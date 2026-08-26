from django.db.models import Count, Q, Sum

from myapp.models import PlanStatus, Plan_tb

from myapp.domain.time_zone_status import TimeZoneStatus


def select_achievement_daily_aggregates(
    *,
    login_number,
    start_date,
    end_date,
):
    return (
        Plan_tb.objects
        .filter(
            status__in=(
                PlanStatus.COMPLETED.value,
                PlanStatus.APPROVAL_WAITING.value,
            ),
            implementation_date__range=(
                start_date,
                end_date,
            ),
            practitioners__member_id=login_number,
        )
        .values(
            "implementation_date",
        )
        .annotate(
            total_count=Count(
                "plan_id",
            ),
            active_hours=Sum(
                "result_man_hours",
                filter=Q(
                    inspection_no__time_zone=(
                        TimeZoneStatus.RUNNING.value
                    ),
                ),
            ),
            inactive_hours=Sum(
                "result_man_hours",
                filter=Q(
                    inspection_no__time_zone=(
                        TimeZoneStatus.STOPPED.value
                    ),
                ),
            ),
        )
        .order_by(
            "implementation_date",
        )
    )
