# myapp/api/home/dashboard.py

import logging


from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET

from myapp.http.json import (
    json_error_response,
    json_response,
)

from myapp.domain.periods import (
    parse_ymd_date,
)



from myapp.services.home.dashboard import (
    build_home_assign_member_options_response,
    build_home_my_tasks_response,
    build_home_my_team_day_detail_response,
    build_home_my_team_progress_response,
    build_home_overall_progress_response,
    get_home_user_profile,
)

from myapp.presenters.home.dashboard_presenter import (
    build_home_assign_member_options_payload,
    build_my_tasks_payload,
    build_my_team_day_detail_payload,
    build_my_team_progress_payload,
    build_overall_progress_payload,
)


logger = logging.getLogger(__name__)




def build_home_success_response(
    payload,
):
    return json_response(
        {
            "status": "success",
            "data": payload,
        },
    )




def build_user_profile_not_found_response():
    return json_error_response(
        "ユーザープロフィールが見つかりません。",
        status=404,
    )


@require_GET
@login_required
def home_overall_progress_api(request):
    """
    home左側「全体の進捗」API。

    全体の進捗:
      ログインユーザーと同じ組織に属する班すべて
    """
    user_profile = get_home_user_profile(user=request.user)
    if user_profile is None:
        return build_user_profile_not_found_response()

    try:
        result = build_home_overall_progress_response(user_profile=user_profile)
        payload = build_overall_progress_payload(
            overall_counts=result.overall_counts,
            overall_attention_rows=result.overall_attention_rows,
            schedule_date_alias_map=result.schedule_date_alias_map,
            shift_pattern_map=result.shift_pattern_map,
            pattern_time_map=result.pattern_time_map,
            login_affiliation_id=result.login_affiliation_id,
            scope_type=result.scope_type,
            scope_label=result.scope_label,
            scope_description=result.scope_description,
            title=result.title,
        )
    except Exception:
        logger.exception("[home_overall_progress_api] failed")

        return json_error_response(
            "全体進捗の取得に失敗しました。",
            status=500,
        )

    return build_home_success_response(
        payload,
    )


@require_GET
@login_required
def home_my_team_progress_api(request):
    """
    home中央「ログインユーザー所属班の進捗」API。
    """
    user_profile = get_home_user_profile(user=request.user)
    if user_profile is None:
        return build_user_profile_not_found_response()

    try:
        result = build_home_my_team_progress_response(user_profile=user_profile)
        payload = build_my_team_progress_payload(
            affiliation_id=result.affiliation_id,
            affiliation_name=result.affiliation_name,
            scope_type=result.scope_type,
            team_title=result.team_title,
            team_counts=result.team_counts,
            today_item=result.today_item,
            week_day_items=result.week_day_items,
            current_period=result.current_period,
        )
    except Exception:
        logger.exception("[home_my_team_progress_api] failed")

        return json_error_response(
            "所属班進捗の取得に失敗しました。",
            status=500,
        )

    return build_home_success_response(
        payload,
    )


@require_GET
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
        return json_error_response(
            "日付が正しくありません。",
            status=400,
        )

    if not status_key:
        return json_error_response(
            "ステータスが指定されていません。",
            status=400,
        )

    user_profile = get_home_user_profile(user=request.user)
    if user_profile is None:
        return build_user_profile_not_found_response()

    try:
        result = build_home_my_team_day_detail_response(
            user_profile=user_profile,
            target_date=target_date,
            status_key=status_key,
        )
        payload = build_my_team_day_detail_payload(
            target_date=result.target_date,
            status_key=result.status_key,
            task_rows=result.task_rows,
        )
    except Exception:
        logger.exception("[home_my_team_day_detail_api] failed")

        return json_error_response(
            "所属班進捗の詳細取得に失敗しました。",
            status=500,
        )

    return build_home_success_response(
        payload,
    )


@require_GET
@login_required
def home_my_tasks_api(request):
    """
    home右側「自分の未完了タスク」API。
    """
    user_profile = get_home_user_profile(
        user=request.user,
        include_user=True,
    )
    if user_profile is None:
        return build_user_profile_not_found_response()

    try:
        result = build_home_my_tasks_response(user_profile=user_profile)
        payload = build_my_tasks_payload(
            holder=result.holder,
            task_rows=result.task_rows,
            schedule_date_alias_map=result.schedule_date_alias_map,
            shift_pattern_map=result.shift_pattern_map,
            pattern_time_map=result.pattern_time_map,
        )
    except Exception:
        logger.exception("[home_my_tasks_api] failed")

        return json_error_response(
            "個別進捗の取得に失敗しました。",
            status=500,
        )

    return build_home_success_response(
        payload,
    )




@require_GET
@login_required
def home_assign_member_options_api(request):
    """
    home作業登録モーダルの作業者候補API。

    A/B/C班ユーザー:
      自班メンバー

    常昼などA/B/C班以外:
      A/B/C班すべてのメンバー
    """
    user_profile = get_home_user_profile(user=request.user)
    if user_profile is None:
        return build_user_profile_not_found_response()

    try:
        result = build_home_assign_member_options_response(user_profile=user_profile)
        payload = build_home_assign_member_options_payload(
            scope=result.scope,
            members=result.members,
        )
    except Exception:
        logger.exception("[home_assign_member_options_api] failed")

        return json_error_response(
            "作業者候補の取得に失敗しました。",
            status=500,
        )

    return build_home_success_response(
        payload,
    )
