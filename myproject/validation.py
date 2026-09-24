"""Fixed identity boundary for the dedicated Oracle validation runtime."""

from django.core.exceptions import ImproperlyConfigured


EXPECTED_IDENTITY = {
    "SESSION_USER": "NIKA_TEST_USER",
    "CURRENT_USER": "NIKA_TEST_USER",
    "CURRENT_SCHEMA": "NIKA_TEST_USER",
    "CON_NAME": "HOZENPDB",
    "SERVICE_NAME": "hozenpdb.ad.toyota-shokki.co.jp",
}
IDENTITY_SQL = "SELECT " + ", ".join(
    f"SYS_CONTEXT('USERENV', '{attribute}')" for attribute in EXPECTED_IDENTITY
) + " FROM DUAL"


class ValidationSafetyError(ImproperlyConfigured):
    """Validation cannot safely use this configuration or connection."""


def verify_validation_connection(*, connection, **kwargs):
    """Check each physical connection; discard it on any failure.

    Do not include driver messages, DSNs, or unexpected values in errors.
    No schema switching, application reads, or mutations belong here.
    """
    try:
        if connection.alias != "default" or connection.vendor != "oracle":
            raise ValidationSafetyError("Validation requires the default Oracle connection.")
        if connection.settings_dict.get("USER", "").upper() != "NIKA_TEST_USER":
            raise ValidationSafetyError("Validation requires the NIKA_TEST_USER account.")
        with connection.cursor() as cursor:
            cursor.execute(IDENTITY_SQL)
            row = cursor.fetchone()
        if row is None or len(row) != len(EXPECTED_IDENTITY):
            raise ValidationSafetyError("Validation identity query returned an invalid result.")
        identity = dict(zip(EXPECTED_IDENTITY, row))
        mismatches = [
            key for key, expected in EXPECTED_IDENTITY.items()
            if identity[key] != expected
        ]
        if mismatches:
            raise ValidationSafetyError(
                "Validation database identity rejected: " + ", ".join(mismatches)
            )
        return identity
    except Exception as error:
        # Django has already assigned the physical connection before emitting
        # connection_created. Raising alone would leave that connection usable.
        try:
            connection.close()
        finally:
            message = (
                str(error) if isinstance(error, ValidationSafetyError)
                else "Validation database identity could not be verified."
            )
            raise ValidationSafetyError(message) from None
