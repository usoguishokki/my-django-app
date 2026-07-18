# myapp/domain/card_work/card_work.py

from datetime import datetime

from myapp.domain.home.progress import get_status_value_map


CARD_WORK_OPENABLE_STATUS_KEYS = {
    "in_progress",
    "sent_back",
    "delayed",
}


def resolve_card_work_status_value(status_key: str) -> str:
    """
    URLのstatusKeyをDBステータス値へ変換する。
    """
    if status_key not in CARD_WORK_OPENABLE_STATUS_KEYS:
        return ""

    return get_status_value_map().get(status_key, "")


def parse_card_work_target_date(date_text: str):
    """
    URLのdateを date 型へ変換する。
    """
    if not date_text:
        return None

    try:
        return datetime.strptime(date_text, "%Y-%m-%d").date()
    except ValueError:
        return None