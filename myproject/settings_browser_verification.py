"""Fail-closed settings for zero-Oracle-write browser verification."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from scripts.research.oracle_readonly import (
    SQLNET_CONTENT,
    load_connection_settings,
)

from .settings import *  # noqa: F403


if os.environ.get("NIKA_ZERO_WRITE_BROWSER_VERIFY") != "1":
    raise RuntimeError(
        "Browser verification settings require "
        "NIKA_ZERO_WRITE_BROWSER_VERIFY=1"
    )


_readonly = load_connection_settings(os.environ)

DATABASES = {  # noqa: F405
    **DATABASES,  # noqa: F405
    "default": {
        **DATABASES["default"],  # noqa: F405
        # Django's Oracle backend treats NAME as a SID when PORT is set.
        # Use an Easy Connect DSN so the read-only PDB service is selected.
        "NAME": (
            f"{_readonly['HOZEN_READONLY_HOST']}:{_readonly['HOZEN_READONLY_PORT']}"
            f"/{_readonly['HOZEN_READONLY_SERVICE']}"
        ),
        "USER": _readonly["HOZEN_READONLY_USER"],
        "PASSWORD": _readonly["HOZEN_READONLY_PASSWORD"],
        "HOST": "",
        "PORT": "",
        "CONN_MAX_AGE": 0,
    },
}

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_NAME = "nika_browser_verification_sessionid"
SESSION_SAVE_EVERY_REQUEST = False

INSTALLED_APPS = [  # noqa: F405
    (
        "myapp.browser_verification.BrowserVerificationAppConfig"
        if app == "myapp"
        else app
    )
    for app in INSTALLED_APPS  # noqa: F405
]

# Keep the temporary Oracle Net override alive for the verification process.
BROWSER_VERIFICATION_ORACLE_CONFIG = tempfile.TemporaryDirectory(
    prefix="nika_browser_verification_oracle_"
)
Path(
    BROWSER_VERIFICATION_ORACLE_CONFIG.name,
    "sqlnet.ora",
).write_text(SQLNET_CONTENT, encoding="ascii")
