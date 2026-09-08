from __future__ import annotations


def build_ai_help() -> dict:
    return {
        "grounding": [
            "Nika is a maintenance operations information source.",
            "InstructionCards are records of past work, not formal standards.",
            "Do not state a fact as InstructionCard-derived unless it is in a tool result.",
            "Use legacy_id as evidence when it is available.",
        ],
        "evidence_limits": [
            "Do not invent a result when a search returns zero cards.",
            "One card is limited evidence.",
            "Multiple cards may be compared, but remain historical records.",
        ],
    }