from myapp.domain.plan_status import PlanStatus


HOME_SOURCE = "home"
HOME_SCOPE = "my_tasks"
WORK_CONTENTS_SOURCE = "work_contents"
WORK_CONTENTS_SCOPE = "plan"

SUPPORTED_SOURCE_SCOPES = frozenset({
    (HOME_SOURCE, HOME_SCOPE),
    (WORK_CONTENTS_SOURCE, WORK_CONTENTS_SCOPE),
})

EDITABLE_STATUSES = frozenset({
    PlanStatus.IN_PROGRESS,
    PlanStatus.DELAYED,
    PlanStatus.SENT_BACK,
})

RETURN_URLS_BY_SOURCE = {
    HOME_SOURCE: "/home/",
    WORK_CONTENTS_SOURCE: "/workContents/",
}


def is_supported_card_work_contract(*, source, scope):
    return (source, scope) in SUPPORTED_SOURCE_SCOPES


def is_card_work_editable(*, source, status):
    return source in RETURN_URLS_BY_SOURCE and status in EDITABLE_STATUSES


def get_card_work_return_url(source):
    return RETURN_URLS_BY_SOURCE.get(source, "")
