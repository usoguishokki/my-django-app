# myapp/api/inspection_standards.py

from __future__ import annotations


from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST, require_GET

from myapp.http.json import (
    InvalidJsonBody,
    json_response,
    parse_json_body,
)

from myapp.domain.errors import InspectionStandardError
from myapp.services.inspection_standards import (
    update_inspection_standard_detail,
    create_inspection_standard_detail,
    delete_inspection_standard_detail,
    build_inspection_standard_common_item_options_payload,
    update_inspection_standard_common_items,
    build_inspection_standard_common_items_plan_preview,
    create_inspection_standard_card,
    abolish_inspection_standard_card,
)
from myapp.services.inspection_card_detail import (
    build_inspection_card_detail_result,
)
from myapp.services.inspection_card_plans import (
    build_inspection_card_plans_result,
)
from myapp.presenters.plan_detail_presenter import (
    build_plan_detail_payload_from_check,
)
from myapp.presenters.inspection_card_plans_presenter import (
    build_inspection_card_plans_payload,
)
from myapp.services.inspection_standard_history_query import (
    build_inspection_standard_history_list_payload,
    build_inspection_standard_history_detail_payload,
)
from myapp.services.inspection_standard_history_approval import (
    approve_inspection_standard_history,
)

from myapp.services.inspection_standard_history_note import (
    update_inspection_standard_history_note,
)

from myapp.services.inspection_standard_history_cancellation import (
    cancel_inspection_standard_history,
)

@require_GET
@login_required
def inspection_card_detail_api(request, inspection_no: str):
    """
    点検カード 詳細API（inspection_no 直）
    GET /api/inspection-cards/<inspection_no>/detail/
    """

    try:
        result, status = build_inspection_card_detail_result(
            inspection_no=inspection_no
        )

        if status != 200:
            return json_response(
                result,
                status=status,
            )

        payload = build_plan_detail_payload_from_check(
            result["check"],
            plan=result.get("plan"),
        )

        return json_response(
            payload,
            status=200,
        )

    except ValueError as error:
        return _bad_request_response(error)


@require_GET
@login_required
def inspection_card_plans_api(request, inspection_no: str):
    """
    点検カード 履歴API（inspection_no に紐づく plan を複数返す）
    GET /api/inspection-cards/<inspection_no>/plans/
    """

    try:
        result, status = build_inspection_card_plans_result(
            inspection_no=inspection_no
        )

        if status != 200:
            return json_response(
                result,
                status=status,
            )

        payload = build_inspection_card_plans_payload(
            inspection_no=inspection_no,
            plans=result,
        )

        return json_response(
            payload,
            status=200,
        )

    except ValueError as error:
        return _bad_request_response(error)


@require_POST
@login_required
def inspection_standard_detail_update_api(request, detail_id: int):
    """
    点検基準書 明細1件更新API。

    更新対象:
      - Db_details_tb.applicable_device
      - Db_details_tb.contents
      - Db_details_tb.method
      - Db_details_tb.standard
      - Db_details_tb.inspection_man_hours
      - Db_details_tb.status
    """

    try:
        payload = _parse_json_body(request)

        result = update_inspection_standard_detail(
            detail_id=detail_id,
            data=payload,
            operated_by=request.user,
        )

        return _success_response({
            'detail': result,
        })

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return _server_error_response(
            message='点検基準書の更新に失敗しました。'
        )


@require_POST
@login_required
def inspection_standard_detail_delete_api(request, detail_id: int):
    """
    点検基準書 明細1件削除API。
    Db_details_tb から物理削除する。
    """

    try:
        payload = _parse_json_body(request)

        result = delete_inspection_standard_detail(
            detail_id=detail_id,
            data=payload,
            operated_by=request.user,
        )

        return json_response(
            {
                'success': True,
                'detail': result,
            },
            status=200,
        )

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return json_response(
            {
                'success': False,
                'message': '点検基準書の明細削除に失敗しました。',
            },
            status=500,
        )


@require_POST
@login_required
def inspection_standard_detail_create_api(request):
    """
    点検基準書 明細1件追加API。

    作成対象:
      - Db_details_tb.inspection_no
      - Db_details_tb.applicable_device
      - Db_details_tb.contents
      - Db_details_tb.method
      - Db_details_tb.standard
      - Db_details_tb.inspection_man_hours
      - Db_details_tb.status
    """

    try:
        payload = _parse_json_body(request)

        result = create_inspection_standard_detail(
            data=payload,
            operated_by=request.user,
        )

        return json_response(
            {
                'success': True,
                'detail': result,
            },
            status=200,
        )

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return json_response(
            {
                'success': False,
                'message': '点検基準書の明細追加に失敗しました。',
            },
            status=500,
        )
        
        
@require_GET
@login_required
def inspection_standard_common_item_options_api(request):
    try:
        payload = build_inspection_standard_common_item_options_payload()

        return json_response(
            payload,
            status=200,
        )

    except Exception:
        return json_response(
            {
                'status': 'error',
                'message': '共通項目変更の選択肢取得に失敗しました。',
            },
            status=500,
        )
        

@require_POST
@login_required
def inspection_standard_common_items_update_api(request, check_id: int):
    """
    点検基準書 共通項目更新API。
    """

    try:
        payload = _parse_json_body(request)

        result = update_inspection_standard_common_items(
            check_id=check_id,
            data=payload,
            operated_by=request.user,
        )

        return json_response(
            {
                'success': True,
                'commonItems': result,
            },
            status=200,
        )

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return json_response(
            {
                'success': False,
                'message': '共通項目の更新に失敗しました。',
            },
            status=500,
        )
        
        
def _parse_json_body(request) -> dict:
    try:
        return parse_json_body(
            request,
            empty_as_object=True,
        )
    except InvalidJsonBody as exc:
        raise ValueError(
            "\u30ea\u30af\u30a8\u30b9\u30c8"
            "\u5f62\u5f0f\u304c\u4e0d\u6b63"
            "\u3067\u3059\u3002"
        ) from exc


def _success_response(
    payload: dict,
    *,
    status: int = 200,
):
    return json_response(
        {
            "success": True,
            **payload,
        },
        status=status,
    )


def _domain_error_response(
    error: InspectionStandardError,
):
    return json_response(
        {
            "success": False,
            "message": str(error),
            "detail": getattr(
                error,
                "detail",
                str(error),
            ),
        },
        status=400,
    )


def _bad_request_response(
    error: ValueError,
):
    return json_response(
        {
            "success": False,
            "message": str(error),
        },
        status=400,
    )


def _server_error_response(
    *,
    message: str,
):
    return json_response(
        {
            "success": False,
            "message": message,
        },
        status=500,
    )


@require_POST
@login_required
def inspection_standard_common_items_plan_preview_api(request, check_id: int):
    """
    共通項目変更時の plan_tb 更新予定日プレビューAPI。
    実際の保存・削除・作成は行わない。
    """

    try:
        payload = _parse_json_body(request)

        result = build_inspection_standard_common_items_plan_preview(
            check_id=check_id,
            data=payload,
        )

        return json_response(
            {
                'success': True,
                'planPreview': result,
            },
            status=200,
        )

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return json_response(
            {
                'success': False,
                'message': '計画日のプレビュー取得に失敗しました。',
            },
            status=500,
        )


@require_POST
@login_required
def inspection_standard_card_create_api(request):
    """
    点検カード新規作成API。
    """

    try:
        payload = _parse_json_body(request)

        result = create_inspection_standard_card(
            data=payload,
            operated_by=request.user,
        )

        return _success_response({
            'card': result,
        })

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return _server_error_response(
            message='点検カードの追加に失敗しました。'
        )

@require_POST
@login_required
def inspection_standard_card_abolish_api(request, check_id: int):
    """
    点検カード廃止API。
    """

    try:
        payload = _parse_json_body(request)

        result = abolish_inspection_standard_card(
            check_id=check_id,
            data=payload,
            operated_by=request.user,
        )

        return _success_response({
            'card': result,
        })

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return _server_error_response(
            message='点検カードの廃止に失敗しました。'
        )


@require_GET
@login_required
def inspection_standard_history_list_api(request):
    """
    点検基準書 変更履歴一覧API。

    GET /api/inspection-standards/history/?inspection_no=XXX
    """

    try:
        inspection_no = request.GET.get('inspection_no', '')
        machine = request.GET.get('machine', '')
        control_no = request.GET.get('control_no', '')
        
        result = build_inspection_standard_history_list_payload(
            inspection_no=inspection_no,
            machine=machine,
            control_no=control_no,
        )

        return json_response(
            result,
            status=200,
        )

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return _server_error_response(
            message='点検基準書の履歴取得に失敗しました。'
        )


@require_POST
@login_required
def inspection_standard_history_note_update_api(
    request,
    history_id: int,
):
    """
    点検基準書 変更履歴の変更理由更新API。

    POST /api/inspection-standards/history/<history_id>/note/update/

    request body:
      {
        "note": "変更理由"
      }
    """

    try:
        payload = _parse_json_body(request)

        result = update_inspection_standard_history_note(
            history_id=history_id,
            note=payload.get('note'),
        )

        return _success_response({
            'history': result,
        })

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return _server_error_response(
            message='変更理由の更新に失敗しました。'
        )


@require_POST
@login_required
def inspection_standard_history_cancel_api(
    request,
    history_id: int,
):
    """
    点検基準書の変更履歴取消API。

    実際の点検基準書の内容は元に戻さず、
    対象の変更履歴だけを取消済みにする。
    """

    try:
        result = cancel_inspection_standard_history(
            history_id=history_id,
            cancelled_by=request.user,
        )

        return _success_response({
            'history': result,
        })

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return _server_error_response(
            message='変更履歴の取り消しに失敗しました。'
        )


@require_GET
@login_required
def inspection_standard_history_detail_api(request, history_id: int):
    """
    点検基準書 変更履歴詳細API。

    GET /api/inspection-standards/history/<history_id>/
    """

    try:
        result = build_inspection_standard_history_detail_payload(
            history_id=history_id,
        )

        return json_response(
            result,
            status=200,
        )

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)

    except Exception:
        return _server_error_response(
            message='点検基準書の履歴詳細取得に失敗しました。'
        )

@require_POST
@login_required
def inspection_standard_history_approve_api(request, history_id: int):
    """
    点検基準書 変更履歴承認API。

    POST /api/inspection-standards/history/<history_id>/approve/

    request body:
      {
        "approvalRole": "leader"
      }

    approvalRole:
      - leader: 組長承認
      - foreman: 工長承認
    """

    try:
        payload = _parse_json_body(request)

        approval_role = (
            payload.get('approvalRole')
            or payload.get('approval_role')
            or ''
        )

        result = approve_inspection_standard_history(
            history_id=history_id,
            approval_role=approval_role,
            approved_by=request.user,
        )

        return _success_response({
            'history': result,
        })

    except InspectionStandardError as error:
        return _domain_error_response(error)

    except ValueError as error:
        return _bad_request_response(error)
