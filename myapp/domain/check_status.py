from django.db.models import TextChoices


class CheckStatus(TextChoices):
    DAILY = '日常点検', '日常点検'
    PERIODIC = '定期点検', '定期点検'
    SYMPTOM_MGMT = '兆候管理', '兆候管理'
    AUTOMATE = '自動化', '自動化'
    MAKER = 'メーカ', 'メーカ'
    ABOLISHED = '廃止', '廃止'
