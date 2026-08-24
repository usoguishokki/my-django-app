# myapp/api/pullback.py

from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST

from myapp.http.json import (
    InvalidJsonBody,
    json_error_response,
    json_response,
    parse_json_body,
)
from myapp.services.pullback import (
    execute_single_pullback,
    execute_bulk_pullback,
)
from myapp.presenters.pullback_presenter import (
    build_single_pullback_payload,
    build_bulk_pullback_payload,
)


def _parse_pullback_json(request):
    try:
        return parse_json_body(
            request,
            encoding="utf-8",
        )
    except InvalidJsonBody as exc:
        cause = exc.__cause__

        raise ValueError(
            str(cause or exc)
        ) from exc


@require_POST
@login_required
def pullback_api(request):
    """
    Single pullback API.
    POST /api/pullback/
    body: { "planId": 123 }
    """
    try:
        data = _parse_pullback_json(
            request
        )

        plan_id = data.get(
            "planId"
        )

        result, http_status = (
            execute_single_pullback(
                plan_id=plan_id,
            )
        )

        if http_status != 200:
            return json_response(
                result,
                status=http_status,
            )

        payload = build_single_pullback_payload(
            plan=result,
        )

        return json_response(
            payload,
            status=200,
        )

    except ValueError as exc:
        return json_error_response(
            str(exc),
            status=400,
        )


@require_POST
@login_required
def bulk_pullback_api(request):
    """
    Bulk pullback API.
    POST /api/bulk-actions/pullback/
    body: { "planIds": [1, 2, 3] }
    """
    try:
        data = _parse_pullback_json(
            request
        )

        plan_ids = data.get(
            "planIds",
            [],
        )

        result, http_status = (
            execute_bulk_pullback(
                plan_ids=plan_ids,
            )
        )

        if http_status != 200:
            return json_response(
                result,
                status=http_status,
            )

        payload = build_bulk_pullback_payload()

        return json_response(
            payload,
            status=200,
        )

    except ValueError as exc:
        return json_error_response(
            str(exc),
            status=400,
        )
