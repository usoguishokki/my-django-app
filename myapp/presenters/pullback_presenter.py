from myapp.presenters.plan_detail_presenter import build_plan_row_payload


def build_single_pullback_payload(*, plan):
    return {
        "status": "success",
        "update_weekly_duty": build_plan_row_payload(plan),
    }


def build_bulk_pullback_payload():
    return {
        "status": "success",
    }