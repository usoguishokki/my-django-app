from __future__ import annotations

import os
import secrets

from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from myapp.http.json import (
    InvalidJsonBody,
    json_response,
    parse_json_body,
)
from myapp.services.instruction_card_search import (
    search_instruction_cards,
)


MAX_KEYWORDS = 10
MAX_KEYWORD_LENGTH = 100
MAX_EQUIPMENT_LENGTH = 100
DEFAULT_LIMIT = 5
MAX_LIMIT = 10


def _error_response(
    *,
    code: str,
    status: int,
) -> HttpResponse:
    return json_response(
        {
            "error": {
                "code": code,
            },
        },
        status=status,
    )


def _is_authorized(request: HttpRequest) -> bool:
    configured_token = os.getenv(
        "NIKA_INTEGRATION_API_TOKEN",
    )

    if not configured_token:
        return False

    authorization = request.headers.get(
        "Authorization",
        "",
    )
    scheme, separator, supplied_token = authorization.partition(" ")

    return bool(
        separator
        and scheme == "Bearer"
        and supplied_token
        and secrets.compare_digest(
            supplied_token,
            configured_token,
        )
    )


def _normalized_string(
    value: object,
    *,
    field_name: str,
    maximum_length: int,
) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")

    normalized_value = value.strip()

    if len(normalized_value) > maximum_length:
        raise ValueError(
            f"{field_name} must be at most "
            f"{maximum_length} characters"
        )

    return normalized_value


def _parse_search_request(
    payload: object,
) -> tuple[str, tuple[str, ...], int]:
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object")

    equipment_value = payload.get("equipment", "")
    equipment = _normalized_string(
        equipment_value,
        field_name="equipment",
        maximum_length=MAX_EQUIPMENT_LENGTH,
    )

    raw_keywords = payload.get("keywords")

    if not isinstance(raw_keywords, list):
        raise ValueError("keywords must be an array")

    if not 1 <= len(raw_keywords) <= MAX_KEYWORDS:
        raise ValueError(
            f"keywords must contain 1 to {MAX_KEYWORDS} values"
        )

    keywords = tuple(
        _normalized_string(
            keyword,
            field_name="keywords",
            maximum_length=MAX_KEYWORD_LENGTH,
        )
        for keyword in raw_keywords
    )

    if not all(keywords):
        raise ValueError("keywords must not contain empty values")

    raw_limit = payload.get("limit", DEFAULT_LIMIT)

    if isinstance(raw_limit, bool) or not isinstance(raw_limit, int):
        raise ValueError("limit must be an integer")

    if not 1 <= raw_limit <= MAX_LIMIT:
        raise ValueError(
            f"limit must be between 1 and {MAX_LIMIT}"
        )

    return equipment, keywords, raw_limit


@csrf_exempt
@require_POST
def instruction_card_search_api(
    request: HttpRequest,
) -> HttpResponse:
    """Bearer-authenticated, read-only InstructionCard search for integrations."""
    if not _is_authorized(request):
        return _error_response(
            code="unauthorized",
            status=401,
        )

    try:
        payload = parse_json_body(request)
        equipment, keywords, limit = _parse_search_request(
            payload,
        )
    except (InvalidJsonBody, ValueError):
        return _error_response(
            code="invalid_request",
            status=400,
        )

    try:
        result = search_instruction_cards(
            equipment=equipment,
            keywords=keywords,
            limit=limit,
        )
    except Exception:
        return _error_response(
            code="search_unavailable",
            status=503,
        )

    return json_response(
        {
            "query": {
                "equipment": result.equipment,
                "keywords": list(result.keywords),
            },
            "count": len(result.items),
            "results": list(result.items),
        },
    )