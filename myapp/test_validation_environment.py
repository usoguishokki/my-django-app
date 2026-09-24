"""Safety boundary tests: all database connections are fake; no Oracle access."""

import io
import json
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db.backends.signals import connection_created
from django.template.loader import render_to_string
from django.test import RequestFactory, SimpleTestCase, override_settings

from myapp.context_processors import validation_environment
from myapp.infrastructure.marp.connection import MarpUnavailable, marp_connection
from myapp.validation import ValidationAppConfig
from myproject.validation import (
    EXPECTED_IDENTITY, IDENTITY_SQL, ValidationSafetyError, verify_validation_connection,
)


ROOT = Path(__file__).resolve().parent.parent
VALIDATION_ENV = {
    "NIKA_VALIDATION_MODE": "1",
    "NIKA_VALIDATION_SECRET_KEY": "synthetic-validation-secret",
    "HOZEN_VALIDATION_HOST": "oracle.example.invalid",
    "HOZEN_VALIDATION_PORT": "1521",
    "HOZEN_VALIDATION_SERVICE": "hozenpdb.ad.toyota-shokki.co.jp",
    "HOZEN_VALIDATION_USER": "NIKA_TEST_USER",
    "HOZEN_VALIDATION_PASSWORD": "synthetic-validation-password",
}
NORMAL_ENV = {
    "DJANGO_SECRET_KEY": "synthetic-normal-secret",
    "DJANGO_ALLOWED_HOSTS": "normal.example.invalid, localhost ",
    "ORACLE_DATABASE_NAME": "normal.example.invalid/service",
    "ORACLE_DATABASE_USER": "MYDJANGO_USER",
    "ORACLE_DATABASE_PASSWORD": "synthetic-normal-password",
    "MARP_DB_DRIVER": "SQL Server",
    "MARP_DB_SERVER": "marp.example.invalid",
    "MARP_DB_NAME": "synthetic-marp",
    "MARP_DB_USERNAME": "synthetic-marp-user",
    "MARP_DB_PASSWORD": "synthetic-marp-password",
}


def inspect_settings(module, environment):
    """Fresh interpreter; block dotenv IO and inspect settings without setup()."""
    script = '''
import importlib, json, os, sys
from unittest.mock import patch
environment = json.loads(sys.stdin.read())
with patch.dict(os.environ, environment, clear=True), patch('dotenv.load_dotenv') as load:
    try:
        module = importlib.import_module(sys.argv[1])
        names = ['DATABASES', 'MARP_DATABASE', 'MARP_ENABLED', 'SECRET_KEY', 'DEBUG',
                 'ALLOWED_HOSTS', 'CACHES', 'LOGGING', 'SESSION_COOKIE_NAME',
                 'CSRF_COOKIE_NAME', 'CORS_ALLOW_ALL_ORIGINS', 'TEMPLATES']
        result = {name: getattr(module, name, None) for name in names}
        result['normal_loaded'] = 'myproject.settings' in sys.modules
        result['dotenv_files'] = [str(call.args[0]) for call in load.call_args_list]
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'error': str(error), 'type': type(error).__name__}))
'''
    result = subprocess.run(
        [sys.executable, "-B", "-c", script, module], input=json.dumps(environment),
        text=True, capture_output=True, cwd=ROOT, check=True,
    )
    return json.loads(result.stdout)


def fake_connection(identity=None):
    connection = MagicMock(alias="default", vendor="oracle")
    connection.settings_dict = {"USER": "NIKA_TEST_USER"}
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = tuple((identity or EXPECTED_IDENTITY).values())
    return connection, cursor


class ValidationSettingsTests(SimpleTestCase):
    def test_explicit_opt_in_required(self):
        for value in (None, "0", "true"):
            with self.subTest(value=value):
                env = dict(VALIDATION_ENV)
                env.pop("NIKA_VALIDATION_MODE")
                if value is not None:
                    env["NIKA_VALIDATION_MODE"] = value
                self.assertIn("NIKA_VALIDATION_MODE=1", inspect_settings(
                    "myproject.settings_validation", env)["error"])

    def test_every_validation_value_is_required_despite_normal_credentials(self):
        for name in VALIDATION_ENV:
            if name == "NIKA_VALIDATION_MODE":
                continue
            with self.subTest(name=name):
                env = {**NORMAL_ENV, **VALIDATION_ENV}
                del env[name]
                self.assertIn(name, inspect_settings("myproject.settings_validation", env)["error"])

    def test_production_or_arbitrary_user_rejected(self):
        for user in ("MYDJANGO_USER", "OTHER_USER"):
            with self.subTest(user=user):
                result = inspect_settings("myproject.settings_validation", {
                    **VALIDATION_ENV, "HOZEN_VALIDATION_USER": user,
                })
                self.assertIn("must be NIKA_TEST_USER", result["error"])

    def test_wrong_service_and_invalid_dsn_components_rejected(self):
        for name, value in (
            ("HOZEN_VALIDATION_SERVICE", "other-service"),
            ("HOZEN_VALIDATION_HOST", "host/other-service"),
            ("HOZEN_VALIDATION_PORT", "not-a-port"),
            ("HOZEN_VALIDATION_PORT", "0"),
            ("HOZEN_VALIDATION_PORT", "65536"),
        ):
            with self.subTest(name=name, value=value):
                self.assertIn(name, inspect_settings("myproject.settings_validation", {
                    **VALIDATION_ENV, name: value,
                })["error"])

    def test_no_normal_settings_or_credentials_or_dotenv_loaded(self):
        result = inspect_settings("myproject.settings_validation", VALIDATION_ENV)
        self.assertNotIn("error", result)
        self.assertFalse(result["normal_loaded"])
        self.assertEqual([Path(p).name for p in result["dotenv_files"]], [".env.validation"])
        self.assertEqual(result["DATABASES"]["default"]["USER"], "NIKA_TEST_USER")
        self.assertEqual(result["SECRET_KEY"], VALIDATION_ENV["NIKA_VALIDATION_SECRET_KEY"])
        self.assertEqual(result["MARP_DATABASE"], {})
        self.assertFalse(result["MARP_ENABLED"])

    def test_normal_credentials_cannot_override_validation(self):
        result = inspect_settings("myproject.settings_validation", {**NORMAL_ENV, **VALIDATION_ENV})
        serialized = json.dumps(result)
        for name in ("ORACLE_DATABASE_PASSWORD", "MARP_DB_PASSWORD", "DJANGO_SECRET_KEY"):
            self.assertNotIn(NORMAL_ENV[name], serialized)

    def test_cache_log_cookie_and_host_isolation(self):
        validation = inspect_settings("myproject.settings_validation", VALIDATION_ENV)
        normal = inspect_settings("myproject.settings", NORMAL_ENV)
        self.assertEqual(validation["CACHES"]["default"]["BACKEND"],
                         "django.core.cache.backends.locmem.LocMemCache")
        self.assertNotEqual(validation["CACHES"], normal["CACHES"])
        self.assertNotIn("filename", json.dumps(validation["LOGGING"]))
        self.assertIn("inetpub", json.dumps(normal["LOGGING"]))
        self.assertEqual(validation["SESSION_COOKIE_NAME"], "nika_validation_sessionid")
        self.assertEqual(validation["CSRF_COOKIE_NAME"], "nika_validation_csrftoken")
        from django.conf import global_settings
        self.assertNotEqual(validation["SESSION_COOKIE_NAME"], global_settings.SESSION_COOKIE_NAME)
        self.assertNotEqual(validation["CSRF_COOKIE_NAME"], global_settings.CSRF_COOKIE_NAME)
        self.assertEqual(validation["ALLOWED_HOSTS"], ["127.0.0.1", "localhost", "[::1]"])
        self.assertFalse(validation["CORS_ALLOW_ALL_ORIGINS"])
        self.assertFalse(validation["DEBUG"])

    def test_normal_settings_keep_existing_environment_semantics(self):
        for debug in ("false", "true"):
            with self.subTest(debug=debug):
                result = inspect_settings("myproject.settings", {**NORMAL_ENV, "DJANGO_DEBUG": debug})
                self.assertEqual(result["DEBUG"], debug == "true")
                self.assertEqual(result["ALLOWED_HOSTS"], ["normal.example.invalid", "localhost"])
                self.assertEqual(result["DATABASES"], {"default": {
                    "ENGINE": "django.db.backends.oracle",
                    "NAME": NORMAL_ENV["ORACLE_DATABASE_NAME"],
                    "USER": NORMAL_ENV["ORACLE_DATABASE_USER"],
                    "PASSWORD": NORMAL_ENV["ORACLE_DATABASE_PASSWORD"],
                }})
                self.assertEqual(result["MARP_DATABASE"]["PORT"], "1433")
                self.assertEqual(result["MARP_DATABASE"]["PASSWORD"], NORMAL_ENV["MARP_DB_PASSWORD"])
                self.assertEqual(result["SECRET_KEY"], NORMAL_ENV["DJANGO_SECRET_KEY"])
                self.assertTrue(result["CORS_ALLOW_ALL_ORIGINS"])
                self.assertNotIn("validation_environment", json.dumps(result["TEMPLATES"]))


class ValidationGuardTests(SimpleTestCase):
    def test_correct_identity_uses_only_select(self):
        connection, cursor = fake_connection()
        self.assertEqual(verify_validation_connection(connection=connection), EXPECTED_IDENTITY)
        cursor.execute.assert_called_once_with(IDENTITY_SQL)
        self.assertTrue(IDENTITY_SQL.startswith("SELECT "))
        self.assertNotIn("ALTER", IDENTITY_SQL)
        connection.close.assert_not_called()

    def test_each_wrong_identity_field_rejects_and_closes(self):
        for field in EXPECTED_IDENTITY:
            with self.subTest(field=field):
                connection, _ = fake_connection({**EXPECTED_IDENTITY, field: "unexpected-sensitive-value"})
                with self.assertRaisesMessage(ValidationSafetyError, field) as error:
                    verify_validation_connection(connection=connection)
                self.assertNotIn("unexpected-sensitive-value", str(error.exception))
                connection.close.assert_called_once()

    def test_query_failure_rejects_closes_and_sanitizes(self):
        connection, cursor = fake_connection()
        cursor.execute.side_effect = RuntimeError("synthetic-secret-in-driver-error")
        with self.assertRaisesMessage(ValidationSafetyError, "could not be verified") as error:
            verify_validation_connection(connection=connection)
        self.assertNotIn("synthetic-secret", str(error.exception))
        connection.close.assert_called_once()

    def test_invalid_identity_result_rejects(self):
        for row in (None, (), ("NIKA_TEST_USER",)):
            connection, cursor = fake_connection()
            cursor.fetchone.return_value = row
            with self.assertRaises(ValidationSafetyError):
                verify_validation_connection(connection=connection)
            connection.close.assert_called_once()

    def test_invalid_alias_vendor_or_configured_user_rejects(self):
        for attribute, value in (("alias", "other"), ("vendor", "sqlite"),
                                 ("settings_dict", {"USER": "MYDJANGO_USER"})):
            connection, cursor = fake_connection()
            setattr(connection, attribute, value)
            with self.assertRaises(ValidationSafetyError):
                verify_validation_connection(connection=connection)
            connection.close.assert_called_once()
            cursor.execute.assert_not_called()

    def test_close_failure_does_not_disclose_driver_error(self):
        connection, cursor = fake_connection()
        cursor.execute.side_effect = RuntimeError("synthetic-secret")
        connection.close.side_effect = RuntimeError("another-synthetic-secret")
        with self.assertRaisesMessage(ValidationSafetyError, "could not be verified"):
            verify_validation_connection(connection=connection)

    def test_app_config_registers_guard_for_first_and_reconnected_physical_connection(self):
        import myapp
        config = ValidationAppConfig("myapp", myapp)
        uid = "nika.validation.verify_connection"
        try:
            fake_settings = SimpleNamespace(NIKA_VALIDATION_MODE=True, DATABASES={"default": {
                "ENGINE": "django.db.backends.oracle", "USER": "NIKA_TEST_USER",
            }})
            with patch("myapp.validation.settings", fake_settings):
                config.ready()
                config.ready()  # dispatch_uid prevents duplicate receivers.
            connection, cursor = fake_connection()
            connection_created.send(sender=type(connection), connection=connection)
            connection_created.send(sender=type(connection), connection=connection)
            self.assertEqual(cursor.execute.call_count, 2)
        finally:
            connection_created.disconnect(dispatch_uid=uid)

    def test_app_config_rejects_unapproved_configuration(self):
        import myapp
        for mode, databases in (
            (False, {}),
            (True, {"default": {"ENGINE": "django.db.backends.oracle", "USER": "MYDJANGO_USER"}}),
            (True, {"default": {}, "other": {}}),
        ):
            with patch("myapp.validation.settings", SimpleNamespace(
                NIKA_VALIDATION_MODE=mode, DATABASES=databases,
            )), self.assertRaises(ValidationSafetyError):
                ValidationAppConfig("myapp", myapp).ready()

    def test_real_django_connect_lifecycle_discards_bad_physical_connection(self):
        # Use the backend wrapper with a mocked driver factory. No socket or
        # Oracle client initialization is involved, but connect()/close() are real.
        from django.db.backends.oracle.base import DatabaseWrapper
        config = {
            "ENGINE": "django.db.backends.oracle", "USER": "NIKA_TEST_USER",
            "NAME": "unused", "PASSWORD": "unused", "HOST": "", "PORT": "",
            "OPTIONS": {}, "TIME_ZONE": None, "AUTOCOMMIT": True,
            "CONN_MAX_AGE": 0, "CONN_HEALTH_CHECKS": False,
        }
        wrapper = DatabaseWrapper(config)
        physical = MagicMock()
        physical.cursor.return_value.fetchone.return_value = tuple(
            {**EXPECTED_IDENTITY, "CURRENT_SCHEMA": "MYDJANGO_USER"}.values()
        )
        uid = "nika.validation.lifecycle_test"
        connection_created.connect(verify_validation_connection, dispatch_uid=uid)
        try:
            with patch.object(wrapper, "get_new_connection", return_value=physical), \
                 patch.object(wrapper, "init_connection_state"):
                with self.assertRaises(ValidationSafetyError):
                    wrapper.ensure_connection()
                self.assertIsNone(wrapper.connection)
                physical.close.assert_called_once()
                physical.cursor.return_value.fetchone.return_value = tuple(EXPECTED_IDENTITY.values())
                wrapper.ensure_connection()
                wrapper.close()
                wrapper.ensure_connection()
                self.assertEqual(physical.cursor.return_value.execute.call_count, 3)
        finally:
            wrapper.close()
            connection_created.disconnect(dispatch_uid=uid)


class ValidationIntegrationTests(SimpleTestCase):
    @override_settings(MARP_ENABLED=False, MARP_DATABASE={})
    def test_marp_disabled_before_driver_connection(self):
        with patch("myapp.infrastructure.marp.connection.pyodbc.connect") as connect:
            with self.assertRaisesMessage(MarpUnavailable, "unavailable"):
                with marp_connection():
                    self.fail("MARP connection must not open")
            connect.assert_not_called()

    @override_settings(MARP_ENABLED=True, MARP_DATABASE={
        "DRIVER": "SQL Server", "SERVER": "example.invalid", "PORT": "1433",
        "NAME": "synthetic", "USER": "synthetic", "PASSWORD": "synthetic",
    })
    def test_normal_marp_connection_unchanged(self):
        with patch("myapp.infrastructure.marp.connection.pyodbc.connect") as connect:
            with marp_connection() as connection:
                self.assertIs(connection, connect.return_value)
            connect.assert_called_once()
            connect.return_value.close.assert_called_once()

    def test_parts_api_reports_disabled_feature(self):
        from myapp.api.parts_search.parts_search import parts_search_api
        request = RequestFactory().get("/api/parts-search/")
        request.user = SimpleNamespace(is_authenticated=True)
        with patch("myapp.api.parts_search.parts_search.search_parts", side_effect=MarpUnavailable):
            response = parts_search_api(request)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(json.loads(response.content)["error"]["code"], "feature_unavailable")

    @override_settings(STATICFILES_STORAGE="django.contrib.staticfiles.storage.StaticFilesStorage")
    def test_marker_and_title_on_application_login_and_admin_only_in_validation(self):
        for enabled in (False, True):
            with override_settings(NIKA_VALIDATION_MODE=enabled):
                context = validation_environment(None)
                for template in ("base.html", "login.html", "admin/base_site.html"):
                    with self.subTest(enabled=enabled, template=template):
                        html = render_to_string(template, {**context, "title": "Nika", "is_popup": False})
                        self.assertEqual("検証環境 / VALIDATION" in html, enabled)
                        title = html.split("<title>")[1].split("</title>")[0]
                        self.assertEqual("[検証環境]" in title, enabled)

    def test_preflight_refuses_normal_settings_without_connecting(self):
        with override_settings(NIKA_VALIDATION_MODE=False), \
             patch("myapp.management.commands.validate_validation_environment.connections") as connections:
            with self.assertRaises(CommandError):
                call_command("validate_validation_environment", stdout=io.StringIO())
            connections.__getitem__.assert_not_called()

    def test_preflight_success_and_failure_never_expose_secrets(self):
        from myapp.management.commands.validate_validation_environment import Command
        validation = inspect_settings("myproject.settings_validation", VALIDATION_ENV)
        overrides = {key: validation[key] for key in (
            "CACHES", "MARP_ENABLED", "SESSION_COOKIE_NAME", "CSRF_COOKIE_NAME", "ALLOWED_HOSTS",
        )}
        fake_settings = SimpleNamespace(**overrides, NIKA_VALIDATION_MODE=True,
                                       INSTALLED_APPS=["myapp.validation.ValidationAppConfig"])
        for fail in (False, True):
            output = io.StringIO()
            connection, cursor = fake_connection()
            if fail:
                cursor.execute.side_effect = RuntimeError(VALIDATION_ENV["HOZEN_VALIDATION_PASSWORD"])
            with patch("myapp.management.commands.validate_validation_environment.settings", fake_settings), \
                 patch("myapp.management.commands.validate_validation_environment.connections", {"default": connection}):
                command = Command(stdout=output)
                if fail:
                    with self.assertRaises(CommandError) as error:
                        command.handle()
                    self.assertNotIn(VALIDATION_ENV["HOZEN_VALIDATION_PASSWORD"], str(error.exception))
                else:
                    command.handle()
                    self.assertIn("Actual CURRENT_SCHEMA: NIKA_TEST_USER", output.getvalue())
                connection.close.assert_called()
            for name in ("HOZEN_VALIDATION_PASSWORD", "NIKA_VALIDATION_SECRET_KEY"):
                self.assertNotIn(VALIDATION_ENV[name], output.getvalue())

    def test_preflight_cleanup_error_is_sanitized(self):
        from myapp.management.commands.validate_validation_environment import Command
        config = SimpleNamespace(
            NIKA_VALIDATION_MODE=True, INSTALLED_APPS=["myapp.validation.ValidationAppConfig"],
            CACHES={"default": {"BACKEND": "local-memory"}}, MARP_ENABLED=False,
            SESSION_COOKIE_NAME="nika_validation_sessionid", CSRF_COOKIE_NAME="nika_validation_csrftoken",
            ALLOWED_HOSTS=["127.0.0.1"],
        )
        connection, _ = fake_connection()
        connection.close.side_effect = RuntimeError("synthetic-sensitive-driver-message")
        with patch("myapp.management.commands.validate_validation_environment.settings", config), \
             patch("myapp.management.commands.validate_validation_environment.connections", {"default": connection}):
            with self.assertRaisesMessage(CommandError, "connection cleanup failed") as error:
                Command(stdout=io.StringIO()).handle()
            self.assertNotIn("synthetic-sensitive", str(error.exception))
