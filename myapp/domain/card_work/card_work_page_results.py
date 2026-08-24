from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CardWorkPageSuccessResult:
    source: str
    scope: str
    status_key: str
    status_label: str
    date_text: str
    plans: Any
    members: Any
    login_user: Any
    active_filters: dict
    filter_options: Any
    filter_rows: Any
    summary_count: int


@dataclass(frozen=True)
class CardWorkPageErrorResult:
    message: str
    source: str = ""
    scope: str = ""
    status_key: str = ""
    date_text: str = ""
