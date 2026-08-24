# myapp/presenters/parts_search/parts_search.py

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Union

from myapp.domain.parts_search.parts_search import (
    PARTS_SEARCH_RESULT_LIMIT,
    PartsSearchResult,
    resolve_parts_section,
)


QuantityValue = Union[int, float]


def _normalize_text(
    value: Any,
) -> str:
    """
    画面表示用の文字列へ変換する。

    DBのNULLは空文字として扱う。
    """
    if value is None:
        return ""

    return str(
        value
    ).strip()


def _normalize_quantity(
    value: Any,
) -> QuantityValue:
    """
    在庫数をJSONで扱える数値へ変換する。

    ・NULLは0
    ・整数値はint
    ・小数値はfloat
    ・数値変換できない値は0
    """
    if value is None:
        return 0

    if isinstance(
        value,
        bool,
    ):
        return int(
            value
        )

    if isinstance(
        value,
        int,
    ):
        return value

    if isinstance(
        value,
        float,
    ):
        return value

    if isinstance(
        value,
        Decimal,
    ):
        decimal_value = value
    else:
        try:
            decimal_value = Decimal(
                str(
                    value
                ).strip()
            )
        except (
            InvalidOperation,
            TypeError,
            ValueError,
        ):
            return 0

    if (
        decimal_value
        == decimal_value.to_integral_value()
    ):
        return int(
            decimal_value
        )

    return float(
        decimal_value
    )


def _build_storage_location_label(
    *,
    location_name: str,
    location_note: str,
) -> str:
    """
    保管場所と補足を
    画面表示用の文字列へまとめる。

    例:
        302NS南通路（成形1号機関係）
    """
    if not location_name:
        return ""

    if not location_note:
        return location_name

    return (
        f"{location_name}"
        f"（{location_note}）"
    )


def _present_parts_item(
    item: dict[str, Any],
) -> dict[str, Any]:
    """
    部品検索結果1件を
    APIレスポンス用へ変換する。
    """
    rack_level1 = _normalize_text(
        item.get(
            "rack_level1"
        )
    )

    rack_location_no = _normalize_text(
        item.get(
            "rack_location_no"
        )
    )

    storage_location_name = _normalize_text(
        item.get(
            "storage_location_name"
        )
    )

    storage_location_note = _normalize_text(
        item.get(
            "storage_location_note"
        )
    )

    resolved_section = resolve_parts_section(
        rack_level1
    )

    return {
        "group_cd": _normalize_text(
            item.get(
                "group_cd"
            )
        ),
        "barcode": _normalize_text(
            item.get(
                "barcode"
            )
        ),
        "rack_level1": rack_level1,
        "section": (
            resolved_section.code
            if resolved_section
            else ""
        ),
        "section_label": (
            resolved_section.label
            if resolved_section
            else ""
        ),
        "rack_location_no":
            rack_location_no,
        "storage_location_name":
            storage_location_name,
        "storage_location_note":
            storage_location_note,
        "storage_location_label":
            _build_storage_location_label(
                location_name=(
                    storage_location_name
                ),
                location_note=(
                    storage_location_note
                ),
            ),
        "parts_name": _normalize_text(
            item.get(
                "parts_name"
            )
        ),
        "parts_model": _normalize_text(
            item.get(
                "parts_model"
            )
        ),
        "new_stock_qty": _normalize_quantity(
            item.get(
                "new_stock_qty"
            )
        ),
        "used_stock_qty": _normalize_quantity(
            item.get(
                "used_stock_qty"
            )
        ),
        "parts_note": _normalize_text(
            item.get(
                "parts_note"
            )
        ),
    }


def present_parts_search_result(
    result: PartsSearchResult,
) -> dict[str, Any]:
    """
    部品検索結果を
    APIレスポンス用の辞書へ変換する。
    """
    items = [
        _present_parts_item(
            item
        )
        for item in result.items
    ]

    return {
        "success": True,
        "query":
            result.criteria.as_dict(),
        "summary": {
            "count":
                result.count,
            "found":
                result.found,
            "limit":
                PARTS_SEARCH_RESULT_LIMIT,
        },
        "items": items,
    }