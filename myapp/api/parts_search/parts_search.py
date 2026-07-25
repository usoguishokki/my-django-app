# myapp/api/parts_search/parts_search.py

from __future__ import annotations

import logging

import pyodbc
from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET

from myapp.domain.parts_search.parts_search import (
    PartsSearchValidationError,
)
from myapp.presenters.parts_search.parts_search import (
    present_parts_search_result,
)
from myapp.services.parts_search.parts_search import (
    search_parts,
)


logger = logging.getLogger("myapp")


def _error_response(
    *,
    code: str,
    message: str,
    status: int,
) -> JsonResponse:
    """
    部品検索APIのエラーレスポンスを生成する。
    """
    return JsonResponse(
        {
            "success": False,
            "error": {
                "code": code,
                "message": message,
            },
            "items": [],
        },
        status=status,
        json_dumps_params={
            "ensure_ascii": False,
        },
    )


def _get_search_parameters(
    request: HttpRequest,
) -> dict[str, str]:
    """
    部品検索用のクエリパラメーターを取得する。

    入力値の正規化と検証は
    Domain層で実施する。
    """
    return {
        "section": request.GET.get(
            "section",
            "",
        ),
        "barcode": request.GET.get(
            "barcode",
            "",
        ),
        "rack_level1": request.GET.get(
            "rack_level1",
            "",
        ),
        "parts_name": request.GET.get(
            "parts_name",
            "",
        ),
        "parts_model": request.GET.get(
            "parts_model",
            "",
        ),
    }


@require_GET
def parts_search_api(
    request: HttpRequest,
) -> JsonResponse:
    """
    指定された条件で部品を検索する。

    呼び出し例:
    GET /api/parts-search/?section=molding

    GET /api/parts-search/
        ?section=molding
        &parts_name=ヒーター

    検索対象:
    ・係
    ・バーコード
    ・棚番
    ・品名
    ・型式

    係は対応する棚番プレフィックスで検索する。

    複数条件が指定された場合は
    AND検索を行う。
    """
    if not request.user.is_authenticated:
        return _error_response(
            code="authentication_required",
            message="ログインが必要です。",
            status=401,
        )

    search_parameters = _get_search_parameters(
        request
    )

    try:
        result = search_parts(
            **search_parameters
        )

        payload = present_parts_search_result(
            result
        )

        return JsonResponse(
            payload,
            status=200,
            json_dumps_params={
                "ensure_ascii": False,
            },
        )

    except PartsSearchValidationError as error:
        return _error_response(
            code="validation_error",
            message=str(error),
            status=400,
        )

    except pyodbc.Error:
        logger.exception(
            "[parts_search_api] MARP database error"
        )

        return _error_response(
            code="database_error",
            message=(
                "部品情報を取得できませんでした。"
                "時間をおいて再度実行してください。"
            ),
            status=503,
        )

    except Exception:
        logger.exception(
            "[parts_search_api] unexpected error"
        )

        return _error_response(
            code="internal_error",
            message="部品検索中にエラーが発生しました。",
            status=500,
        )