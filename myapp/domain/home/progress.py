# myapp/domain/home/progress.py

from typing import Mapping, Optional

from myapp.models import PlanStatus


STATUS_COUNT_KEYS = (
    "waiting",
    "in_progress",
    "approval_waiting",
    "completed",
    "sent_back",
    "delayed",
)

ALL_COUNT_KEYS = STATUS_COUNT_KEYS + (
    "remaining",
    "total",
)


def to_int(value) -> int:
    """
    None や文字列数値を安全に int 化する。
    """
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def calc_rate(*, numerator: int, denominator: int) -> int:
    """
    UI表示用のパーセントを計算する。
    小数は四捨五入して整数で返す。
    """
    if denominator <= 0:
        return 0

    return round((numerator / denominator) * 100)


def normalize_status_counts(counts: Optional[Mapping]) -> dict:
    """
    DB集計結果をhome画面で扱いやすい形に正規化する。

    remaining は「完了以外すべて」とする。
    """
    source = counts or {}

    normalized = {
        key: to_int(source.get(key))
        for key in ALL_COUNT_KEYS
    }

    status_total = sum(
        normalized[key]
        for key in STATUS_COUNT_KEYS
    )

    total = normalized["total"] or status_total
    completed = normalized["completed"]

    normalized["total"] = total
    normalized["remaining"] = max(total - completed, 0)

    return normalized


def detect_progress_health(counts: Mapping) -> str:
    """
    UI側の色分け用状態を返す。

    empty    : 対象なし
    danger   : 遅れあり
    warning  : 差戻し or 承認待ちあり
    complete : すべて完了
    normal   : 通常
    """
    total = to_int(counts.get("total"))
    delayed = to_int(counts.get("delayed"))
    sent_back = to_int(counts.get("sent_back"))
    approval_waiting = to_int(counts.get("approval_waiting"))
    remaining = to_int(counts.get("remaining"))

    if total == 0:
        return "empty"

    if delayed > 0:
        return "danger"

    if sent_back > 0 or approval_waiting > 0:
        return "warning"

    if remaining == 0:
        return "complete"

    return "normal"


def build_progress_summary(counts: Optional[Mapping]) -> dict:
    """
    home画面用の進捗サマリーを作る。

    左側：全体
    中央：所属班
    右側：個人別

    すべてこの関数を使えるようにする。
    """
    normalized_counts = normalize_status_counts(counts)

    total = normalized_counts["total"]
    completed = normalized_counts["completed"]
    remaining = normalized_counts["remaining"]

    completed_rate = calc_rate(
        numerator=completed,
        denominator=total,
    )

    remaining_rate = calc_rate(
        numerator=remaining,
        denominator=total,
    )

    return {
        "counts": normalized_counts,
        "rates": {
            "completed": completed_rate,
            "remaining": remaining_rate,
        },
        "health": detect_progress_health(normalized_counts),
    }


def get_status_value_map() -> dict:
    """
    selector側でステータス集計を作るときに使う。
    """
    return {
        "waiting": PlanStatus.WAITING.value,
        "in_progress": PlanStatus.IN_PROGRESS.value,
        "approval_waiting": PlanStatus.APPROVAL_WAITING.value,
        "completed": PlanStatus.COMPLETED.value,
        "sent_back": PlanStatus.SENT_BACK.value,
        "delayed": PlanStatus.DELAYED.value,
    }

def build_attention_summary(counts: Optional[Mapping]) -> dict:
    """
    home左側「全体」用。

    年間全体では配布待ちが多くて当然なので、
    全体では見るべき 実施待ち / 承認待ち / 差戻し / 遅れ を返す。
    """
    normalized_counts = normalize_status_counts(counts)

    in_progress = normalized_counts["in_progress"]
    approval_waiting = normalized_counts["approval_waiting"]
    sent_back = normalized_counts["sent_back"]
    delayed = normalized_counts["delayed"]

    total = (
        in_progress +
        approval_waiting +
        sent_back +
        delayed
    )

    return {
        "counts": {
            "in_progress": in_progress,
            "approval_waiting": approval_waiting,
            "sent_back": sent_back,
            "delayed": delayed,
            "total": total,
        },
        "health": detect_attention_health(
            delayed=delayed,
            sent_back=sent_back,
            approval_waiting=approval_waiting,
        ),
    }


def detect_attention_health(
    *,
    delayed: int,
    sent_back: int,
    approval_waiting: int,
) -> str:
    """
    全体注意項目の状態。
    """
    if delayed > 0:
        return "danger"

    if sent_back > 0 or approval_waiting > 0:
        return "warning"

    return "normal"


def build_focus_progress_summary(counts: Optional[Mapping]) -> dict:
    """
    UIのメイン表示用に、見るべき項目だけに絞った進捗サマリーを作る。

    中央の「今日の進捗」で使う。
    """
    summary = build_progress_summary(counts)
    normalized_counts = summary["counts"]

    return {
        "counts": {
            "waiting": normalized_counts["waiting"],
            "in_progress": normalized_counts["in_progress"],
            "approval_waiting": normalized_counts["approval_waiting"],
            "delayed": normalized_counts["delayed"],
            "total": normalized_counts["total"],
        },
        "rates": {
            "completed": summary["rates"]["completed"],
        },
        "health": summary["health"],
    }


def detect_weekday_state(
    counts: Optional[Mapping],
    *,
    target_date,
    base_date,
) -> str:
    """
    曜日ストリップ用の状態を返す。

    優先順位:
      1. 対象なし
      2. 遅れ
      3. 過去日の残あり
      4. 承認待ち
      5. 完了
      6. 今日
      7. 未来日
    """
    normalized_counts = normalize_status_counts(counts)

    total = normalized_counts["total"]
    remaining = normalized_counts["remaining"]
    delayed = normalized_counts["delayed"]
    approval_waiting = normalized_counts["approval_waiting"]

    if total == 0:
        return "empty"

    if delayed > 0:
        return "danger"

    if target_date < base_date and remaining > 0:
        return "pending"

    if approval_waiting > 0:
        return "warning"

    if remaining == 0:
        return "done"

    if target_date == base_date:
        return "today"

    if target_date > base_date:
        return "future"

    return "pending"