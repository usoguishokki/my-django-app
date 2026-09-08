from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path
from uuid import uuid4

from django.core.management.base import BaseCommand, CommandError

from myapp.nagakusa.config import (
    NagakusaConfigurationError,
    get_runtime_configuration,
    integration_token,
    registration_key,
    registration_url,
    validate_absolute_http_url,
)
from myapp.nagakusa.manifest import build_manifest
from myapp.nagakusa.http_client import post_json


class Command(BaseCommand):
    help = "Validate Nika's Nagakusa runtime registration payload."

    def add_arguments(self, parser: argparse.ArgumentParser) -> None:
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--force-register", action="store_true")

    def handle(self, *args, **options) -> None:
        try:
            configuration = get_runtime_configuration()
            endpoint = validate_absolute_http_url(registration_url(), name="NAGAKUSA_REGISTRATION_API_URL")
            if not registration_key() or not integration_token():
                raise NagakusaConfigurationError("Registration credentials are not configured.")
        except NagakusaConfigurationError as error:
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
            self.stdout.write(f"- manifest_fingerprint: {fingerprint}")
            self.stdout.write("- credentials: configured")
            return
        if not options["force_register"] and _retry_after(fingerprint):
            raise CommandError("Nagakusa registration is temporarily backed off.")
        try:
            response = post_json(url=endpoint, payload=payload, timeout_seconds=10)
            if not response.payload.get("ok"):
                raise RuntimeError("Nagakusa registration was rejected.")
        except RuntimeError as error:
            _save_state({"status": "failed", "fingerprint": fingerprint, "retry_after": int(time.time()) + 60})
            raise CommandError("Nagakusa registration failed.") from error
        _save_state({"status": "success", "fingerprint": fingerprint})
        self.stdout.write("Nagakusa registration completed.")


def _state_path() -> Path:
    return Path.cwd() / ".nika-nagakusa-registration-state.json"


def _fingerprint(endpoint: str, payload: dict) -> str:
    safe_payload = dict(payload)
    safe_payload.pop("registration_key", None)
    safe_payload.pop("api_token", None)
    return hashlib.sha256(json.dumps({"endpoint": endpoint, "payload": safe_payload}, sort_keys=True).encode("utf-8")).hexdigest()


def _retry_after(fingerprint: str) -> bool:
    try:
        payload = json.loads(_state_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    return payload.get("status") == "failed" and payload.get("fingerprint") == fingerprint and int(payload.get("retry_after", 0)) > time.time()


def _save_state(payload: dict) -> None:
    path = _state_path()
    temporary_path = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary_path.write_text(json.dumps(payload) + "\n", encoding="utf-8")
        temporary_path.replace(path)
    finally:
        try:
            temporary_path.unlink()
        except OSError:
            pass