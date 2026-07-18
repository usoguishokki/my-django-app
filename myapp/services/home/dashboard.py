# myapp/services/home/dashboard.py

from datetime import date, timedelta

from typing import Optional


from myapp.presenters.home.dashboard_presenter import (
    build_home_assign_member_options_payload,
    build_my_tasks_payload,
    build_my_team_day_detail_payload,
    build_my_team_progress_payload,
    build_overall_progress_payload,
)


from myapp.domain.home.plan_dates import (
    collect_plan_display_dates,
    collect_plan_schedule_dates,
)


from myapp.selectors.hozen_calendar import (
    get_date_alias_by_date,
    select_date_alias_map_by_dates,
)


from myapp.selectors.home.dashboard import (
    aggregate_home_status_counts,
    select_affiliations_day_detail_task_rows,
    select_affiliations_day_plan_scope,
    select_affiliations_period_plan_scope,
    select_calendar_days_by_date_alias,
    select_home_affiliations_by_organization,
    select_my_incomplete_task_rows,
    select_overall_attention_plan_rows,
    select_overall_plan_scope,
    select_team_day_detail_task_rows,
    select_team_day_plan_scope,
    select_team_period_plan_scope,
)


from myapp.selectors.shifts import (
    build_pattern_time_map,
    build_shift_pattern_map,
)


from myapp.selectors.members import select_members_by_affiliation_ids


from myapp.domain.org_constants import WD_JA


from myapp.domain.org_constants import TEAM_NAMES


def build_home_overall_progress_response(*, user_profile) -> dict:
    """
    home左側「全体進捗」を作る。

    A/B/C班ユーザー:
      ログインユーザー所属班の全体進捗

    常昼などA/B/C班以外:
      A/B/C班すべての全体進捗
    """
    organization_id = user_profile.organization_id
    login_affiliation_id = user_profile.belongs_id
    login_affiliation = user_profile.belongs
    login_affiliation_name = (
        getattr(login_affiliation, "affilation", "")
        if login_affiliation
        else ""
    )

    scope = build_overall_scope(
        organization_id=organization_id,
        login_affiliation_id=login_affiliation_id,
        login_affiliation_name=login_affiliation_name,
    )

    overall_counts = build_overall_counts(
        affiliation_ids=scope["affiliation_ids"],
    )

    overall_attention_rows = select_overall_attention_plan_rows(
        affiliation_ids=scope["affiliation_ids"],
    )

    overall_attention_rows = list(overall_attention_rows)

    shift_context = build_home_shift_context(
        plan_rows=overall_attention_rows,
    )

    schedule_date_alias_map = build_plan_schedule_date_alias_map(
        plan_rows=overall_attention_rows,
        **shift_context,
    )

    return build_overall_progress_payload(
        overall_counts=overall_counts,
        overall_attention_rows=overall_attention_rows,
        schedule_date_alias_map=schedule_date_alias_map,
        login_affiliation_id=login_affiliation_id,
        scope_type=scope["scope_type"],
        scope_label=scope["label"],
        scope_description=scope["description"],
        title=scope["title"],
        **shift_context,
    )

def build_plan_schedule_date_alias_map(
    *,
    plan_rows,
    shift_pattern_map: Optional[dict] = None,
    pattern_time_map: Optional[dict] = None,
) -> dict:
    """
    homeカードの表示日付に対応する date_alias を一括取得する。

    シフト情報がある場合:
      plan_timeをシフト日付に丸めた日付

    シフト情報がない場合:
      従来通り plan_time優先、なければp_date
    """
    if shift_pattern_map and pattern_time_map:
        schedule_dates = collect_plan_display_dates(
            plan_rows,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
    else:
        schedule_dates = collect_plan_schedule_dates(plan_rows)

    return select_date_alias_map_by_dates(
        target_dates=schedule_dates,
    )


def build_home_shift_context(*, plan_rows) -> dict:
    """
    home表示日付の丸めに必要なシフト情報をまとめて作る。

    shift_pattern_map:
      (date, team_key) -> pattern_id

    pattern_time_map:
      pattern_id -> (start_time, end_time)
    """
    schedule_dates = collect_plan_schedule_dates(plan_rows)

    if not schedule_dates:
        return {
            "shift_pattern_map": {},
            "pattern_time_map": {},
        }

    # 深夜帯が前日シフトに属する可能性があるため、前後に余裕を持たせる
    range_start = min(schedule_dates) - timedelta(days=1)
    range_end = max(schedule_dates) + timedelta(days=2)

    return {
        "shift_pattern_map": build_shift_pattern_map(range_start, range_end),
        "pattern_time_map": build_pattern_time_map(),
    }
    
    
def build_overall_scope(
    *,
    organization_id,
    login_affiliation_id,
    login_affiliation_name: str,
) -> dict:
    """
    左側「全体進捗」の対象スコープを決める。

    A/B/C班ユーザー:
      自班のみ

    A/B/C班以外:
      A/B/C班すべて
    """
    if login_affiliation_name in TEAM_NAMES and login_affiliation_id:
        return {
            "scope_type": "team",
            "affiliation_ids": [login_affiliation_id],
            "label": login_affiliation_name,
            "description": f"{login_affiliation_name} 全体",
            "title": f"{login_affiliation_name} 全体進捗",
        }

    affiliations = list(
        select_home_affiliations_by_organization(
            organization_id=organization_id,
        )
    )

    return {
        "scope_type": "all_teams",
        "affiliation_ids": [
            affiliation.affilation_id
            for affiliation in affiliations
        ],
        "label": "全体",
        "description": "A/B/C班すべて",
        "title": "全体進捗",
    }
    
def build_my_team_scope(*, user_profile) -> dict:
    """
    中央「今週」表示の対象スコープを決める。

    A/B/C班ユーザー:
      自班のみ

    常昼などA/B/C班以外:
      A/B/C班すべて
    """
    login_affiliation = user_profile.belongs
    login_affiliation_id = user_profile.belongs_id
    login_affiliation_name = (
        getattr(login_affiliation, "affilation", "")
        if login_affiliation
        else ""
    )

    if login_affiliation_name in TEAM_NAMES and login_affiliation_id:
        return {
            "scope_type": "my_team",
            "affiliation_id": login_affiliation_id,
            "affiliation_name": login_affiliation_name,
            "affiliation_ids": [login_affiliation_id],
            "title": f"{login_affiliation_name}の進捗",
        }

    affiliations = list(
        select_home_affiliations_by_organization(
            organization_id=user_profile.organization_id,
        )
    )

    return {
        "scope_type": "all_teams",
        "affiliation_id": "",
        "affiliation_name": "全班",
        "affiliation_ids": [
            affiliation.affilation_id
            for affiliation in affiliations
        ],
        "title": "全班の進捗",
    }

def build_home_my_team_progress_response(*, user_profile, target_date=None) -> dict:
    """
    home中央「今週の進捗」を作る。

    A/B/C班ユーザー:
      自班の今週進捗

    常昼などA/B/C班以外:
      A/B/C班すべての今週進捗
    """
    target_date = target_date or date.today()

    current_date_alias = get_date_alias_by_date(
        target_date=target_date,
    )

    scope = build_my_team_scope(
        user_profile=user_profile,
    )

    team_qs = select_progress_period_scope(
        scope=scope,
        date_alias=current_date_alias,
        base_date=target_date,
    )

    team_counts = aggregate_home_status_counts(team_qs)

    today_item = build_progress_today_item(
        scope=scope,
        target_date=target_date,
    )

    week_day_items = build_progress_week_day_items(
        scope=scope,
        date_alias=current_date_alias,
        base_date=target_date,
    )

    return build_my_team_progress_payload(
        affiliation_id=scope["affiliation_id"],
        affiliation_name=scope["affiliation_name"],
        scope_type=scope["scope_type"],
        team_title=scope["title"],
        team_counts=team_counts,
        today_item=today_item,
        week_day_items=week_day_items,
        current_period=build_current_period(
            target_date=target_date,
            date_alias=current_date_alias,
        ),
    )

def select_progress_period_scope(
    *,
    scope: dict,
    date_alias: str,
    base_date,
):
    """
    中央表示の週全体Planを取得する。
    """
    if scope["scope_type"] == "all_teams":
        return select_affiliations_period_plan_scope(
            affiliation_ids=scope["affiliation_ids"],
            date_alias=date_alias,
            base_date=base_date,
        )

    return select_team_period_plan_scope(
        affiliation_id=scope["affiliation_id"],
        date_alias=date_alias,
        base_date=base_date,
    )


def select_progress_day_scope(
    *,
    scope: dict,
    target_date,
):
    """
    中央表示の日別Planを取得する。
    """
    if scope["scope_type"] == "all_teams":
        return select_affiliations_day_plan_scope(
            affiliation_ids=scope["affiliation_ids"],
            target_date=target_date,
        )

    return select_team_day_plan_scope(
        affiliation_id=scope["affiliation_id"],
        target_date=target_date,
    )

def build_home_my_team_day_detail_response(
    *,
    user_profile,
    target_date,
    status_key: str,
) -> dict:
    """
    home中央「今日の進捗」クリック時の詳細カード一覧を作る。

    A/B/C班ユーザー:
      自班の指定日・指定ステータスのPlan

    常昼などA/B/C班以外:
      A/B/C班すべての指定日・指定ステータスのPlan
    """
    scope = build_my_team_scope(
        user_profile=user_profile,
    )

    task_rows = select_progress_day_detail_rows(
        scope=scope,
        target_date=target_date,
        status_key=status_key,
    )

    return build_my_team_day_detail_payload(
        target_date=target_date,
        status_key=status_key,
        task_rows=task_rows,
    )


def select_progress_day_detail_rows(
    *,
    scope: dict,
    target_date,
    status_key: str,
):
    """
    中央詳細表示用の日別・ステータス別Planを取得する。
    """
    if scope["scope_type"] == "all_teams":
        return select_affiliations_day_detail_task_rows(
            affiliation_ids=scope["affiliation_ids"],
            target_date=target_date,
            status_key=status_key,
        )

    return select_team_day_detail_task_rows(
        affiliation_id=scope["affiliation_id"],
        target_date=target_date,
        status_key=status_key,
    )

def build_progress_today_item(*, scope: dict, target_date) -> dict:
    """
    中央表示の今日の進捗を作る。
    """
    today_qs = select_progress_day_scope(
        scope=scope,
        target_date=target_date,
    )

    return {
        "date": target_date,
        "weekday": WD_JA[target_date.weekday()],
        "counts": aggregate_home_status_counts(today_qs),
    }


def build_progress_week_day_items(
    *,
    scope: dict,
    date_alias: str,
    base_date,
) -> list[dict]:
    """
    中央表示の曜日別進捗を作る。

    A/B/C班ユーザー:
      自班の日別進捗

    常昼ユーザー:
      A/B/C班すべての日別進捗
    """
    calendar_days = select_calendar_days_by_date_alias(
        date_alias=date_alias,
        base_date=base_date,
    )

    items = []

    for calendar_day in calendar_days:
        target_date = calendar_day.h_date

        day_qs = select_progress_day_scope(
            scope=scope,
            target_date=target_date,
        )

        items.append({
            "date": target_date,
            "weekday": WD_JA[target_date.weekday()],
            "is_today": target_date == base_date,
            "base_date": base_date,
            "counts": aggregate_home_status_counts(day_qs),
        })

    return items

def build_team_week_day_items(
    *,
    affiliation_id,
    date_alias: str,
    base_date,
) -> list[dict]:
    """
    所属班のdate_alias内の日別進捗を作る。

    UIでは詳細値を全部出さず、曜日ストリップとして使う。
    """
    calendar_days = select_calendar_days_by_date_alias(
        date_alias=date_alias,
        base_date=base_date,
    )

    items = []

    for calendar_day in calendar_days:
        target_date = calendar_day.h_date

        day_qs = select_team_day_plan_scope(
            affiliation_id=affiliation_id,
            target_date=target_date,
        )

        items.append({
            "date": target_date,
            "weekday": WD_JA[target_date.weekday()],
            "is_today": target_date == base_date,
            "base_date": base_date,
            "counts": aggregate_home_status_counts(day_qs),
        })

    return items

def build_team_today_item(*, affiliation_id, target_date) -> dict:
    """
    所属班の今日の進捗を作る。
    """
    today_qs = select_team_day_plan_scope(
        affiliation_id=affiliation_id,
        target_date=target_date,
    )

    return {
        "date": target_date,
        "weekday": WD_JA[target_date.weekday()],
        "counts": aggregate_home_status_counts(today_qs),
    }

def build_overall_counts(*, affiliation_ids: list[int]) -> dict:
    """
    A/B/C班すべてのステータス別件数を作る。

    presenter側で 遅れ / 差戻し のみに絞って返す。
    """
    overall_qs = select_overall_plan_scope(
        affiliation_ids=affiliation_ids,
    )

    return aggregate_home_status_counts(overall_qs)


def build_current_period(*, target_date, date_alias: str) -> dict:
    """
    現在表示している保全カレンダー期間情報。
    """
    return {
        "targetDate": target_date.isoformat(),
        "dateAlias": date_alias or "",
        "found": bool(date_alias),
    }

def build_home_my_tasks_response(*, user_profile) -> dict:
    holder = user_profile.user

    task_rows = list(select_my_incomplete_task_rows(
        holder_id=holder.member_id,
    ))

    shift_context = build_home_shift_context(
        plan_rows=task_rows,
    )

    schedule_date_alias_map = build_plan_schedule_date_alias_map(
        plan_rows=task_rows,
        **shift_context,
    )

    return build_my_tasks_payload(
        holder=holder,
        task_rows=task_rows,
        schedule_date_alias_map=schedule_date_alias_map,
        **shift_context,
    )


def build_home_assign_member_options_response(*, user_profile) -> dict:
    """
    home作業登録モーダル用の作業者候補を返す。

    A/B/C班ユーザー:
      自班メンバーのみ

    常昼などA/B/C班以外:
      A/B/C班すべてのメンバー
    """
    scope = build_my_team_scope(user_profile=user_profile)

    members = select_members_by_affiliation_ids(
        scope["affiliation_ids"]
    )

    return build_home_assign_member_options_payload(
        scope=scope,
        members=members,
    )