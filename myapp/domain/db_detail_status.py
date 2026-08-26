from django.db.models import TextChoices


class DbDetailStatus(TextChoices):
    NORMAL = "通常", "通常"
    MAKER = "メーカ", "メーカ"
    AUTOMATION = "自動化", "自動化"
    ABOLISHED = "廃止", "廃止"
