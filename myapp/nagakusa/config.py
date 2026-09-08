from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlsplit


class NagakusaConfigurationError(RuntimeError):
    """Raised when the native plugin identity is incomplete."""


@dataclass(frozen=True)
class NagakusaRuntimeConfiguration:
    plugin_key: str
    app_key: str
    module_slug: str
    label: str
    version: str
    base_url: str


_IDENTITY_VARIABLES = (
    ("NAGAKUSA_PLUGIN_KEY", "plugin_key"),
    ("NAGAKUSA_PLUGIN_APP_KEY", "app_key"),
    ("NAGAKUSA_PLUGIN_MODULE_SLUG", "module_slug"),
    ("NAGAKUSA_PLUGIN_LABEL", "label"),
    ("NAGAKUSA_PLUGIN_VERSION", "version"),
    ("NAGAKUSA_RUNTIME_BASE_URL", "base_url"),
)


def integration_token() -> str:
    return os.getenv("NAGAKUSA_PLUGIN_AI_API_TOKEN", "").strip()


def frame_auth_secret() -> str:
    return integration_token()


def platform_spec_url() -> str:
    return os.getenv("NAGAKUSA_PLUGIN_SPEC_API_URL", "").strip()


def platform_spec_timeout_seconds() -> int:
    return _bounded_integer(
        "NAGAKUSA_PLATFORM_SPEC_TIMEOUT_SECONDS",
        default=5,
        minimum=1,
        maximum=30,
    )


def platform_spec_cache_seconds() -> int:
    return _bounded_integer(
        "NAGAKUSA_PLATFORM_SPEC_CACHE_SECONDS",
        default=300,
        minimum=1,
        maximum=3600,
    )


def registration_url() -> str:
    return os.getenv("NAGAKUSA_REGISTRATION_API_URL", "").strip()


def registration_key() -> str:
    return os.getenv("NAGAKUSA_REGISTRATION_KEY", "").strip()


def validate_absolute_http_url(value: str, *, name: str) -> str:
    normalized_value = str(value or "").strip().rstrip("/")
    parsed = urlsplit(normalized_value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise NagakusaConfigurationError(
            f"{name} must be an absolute HTTP(S) URL."
        )
    return normalized_value


def _bounded_integer(
    variable_name: str,
    *,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    try:
        value = int(os.getenv(variable_name, str(default)))
    except ValueError as error:
        raise NagakusaConfigurationError(
            f"{variable_name} must be an integer."
        ) from error
    if not minimum <= value <= maximum:
        raise NagakusaConfigurationError(
            f"{variable_name} is outside its allowed range."
        )
    return value


def runtime_is_configured() -> bool:
    return bool(integration_token()) and all(
        os.getenv(variable_name, "").strip()
        for variable_name, _ in _IDENTITY_VARIABLES
    )


def get_runtime_configuration() -> NagakusaRuntimeConfiguration:
    values = {
        attribute_name: os.getenv(variable_name, "").strip()
        for variable_name, attribute_name in _IDENTITY_VARIABLES
    }

    if not all(values.values()):
        raise NagakusaConfigurationError(
            "Nagakusa runtime identity is not configured."
        )

    return NagakusaRuntimeConfiguration(**values)