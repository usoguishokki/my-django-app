from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class InspectionStandardDetailsResult:
    rows: Any


@dataclass(frozen=True)
class InspectionStandardCommonItemOptionsResult:
    rules: Any
    shift_patterns: Any


@dataclass(frozen=True)
class InspectionStandardCommonItemsUpdateResult:
    check: Any
    plan_sync_result: Any = None


@dataclass(frozen=True)
class InspectionStandardCardCreateResult:
    check: Any
    detail_count: int
