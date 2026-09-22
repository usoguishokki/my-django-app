# Plan Scheduling read data flow

This document records verified repository behavior. It is not a description of an inferred rotation formula.

## Maintenance calendar

`Hozen_calendar_tb` is the authoritative maintenance-date calendar. Relevant verified model fields are:

- `h_id`: maintenance-calendar row identity.
- `h_date`: unique maintenance date.
- `date_alias`: display/group label used to associate dates with a maintenance week.
- `date_tag`: a separately modeled calendar tag with defined choices; Plan Scheduling does not use it to resolve shifts.
- `holiday_group_id`: an optional indexed calendar field. Its business meaning is not yet verified.

`date_alias` groups maintenance dates. It does **not** define shift/team assignments or a rotation.

## Date-level calendar assignments

`Calendar_tb` stores date-level assignments through these relations:

- `Calendar_tb.c_date` -> `Hozen_calendar_tb`
- `Calendar_tb.affilation` -> `Affilation_tb`, whose `affilation` field supplies the team name
- `Calendar_tb.pattern` -> `ShiftPattan_tb`, whose `pattern_name` field supplies the shift name

One daily presentation slot is resolved for a maintenance-date/team pair from these actual rows. The code rejects an ambiguous pair containing more than one distinct shift rather than guessing.

## Selector flow

The relevant selectors are in `myapp/selectors/plan_scheduling.py`:

- `select_maintenance_week(target_date=...)` finds the target `Hozen_calendar_tb` row, then returns same-`date_alias` dates within that target date's fiscal year, ordered by `h_date`, then `h_id`.
- `select_all_maintenance_dates()` returns all dated maintenance-calendar rows ordered by `h_date`, then `h_id`.
- `select_calendar_rows_for_maintenance_dates(maintenance_date_ids=...)` loads actual `Calendar_tb` rows with their maintenance date, affiliation, and shift pattern. Ordering is maintenance date, pattern start time, affiliation id, then calendar-row id.

## Service and domain flow

The read pipeline is:

```text
Calendar_tb
  -> select_calendar_rows_for_maintenance_dates()
  -> _build_slots_by_pair()
  -> resolve_distinct_shift() / is_display_slot()
  -> _build_slot_effort()
  -> _build_date_items()
  -> timeline API `dates[].slots`
  -> controller canonical state: `timelineDates[].slots`
  -> daily Matrix / Chart and filtered projections
```

`_build_slots_by_pair()` groups rows by maintenance-date id and affiliation id. `resolve_distinct_shift()` requires exactly one distinct shift for the pair. `is_display_slot()` limits presentation to the approved shift and team universe. `_build_slot_effort()` calculates workload once for the resolved slots, and `_build_date_items()` preserves displayed slots even when their actual workload is zero.

Daily Matrix slots therefore represent actual Calendar assignments; they are not a generated shift/team cross-product.

## Maintenance-week projection

The accepted frontend pipeline is:

```text
canonical daily timeline
  -> filter projection
  -> maintenance-week projection
  -> weekly Chart and weekly Matrix
```

The weekly Chart and Matrix share one ordered maintenance-week projection. Weekly Matrix membership comes only from distinct shift/team pairs present in the contributing `timelineDates[].slots`.

- Actual Calendar assignment with zero workload: **keep it**.
- Shift/team combination absent from daily slots: **do not create it**.
- Never synthesize the Cartesian product of all shifts and all teams.

Do not infer a production rotation formula from a small sample of maintenance weeks. Always use the actual daily slot membership.

## Holiday semantics

For Plan Scheduling, the Holiday shift is identified by `ShiftPattan_tb.pattern_name == "休日"`. It is not inferred from `date_tag` or `holiday_group_id`.

Underlying Holiday `Calendar_tb` rows may still carry A/B/C affiliations. The Maintenance Week Matrix intentionally presents those actual Holiday slots as one teamless Holiday aggregate. This is a weekly presentation rule only; it does not change the database semantics, and the weekly Chart retains normal team-based aggregation.

## Known unknowns

- The business meaning and lifecycle of `holiday_group_id` remain **UNKNOWN**.
- No general shift/team rotation formula has been verified. Observed production samples must not be converted into such a rule.
