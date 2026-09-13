"""Explicitly activated safeguards for browser verification settings."""

from __future__ import annotations

import os

from django.conf import settings
from django.contrib.auth.signals import user_logged_in
from django.db.backends.signals import connection_created

from scripts.research.oracle_readonly import (
    EXPECTED_USER,
    EXPECTED_OBJECT_OWNER,
    ResearchSafetyError,
    _verify_connection,
)
from myapp.apps import MyappConfig


def _verify_readonly_database_connection(*, connection, **_kwargs) -> None:
    if connection.alias != "default" or connection.vendor != "oracle":
        raise ResearchSafetyError(
            "Browser verification requires the default Oracle connection"
        )

    with connection.cursor() as cursor:
        # Django model queries are unqualified; resolve them against the
        # read-only application's approved object owner.
        cursor.execute(
            f"ALTER SESSION SET CURRENT_SCHEMA = {EXPECTED_OBJECT_OWNER}"
        )
        _verify_connection(cursor)


class BrowserVerificationAppConfig(MyappConfig):

    def ready(self) -> None:
        from django.contrib.auth.models import update_last_login

        super().ready()

        if os.environ.get("NIKA_ZERO_WRITE_BROWSER_VERIFY") != "1":
            raise RuntimeError(
                "BrowserVerificationAppConfig requires the explicit "
                "zero-write verification flag"
            )

        database_user = str(
            settings.DATABASES["default"].get("USER", "")
        ).upper()
        if database_user != EXPECTED_USER:
            raise ResearchSafetyError(
                "Browser verification must use HOZEN_READONLY"
            )

        import cx_Oracle

        cx_Oracle.init_oracle_client(
            config_dir=settings.BROWSER_VERIFICATION_ORACLE_CONFIG.name
        )

        user_logged_in.disconnect(
            update_last_login,
            dispatch_uid="update_last_login",
        )
        connection_created.connect(
            _verify_readonly_database_connection,
            dispatch_uid="nika.browser_verification.verify_readonly_connection",
        )
