# myapp/services/card_work/card_work_page.py

from myapp.domain.card_work.card_work import (
    parse_card_work_target_date,
    resolve_card_work_status_value,
)

from myapp.domain.plan_dates import (
    resolve_plan_display_date,
)

from myapp.services.plan_shift_context import (
    build_plan_shift_context,
)

from myapp.selectors.card_work.card_work import (
    apply_card_work_filters,
    select_card_work_filter_options,
    select_card_work_filter_rows,
    select_card_work_my_task_candidate_rows,
    select_card_work_plan_by_id,
    with_card_work_detail_related,
)

from myapp.selectors.members import select_all_members

from myapp.presenters.card_work.card_work import (
    build_card_work_error_state,
    build_card_work_initial_state,
)


def build_card_work_page_context(*, request, team_profiles):
    initial_state = build_card_work_initial_state_from_request(
        request=request,
        team_profiles=team_profiles,
    )

    return {
        "card_work_initial_state": initial_state,
    }


def build_card_work_initial_state_from_request(*, request, team_profiles):
    source = request.GET.get("source", "")
    scope = request.GET.get("scope", "")
    status_key = request.GET.get("status", "")
    date_text = request.GET.get("date", "")
    plan_id_text = (request.GET.get("plan_id") or "").strip()

    if source == "work_contents" and scope == "plan":
        return build_card_work_initial_state_from_work_contents(
            plan_id_text=plan_id_text,
            team_profiles=team_profiles,
        )

    if source != "home" or scope != "my_tasks":
        return build_card_work_error_state(
            message="このカード作業画面はhomeから開いてください。",
            source=source,
            scope=scope,
            status_key=status_key,
            date_text=date_text,
        )

    target_date = parse_card_work_target_date(date_text)
    status_value = resolve_card_work_status_value(status_key)

    if not target_date:
        return build_card_work_error_state(
            message="date の形式が正しくありません。",
            source=source,
            scope=scope,
            status_key=status_key,
            date_text=date_text,
        )

    if not status_value:
        return build_card_work_error_state(
            message="対象外のステータスです。",
            source=source,
            scope=scope,
            status_key=status_key,
            date_text=date_text,
        )

    login_user = team_profiles["user_profile"].user
    active_filters = parse_card_work_filters(request)

    candidate_plans_qs = select_card_work_my_task_candidate_rows(
        holder_id=login_user.member_id,
        status_value=status_value,
    )

    base_plans_qs = filter_card_work_plans_by_display_date(
        candidate_plans_qs=candidate_plans_qs,
        target_date=target_date,
    )

    summary_count = base_plans_qs.count()

    filter_options = select_card_work_filter_options(base_plans_qs)
    filter_rows = select_card_work_filter_rows(base_plans_qs)

    plans_qs = apply_card_work_filters(
        base_plans_qs,
        process=active_filters["process"],
        equipment=active_filters["equipment"],
        check_status=active_filters["checkStatus"],
    )

    plans_qs = with_card_work_detail_related(plans_qs)

    plans = list(plans_qs[:300])
    members = list(select_all_members())

    return build_card_work_initial_state(
        source=source,
        scope=scope,
        status_key=status_key,
        status_label=status_value,
        date_text=date_text,
        plans=plans,
        members=members,
        login_user=login_user,
        active_filters=active_filters,
        filter_options=filter_options,
        filter_rows=filter_rows,
        summary_count=summary_count,
    )


def build_card_work_initial_state_from_work_contents(
    *,
    plan_id_text,
    team_profiles,
):
    try:
        plan_id = int(plan_id_text)
    except (TypeError, ValueError):
        return build_card_work_error_state(
            message="plan_id が正しくありません。",
            source="work_contents",
            scope="plan",
        )

    base_plans_qs = select_card_work_plan_by_id(
        plan_id=plan_id,
    )

    plans_qs = with_card_work_detail_related(
        base_plans_qs,
    )

    plans = list(plans_qs[:1])

    if not plans:
        return build_card_work_error_state(
            message="対象カードが見つかりません。",
            source="work_contents",
            scope="plan",
        )

    login_user = team_profiles["user_profile"].user
    members = list(select_all_members())

    filter_options = select_card_work_filter_options(
        base_plans_qs,
    )

    filter_rows = select_card_work_filter_rows(
        base_plans_qs,
    )

    return build_card_work_initial_state(
        source="work_contents",
        scope="plan",
        status_key="",
        status_label=plans[0].status or "",
        date_text="",
        plans=plans,
        members=members,
        login_user=login_user,
        active_filters={},
        filter_options=filter_options,
        filter_rows=filter_rows,
        summary_count=len(plans),
    )


def parse_card_work_filters(request):
    return {
        "process": (request.GET.get("process") or "").strip(),
        "equipment": (request.GET.get("equipment") or "").strip(),
        "checkStatus": (request.GET.get("checkStatus") or "").strip(),
    }


def filter_card_work_plans_by_display_date(
    *,
    candidate_plans_qs,
    target_date,
):
    """
    候補PlanをHomeと同じシフト表示日で絞り込む。

    plan_timeの実日付ではなく、
    resolve_plan_display_date()が返すシフト日を使用する。

    戻り値は後続のcount・filter・values_listを使用できるよう、
    QuerySetのまま返す。
    """
    if not target_date:
        return candidate_plans_qs.none()

    candidate_plans = list(candidate_plans_qs)

    if not candidate_plans:
        return candidate_plans_qs.none()

    shift_context = build_plan_shift_context(
        plan_rows=candidate_plans,
    )

    target_plan_ids = [
        plan.plan_id
        for plan in candidate_plans
        if resolve_plan_display_date(
            plan,
            **shift_context,
        ) == target_date
    ]

    if not target_plan_ids:
        return candidate_plans_qs.none()

    return candidate_plans_qs.filter(
        plan_id__in=target_plan_ids,
    )