import importlib
import os
from types import SimpleNamespace
from unittest import TestCase, mock

from django.contrib.auth.models import update_last_login
from django.contrib.auth.signals import user_logged_in
from django.db.backends.signals import connection_created
from django.test import override_settings

from myapp.browser_verification import (
    BrowserVerificationAppConfig,
    _verify_readonly_database_connection,
)
from scripts.research.oracle_readonly import ResearchSafetyError


class BrowserVerificationSafetyTests(TestCase):
    @mock.patch.dict(
        os.environ,
        {"NIKA_ZERO_WRITE_BROWSER_VERIFY": "1"},
    )
    @override_settings(
        DATABASES={"default": {"USER": "HOZEN_READONLY"}},
        BROWSER_VERIFICATION_ORACLE_CONFIG=SimpleNamespace(name="test-config"),
    )
    @mock.patch("cx_Oracle.init_oracle_client")
    @mock.patch.object(connection_created, "connect")
    @mock.patch.object(user_logged_in, "disconnect")
    def test_ready_disables_last_login_write_and_registers_connection_guard(
        self,
        disconnect,
        connect,
        init_oracle_client,
    ):
        config = BrowserVerificationAppConfig(
            "myapp",
            importlib.import_module("myapp"),
        )

        config.ready()

        init_oracle_client.assert_called_once_with(config_dir="test-config")
        disconnect.assert_called_once_with(
            update_last_login,
            dispatch_uid="update_last_login",
        )
        connect.assert_called_once_with(
            _verify_readonly_database_connection,
            dispatch_uid=(
                "nika.browser_verification.verify_readonly_connection"
            ),
        )

    @mock.patch.dict(
        os.environ,
        {"NIKA_ZERO_WRITE_BROWSER_VERIFY": "1"},
    )
    @override_settings(
        DATABASES={"default": {"USER": "APPLICATION_USER"}},
        BROWSER_VERIFICATION_ORACLE_CONFIG=SimpleNamespace(name="test-config"),
    )
    def test_ready_rejects_write_capable_database_identity(self):
        config = BrowserVerificationAppConfig(
            "myapp",
            importlib.import_module("myapp"),
        )

        with self.assertRaisesRegex(
            ResearchSafetyError,
            "must use HOZEN_READONLY",
        ):
            config.ready()

    @mock.patch("myapp.browser_verification._verify_connection")
    def test_connection_guard_verifies_the_open_oracle_connection(self, verify):
        cursor = mock.MagicMock()
        cursor_context = mock.MagicMock()
        cursor_context.__enter__.return_value = cursor
        connection = SimpleNamespace(
            alias="default",
            vendor="oracle",
            cursor=mock.Mock(return_value=cursor_context),
        )

        _verify_readonly_database_connection(connection=connection)

        cursor.execute.assert_called_once_with(
            "ALTER SESSION SET CURRENT_SCHEMA = MYDJANGO_USER"
        )
        verify.assert_called_once_with(cursor)

    def test_connection_guard_rejects_non_oracle_connections(self):
        connection = SimpleNamespace(alias="default", vendor="sqlite")

        with self.assertRaisesRegex(
            ResearchSafetyError,
            "requires the default Oracle connection",
        ):
            _verify_readonly_database_connection(connection=connection)
