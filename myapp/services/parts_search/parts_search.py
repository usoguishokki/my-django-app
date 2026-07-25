# myapp/services/parts_search/parts_search.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from myapp.domain.parts_search.parts_search import (
    PartsSearchCriteria,
    build_parts_search_criteria,
)
from myapp.domain.parts_search.rack_location import (
    PartsRackLocationResolver,
)
from myapp.selectors.parts_search.parts_search import (
    select_parts_by_criteria,
)
from myapp.selectors.parts_search.rack_location import (
    select_active_parts_rack_locations,
)


@dataclass(frozen=True)
class PartsSearchResult:
    """
    部品検索結果。

    criteria:
        正規化・検証済みの検索条件。

    items:
        MARPから取得し、
        保管場所情報を付加した部品情報。
    """

    criteria: PartsSearchCriteria
    items: tuple[dict[str, Any], ...]

    @property
    def count(self) -> int:
        """
        検索結果件数を返す。
        """
        return len(
            self.items
        )

    @property
    def found(self) -> bool:
        """
        検索結果が1件以上あるか判定する。
        """
        return self.count > 0


def _attach_rack_location(
    row: dict[str, Any],
    resolver: PartsRackLocationResolver,
) -> dict[str, Any]:
    """
    MARPの部品情報へ保管場所を付加する。

    元の辞書は変更せず、
    新しい辞書を生成して返す。
    """
    rack_location = resolver.resolve(
        row.get(
            "rack_level1"
        )
    )

    enriched_row = dict(
        row
    )

    if rack_location is None:
        enriched_row.update({
            "rack_location_no": "",
            "storage_location_name": "",
            "storage_location_note": "",
        })

        return enriched_row

    enriched_row.update({
        "rack_location_no":
            rack_location.rack_no,
        "storage_location_name":
            rack_location.location_name,
        "storage_location_note":
            rack_location.location_note,
    })

    return enriched_row


def _attach_rack_locations(
    rows: list[dict[str, Any]],
) -> tuple[dict[str, Any], ...]:
    """
    部品検索結果一覧へ保管場所を付加する。

    Oracleから保管場所マスタを一度だけ取得し、
    Python上で各棚番を解決する。
    """
    if not rows:
        return ()

    rack_location_rows = (
        select_active_parts_rack_locations()
    )

    resolver = (
        PartsRackLocationResolver
        .from_rows(
            rack_location_rows
        )
    )

    return tuple(
        _attach_rack_location(
            row,
            resolver,
        )
        for row in rows
    )


def search_parts(
    *,
    section: object = "",
    barcode: object = "",
    rack_level1: object = "",
    parts_name: object = "",
    parts_model: object = "",
) -> PartsSearchResult:
    """
    指定された条件で部品を検索する。

    処理:
    1. 検索条件を正規化・検証
    2. MARPから部品を取得
    3. Oracleから保管場所マスタを一括取得
    4. 棚番の最長前方一致で保管場所を付加

    複数条件が指定された場合は
    AND検索を行う。
    """
    criteria = build_parts_search_criteria(
        section=section,
        barcode=barcode,
        rack_level1=rack_level1,
        parts_name=parts_name,
        parts_model=parts_model,
    )

    rows = select_parts_by_criteria(
        criteria
    )

    items = _attach_rack_locations(
        rows
    )

    return PartsSearchResult(
        criteria=criteria,
        items=items,
    )