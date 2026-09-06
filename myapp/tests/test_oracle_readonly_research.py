from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.research.oracle_readonly import (
    APPROVED_OBJECT_OWNERS,
    APPROVED_OBJECT_PRIVILEGES,
    APPROVED_ROLES,
    APPROVED_SYSTEM_PRIVILEGES,
    ENVIRONMENT_VARIABLES,
    EXPECTED_CONTAINER,
    EXPECTED_ROLE,
    EXPECTED_USER,
    ResearchSafetyError,
    SQLNET_CONTENT,
    format_json,
    isolated_oracle_client,
    load_connection_settings,
    validate_sql,
    verify_identity,
    verify_object_privileges,
)


class SqlValidationTests(unittest.TestCase):
    def test_allows_select_with_whitespace_and_comments(self):
        allowed = (
            "SELECT * FROM example",
            "  \n SELECT value FROM example;  ",
            "-- research only\nSELECT value FROM example",
            "/* supported leading comment */ WITH sample AS "
            "(SELECT 1 value FROM dual) SELECT value FROM sample",
            "SELECT 'DROP; 日本語' value FROM dual",
        )
        for sql in allowed:
            with self.subTest(sql=sql):
                self.assertTrue(validate_sql(sql))

    def test_rejects_mutation_ddl_plsql_locking_and_multiple_statements(self):
        rejected = (
            "INSERT INTO t VALUES (1)", "UPDATE t SET x = 1", "DELETE FROM t",
            "MERGE INTO t USING s ON (1=1) WHEN MATCHED THEN UPDATE SET x=1",
            "CREATE TABLE t (x NUMBER)", "ALTER TABLE t ADD x NUMBER", "DROP TABLE t",
            "TRUNCATE TABLE t", "GRANT SELECT ON t TO u", "REVOKE SELECT ON t FROM u",
            "BEGIN NULL; END;", "DECLARE x NUMBER; BEGIN NULL; END;", "CALL p()",
            "EXECUTE p", "LOCK TABLE t IN EXCLUSIVE MODE",
            "SELECT * FROM t FOR UPDATE", "SELECT 1 FROM dual; SELECT 2 FROM dual",
            "WITH changed AS (DELETE FROM t) SELECT * FROM changed",
        )
        for sql in rejected:
            with self.subTest(sql=sql), self.assertRaises(ResearchSafetyError):
                validate_sql(sql)

    def test_json_is_ascii_safe_and_unicode_is_lossless(self):
        output = format_json(["DATE_ALIAS"], [["3月4週目"]])
        output.encode("ascii")
        self.assertEqual("3月4週目", json.loads(output)[0]["DATE_ALIAS"])


class ConnectionContractTests(unittest.TestCase):
    def test_missing_environment_variables_fail_closed(self):
        with self.assertRaisesRegex(ResearchSafetyError, "Missing dedicated"):
            load_connection_settings({})

    def test_production_username_is_rejected(self):
        values = {name: "value" for name in ENVIRONMENT_VARIABLES}
        values["HOZEN_READONLY_PORT"] = "1521"
        values["HOZEN_READONLY_USER"] = "application_user"
        with self.assertRaisesRegex(ResearchSafetyError, "HOZEN_READONLY"):
            load_connection_settings(values)

    def test_exact_identity_role_and_system_privilege_contract_passes(self):
        verify_identity(EXPECTED_USER, EXPECTED_CONTAINER, {EXPECTED_ROLE}, APPROVED_SYSTEM_PRIVILEGES)

    def test_unexpected_user_or_container_fails(self):
        cases = (
            ("OTHER", EXPECTED_CONTAINER, {EXPECTED_ROLE}, {"CREATE SESSION"}),
            (EXPECTED_USER, "OTHERPDB", {EXPECTED_ROLE}, {"CREATE SESSION"}),
        )
        for values in cases:
            with self.subTest(values=values), self.assertRaises(ResearchSafetyError):
                verify_identity(*values)

    def test_role_set_must_match_exactly(self):
        self.assertEqual(frozenset({EXPECTED_ROLE}), APPROVED_ROLES)
        for roles in ({EXPECTED_ROLE, "EXTRA_ROLE"}, set()):
            with self.subTest(roles=roles), self.assertRaises(ResearchSafetyError):
                verify_identity(
                    EXPECTED_USER, EXPECTED_CONTAINER, roles, APPROVED_SYSTEM_PRIVILEGES
                )

    def test_system_privilege_set_must_match_exactly(self):
        for privileges in (set(), {"CREATE SESSION", "CREATE USER"}):
            with self.subTest(privileges=privileges), self.assertRaises(ResearchSafetyError):
                verify_identity(EXPECTED_USER, EXPECTED_CONTAINER, APPROVED_ROLES, privileges)

    def test_approved_owner_read_and_select_pass(self):
        self.assertEqual(frozenset({"MYDJANGO_USER"}), APPROVED_OBJECT_OWNERS)
        for privilege in ("READ", "SELECT"):
            with self.subTest(privilege=privilege):
                verify_object_privileges({("MYDJANGO_USER", privilege)})

    def test_other_owner_read_and_select_fail(self):
        for privilege in ("READ", "SELECT"):
            with self.subTest(privilege=privilege), self.assertRaises(ResearchSafetyError):
                verify_object_privileges({("OTHER_SCHEMA", privilege)})

    def test_approved_owner_unsafe_privileges_fail(self):
        verify_object_privileges(set())
        for privilege in ("UPDATE", "DELETE", "EXECUTE"):
            with self.subTest(privilege=privilege), self.assertRaises(ResearchSafetyError):
                verify_object_privileges({("MYDJANGO_USER", privilege)})

    @mock.patch("scripts.research.oracle_readonly._fetch_identity")
    def test_unsafe_public_grant_on_approved_owner_object_fails(self, fetch_identity):
        from scripts.research.oracle_readonly import _verify_connection

        fetch_identity.return_value = (
            EXPECTED_USER, EXPECTED_CONTAINER, {EXPECTED_ROLE}, {"CREATE SESSION"}
        )
        cursor = mock.Mock()
        cursor.fetchall.side_effect = [[], [], [], [("MYDJANGO_USER", "UPDATE")], []]

        with self.assertRaises(ResearchSafetyError):
            _verify_connection(cursor)

        public_queries = [
            call.args[0] for call in cursor.execute.call_args_list if "GRANTEE = 'PUBLIC'" in call.args[0]
        ]
        self.assertEqual(2, len(public_queries))
        self.assertIn("TABLE_SCHEMA = :owner", public_queries[0])
        self.assertIn("TYPE <> 'USER'", public_queries[0])
        self.assertIn("TABLE_SCHEMA = :owner", public_queries[1])
        self.assertTrue(
            all(call.kwargs.get("owner") == "MYDJANGO_USER" for call in cursor.execute.call_args_list[-2:])
        )

    @mock.patch("scripts.research.oracle_readonly._verify_connection")
    @mock.patch("scripts.research.oracle_readonly.isolated_oracle_client")
    def test_read_only_transaction_precedes_verification_and_user_select(
        self, isolated_client, verify_connection
    ):
        from scripts.research.oracle_readonly import execute_query

        events = []
        cursor = mock.Mock()
        cursor.description = [("VALUE",)]
        cursor.fetchall.return_value = [(1,)]
        cursor.execute.side_effect = lambda sql, **kwargs: events.append(sql)
        connection = mock.Mock()
        connection.cursor.return_value = cursor
        oracle = mock.Mock()
        oracle.connect.side_effect = lambda **kwargs: (events.append("CONNECT") or connection)
        isolated_client.return_value.__enter__.return_value = oracle
        verify_connection.side_effect = lambda current_cursor: events.append("VERIFY")
        environment = {name: "value" for name in ENVIRONMENT_VARIABLES}
        environment["HOZEN_READONLY_PORT"] = "1521"
        environment["HOZEN_READONLY_USER"] = EXPECTED_USER

        execute_query("SELECT 1 FROM DUAL", environment)

        self.assertEqual(
            ["CONNECT", "SET TRANSACTION READ ONLY", "VERIFY", "SELECT 1 FROM DUAL"],
            events,
        )

    def test_temporary_sqlnet_content_and_cleanup(self):
        observed = {}

        def initialize(*, config_dir):
            path = Path(config_dir)
            observed["directory"] = path
            observed["content"] = (path / "sqlnet.ora").read_text(encoding="ascii")

        fake_module = mock.Mock(init_oracle_client=initialize)
        with mock.patch.dict("sys.modules", {"cx_Oracle": fake_module}):
            with isolated_oracle_client() as returned:
                self.assertIs(returned, fake_module)
                self.assertTrue(observed["directory"].exists())
        self.assertEqual(SQLNET_CONTENT, observed["content"])
        self.assertFalse(observed["directory"].exists())

    def test_cleanup_when_initialization_fails(self):
        directories_before = set(Path(tempfile.gettempdir()).glob("hozen_readonly_oracle_*"))
        fake_module = mock.Mock()
        fake_module.init_oracle_client.side_effect = RuntimeError("already initialized")
        with mock.patch.dict("sys.modules", {"cx_Oracle": fake_module}):
            with self.assertRaisesRegex(ResearchSafetyError, "no connection was attempted"):
                with isolated_oracle_client():
                    pass
        directories_after = set(Path(tempfile.gettempdir()).glob("hozen_readonly_oracle_*"))
        self.assertEqual(directories_before, directories_after)
