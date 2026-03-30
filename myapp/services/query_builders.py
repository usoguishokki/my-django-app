import json
from functools import reduce
from typing import Mapping, Iterable, Dict, Any
from django.db.models import Q

def is_none_like(v) -> bool:
    return v is None or (isinstance(v, str) and v.strip().lower() in ("", "none", "null"))

def normalize_value(field: str, value, *, status_map: Mapping[str, str]):
    if field == "status" and isinstance(value, str) and status_map:
        return status_map.get(value, value)
    return value

def build_q_from_simple_params(
    params: Mapping[str, Any],
    *,
    field_map: Mapping[str, str],
    status_map: Mapping[str, str],
) -> Q:
    q = Q()
    for logical_field, raw_value in params.items():
        if is_none_like(raw_value):
            continue
        orm_field = field_map.get(logical_field)
        if not orm_field:
            continue
        norm = normalize_value(logical_field, raw_value, status_map=status_map)
        q &= Q(**{orm_field: norm})
    return q

def clause_to_q(
    clause: Dict[str, Any],
    *,
    field_map: Mapping[str, str],
    status_map: Mapping[str, str],
    op_map: Mapping[str, str],
    negated_ops: Iterable[str],
) -> Q:
    field = (clause.get("field") or "").strip()
    op    = (clause.get("op") or "eq").lower()
    value = clause.get("value")
    if is_none_like(value):
        return Q()
    orm_field = field_map.get(field)
    if not orm_field:
        return Q()

    lookup = op_map.get(op, "exact")
    value  = normalize_value(field, value, status_map=status_map)
    if lookup == "in" and not isinstance(value, (list, tuple)):
        value = [value]

    key = f"{orm_field}__{lookup}" if lookup != "exact" else orm_field
    q = Q(**{key: value})
    return ~q if op in negated_ops else q


def build_q_from_filters(
    filters_json: Dict[str, Any],
    *,
    field_map: Mapping[str, str],
    status_map: Mapping[str, str],
    op_map: Mapping[str, str],
    negated_ops: Iterable[str],
) -> Q:
    if not isinstance(filters_json, dict):
        return Q()
    logic   = (filters_json.get("logic") or "and").lower()
    clauses = filters_json.get("clauses") or []
    qs = []
    for c in clauses:
        q = clause_to_q(c, field_map=field_map, status_map=status_map,
                        op_map=op_map, negated_ops=negated_ops)
        if q.children:
            qs.append(q)
    if not qs:
        return Q()
    return reduce(lambda a,b: a | b, qs) if logic == "or" else reduce(lambda a,b: a & b, qs)