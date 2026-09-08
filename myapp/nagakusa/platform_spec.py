from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from django.core.cache import cache

from myapp.nagakusa.config import (
    NagakusaConfigurationError,
    platform_spec_cache_seconds,
    platform_spec_timeout_seconds,
    platform_spec_url,
    validate_absolute_http_url,
)
from myapp.nagakusa.http_client import get_json


SNAPSHOT_PATH = Path("myapp") / "nagakusa" / "platform_spec_snapshot.json"
CACHE_KEY = "nagakusa.platform_spec.v1"


def get_platform_spec() -> dict[str, Any]:
    cached = cache.get(CACHE_KEY)
    if isinstance(cached, dict):
        return _with_metadata(cached, source="remote_cache")
    try:
        url = validate_absolute_http_url(
            platform_spec_url(),
            name="NAGAKUSA_PLUGIN_SPEC_API_URL",
        )
        response = get_json(
            url=url,
            timeout_seconds=platform_spec_timeout_seconds(),
        )
        _validate_spec(response.payload)
    except (NagakusaConfigurationError, RuntimeError):
        return _with_metadata(load_local_platform_spec(), source="local_snapshot")
    cache.set(CACHE_KEY, response.payload, timeout=platform_spec_cache_seconds())
    return _with_metadata(response.payload, source="remote")


def load_local_platform_spec() -> dict[str, Any]:
    try:
        payload = json.loads(snapshot_path().read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise RuntimeError("Nika platform specification snapshot is unavailable.") from error
    _validate_spec(payload)
    return payload


def snapshot_path() -> Path:
    return Path(__file__).resolve().parent / SNAPSHOT_PATH.name


def _validate_spec(payload: object) -> None:
    if not isinstance(payload, dict):
        raise RuntimeError("Platform specification must be an object.")
    metadata = payload.get("metadata")
    contracts = payload.get("contracts")
    if not isinstance(metadata, dict) or not isinstance(contracts, dict):
        raise RuntimeError("Platform specification has an invalid shape.")
    if not isinstance(metadata.get("version"), int):
        raise RuntimeError("Platform specification version is invalid.")


def _with_metadata(payload: dict[str, Any], *, source: str) -> dict[str, Any]:
    return {**payload, "served_from": source}