"""Django connection lifecycle integration for writable validation only."""

from django.conf import settings
from django.db.backends.signals import connection_created

from myapp.apps import MyappConfig
from myproject.validation import ValidationSafetyError, verify_validation_connection


class ValidationAppConfig(MyappConfig):
    def ready(self):
        super().ready()
        if not getattr(settings, "NIKA_VALIDATION_MODE", False):
            raise ValidationSafetyError("ValidationAppConfig requires validation settings.")
        if set(settings.DATABASES) != {"default"}:
            raise ValidationSafetyError("Validation permits only the default database alias.")
        database = settings.DATABASES["default"]
        if (
            database.get("ENGINE") != "django.db.backends.oracle"
            or database.get("USER") != "NIKA_TEST_USER"
        ):
            raise ValidationSafetyError("Validation requires the dedicated Oracle account.")
        connection_created.connect(
            verify_validation_connection,
            dispatch_uid="nika.validation.verify_connection",
        )
