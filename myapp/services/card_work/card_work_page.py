# myapp/services/card_work/card_work_page.py

from myapp.domain.card_work.card_work import (
    parse_card_work_target_date,
    resolve_card_work_status_value,
)

from myapp.selectors.card_work.card_work import (
    apply_card_work_filters,
    select_card_work_filter_options,
    select_card_work_filter_rows,
    select_card_work_my_task_rows,
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

    base_plans_qs = select_card_work_my_task_rows(
        holder_id=login_user.member_id,
        status_value=status_value,
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


def parse_card_work_filters(request):
    return {
        "process": (request.GET.get("process") or "").strip(),
        "equipment": (request.GET.get("equipment") or "").strip(),
        "checkStatus": (request.GET.get("checkStatus") or "").strip(),
    }