from django.db.models import TextChoices


class PlanScheduleUnit(TextChoices):
    DAY = 'D', 'Day'
    WEEK = 'W', 'Week'
    MONTH = 'M', 'Month'
    YEAR = 'Y', 'Year'


class PlanRuleConditionType(TextChoices):
    DAY_OF_WEEK = 'DAY_OF_WEEK', 'Day of week'
    WEEK_PARITY = 'WEEK_PARITY', 'Week parity'
    DATE_TAG = 'DATE_TAG', 'Date tag'
    NEXT_DATE_TAG = 'NEXT_DATE_TAG', 'Next date tag'


class PlanRuleConditionOperator(TextChoices):
    EQ = 'EQ', 'Equals'
    IN = 'IN', 'In'
