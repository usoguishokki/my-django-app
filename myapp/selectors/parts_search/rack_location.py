# myapp/selectors/parts_search/rack_location.py

from __future__ import annotations

from typing import Any

from myapp.models import (
    PartsRackLocation_tb,
)


def select_active_parts_rack_locations(
) -> list[dict[str, Any]]:
    """
    使用中の部品棚保管場所マスタを取得する。

    部品検索1回につき、Oracleへの問い合わせは
    この1回だけとする。
    """
    return list(
        PartsRackLocation_tb.objects
        .filter(
            is_active=True,
        )
        .values(
            "rack_no",
            "location_name",
            "location_note",
            "display_order",
        )
        .order_by(
            "display_order",
            "rack_no",
        )
    )