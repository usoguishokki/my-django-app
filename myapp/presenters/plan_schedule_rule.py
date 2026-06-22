# myapp/presenters/plan_schedule_rule.py

from __future__ import annotations

from typing import Any

from myapp.presenters.formatters import as_int, as_text, safe_get


def format_plan_schedule_rule_period(rule: Any) -> str:
    interval = as_text(safe_get(rule, 'interval', ''))
    unit = as_text(safe_get(rule, 'unit', ''))

    if interval and unit:
        return f'{interval}{unit}'

    return ''


def format_plan_schedule_rule_label(rule: Any) -> str:
    period = format_plan_schedule_rule_period(rule)
    name = as_text(safe_get(rule, 'name', ''))

    if period and name:
        return f'{period}({name})'

    return period or name


def present_plan_schedule_rule(rule: Any) -> dict:
    if rule is None:
        return {
            'id': 0,
            'name': '',
            'interval': '',
            'unit': '',
            'label': '',
        }

    return {
        'id': as_int(safe_get(rule, 'id', 0)),
        'name': as_text(safe_get(rule, 'name', '')),
        'interval': as_int(safe_get(rule, 'interval', 0)),
        'unit': as_text(safe_get(rule, 'unit', '')),
        'label': format_plan_schedule_rule_label(rule),
    }


def present_plan_schedule_rule_option(rule: Any) -> dict:
    return {
        'value': as_int(safe_get(rule, 'id', 0)),
        'label': format_plan_schedule_rule_label(rule),
        'meta': {
            'name': as_text(safe_get(rule, 'name', '')),
            'interval': as_int(safe_get(rule, 'interval', 0)),
            'unit': as_text(safe_get(rule, 'unit', '')),
            'period': format_plan_schedule_rule_period(rule),
        },
    }


def present_plan_schedule_rule_options(rules) -> list[dict]:
    return [
        present_plan_schedule_rule_option(rule)
        for rule in rules
    ]