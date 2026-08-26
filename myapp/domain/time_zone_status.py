from django.db.models import TextChoices


class TimeZoneStatus(TextChoices):
    RUNNING = "稼働中", "稼働中"
    STOPPED = "停止中", "停止中"
