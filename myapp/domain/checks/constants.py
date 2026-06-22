# myapp/domain/checks/constants.py
from __future__ import annotations

from myapp.models import CheckStatus, DbDetailStatus


NON_ACTIVE_CHECK_STATUSES = frozenset({
    CheckStatus.MAKER,
    CheckStatus.AUTOMATE,
    CheckStatus.ABOLISHED,
    CheckStatus.SYMPTOM_MGMT,
})

CSV_EXCLUDED_CHECK_STATUSES = NON_ACTIVE_CHECK_STATUSES

DB_DETAIL_EXCLUDED_STATUSES = frozenset({
    DbDetailStatus.MAKER,
    DbDetailStatus.AUTOMATION,
    DbDetailStatus.ABOLISHED,
})