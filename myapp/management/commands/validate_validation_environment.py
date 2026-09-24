"""Read-only preflight. Does not establish schema or privilege readiness."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections

from myproject.validation import EXPECTED_IDENTITY, verify_validation_connection


class Command(BaseCommand):
    help = "Verify the dedicated local validation configuration and Oracle identity."
    requires_system_checks = []

    def handle(self, *args, **options):
        if (
            not getattr(settings, "NIKA_VALIDATION_MODE", False)
            or "myapp.validation.ValidationAppConfig" not in settings.INSTALLED_APPS
        ):
            raise CommandError("Use --settings=myproject.settings_validation.")
        self.stdout.write("Validation settings: active")
        for key, value in EXPECTED_IDENTITY.items():
            self.stdout.write(f"Expected {key}: {value}")
        self.stdout.write(f"Cache: {settings.CACHES['default']['BACKEND']}")
        self.stdout.write("Logs: console (stderr)")
        self.stdout.write(f"MARP disabled: {settings.MARP_ENABLED is False}")
        self.stdout.write(f"Session cookie: {settings.SESSION_COOKIE_NAME}")
        self.stdout.write(f"CSRF cookie: {settings.CSRF_COOKIE_NAME}")
        self.stdout.write(f"Allowed hosts: {', '.join(settings.ALLOWED_HOSTS)}")
        self.stdout.write("Bind the runtime to 127.0.0.1:8011; ALLOWED_HOSTS is not a bind control.")
        connection = connections["default"]
        try:
            identity = verify_validation_connection(connection=connection)
            for key, value in identity.items():
                self.stdout.write(f"Actual {key}: {value}")
        except Exception:
            # Driver errors may contain secrets; do not print or chain them.
            raise CommandError(
                "Validation preflight failed: connection unavailable or identity rejected. "
                "No fallback connection was attempted."
            ) from None
        finally:
            try:
                connection.close()
            except Exception:
                raise CommandError("Validation preflight failed: connection cleanup failed.") from None
        self.stdout.write("Identity verified. Schema, grants and writable readiness are NOT certified.")
