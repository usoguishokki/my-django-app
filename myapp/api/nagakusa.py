from __future__ import annotations

import secrets

from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from myapp.http.json import InvalidJsonBody, json_response, parse_json_body
from myapp.nagakusa.ai import (
    NagakusaToolRequestError,
    build_tool_manifest,
    parse_tool_call,
    route_ai_request,
)
from myapp.nagakusa.ai_prompt import build_ai_help
from myapp.nagakusa.config import (
    NagakusaConfigurationError,
    get_runtime_configuration,
    integration_token,
    runtime_is_configured,
)
from myapp.nagakusa.load_safety import (
    request_body_is_within_limit,
    request_rate_is_allowed,
    tool_call_slot,
)
from myapp.nagakusa.manifest import build_manifest
from myapp.nagakusa.platform_spec import get_platform_spec
from myapp.services.nagakusa import execute_nagakusa_tool


def _error_response(*, code: str, status: int) -> HttpResponse:
    response = json_response({"error": {"code": code}}, status=status)
    response["Cache-Control"] = "no-store"
    return response


def _no_store_response(payload: dict) -> HttpResponse:
    response = json_response(payload)
    response["Cache-Control"] = "no-store"
    return response


def _runtime_is_available() -> bool:
    try:
        get_runtime_configuration()
    except NagakusaConfigurationError:
        return False
    return True


def _is_authorized(request: HttpRequest) -> bool:
    expected_token = integration_token()
    if not expected_token:
        return False
    scheme, separator, supplied_token = request.headers.get(
        "Authorization", ""
    ).partition(" ")
    return bool(
        separator
        and scheme == "Bearer"
        and supplied_token
        and secrets.compare_digest(supplied_token, expected_token)
    )


def _authorized_json_request(
    request: HttpRequest,
    *,
    scope: str,
) -> HttpResponse | None:
    if not _is_authorized(request):
        return _error_response(code="unauthorized", status=401)
    if not request_body_is_within_limit(request):
        return _error_response(code="request_too_large", status=413)
    if not request_rate_is_allowed(request, scope=scope):
        return _error_response(code="rate_limited", status=429)
    return None


@require_GET
def nagakusa_plugin_manifest(request: HttpRequest) -> HttpResponse:
    del request
    try:
        return json_response(build_manifest())
    except NagakusaConfigurationError:
        return _error_response(code="runtime_not_configured", status=503)


@require_GET
def nagakusa_health_api(request: HttpRequest) -> HttpResponse:
    del request
    return json_response({
        "status": "ok",
        "service": "nika.nagakusa_runtime",
        "runtime_configured": runtime_is_configured(),
    })


@require_GET
def nagakusa_ai_help_api(request: HttpRequest) -> HttpResponse:
    del request
    if not _runtime_is_available():
        return _error_response(code="runtime_not_configured", status=503)
    return json_response(build_ai_help())


@require_GET
def nagakusa_ai_tools_api(request: HttpRequest) -> HttpResponse:
    del request
    if not _runtime_is_available():
        return _error_response(code="runtime_not_configured", status=503)
    return json_response(build_tool_manifest())


@require_GET
def nagakusa_platform_spec_api(request: HttpRequest) -> HttpResponse:
    del request
    response = json_response(get_platform_spec())
    response["Cache-Control"] = "no-store"
    return response


@csrf_exempt
@require_POST
def nagakusa_ai_route_api(request: HttpRequest) -> HttpResponse:
    rejected = _authorized_json_request(request, scope="ai-route")
    if rejected is not None:
        return rejected
    if not _runtime_is_available():
        return _error_response(code="runtime_not_configured", status=503)
    try:
        return _no_store_response(route_ai_request(parse_json_body(request)))
    except (InvalidJsonBody, NagakusaToolRequestError):
        return _error_response(code="invalid_ai_request", status=400)


@csrf_exempt
@require_POST
def nagakusa_ai_tool_call_api(request: HttpRequest) -> HttpResponse:
    rejected = _authorized_json_request(request, scope="ai-tool-call")
    if rejected is not None:
        return rejected
    if not _runtime_is_available():
        return _error_response(code="runtime_not_configured", status=503)
    try:
        tool_name, arguments = parse_tool_call(parse_json_body(request))
    except InvalidJsonBody:
        return _error_response(code="invalid_json", status=400)
    except NagakusaToolRequestError as error:
        return _error_response(code=error.code, status=400)

    with tool_call_slot() as acquired:
        if not acquired:
            return _error_response(code="tool_call_busy", status=503)
        try:
            return _no_store_response(execute_nagakusa_tool(
                tool_name=tool_name,
                arguments=arguments,
            ))
        except Exception:
            return _error_response(code="tool_unavailable", status=503)