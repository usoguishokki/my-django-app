from __future__ import annotations

import os
from dataclasses import dataclass


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