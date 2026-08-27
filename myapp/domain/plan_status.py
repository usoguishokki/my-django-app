from django.db.models import TextChoices


class PlanStatus(TextChoices):
    WAITING = '配布待ち', '配布待ち'
    IN_PROGRESS = '実施待ち', '実施待ち'
    APPROVAL_WAITING = '承認待ち', '承認待ち'
    COMPLETED = '完了', '完了'
    SENT_BACK = '差戻し', '差戻し'
    DELAYED = '遅れ', '遅れ'
