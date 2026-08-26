from django.db.models import IntegerChoices


class DayOfWeek(IntegerChoices):
    MON = 0, "月"
    TUE = 1, "火"
    WED = 2, "水"
    THU = 3, "木"
    FRI = 4, "金"
    SAT = 5, "土"
    SUN = 6, "日"
