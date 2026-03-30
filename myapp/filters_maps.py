# filters_maps.py
from typing import Dict, Mapping
from types import MappingProxyType

# --- 型（緩く運用するならこのままでOK） ---
FieldMapType = Dict[str, str]          # 1リソースの論理名→ORMパス
FieldMapsType = Dict[str, FieldMapType] # 複数リソース分
StatusMapType = Dict[str, str]         # 英語キー→和名
OpMapType = Dict[str, str]             # 論理演算子→Django lookup

# --- リソース別フィールドマップ ---
FIELD_MAPS: FieldMapsType = {
    'plan': {
        'week_alias':  'p_date__date_alias',
        'day_of_week': 'p_date__h_day_of_week',
        'status':      'status',
        'time_zone':   'inspection_no__time_zone',
        'machine':     'inspection_no__control_no__machine',
        'line_name':   'inspection_no__control_no__line_name__line_name',
        'line_id':     'inspection_no__control_no__line_name_id',
        'holder_id':   'holder_id',
    },
    
    'wd': {
        'week_alias':  'plan__p_date__date_alias',
        'day_of_week': 'plan__p_date__h_day_of_week',
        'status':      'status',  # WeeklyDuty 側の仕様に合わせて
        'time_zone':   'plan__inspection_no__time_zone',
        'machine':     'plan__inspection_no__control_no__machine',
        'line_name':   'plan__inspection_no__control_no__line_name__line_name',
        'line_id':     'plan__inspection_no__control_no__line_name_id',
        'holder_id':   'plan__holder_id',
    },
}

# --- リソース別ステータスマップ（必要なものだけ定義） ---
STATUS_MAPS: Dict[str, StatusMapType] = {
    'plan': {
        'pending':  '配布待ち',
        'delayed':  '遅れ',
        'approval': '承認待ち',
        'done':     '完了',
        'returned': '差戻し',
    },
    # 'wd': {...}  # WeeklyDuty 用が必要なら追加
}

# --- サポートする演算子（フロントから来る op → Django lookup に変換） ---
OP_MAP: OpMapType = {
    'eq':          'exact',       # 完全一致
    'neq':         'exact',       # 否定は別管理（NEGATED_OPS）で ~Q にする
    'icontains':   'icontains',
    'contains':    'contains',
    'in':          'in',
    'startswith':  'startswith',
    'istartswith': 'istartswith',
    'endswith':    'endswith',
    'iendswith':   'iendswith',
}

# 否定扱いにしたい演算子（~Q）
NEGATED_OPS = {'neq'}

# 実行時の書き換えを防ぎたい場合は MappingProxyType でラップ
IMMUTABLE_FIELD_MAPS: Mapping[str, Mapping[str, str]] = MappingProxyType(
    {k: MappingProxyType(v) for k, v in FIELD_MAPS.items()}
)
IMMUTABLE_STATUS_MAPS: Mapping[str, Mapping[str, str]] = MappingProxyType(
    {k: MappingProxyType(v) for k, v in STATUS_MAPS.items()}
)
IMMUTABLE_OP_MAP: Mapping[str, str] = MappingProxyType(OP_MAP)
IMMUTABLE_NEGATED_OPS = frozenset(NEGATED_OPS)

# 取得用ヘルパ
def get_field_map(resource: str) -> Mapping[str, str]:
    try:
        return IMMUTABLE_FIELD_MAPS[resource]
    except KeyError as e:
        raise ValueError(f'Unknown resource "{resource}"') from e

def get_status_map(resource: str) -> Mapping[str, str]:
    # ステータスマップが未定義のリソースもある想定なので、見つからなければ空を返す
    return IMMUTABLE_STATUS_MAPS.get(resource, {})

def get_op_map() -> Mapping[str, str]:
    return IMMUTABLE_OP_MAP

def get_negated_ops():
    return IMMUTABLE_NEGATED_OPS
 