from __future__ import annotations

from typing import Final


HOZEN_DATE_ALIASES: Final[tuple[str, ...]] = (
    '4月1週目', '4月2週目', '4月3週目', '4月4週目',
    '5月1週目', '5月2週目', '5月3週目', '5月4週目',
    '6月1週目', '6月2週目', '6月3週目', '6月4週目',
    '7月1週目', '7月2週目', '7月3週目', '7月4週目',
    '8月1週目', '8月2週目', '8月3週目', '8月4週目',
    '9月1週目', '9月2週目', '9月3週目', '9月4週目',
    '10月1週目', '10月2週目', '10月3週目', '10月4週目',
    '11月1週目', '11月2週目', '11月3週目', '11月4週目',
    '12月1週目', '12月2週目', '12月3週目', '12月4週目',
    '1月1週目', '1月2週目', '1月3週目', '1月4週目',
    '2月1週目', '2月2週目', '2月3週目', '2月4週目',
    '3月1週目', '3月2週目', '3月3週目', '3月4週目',
    '4月連休', '8月連休', '12月連休', '予備週',
)


def build_hozen_date_alias_options(
    active_date_alias: str | None = None,
) -> list[dict[str, object]]:
    return [
        {
            'key': date_alias,
            'label': date_alias,
            'isActive': date_alias == active_date_alias,
        }
        for date_alias in HOZEN_DATE_ALIASES
    ]