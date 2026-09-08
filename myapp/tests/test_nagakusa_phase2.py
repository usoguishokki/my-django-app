from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from django.core.management import call_command
from django.test import RequestFactory

from myapp.nagakusa import frame_auth, platform_spec
from myapp.nagakusa.manifest import build_manifest


IDENTITY = {
    "NAGAKUSA_PLUGIN_KEY": "existing-hozen-key-from-environment",
    "NAGAKUSA_PLUGIN_APP_KEY": "existing-hozen-app",
    "NAGAKUSA_PLUGIN_MODULE_SLUG": "existing-hozen-module",
    "NAGAKUSA_PLUGIN_LABEL": "Existing Hozen Runtime",
    "NAGAKUSA_PLUGIN_VERSION": "1.0.0",
    "NAGAKUSA_RUNTIME_BASE_URL": "http://127.0.0.1:8010",
    "NAGAKUSA_PLUGIN_AI_API_TOKEN": "a" * 48,
}


def _ticket(payload: dict) -> str:
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()
    signed = f"v1.{encoded}".encode("ascii")
    signing_key = hmac.new(
        IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"].encode("ascii"),
        b"nagakusa:plugin-frame-auth:v1",
        hashlib.sha256,
    ).digest()
    signature = base64.urlsafe_b64encode(
        hmac.new(signing_key, signed, hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"v1.{encoded}.{signature}"


class NagakusaPhase2Tests(TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, IDENTITY, clear=False)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_manifest_requests_only_ai_message_permission(self):
        manifest = build_manifest()
        self.assertEqual(
            ["ai.message.send"],
            [item["scope"] for item in manifest["host_permissions"]],
        )
        self.assertNotIn(IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"], json.dumps(manifest))

    def test_platform_spec_uses_local_snapshot_when_remote_is_unavailable(self):
        with patch.object(platform_spec, "platform_spec_url", return_value=""), patch.object(
            platform_spec.cache, "get", return_value=None
        ):
            payload = platform_spec.get_platform_spec()
        self.assertEqual("local_snapshot", payload["served_from"])
        self.assertEqual(1, payload["metadata"]["version"])

    def test_platform_spec_remote_response_is_cached_and_validated(self):
        remote = {"metadata": {"version": 2}, "contracts": {}}
        response = type("Response", (), {"payload": remote})()
        with patch.object(platform_spec.cache, "get", return_value=None), patch.object(
            platform_spec, "platform_spec_url", return_value="https://host.example/spec"
        ), patch.object(platform_spec, "get_json", return_value=response), patch.object(
            platform_spec.cache, "set"
        ) as cache_set:
            payload = platform_spec.get_platform_spec()
        self.assertEqual("remote", payload["served_from"])
        cache_set.assert_called_once()

    def test_frame_ticket_validates_signed_host_claims(self):
        now = int(time.time())
        payload = {
            "iss": frame_auth.FRAME_AUTH_ISSUER,
            "aud": IDENTITY["NAGAKUSA_PLUGIN_MODULE_SLUG"],
            "app_key": IDENTITY["NAGAKUSA_PLUGIN_APP_KEY"],
            "method": "GET",
            "sub": "42",
            "jti": "a" * 16,
            "iat": now,
            "exp": now + 30,
            "operation_capabilities": {"nika.read": {"allowed": True}},
        }
        verified = frame_auth.verify_frame_ticket(
            _ticket(payload),
            secret=IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"],
            expected_module_slug=IDENTITY["NAGAKUSA_PLUGIN_MODULE_SLUG"],
            expected_app_key=IDENTITY["NAGAKUSA_PLUGIN_APP_KEY"],
            expected_method="GET",
            now=now,
        )
        self.assertTrue(frame_auth.operation_capability_allowed(verified, "nika.read"))

    def test_frame_ticket_rejects_invalid_identity_time_method_and_capability(self):
        now = 1_800_000_000
        baseline = {
            "iss": frame_auth.FRAME_AUTH_ISSUER,
            "aud": IDENTITY["NAGAKUSA_PLUGIN_MODULE_SLUG"],
            "app_key": IDENTITY["NAGAKUSA_PLUGIN_APP_KEY"],
            "method": "GET", "sub": "42", "jti": "a" * 16, "iat": now, "exp": now + 30,
            "operation_capabilities": {"nika.read": {"allowed": True}},
        }
        cases = (
            ({"iss": "wrong"}, "frame_auth_issuer_invalid"),
            ({"aud": "wrong"}, "frame_auth_audience_invalid"),
            ({"app_key": "wrong"}, "frame_auth_app_key_invalid"),
            ({"method": "POST"}, "frame_auth_method_invalid"),
            ({"iat": now - 40, "exp": now - 6}, "frame_auth_expired"),
            ({"operation_capabilities": {"nika.read": {"allowed": 1}}}, "frame_auth_capabilities_invalid"),
        )
        for override, code in cases:
            with self.subTest(code=code):
                ticket = _ticket({**baseline, **override})
                with self.assertRaisesRegex(frame_auth.NagakusaFrameAuthError, code):
                    frame_auth.verify_frame_ticket(ticket, secret=IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"], expected_module_slug=IDENTITY["NAGAKUSA_PLUGIN_MODULE_SLUG"], expected_app_key=IDENTITY["NAGAKUSA_PLUGIN_APP_KEY"], expected_method="GET", now=now)

    def test_frame_request_rejects_missing_ticket(self):
        with self.assertRaisesRegex(frame_auth.NagakusaFrameAuthError, "frame_auth_missing"):
            frame_auth.verify_frame_request(RequestFactory().get("/ai-chat/"))

    def test_registration_dry_run_never_opens_network_connection(self):
        with patch(
            "myapp.management.commands.register_nagakusa_plugin.registration_url",
            return_value="https://host.example/register",
        ), patch(
            "myapp.management.commands.register_nagakusa_plugin.registration_key",
            return_value="registration-key",
        ), patch(
            "myapp.management.commands.register_nagakusa_plugin.integration_token",
            return_value=IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"],
        ), patch("urllib.request.OpenerDirector.open") as open_request:
            call_command("register_nagakusa_plugin", "--dry-run")
        open_request.assert_not_called()

    def test_bridge_asset_never_contains_browser_token_or_http_fallback(self):
        asset = (Path(__file__).resolve().parents[1] / "static" / "js" / "nagakusa" / "hostAiBridge.js").read_text(encoding="utf-8")
        self.assertIn("window.parent.postMessage", asset)
        self.assertIn("request_id", asset)
        self.assertIn("conversation_id", asset)
        self.assertNotIn("NAGAKUSA_PLUGIN_AI_API_TOKEN", asset)
        self.assertNotIn("fetch(", asset)
        self.assertNotIn("XMLHttpRequest", asset)