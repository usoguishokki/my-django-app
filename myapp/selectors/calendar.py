# myapp/selectors/calendar.py
from __future__ import annotations

from datetime import date

from collections import defaultdict
from django.db.models import Q, QuerySet, OuterRef, Subquery

from myapp.domain.periods import YearMonth
from myapp.models import Hozen_calendar_tb
from myapp.models import Calendar_tb

from myapp.selectors.hozen_calendar import get_h_id_by_date


def calendar_rows_for_year_months(year_months: list[YearMonth]) -> QuerySet[Hozen_calendar_tb]:
    """
    指定した YearMonth 一覧に該当する保全カレンダーを返す。
    """
    if not year_months:
        return Hozen_calendar_tb.objects.none()

    grouped_months: dict[int, set[int]] = defaultdict(set)
    for ym in year_months:
        grouped_months[ym.year].add(ym.month)

    condition = Q()
    for year, months in grouped_months.items():
        condition |= (
            Q(h_date__year=year) &
            Q(h_month__in=sorted(months))
        )

    return (
        Hozen_calendar_tb.objects
        .filter(condition)
        .order_by("h_date", "h_id")
    )


def group_calendar_rows_by_year_month(
    calendar_rows: QuerySet[Hozen_calendar_tb] | list[Hozen_calendar_tb],
) -> dict[str, list[Hozen_calendar_tb]]:
    """
    保全カレンダーを YYYY-MM ごとにまとめる。
    """
    grouped: dict[str, list[Hozen_calendar_tb]] = defaultdict(list)

    for row in calendar_rows:
        key = row.h_date.strftime("%Y-%m")
        grouped[key].append(row)

    return dict(grouped)

def get_pattern_id_by_date_and_belongs_id(*, target_date: date, belongs_id: int) -> int | None:
    h_id = get_h_id_by_date(target_date)
    if h_id is None:
        return None

    return (
        Calendar_tb.objects
        .filter(
            c_date_id=h_id,
            affilation_id=belongs_id,
        )
        .values_list("pattern_id", flat=True)
        .first()
    )
    
def annotate_plan_affiliation_from_calendar(qs):
    calendar_match = (
        Calendar_tb.objects
        .filter(
            c_date_id=OuterRef("p_date_id"),
            pattern_id=OuterRef("inspection_no__practitioner_id"),
        )
    )

    return qs.annotate(
        calendar_affiliation_id=Subquery(
            calendar_match.values("affilation_id")[:1]
        ),
        calendar_affiliation_name=Subquery(
            calendar_match.values("affilation__affilation")[:1]
        ),
    )
    
    
def select_calendar_by_date_and_affiliation(*, target_date: date, affiliation_id: int):
    return (
        Calendar_tb.objects
        .select_related("pattern", "c_date", "affilation")
        .filter(
            c_date__h_date=target_date,
            affilation_id=affiliation_id,
        )
        .first()
    )