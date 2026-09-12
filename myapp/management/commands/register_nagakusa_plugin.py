from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from myapp.nagakusa.bounded_http import validate_http_url

from myapp.nagakusa.config import (
    NagakusaConfigurationError,
    get_runtime_configuration,
    integration_token,
    host_base_url,
    registration_key,
    registration_url,
    validate_absolute_http_url,
)
from myapp.nagakusa.manifest import build_manifest
from myapp.nagakusa.http_client import RemoteHttpError, post_json, public_response_error


class Command(BaseCommand):
    help = "Validate Nika's Nagakusa runtime registration payload."

    def add_arguments(self, parser: argparse.ArgumentParser) -> None:
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--force-register", action="store_true")

    def handle(self, *args, **options) -> None:
        try:
            configuration = get_runtime_configuration()
            endpoint = validate_absolute_http_url(registration_url(), name="NAGAKUSA_REGISTRATION_API_URL")
            validate_http_url(endpoint, label="Registration URL", expected_origin_url=host_base_url())
            if not registration_key() or not integration_token():
                raise NagakusaConfigurationError("Registration credentials are not configured.")
        except RuntimeError as error:
            raise CommandError("Nagakusa registration is not configured.") from error
        manifest = build_manifest()
        manifest_url = configuration.base_url.rstrip("/") + "/.well-known/nagakusa-plugin.json"
        payload = {
            "registration_key": registration_key(),
            "base_url": configuration.base_url,
            "manifest_url": manifest_url,
            "manifest": manifest,
            "api_token": integration_token(),
        }
        fingerprint = _fingerprint(endpoint, payload)
        if options["dry_run"]:
            self.stdout.write("Nagakusa registration dry run ready.")
            self.stdout.write(f"- manifest_url: {manifest_url}")
            self.stdout.write(f"- runtime_base_url: {configuration.base_url}")
            self.stdout.write("- credentials: configured")
            return
        if not options["force_register"] and _already_registered(fingerprint):
            self.stdout.write("Nagakusa registration unchanged; skipped.")
            return
        if not options["force_register"] and _retry_after(fingerprint):
            raise CommandError("Nagakusa registration is temporarily backed off.")
        try:
            response = post_json(url=endpoint, payload=payload, timeout_seconds=10)
            if not response.payload.get("ok"):
                raise public_response_error(response.status, response.payload, request_payload=payload)
        except RuntimeError as error:
            _save_state({"status": "failed", "fingerprint": fingerprint, "retry_after": int(time.time()) + 60 + int(fingerprint[:8], 16) % 31})
            detail = f" {error}" if isinstance(error, RemoteHttpError) else ""
            raise CommandError(f"Nagakusa registration failed.{detail}") from None
        _save_state({"status": "success", "fingerprint": fingerprint})
        self.stdout.write("Nagakusa registration completed.")


def _state_path() -> Path:
    return Path(settings.BASE_DIR) / ".nika-nagakusa-registration-state.json"


def _fingerprint(endpoint: str, payload: dict) -> str:
    # Private state only: credential rotation must invalidate a prior success.
    encoded = json.dumps(
        {"url": endpoint, "payload": payload}, ensure_ascii=False,
        sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _load_state() -> dict:
    try:
        payload = json.loads(_state_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _already_registered(fingerprint: str) -> bool:
    payload = _load_state()
    return payload.get("status") == "success" and payload.get("fingerprint") == fingerprint


def _retry_after(fingerprint: str) -> bool:
    payload = _load_state()
    if payload.get("status") != "failed" or payload.get("fingerprint") != fingerprint:
        return False
    try:
        return float(payload.get("retry_after", 0)) > time.time()
    except (ValueError, TypeError, OverflowError):
        return False


def _save_state(payload: dict) -> None:
    path = _state_path()
    temporary_path = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary_path.write_text(json.dumps(payload) + "\n", encoding="utf-8")
        temporary_path.replace(path)
    except OSError:
        # A local state failure must not misreport a successful Host write.
        import warnings
        warnings.warn("Nagakusa registration state could not be saved.", RuntimeWarning)
    finally:
        try:
            temporary_path.unlink()
        except OSError:
            pass
