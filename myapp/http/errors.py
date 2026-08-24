from myapp.http.json import (
    json_error_response,
)


def logged_json_error_response(
    *,
    logger,
    exc,
    message=None,
    status=500,
):
    response_message = (
        message
        if message is not None
        else str(exc)
    )

    logger.error(
        "Error: %s - %s",
        response_message,
        exc,
        exc_info=True,
    )

    return json_error_response(
        response_message,
        status=status,
    )
