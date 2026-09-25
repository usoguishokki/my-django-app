"""Explicit local validation configuration. Never imports normal settings."""

import copy
import os
import re

from dotenv import load_dotenv

from .settings_shared import *  # noqa: F403
from .validation import EXPECTED_IDENTITY, ValidationSafetyError


# This dedicated ignored file must contain validation secrets only.
load_dotenv(BASE_DIR / ".env.validation", override=False)

if os.environ.get("NIKA_VALIDATION_MODE") != "1":
    raise ValidationSafetyError("Validation requires NIKA_VALIDATION_MODE=1.")


def _required(name):
    value = os.environ.get(name)
    if not value or not value.strip():
        raise ValidationSafetyError(f"Validation requires {name}.")
    return value


_user = _required("HOZEN_VALIDATION_USER").strip().upper()
if _user != EXPECTED_IDENTITY["SESSION_USER"]:
    raise ValidationSafetyError("HOZEN_VALIDATION_USER must be NIKA_TEST_USER.")
_host = _required("HOZEN_VALIDATION_HOST").strip()
if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]*", _host):
    raise ValidationSafetyError("HOZEN_VALIDATION_HOST must be a hostname or IPv4 address.")
_service = _required("HOZEN_VALIDATION_SERVICE").strip()
if _service != EXPECTED_IDENTITY["SERVICE_NAME"]:
    raise ValidationSafetyError("HOZEN_VALIDATION_SERVICE is not the approved service.")
try:
    _port = int(_required("HOZEN_VALIDATION_PORT"))
except ValueError:
    raise ValidationSafetyError("HOZEN_VALIDATION_PORT must be an integer.") from None
if not 1 <= _port <= 65535:
    raise ValidationSafetyError("HOZEN_VALIDATION_PORT is outside the valid range.")

SECRET_KEY = _required("NIKA_VALIDATION_SECRET_KEY")
NIKA_VALIDATION_MODE = True
DEBUG = False
# Local runserver --insecure serves source files through staticfiles finders.
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "[::1]"]
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = []
CSRF_TRUSTED_ORIGINS = []

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.oracle",
        "NAME": f"{_host}:{_port}/{_service}",
        "USER": _user,
        "PASSWORD": _required("HOZEN_VALIDATION_PASSWORD"),
        "HOST": "",
        "PORT": "",
        "CONN_MAX_AGE": 0,
    },
}
MARP_ENABLED = False
MARP_DATABASE = {}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "nika-validation",
    },
}
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "myapp": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
SESSION_COOKIE_NAME = "nika_validation_sessionid"
CSRF_COOKIE_NAME = "nika_validation_csrftoken"
SESSION_ENGINE = "django.contrib.sessions.backends.db"
INSTALLED_APPS = [
    "myapp.validation.ValidationAppConfig" if app == "myapp" else app
    for app in INSTALLED_APPS
]
# Copy before extending: importing validation must not mutate shared defaults.
TEMPLATES = copy.deepcopy(TEMPLATES)
TEMPLATES[0]["OPTIONS"]["context_processors"].append(
    "myapp.context_processors.validation_environment"
)
