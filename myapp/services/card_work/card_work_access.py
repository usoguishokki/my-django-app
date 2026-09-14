from myapp.domain.plan_status import PlanStatus


HOME_SOURCE = "home"
HOME_SCOPE = "my_tasks"
WORK_CONTENTS_SOURCE = "work_contents"
WORK_CONTENTS_SCOPE = "plan"

SUPPORTED_SOURCE_SCOPES = frozenset({
    (HOME_SOURCE, HOME_SCOPE),
    (WORK_CONTENTS_SOURCE, WORK_CONTENTS_SCOPE),
})

EDITABLE_STATUSES_BY_SOURCE = {
    HOME_SOURCE: frozenset({
        PlanStatus.IN_PROGRESS,
        PlanStatus.APPROVAL_WAITING,
        PlanStatus.DELAYED,
        PlanStatus.SENT_BACK,
    }),
    WORK_CONTENTS_SOURCE: frozenset({
        PlanStatus.IN_PROGRESS,
        PlanStatus.DELAYED,
        PlanStatus.SENT_BACK,
    }),
}

RETURN_URLS_BY_SOURCE = {
    HOME_SOURCE: "/home/",
    WORK_CONTENTS_SOURCE: "/workContents/",
}


def is_supported_card_work_contract(*, source, scope):
    return (source, scope) in SUPPORTED_SOURCE_SCOPES


def is_card_work_editable(
    *,
    source,
    status,
    plan_holder_id="",
    requested_member_id="",
):
    editable_statuses = EDITABLE_STATUSES_BY_SOURCE.get(source, frozenset())

    if status not in editable_statuses:
        return False

    if source == HOME_SOURCE:
        return bool(
            plan_holder_id
            and requested_member_id
            and plan_holder_id == requested_member_id
        )

    return True


def get_card_work_return_url(source):
    return RETURN_URLS_BY_SOURCE.get(source, "")
