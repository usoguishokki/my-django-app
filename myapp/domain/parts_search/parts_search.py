# myapp/domain/parts_search/parts_search.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional


MAX_SEARCH_VALUE_LENGTH = 100
PARTS_SEARCH_RESULT_LIMIT = 200


SECTION_DEFINITIONS = {
    "molding": {
        "label": "成形",
        "rack_prefixes": (
            "1R",
            "3R",
        ),
    },
    "press": {
        "label": "プレス",
        "rack_prefixes": (
            "1P",
        ),
    },
    "body": {
        "label": "ボデー",
        "rack_prefixes": (
            "1W",
            "2W",
        ),
    },
    "painting": {
        "label": "塗装",
        "rack_prefixes": (
            "1T",
            "2T",
        ),
    },
    "assembly": {
        "label": "組立て",
        "rack_prefixes": (
            "1A",
            "2A",
        ),
    },
}


@dataclass(frozen=True)
class PartsSection:
    """
    棚番から判定した係情報。
    """

    code: str
    label: str


class PartsSearchValidationError(ValueError):
    """
    部品検索条件が不正な場合に発生する例外。
    """


@dataclass(frozen=True)
class PartsSearchCriteria:
    """
    正規化・検証済みの部品検索条件。

    複数項目が入力された場合は、
    すべての条件に一致する部品を検索する。
    """

    section: str
    barcode: str
    rack_level1: str
    parts_name: str
    parts_model: str

    @property
    def has_any_condition(self) -> bool:
        """
        1つ以上の検索条件が指定されているか判定する。
        """
        return any((
            self.section,
            self.barcode,
            self.rack_level1,
            self.parts_name,
            self.parts_model,
        ))

    @property
    def section_rack_prefixes(
        self,
    ) -> tuple[str, ...]:
        """
        選択された係に対応する棚番プレフィックスを返す。

        係が未指定の場合は空のtupleを返す。
        """
        if not self.section:
            return ()

        definition = SECTION_DEFINITIONS.get(
            self.section
        )

        if not definition:
            return ()

        return tuple(
            definition["rack_prefixes"]
        )

    def as_dict(self) -> dict[str, str]:
        """
        検索条件を辞書形式で返す。
        """
        return {
            "section": self.section,
            "barcode": self.barcode,
            "rack_level1": self.rack_level1,
            "parts_name": self.parts_name,
            "parts_model": self.parts_model,
        }


@dataclass(frozen=True)
class PartsSearchResult:
    """
    部品検索結果。

    criteria:
        正規化・検証済みの検索条件。

    items:
        保管場所情報を付加した部品情報。
    """

    criteria: PartsSearchCriteria
    items: tuple[dict[str, Any], ...]

    @property
    def count(self) -> int:
        return len(
            self.items
        )

    @property
    def found(self) -> bool:
        return self.count > 0


_SEARCH_FIELD_LABELS = {
    "barcode": "バーコード",
    "rack_level1": "棚番",
    "parts_name": "品名",
    "parts_model": "型式",
}


def _normalize_search_value(
    value: object,
) -> str:
    """
    検索値の前後にある空白を除去する。

    大文字・小文字、全角・半角などは変更しない。
    """
    return str(
        value or ""
    ).strip()


def resolve_parts_section(
    rack_level1: object,
) -> Optional[PartsSection]:
    """
    棚番の先頭文字から係を判定する。

    対応する係がない場合はNoneを返す。
    """
    normalized_rack_level1 = (
        _normalize_search_value(
            rack_level1
        )
        .upper()
    )

    if not normalized_rack_level1:
        return None

    for section_code, definition in (
        SECTION_DEFINITIONS.items()
    ):
        rack_prefixes = definition[
            "rack_prefixes"
        ]

        if not any(
            normalized_rack_level1.startswith(
                prefix.upper()
            )
            for prefix in rack_prefixes
        ):
            continue

        return PartsSection(
            code=section_code,
            label=str(
                definition["label"]
            ),
        )

    return None



def _validate_section(
    section: str,
) -> None:
    """
    係の値が許可された値か検証する。

    空文字は「すべて」として許可する。
    """
    if not section:
        return

    if section in SECTION_DEFINITIONS:
        return

    raise PartsSearchValidationError(
        "係の指定が不正です。"
        "選択し直してください。"
    )


def _validate_search_value_lengths(
    values: dict[str, str],
) -> None:
    """
    テキスト検索条件の文字数を検証する。
    """
    for field_name, value in values.items():
        if len(value) <= MAX_SEARCH_VALUE_LENGTH:
            continue

        field_label = _SEARCH_FIELD_LABELS[
            field_name
        ]

        raise PartsSearchValidationError(
            f"{field_label}は"
            f"{MAX_SEARCH_VALUE_LENGTH}文字以内で"
            "入力してください。"
        )


def build_parts_search_criteria(
    *,
    section: object = "",
    barcode: object = "",
    rack_level1: object = "",
    parts_name: object = "",
    parts_model: object = "",
) -> PartsSearchCriteria:
    """
    入力値を正規化・検証し、
    部品検索条件を生成する。
    """
    normalized_section = (
        _normalize_search_value(
            section
        )
    )

    normalized_text_values = {
        "barcode": _normalize_search_value(
            barcode
        ),
        "rack_level1": _normalize_search_value(
            rack_level1
        ),
        "parts_name": _normalize_search_value(
            parts_name
        ),
        "parts_model": _normalize_search_value(
            parts_model
        ),
    }

    _validate_section(
        normalized_section
    )

    _validate_search_value_lengths(
        normalized_text_values
    )

    criteria = PartsSearchCriteria(
        section=normalized_section,
        **normalized_text_values,
    )

    if not criteria.has_any_condition:
        raise PartsSearchValidationError(
            "係、バーコード、棚番、品名、型式の"
            "いずれかを指定してください。"
        )

    return criteria