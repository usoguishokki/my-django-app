from django.db.models import TextChoices


class DateTag(TextChoices):
    LONG_HOLIDAY = 'LONG_HOLIDAY', '連休'
