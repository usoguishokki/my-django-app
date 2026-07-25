# myapp/domain/parts_search/rack_location.py

from __future__ import annotations

import re
import unicodedata

from dataclasses import dataclass
from typing import (
    Any,
    Iterable,
    Mapping,
    Optional,
)


@dataclass(frozen=True)
class PartsRackLocation:
    """
    部品棚の保管場所情報。
    """

    rack_no: str
    location_name: str
    location_note: str
    display_order: int


@dataclass(frozen=True)
class _RackLocationCandidate:
    """
    棚番照合用の内部候補。

    match_key:
        比較用に正規化した棚No。
    """

    match_key: str
    location: PartsRackLocation


def normalize_rack_no(
    value: object,
) -> str:
    """
    棚Noを照合用の文字列へ正規化する。

    処理内容:
    ・Noneは空文字
    ・全角英数字を半角へ統一
    ・英字を大文字へ統一
    ・前後および途中の空白を除去
    """
    text = unicodedata.normalize(
        "NFKC",
        str(value or ""),
    )

    return re.sub(
        r"\s+",
        "",
        text,
    ).upper()


def _normalize_text(
    value: object,
) -> str:
    """
    表示用文字列を正規化する。

    表示内容では途中の空白を保持し、
    前後の空白だけを除去する。
    """
    return unicodedata.normalize(
        "NFKC",
        str(value or ""),
    ).strip()


def _normalize_display_order(
    value: object,
) -> int:
    """
    表示順を0以上の整数へ変換する。
    """
    try:
        display_order = int(
            value or 0
        )
    except (
        TypeError,
        ValueError,
    ):
        return 0

    return max(
        display_order,
        0,
    )


def build_parts_rack_location(
    source: Mapping[str, Any],
) -> Optional[PartsRackLocation]:
    """
    Selectorから取得した辞書を
    Domainの保管場所情報へ変換する。

    棚Noまたは保管場所が空の場合は
    無効なマスタとしてNoneを返す。
    """
    rack_no = normalize_rack_no(
        source.get("rack_no")
    )

    location_name = _normalize_text(
        source.get("location_name")
    )

    if (
        not rack_no
        or not location_name
    ):
        return None

    return PartsRackLocation(
        rack_no=rack_no,
        location_name=location_name,
        location_note=_normalize_text(
            source.get("location_note")
        ),
        display_order=(
            _normalize_display_order(
                source.get(
                    "display_order"
                )
            )
        ),
    )


class PartsRackLocationResolver:
    """
    MARPの棚番から保管場所を解決する。

    一致する棚Noが複数ある場合は、
    最も長い棚Noを優先する。

    例:
        対象棚番: 1R55A09

        候補:
        ・1R55
        ・1R55A

        結果:
        ・1R55A
    """

    def __init__(
        self,
        locations: Iterable[
            PartsRackLocation
        ],
    ) -> None:
        candidates = [
            _RackLocationCandidate(
                match_key=normalize_rack_no(
                    location.rack_no
                ),
                location=location,
            )
            for location in locations
            if normalize_rack_no(
                location.rack_no
            )
        ]

        # 棚Noが長い候補を先頭へ並べる。
        # 同じ長さの場合は表示順、棚Noの順とする。
        self._candidates = tuple(
            sorted(
                candidates,
                key=lambda candidate: (
                    -len(
                        candidate.match_key
                    ),
                    candidate.location.display_order,
                    candidate.match_key,
                ),
            )
        )

    @classmethod
    def from_rows(
        cls,
        rows: Iterable[
            Mapping[str, Any]
        ],
    ) -> PartsRackLocationResolver:
        """
        Selectorが返した辞書一覧から
        Resolverを生成する。
        """
        locations = []

        for row in rows:
            location = (
                build_parts_rack_location(
                    row
                )
            )

            if location is None:
                continue

            locations.append(
                location
            )

        return cls(
            locations
        )

    def resolve(
        self,
        rack_level1: object,
    ) -> Optional[PartsRackLocation]:
        """
        MARPの棚番に一致する保管場所を返す。

        一致しない場合はNoneを返す。
        """
        rack_key = normalize_rack_no(
            rack_level1
        )

        if not rack_key:
            return None

        for candidate in self._candidates:
            if rack_key.startswith(
                candidate.match_key
            ):
                return (
                    candidate.location
                )

        return None