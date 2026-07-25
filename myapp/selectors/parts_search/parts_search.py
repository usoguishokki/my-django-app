# myapp/selectors/parts_search/parts_search.py

from __future__ import annotations

from typing import Any

from myapp.domain.parts_search.parts_search import (
    PARTS_SEARCH_RESULT_LIMIT,
    PartsSearchCriteria,
)
from myapp.infrastructure.marp.connection import (
    marp_connection,
)


PARTS_SEARCH_SELECT_SQL = f"""
SELECT TOP ({PARTS_SEARCH_RESULT_LIMIT})
    p.GROUP_CD AS group_cd,
    p.PARTS_NO AS barcode,
    s.RACK_LEVEL1 AS rack_level1,
    p.PARTS_NAME AS parts_name,
    p.PARTS_MODEL AS parts_model,
    COALESCE(s.NEW_STOCK_QTY, 0) AS new_stock_qty,
    COALESCE(s.USED_STOCK_QTY, 0) AS used_stock_qty,
    p.PARTS_NOTE AS parts_note
FROM
    dbo.MST_PARTS AS p
LEFT JOIN
    dbo.MST_STOCK AS s
        ON p.GROUP_CD = s.GROUP_CD
       AND p.PARTS_NO = s.PARTS_NO
       AND s.DELETED_FLG = '0'
"""


PARTS_SEARCH_DEFAULT_ORDER_BY_SQL = """
ORDER BY
    p.PARTS_NO,
    p.GROUP_CD,
    s.RACK_LEVEL1
"""


PARTS_SEARCH_BARCODE_ORDER_BY_SQL = """
ORDER BY
    CASE
        WHEN p.PARTS_NO = ? THEN 0
        WHEN p.PARTS_NO LIKE ? ESCAPE '\\' THEN 1
        ELSE 2
    END,
    p.PARTS_NO,
    p.GROUP_CD,
    s.RACK_LEVEL1
"""


SEARCH_FIELD_DEFINITIONS = (
    (
        "barcode",
        "p.PARTS_NO",
    ),
    (
        "rack_level1",
        "s.RACK_LEVEL1",
    ),
    (
        "parts_name",
        "p.PARTS_NAME",
    ),
    (
        "parts_model",
        "p.PARTS_MODEL",
    ),
)


def _escape_like_value(
    value: str,
) -> str:
    """
    SQL ServerのLIKE検索で特殊な意味を持つ文字を
    通常の文字として検索できるようにする。
    """
    return (
        value
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


def _build_contains_parameter(
    value: str,
) -> str:
    """
    部分一致検索用のパラメーターを生成する。
    """
    escaped_value = _escape_like_value(
        value
    )

    return f"%{escaped_value}%"


def _build_starts_with_parameter(
    value: str,
) -> str:
    """
    前方一致検索用のパラメーターを生成する。
    """
    escaped_value = _escape_like_value(
        value
    )

    return f"{escaped_value}%"


def _build_section_condition(
    rack_prefixes: tuple[str, ...],
) -> tuple[str, tuple[str, ...]]:
    """
    係に対応する棚番の前方一致条件を生成する。

    複数の棚番プレフィックスはORで結合する。

    例:
        (
            s.RACK_LEVEL1 LIKE '1R%'
            OR s.RACK_LEVEL1 LIKE '3R%'
        )
    """
    if not rack_prefixes:
        return "", ()

    conditions = [
        "s.RACK_LEVEL1 LIKE ? ESCAPE '\\'"
        for _ in rack_prefixes
    ]

    condition_sql = (
        "(\n"
        "        "
        + "\n        OR ".join(
            conditions
        )
        + "\n    )"
    )

    parameters = tuple(
        _build_starts_with_parameter(
            prefix
        )
        for prefix in rack_prefixes
    )

    return condition_sql, parameters


def _build_parts_search_statement(
    criteria: PartsSearchCriteria,
) -> tuple[str, tuple[Any, ...]]:
    """
    入力されている検索条件だけを使い、
    SQLとバインドパラメーターを生成する。

    条件の結合方法:
    ・係内の棚番プレフィックスはOR
    ・係と各テキスト検索条件はAND
    ・テキスト検索条件同士もAND
    """
    if not criteria.has_any_condition:
        return "", ()

    where_conditions = [
        "p.DELETED_FLG = '0'",
    ]

    parameters: list[Any] = []

    section_condition, section_parameters = (
        _build_section_condition(
            criteria.section_rack_prefixes
        )
    )

    if section_condition:
        where_conditions.append(
            section_condition
        )

        parameters.extend(
            section_parameters
        )

    for (
        field_name,
        column_name,
    ) in SEARCH_FIELD_DEFINITIONS:
        value = getattr(
            criteria,
            field_name,
        )

        if not value:
            continue

        where_conditions.append(
            f"{column_name} LIKE ? ESCAPE '\\'"
        )

        parameters.append(
            _build_contains_parameter(
                value
            )
        )

    where_sql = "\n    AND ".join(
        where_conditions
    )

    if criteria.barcode:
        order_by_sql = (
            PARTS_SEARCH_BARCODE_ORDER_BY_SQL
        )

        parameters.extend((
            criteria.barcode,
            _build_starts_with_parameter(
                criteria.barcode
            ),
        ))
    else:
        order_by_sql = (
            PARTS_SEARCH_DEFAULT_ORDER_BY_SQL
        )

    sql = "\n".join((
        PARTS_SEARCH_SELECT_SQL.strip(),
        "WHERE",
        f"    {where_sql}",
        order_by_sql.strip(),
    ))

    return sql, tuple(parameters)


def _row_to_dict(
    column_names: list[str],
    row: Any,
) -> dict[str, Any]:
    """
    DB取得行を列名付きの辞書へ変換する。
    """
    return dict(
        zip(
            column_names,
            row,
        )
    )


def select_parts_by_criteria(
    criteria: PartsSearchCriteria,
) -> list[dict[str, Any]]:
    """
    検証済みの検索条件で部品を検索する。

    係検索:
    ・係に対応する棚番の前方一致
    ・複数プレフィックスはOR検索

    その他の検索:
    ・各項目は部分一致
    ・複数項目はAND検索

    バーコードが指定されている場合の並び順:
    1. 完全一致
    2. 前方一致
    3. その他の部分一致
    """
    sql, parameters = (
        _build_parts_search_statement(
            criteria
        )
    )

    if not sql:
        return []

    with marp_connection() as connection:
        cursor = connection.cursor()

        try:
            cursor.execute(
                sql,
                parameters,
            )

            column_names = [
                description[0]
                for description in cursor.description
            ]

            rows = cursor.fetchall()

            return [
                _row_to_dict(
                    column_names,
                    row,
                )
                for row in rows
            ]

        finally:
            cursor.close()