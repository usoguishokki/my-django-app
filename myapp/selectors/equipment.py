from myapp.models import Control_tb, Check_tb


def _equipment_base_qs():
    return (
        Control_tb.objects
        .select_related(
            "line_name",
        )
    )


def get_equipment_by_control_no(
    *,
    control_no,
):
    return (
        _equipment_base_qs()
        .get(
            control_no=control_no,
        )
    )


def find_equipment_by_control_no(
    *,
    control_no,
):
    return (
        _equipment_base_qs()
        .filter(
            control_no=control_no,
        )
        .first()
    )


def select_checks_by_control(
    *,
    equipment,
):
    return list(
        Check_tb.objects
        .filter(
            control_no=equipment,
        )
        .select_related(
            "control_no",
            "control_no__line_name",
            "practitioner",
        )
        .prefetch_related(
            "db_details",
        )
        .order_by(
            "id",
        )
    )
