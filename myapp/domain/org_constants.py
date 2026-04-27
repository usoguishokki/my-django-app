ALLOWED_TEAM_KEYS = {"A", "B", "C"}

TEAM_FILTER_KEYS = ("A", "B", "C")

TEAM_KEYS = ("A", "B", "C", "all", "unknown")
TEAM_LABEL = {
    "A": "A班",
    "B": "B班",
    "C": "C班",
    "all": "全体",
    "unknown": "不明",
}

TEAM_FILTER_ORDER = {
    team_key: index
    for index, team_key in enumerate(TEAM_FILTER_KEYS)
}


WD_JA = ["月", "火", "水", "木", "金", "土", "日"]

TEAM_NAMES = {TEAM_LABEL[k] for k in ("A", "B", "C")}

def normalize_team_key(aff_name: str) -> str:
    """
    班名（例：'A班', 'B班'）から data-team 用のキー（'A', 'B', ...）を作る。
    HTML 側の <td data-team="A"> に合わせる。
    """
    if not aff_name:
        return "unknown"

    aff_name = str(aff_name)
    if aff_name.endswith("班") and len(aff_name) >= 2:
        return aff_name[0]  # 'A班' → 'A'
    return aff_name