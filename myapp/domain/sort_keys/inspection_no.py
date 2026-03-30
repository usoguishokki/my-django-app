# myapp/domain/inspection_no.py
from __future__ import annotations
import re
from typing import Any, Tuple

_NUM_RE = re.compile(r"\d+")

def inspection_no_sort_key(v: Any) -> Tuple[str, ...]:
    """
    inspection_no を「自然順」で並べるためのキーを返す。
    - 文字と数字を交互に分解し、数字部分は int 化して比較する
    - 例外は投げない（値がNone/空でもOK）
    例:
      'KJ-09-001' -> ('kj-', 9, '-', 1)
      'KJ-9-10'   -> ('kj-', 9, '-', 10)
      'ABC2'      -> ('abc', 2)
      'abc10'     -> ('abc', 10)
    """
    s = "" if v is None else str(v)
    if s == "":
        # 空は最後に寄せたいなら大きい値にする等、運用に合わせて調整可
        return ("",)

    parts = _NUM_RE.split(s)
    nums = _NUM_RE.findall(s)

    key = []
    # parts は nums より 1つ多い（末尾に文字列が入る）
    for i, p in enumerate(parts):
        if p:
            key.append(p.lower())
        if i < len(nums):
            # 数字は int で比較（ゼロ埋め不要）
            try:
                key.append(int(nums[i]))
            except ValueError:
                # 万一数字扱いできないなら文字として扱う（例外は出さない）
                key.append(nums[i])

    return tuple(key)