import json

from django.http import JsonResponse


class InvalidJsonBody(ValueError):
    pass


def parse_json_body(
    request,
    *,
    empty_as_object=False,
):
    raw_body = request.body

    if empty_as_object and not raw_body:
        return {}

    try:
        return json.loads(
            raw_body
        )
    except json.JSONDecodeError as exc:
        raise InvalidJsonBody(
            "Invalid JSON data"
        ) from exc


def json_response(
    payload,
    *,
    status=200,
):
    return JsonResponse(
        payload,
        status=status,
        json_dumps_params={
            "ensure_ascii": False,
        },
    )


def json_error_response(
    message,
    *,
    status=400,
):
    return json_response(
        {
            "status": "error",
            "message": str(message),
        },
        status=status,
    )
