# myapp/infrastructure/marp/connection.py

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import pyodbc
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


_REQUIRED_CONFIG_KEYS = (
    "DRIVER",
    "SERVER",
    "PORT",
    "NAME",
    "USER",
    "PASSWORD",
)


def _load_marp_database_config() -> dict[str, str]:
    config = getattr(settings, "MARP_DATABASE", None)

    if not isinstance(config, dict):
        raise ImproperlyConfigured(
            "settings.MARP_DATABASE が定義されていません。"
        )

    normalized_config = {
        key: str(config.get(key) or "").strip()
        for key in _REQUIRED_CONFIG_KEYS
    }

    missing_keys = [
        key
        for key, value in normalized_config.items()
        if not value
    ]

    if missing_keys:
        raise ImproperlyConfigured(
            "MARP_DATABASEで未設定の項目があります: "
            + ", ".join(missing_keys)
        )

    return normalized_config


def _normalize_driver(driver: str) -> str:
    normalized_driver = driver.strip()

    if (
        normalized_driver.startswith("{")
        and normalized_driver.endswith("}")
    ):
        return normalized_driver[1:-1]

    return normalized_driver


def _escape_odbc_value(value: str) -> str:
    """
    ODBC接続文字列の値を波括弧で囲む。

    値に閉じ波括弧が含まれる場合は、
    ODBC接続文字列の規則に従って二重化する。
    """
    escaped_value = value.replace("}", "}}")

    return "{" + escaped_value + "}"


def _build_server_address(
    server: str,
    port: str,
) -> str:
    if not port:
        return server

    return f"{server},{port}"


def build_marp_connection_string() -> str:
    config = _load_marp_database_config()

    driver = _normalize_driver(
        config["DRIVER"]
    )

    server_address = _build_server_address(
        config["SERVER"],
        config["PORT"],
    )

    connection_parts = (
        f"DRIVER={_escape_odbc_value(driver)}",
        f"SERVER={_escape_odbc_value(server_address)}",
        f"DATABASE={_escape_odbc_value(config['NAME'])}",
        f"UID={_escape_odbc_value(config['USER'])}",
        f"PWD={_escape_odbc_value(config['PASSWORD'])}",
    )

    return ";".join(connection_parts) + ";"


@contextmanager
def marp_connection(
    *,
    timeout_seconds: int = 10,
) -> Iterator[pyodbc.Connection]:
    """
    MARP SQL Serverへの接続を提供する。

    withブロック終了時には、正常・異常を問わず
    接続を閉じる。
    """
    connection = pyodbc.connect(
        build_marp_connection_string(),
        timeout=timeout_seconds,
        autocommit=True,
    )

    try:
        yield connection
    finally:
        connection.close()