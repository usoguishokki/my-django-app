from datetime import date
from typing import Optional


def parse_optional_base_date(value) -> Optional[date]:
    if value is None or value == "":
        return None

    try:
        return date.fromisoformat(str(value).strip())
    except (TypeError, ValueError):
        raise ValueError("invalid base_date")
