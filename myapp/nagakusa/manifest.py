from __future__ import annotations

from myapp.nagakusa.ai import TOOL_NAMES
from myapp.nagakusa.config import ai_agent_mode, ai_tools_enabled, get_runtime_configuration


def build_manifest() -> dict:
    configuration = get_runtime_configuration()

    return {
        "schema_version": 1,
        "plugin": {
            "key": configuration.plugin_key,
            "app_key": configuration.app_key,
            "label": configuration.label,
            "version": configuration.version,
            "owner": "your-team",
            "summary": "Nika 用のNagakusa DX System外部プラグインです。",
        },
        "runtime": {
            "module_slug": configuration.module_slug,
            "base_url": configuration.base_url,
            "healthcheck_url": "/api/health",
            "launch_path": "/",
        },
        "ui": {
            "category_key": "development",
            "icon": "img/work_history_icon.svg",
            "default_screen_key": "nika_home",
            "host_shell": {"appbar": True, "launchbar": True, "ai_dock": True},
        },
        "feedback_delivery": {
            "route": "direct",
            "delivery_mode": "production_direct",
            "artifact_kind": "plugin_version",
            "artifact_ref": configuration.version,
            "change_ids": [],
        },
        "data_sources": [],
        "features": {
            "ai": ai_tools_enabled(),
            "desktop": True,
            "standalone": True,
            "rag_ingest": False,
        },
        "host_permissions": [
            {
                "scope": "ai.message.send",
                "reason": (
                    "Send a user-authored Nika maintenance question to the "
                    "Nagakusa Host AI bridge."
                ),
            },
        ] if ai_agent_mode() == "host" else [],
        "ai": {
            "help_url": "/api/ai/help",
            "route_url": "/api/ai/route",
            "tool_manifest_url": "/api/ai/tools",
            "tool_call_url": "/api/ai/tool-call",
        },
        "tools": list(TOOL_NAMES) if ai_tools_enabled() else [],
    }
