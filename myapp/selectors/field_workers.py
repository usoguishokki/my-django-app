from myapp.models import Field_worker_tb


FACTORY_LINE_FRAME_PATTERN_NAMES = (
    "1直",
    "2直",
)


def select_factory_line_frame_workers():
    return tuple(
        Field_worker_tb.objects
        .filter(
            pattern_name__in=FACTORY_LINE_FRAME_PATTERN_NAMES,
        )
        .order_by("pattern_id")
    )
