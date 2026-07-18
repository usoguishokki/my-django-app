# myapp/presenters/inspection_detail_items.py

from __future__ import annotations


def build_inspection_detail_items(check) -> list[dict[str, str]]:
    """
    点検カードの明細を、カード表示用の共通形式に整形する。

    home の未完了タスク、schedule の点検カードなど、
    「対象部位 + 点検内容」を表示するカードで共通利用する。
    """
    if not check:
        return []

    details = getattr(check, "db_details", None)

    if details is None:
        return []

    return [
        {
            "applicableDevice": detail.applicable_device or "",
            "contents": detail.contents or "",
        }
        for detail in details.all()
        if detail.applicable_device or detail.contents
    ]