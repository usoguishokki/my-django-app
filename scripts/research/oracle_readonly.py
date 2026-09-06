"""Fail-closed Oracle research CLI for the dedicated read-only account."""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import decimal
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Iterable, Mapping, Sequence


EXPECTED_USER = "HOZEN_READONLY"
EXPECTED_CONTAINER = "HOZENPDB"
EXPECTED_ROLE = "HOZEN_APP_READ_ROLE"
APPROVED_ROLES = frozenset({EXPECTED_ROLE})
APPROVED_SYSTEM_PRIVILEGES = frozenset({"CREATE SESSION"})
EXPECTED_OBJECT_OWNER = "MYDJANGO_USER"
APPROVED_OBJECT_OWNERS = frozenset({EXPECTED_OBJECT_OWNER})
APPROVED_OBJECT_PRIVILEGES = frozenset({"READ", "SELECT"})
SQLNET_CONTENT = "SQLNET.AUTHENTICATION_SERVICES = (NONE)"
ENVIRONMENT_VARIABLES = (
    "HOZEN_READONLY_HOST",
    "HOZEN_READONLY_PORT",
    "HOZEN_READONLY_SERVICE",
    "HOZEN_READONLY_USER",
    "HOZEN_READONLY_PASSWORD",
)


class ResearchSafetyError(RuntimeError):
    """Raised when a fail-closed research safety check fails."""


def load_connection_settings(environment: Mapping[str, str]) -> dict[str, str]:
    missing = [name for name in ENVIRONMENT_VARIABLES if not environment.get(name)]
    if missing:
        raise ResearchSafetyError(
            "Missing dedicated research environment variables: " + ", ".join(missing)
        )
    settings = {name: environment[name] for name in ENVIRONMENT_VARIABLES}
    if settings["HOZEN_READONLY_USER"].upper() != EXPECTED_USER:
        raise ResearchSafetyError("The dedicated research username must be HOZEN_READONLY")
    try:
        port = int(settings["HOZEN_READONLY_PORT"])
    except ValueError as exc:
        raise ResearchSafetyError("HOZEN_READONLY_PORT must be an integer") from exc
    if not 1 <= port <= 65535:
        raise ResearchSafetyError("HOZEN_READONLY_PORT is outside the valid range")
    return settings


def _mask_literals_and_comments(sql: str) -> str:
    """Preserve SQL structure while masking quoted text and comments."""
    result: list[str] = []
    index = 0
    state = "normal"
    while index < len(sql):
        char = sql[index]
        following = sql[index + 1] if index + 1 < len(sql) else ""
        if state == "normal":
            if char == "'":
                state = "string"
                result.append(" ")
            elif char == '"':
                state = "identifier"
                result.append(" ")
            elif char == "-" and following == "-":
                state = "line_comment"
                result.extend("  ")
                index += 1
            elif char == "/" and following == "*":
                state = "block_comment"
                result.extend("  ")
                index += 1
            else:
                result.append(char)
        elif state == "string":
            result.append("\n" if char == "\n" else " ")
            if char == "'" and following == "'":
                result.append(" ")
                index += 1
            elif char == "'":
                state = "normal"
        elif state == "identifier":
            result.append("\n" if char == "\n" else " ")
            if char == '"' and following == '"':
                result.append(" ")
                index += 1
            elif char == '"':
                state = "normal"
        elif state == "line_comment":
            result.append("\n" if char == "\n" else " ")
            if char == "\n":
                state = "normal"
        elif state == "block_comment":
            result.append("\n" if char == "\n" else " ")
            if char == "*" and following == "/":
                result.append(" ")
                index += 1
                state = "normal"
        index += 1
    if state in {"string", "identifier", "block_comment"}:
        raise ResearchSafetyError("SQL contains an unterminated literal, identifier, or comment")
    return "".join(result)


def validate_sql(sql: str) -> str:
    if not sql or not sql.strip():
        raise ResearchSafetyError("SQL is required")
    masked = _mask_literals_and_comments(sql)
    semicolons = [match.start() for match in re.finditer(";", masked)]
    if semicolons:
        tail = masked[semicolons[-1] + 1 :]
        if len(semicolons) != 1 or tail.strip():
            raise ResearchSafetyError("Multiple SQL statements are not allowed")
        sql = sql[: semicolons[0]].rstrip()
        masked = masked[: semicolons[0]]
    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_$#]*", masked.upper())
    if not tokens or tokens[0] not in {"SELECT", "WITH"}:
        raise ResearchSafetyError("Only SELECT and WITH ... SELECT are allowed")
    if tokens[0] == "WITH" and "SELECT" not in tokens:
        raise ResearchSafetyError("WITH must lead to a SELECT statement")
    forbidden = {
        "INSERT", "UPDATE", "DELETE", "MERGE", "CREATE", "ALTER", "DROP",
        "TRUNCATE", "GRANT", "REVOKE", "BEGIN", "DECLARE", "CALL", "EXECUTE",
    }
    found = forbidden.intersection(tokens)
    if found:
        raise ResearchSafetyError("Forbidden SQL keyword: " + sorted(found)[0])
    pairs = set(zip(tokens, tokens[1:]))
    if ("FOR", "UPDATE") in pairs:
        raise ResearchSafetyError("SELECT ... FOR UPDATE is not allowed")
    if ("LOCK", "TABLE") in pairs:
        raise ResearchSafetyError("LOCK TABLE is not allowed")
    return sql


def verify_identity(user: str, container: str, roles: Iterable[str], privileges: Iterable[str]) -> None:
    normalized_roles = {value.upper() for value in roles}
    normalized_privileges = {value.upper() for value in privileges}
    if user.upper() != EXPECTED_USER:
        raise ResearchSafetyError(f"Unexpected Oracle user: {user}")
    if container.upper() != EXPECTED_CONTAINER:
        raise ResearchSafetyError(f"Unexpected Oracle container: {container}")
    if normalized_roles != APPROVED_ROLES:
        raise ResearchSafetyError("Oracle roles do not match the approved research role set")
    if normalized_privileges != APPROVED_SYSTEM_PRIVILEGES:
        raise ResearchSafetyError(
            "Oracle system privileges do not match the approved research privilege set"
        )


def verify_object_privileges(grants: Iterable[tuple[str, str]]) -> None:
    normalized_grants = {(owner.upper(), privilege.upper()) for owner, privilege in grants}
    unexpected = {
        (owner, privilege)
        for owner, privilege in normalized_grants
        if owner not in APPROVED_OBJECT_OWNERS
        or privilege not in APPROVED_OBJECT_PRIVILEGES
    }
    if unexpected:
        raise ResearchSafetyError(
            "Object grants exceed the approved owner and read-only privilege scope"
        )


@contextlib.contextmanager
def isolated_oracle_client():
    """Initialize cx_Oracle with a temporary, process-local sqlnet.ora."""
    with tempfile.TemporaryDirectory(prefix="hozen_readonly_oracle_") as directory:
        config_path = Path(directory) / "sqlnet.ora"
        config_path.write_bytes(SQLNET_CONTENT.encode("ascii"))
        try:
            import cx_Oracle

            cx_Oracle.init_oracle_client(config_dir=directory)
        except Exception as exc:
            raise ResearchSafetyError(
                "Could not safely initialize Oracle Client with the temporary "
                "research configuration; no connection was attempted"
            ) from exc
        yield cx_Oracle


def _fetch_identity(cursor) -> tuple[str, str, set[str], set[str]]:
    cursor.execute(
        "SELECT SYS_CONTEXT('USERENV', 'SESSION_USER'), "
        "SYS_CONTEXT('USERENV', 'CON_NAME') FROM DUAL"
    )
    user, container = cursor.fetchone()
    cursor.execute("SELECT ROLE FROM SESSION_ROLES")
    roles = {row[0] for row in cursor.fetchall()}
    cursor.execute("SELECT PRIVILEGE FROM SESSION_PRIVS")
    privileges = {row[0] for row in cursor.fetchall()}
    return user, container, roles, privileges


def _fetch_effective_object_privileges(cursor) -> set[tuple[str, str]]:
    """Return direct and active research-role grants, intentionally excluding PUBLIC."""
    cursor.execute("SELECT OWNER, PRIVILEGE FROM USER_TAB_PRIVS_RECD")
    grants = {(row[0], row[1]) for row in cursor.fetchall()}
    cursor.execute("SELECT OWNER, PRIVILEGE FROM USER_COL_PRIVS_RECD")
    grants.update((row[0], row[1]) for row in cursor.fetchall())
    cursor.execute(
        "SELECT OWNER, PRIVILEGE FROM ROLE_TAB_PRIVS WHERE ROLE = :role",
        role=EXPECTED_ROLE,
    )
    grants.update((row[0], row[1]) for row in cursor.fetchall())
    return grants


def _fetch_public_object_privileges(cursor) -> set[tuple[str, str]]:
    """Return PUBLIC grants only for objects in approved application schemas."""
    grants: set[tuple[str, str]] = set()
    public_sources = (
        ("ALL_TAB_PRIVS", "TABLE_SCHEMA", " AND TYPE <> 'USER'"),
        ("ALL_COL_PRIVS", "TABLE_SCHEMA", ""),
    )
    for view, owner_column, object_filter in public_sources:
        cursor.execute(
            f"SELECT {owner_column}, PRIVILEGE FROM {view} "
            f"WHERE GRANTEE = 'PUBLIC' AND {owner_column} = :owner{object_filter}",
            owner=EXPECTED_OBJECT_OWNER,
        )
        grants.update((row[0], row[1]) for row in cursor.fetchall())
    return grants


def _verify_connection(cursor) -> None:
    verify_identity(*_fetch_identity(cursor))
    verify_object_privileges(_fetch_effective_object_privileges(cursor))
    verify_object_privileges(_fetch_public_object_privileges(cursor))


def execute_query(sql: str, environment: Mapping[str, str]) -> tuple[list[str], list[tuple]]:
    sql = validate_sql(sql)
    settings = load_connection_settings(environment)
    with isolated_oracle_client() as oracle:
        dsn = oracle.makedsn(
            settings["HOZEN_READONLY_HOST"],
            int(settings["HOZEN_READONLY_PORT"]),
            service_name=settings["HOZEN_READONLY_SERVICE"],
        )
        connection = None
        cursor = None
        try:
            connection = oracle.connect(
                user=settings["HOZEN_READONLY_USER"],
                password=settings["HOZEN_READONLY_PASSWORD"],
                dsn=dsn,
                encoding="UTF-8",
                nencoding="UTF-8",
            )
            cursor = connection.cursor()
            cursor.execute("SET TRANSACTION READ ONLY")
            _verify_connection(cursor)
            cursor.execute(sql)
            columns = [item[0] for item in cursor.description]
            return columns, cursor.fetchall()
        finally:
            if cursor is not None:
                cursor.close()
            if connection is not None:
                connection.close()


def _json_value(value):
    if isinstance(value, (dt.date, dt.datetime, dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    return value


def format_json(columns: Sequence[str], rows: Sequence[Sequence[object]]) -> str:
    records = [dict(zip(columns, (_json_value(value) for value in row))) for row in rows]
    return json.dumps(records, ensure_ascii=True, indent=2)


def format_table(columns: Sequence[str], rows: Sequence[Sequence[object]]) -> str:
    rendered = [["" if value is None else str(value) for value in row] for row in rows]
    widths = [len(column) for column in columns]
    for row in rendered:
        widths = [max(width, len(value)) for width, value in zip(widths, row)]
    lines = [" | ".join(value.ljust(width) for value, width in zip(columns, widths))]
    lines.append("-+-".join("-" * width for width in widths))
    lines.extend(" | ".join(value.ljust(width) for value, width in zip(row, widths)) for row in rendered)
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sql", help="A single SELECT statement (otherwise read from stdin)")
    parser.add_argument("--format", choices=("table", "json"), default="table")
    args = parser.parse_args(argv)
    sql = args.sql if args.sql is not None else sys.stdin.read()
    try:
        columns, rows = execute_query(sql, os.environ)
        output = format_json(columns, rows) if args.format == "json" else format_table(columns, rows)
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="strict")
        print(output)
        return 0
    except ResearchSafetyError as exc:
        print(f"Oracle research query failed: {exc}", file=sys.stderr)
        return 1
    except Exception:
        # Driver errors can contain connection details; keep failure output sanitized.
        print("Oracle research query failed: Oracle operation was unsuccessful", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
