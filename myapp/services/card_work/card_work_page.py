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
    select_card_work_plan_for_organization,
    with_card_work_detail_related,
)

from myapp.selectors.members import select_all_members

from myapp.presenters.card_work.card_work import (
    build_card_work_error_state,
    build_card_work_initial_state,
)
from myapp.services.card_work.card_work_access import (
    HOME_SCOPE,
    HOME_SOURCE,
    WORK_CONTENTS_SCOPE,
    WORK_CONTENTS_SOURCE,
    get_card_work_return_url,
    is_card_work_editable,
    is_supported_card_work_contract,
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

    if not is_supported_card_work_contract(source=source, scope=scope):
        return build_card_work_error_state(
            message="Card Workの起動元が正しくありません。",
            source=source,
            scope=scope,
            status_key=status_key,
            date_text=date_text,
        )

    if source == WORK_CONTENTS_SOURCE:
        return build_card_work_initial_state_from_work_contents(
            plan_id_text=plan_id_text,
            organization_code=request.organization_code,
            team_profiles=team_profiles,
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

    selected_plan_id = resolve_selected_plan_id(
        plans=plans,
        plan_id_text=plan_id_text,
    )
    if plan_id_text and selected_plan_id is None:
        return build_card_work_error_state(
            message="対象カードが見つかりません。",
            source=source,
            scope=scope,
            status_key=status_key,
            date_text=date_text,
        )

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
        selected_plan_id=selected_plan_id,
        return_url=get_card_work_return_url(source),
        editability_by_plan_id=build_plan_editability(
            source=source,
            plans=plans,
            requested_user=login_user,
        ),
    )


def build_card_work_initial_state_from_work_contents(
    *,
    plan_id_text,
    organization_code,
    team_profiles,
):
    try:
        plan_id = int(plan_id_text)
    except (TypeError, ValueError):
        return build_card_work_error_state(
            message="plan_id が正しくありません。",
            source=WORK_CONTENTS_SOURCE,
            scope=WORK_CONTENTS_SCOPE,
        )

    base_plans_qs = select_card_work_plan_for_organization(
        plan_id=plan_id,
        organization_code=organization_code,
    )
    plans = list(with_card_work_detail_related(base_plans_qs)[:1])

    if not plans:
        return build_card_work_error_state(
            message="対象カードが見つかりません。",
            source=WORK_CONTENTS_SOURCE,
            scope=WORK_CONTENTS_SCOPE,
        )

    login_user = team_profiles["user_profile"].user
    members = list(select_all_members())
    plan = plans[0]

    return build_card_work_initial_state(
        source=WORK_CONTENTS_SOURCE,
        scope=WORK_CONTENTS_SCOPE,
        status_key="",
        status_label=plan.status or "",
        date_text="",
        plans=plans,
        members=members,
        login_user=login_user,
        active_filters={},
        filter_options=select_card_work_filter_options(base_plans_qs),
        filter_rows=select_card_work_filter_rows(base_plans_qs),
        summary_count=1,
        selected_plan_id=plan.plan_id,
        return_url=get_card_work_return_url(WORK_CONTENTS_SOURCE),
        editability_by_plan_id=build_plan_editability(
            source=WORK_CONTENTS_SOURCE,
            plans=plans,
            requested_user=login_user,
        ),
    )


def resolve_selected_plan_id(*, plans, plan_id_text):
    if not plans:
        return None

    if not plan_id_text:
        return plans[0].plan_id

    try:
        plan_id = int(plan_id_text)
    except (TypeError, ValueError):
        return None

    return next(
        (plan.plan_id for plan in plans if plan.plan_id == plan_id),
        None,
    )


def build_plan_editability(*, source, plans, requested_user):
    return {
        plan.plan_id: is_card_work_editable(
            source=source,
            status=plan.status,
            plan_holder_id=plan.holder_id,
            requested_member_id=requested_user.member_id,
        )
        for plan in plans
    }


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
