from myapp.models import Control_tb


def get_controls_for_inspection_standard_machine_options():
    return list(
        Control_tb.objects
        .exclude(machine__isnull=True)
        .exclude(machine__exact="")
        .values("control_no", "machine")
        .order_by("machine", "control_no")
    )