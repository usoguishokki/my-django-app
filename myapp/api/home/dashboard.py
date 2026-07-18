# myapp/api/home/dashboard.py

import logging
from datetime import datetime


from django.contrib.auth.decorators import login_required
from django.http import JsonResponse


from myapp.models import UserProfile
from myapp.services.home.dashboard import (
    build_home_assign_member_options_response,
    build_home_my_tasks_response,
    build_home_my_team_day_detail_response,
    build_home_my_team_progress_response,
    build_home_overall_progress_response,
)


logger = logging.getLogger(__name__)


def get_home_user_profile(request, *, include_user: bool = False):
    """
    home API共通のログインユーザープロフィール取得。

    include_user=True:
      home_my_tasks_api のように user.member_id を使う場合に指定する。
    """
    related_fields = ["organization", "belongs"]

    if include_user:
        related_fields.append("user")

    return (
        UserProfile.objects
        .select_related(*related_fields)
        .get(user=request.user)
    )


def build_user_profile_not_found_response():
    return JsonResponse(
        {
            "status": "error",
            "message": "ユーザープロフィールが見つかりません。",
        },
        status=404,
        json_dumps_params={"ensure_ascii": False},
    )


@login_required
def home_overall_progress_api(request):
    """
    home左側「全体の進捗」API。

    全体の進捗:
      ログインユーザーと同じ組織に属する班すべて
    """
    try:
        user_profile = get_home_user_profile(request)
    except UserProfile.DoesNotExist:
        return build_user_profile_not_found_response()

    try:
        payload = build_home_overall_progress_response(
            user_profile=user_profile,
        )
    except Exception:
        logger.exception("[home_overall_progress_api] failed")

        return JsonResponse(
            {
                "status": "error",
                "message": "全体進捗の取得に失敗しました。",
            },
            status=500,
            json_dumps_params={"ensure_ascii": False},
        )

    return JsonResponse(
        {
            "status": "success",
            "data": payload,
        },
        json_dumps_params={"ensure_ascii": False},
    )

    
@login_required
def home_my_team_progress_api(request):
    """
    home中央「ログインユーザー所属班の進捗」API。
    """
    try:
        user_profile = get_home_user_profile(request)
    except UserProfile.DoesNotExist:
        return build_user_profile_not_found_response()

    try:
        payload = build_home_my_team_progress_response(
            user_profile=user_profile,
        )
    except Exception:
        logger.exception("[home_my_team_progress_api] failed")

        return JsonResponse(
            {
                "status": "error",
                "message": "所属班進捗の取得に失敗しました。",
            },
            status=500,
            json_dumps_params={"ensure_ascii": False},
        )

    return JsonResponse(
        {
            "status": "success",
            "data": payload,
        },
        json_dumps_params={"ensure_ascii": False},
    )


@login_required
def home_my_team_day_detail_api(request):
    """
    home中央「今日の進捗」クリック時の詳細カード一覧API。

    Query Params:
      date: yyyy-mm-dd
      statusKey: waiting / in_progress / approval_waiting / delayed
    """
    target_date = parse_ymd_date(request.GET.get("date", ""))
    status_key = request.GET.get("statusKey", "")

    if not target_date:
        return JsonResponse(
            {
                "status": "error",
                "message": "日付が正しくありません。",
            },
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )

    if not status_key:
        return JsonResponse(
            {
                "status": "error",
                "message": "ステータスが指定されていません。",
            },
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )

    try:
        user_profile = get_home_user_profile(request)
    except UserProfile.DoesNotExist:
        return build_user_profile_not_found_response()

    try:
        payload = build_home_my_team_day_detail_response(
            user_profile=user_profile,
            target_date=target_date,
            status_key=status_key,
        )
    except Exception:
        logger.exception("[home_my_team_day_detail_api] failed")

        return JsonResponse(
            {
                "status": "error",
                "message": "所属班進捗の詳細取得に失敗しました。",
            },
            status=500,
            json_dumps_params={"ensure_ascii": False},
        )

    return JsonResponse(
        {
            "status": "success",
            "data": payload,
        },
        json_dumps_params={"ensure_ascii": False},
    )


@login_required
def home_my_tasks_api(request):
    """
    home右側「自分の未完了タスク」API。
    """
    try:
        user_profile = get_home_user_profile(
            request,
            include_user=True,
        )
    except UserProfile.DoesNotExist:
        return build_user_profile_not_found_response()

    try:
        payload = build_home_my_tasks_response(
            user_profile=user_profile,
        )
    except Exception:
        logger.exception("[home_my_tasks_api] failed")

        return JsonResponse(
            {
                "status": "error",
                "message": "個別進捗の取得に失敗しました。",
            },
            status=500,
            json_dumps_params={"ensure_ascii": False},
        )

    return JsonResponse(
        {
            "status": "success",
            "data": payload,
        },
        json_dumps_params={"ensure_ascii": False},
    )


def parse_ymd_date(value: str):
    """
    yyyy-mm-dd 文字列を date に変換する。
    不正な場合は None を返す。
    """
    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


@login_required
def home_assign_member_options_api(request):
    """
    home作業登録モーダルの作業者候補API。

    A/B/C班ユーザー:
      自班メンバー

    常昼などA/B/C班以外:
      A/B/C班すべてのメンバー
    """
    try:
        user_profile = get_home_user_profile(request)
    except UserProfile.DoesNotExist:
        return build_user_profile_not_found_response()

    try:
        payload = build_home_assign_member_options_response(
            user_profile=user_profile,
        )
    except Exception:
        logger.exception("[home_assign_member_options_api] failed")

        return JsonResponse(
            {
                "status": "error",
                "message": "作業者候補の取得に失敗しました。",
            },
            status=500,
            json_dumps_params={"ensure_ascii": False},
        )

    return JsonResponse(
        {
            "status": "success",
            "data": payload,
        },
        json_dumps_params={"ensure_ascii": False},
    )