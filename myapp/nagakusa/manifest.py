from __future__ import annotations

from myapp.nagakusa.config import get_runtime_configuration


def build_manifest() -> dict:
    configuration = get_runtime_configuration()

    return {
        "schema_version": 1,
        "plugin": {
            "key": configuration.plugin_key,
            "app_key": configuration.app_key,
            "label": configuration.label,
            "version": configuration.version,
        },
        "runtime": {
            "module_slug": configuration.module_slug,
            "base_url": configuration.base_url,
            "healthcheck_url": "/api/health",
            "launch_path": "/",
        },
        "features": {
            "ai": True,
            "rag_ingest": False,
        },
        "ai": {
            "help_url": "/api/ai/help",
            "route_url": "/api/ai/route",
            "tool_manifest_url": "/api/ai/tools",
            "tool_call_url": "/api/ai/tool-call",
        },
        "tools": ["nika_search_instruction_cards"],
    }