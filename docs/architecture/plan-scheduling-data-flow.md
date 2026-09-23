# Plan Scheduling data flow

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

## Inspection standard versus instantiated Plan

`Check_tb.day_of_week` and `Check_tb.practitioner_id` describe the inspection standard and its recurrence. They remain inputs to future Plan generation; moving one existing Plan does not change them.

For an already-created Plan, `Plan_tb.p_date` is its current scheduled date and `Plan_tb.planned_affilation_id`, when populated, is its current team. The current shift is resolved from the actual `Calendar_tb` rows for that Plan's current date/team pair and their `ShiftPattan_tb` pattern. A maintenance-week label groups dates but does not provide a representative shift for every Plan in that week.

The timetable test-card week, weekday, team, shift, card display, and bulk-registration candidate list use this current-Plan projection. A NULL `planned_affilation_id` retains the timetable's local legacy master-pattern fallback; it never overrides a populated Plan team. Standard weekday remains a separate value from current scheduled weekday.

Timetable team-filter buttons use the repository's canonical A/B/C team order, independent of the current shift rotation or the Calendar row order. Each button retains its own Calendar-derived shift metadata; sorting buttons does not change Plan placement or shift resolution.

## Inspection Standard Plan resynchronization

The Inspection Standard is the recurrence and Plan-generation definition; an instantiated Plan retains its own current operational placement. The common-item update service uses the domain policy in `myapp/domain/inspection_standard_plan_schedule.py` to classify effective changes as `NO_RESYNC`, `RESYNC_SCHEDULE`, or `RESYNC_LIFECYCLE`. Rule, anchors, week, weekday, and practitioner/team-generation changes require schedule resync while Plan generation is eligible. A status change requires lifecycle resync only when Plan-generation eligibility changes; edits while both states are ineligible do not generate Plans. Work name, effort, staffing count, time zone, safe point, and detail content do not trigger Plan schedule resync.

Phase 1 retains delete-and-regenerate for eligible `WAITING` Plans. A manually moved waiting Plan may therefore be replaced after a genuine scheduling-standard change; a descriptive edit does not replace it. Normal resync preserves waiting Plans whose current scheduled date is already past or whose `plan_time` is set. Deleting those protected Plans requires an explicit confirmation, rechecked against the locked candidate count. Past dates are not generated again merely because an explicitly confirmed resync deleted an old Plan. Non-waiting Plans are not common-resync delete candidates.

Card abolition is a separate lifecycle operation. It deletes waiting Plans by default, preserves completed Plans always, and preserves distributed/in-progress Plans unless their deletion is explicitly confirmed. Inspection Standard history records standard-driven Plan deletion/creation; Move history snapshots survive a deleted Plan through its nullable `SET_NULL` FK. Delete/regenerate may change `plan_id`. Explicit old-Plan to new-Plan occurrence lineage is a future design, not part of Phase 1.

Inspection Standard business edits go through the Nika UI/API. Django Admin is read-only for `Check_tb` and `Db_details_tb` so it cannot bypass the resync decision.

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

The Chart is a presentation projection of those same filtered slots. In both Day and Maintenance Week modes its series dimension is shift (`1直`, `2直`, `3直`, `休日`), while team remains a filter and a Matrix assignment attribute. Chart shift workload must therefore be aggregated only after weekday, shift, and team filters have selected the contributing daily slots.

Matrix visibility is an independent frontend presentation state. With the Matrix visible, Plan Scheduling retains the detailed Chart/Matrix layout and interactions. With it hidden, the same filtered Chart projection is rendered as a compact, horizontally scrollable overview; no alternate data source or business aggregation is introduced. Switching visibility preserves the logical date/week anchor rather than a raw pixel scroll position.

Day Overview keeps one Chart bar per visible day. Its contextual rows group the filtered visible date sequence by stable maintenance-calendar group identity, showing each group's actual visible first/last dates and authoritative `date_alias` label. This grouping is presentation context only and does not aggregate daily Chart workload into weekly bars.

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

Underlying Holiday `Calendar_tb` rows may still carry A/B/C affiliations. The Maintenance Week Matrix intentionally presents those actual Holiday slots as one teamless Holiday aggregate and ignores the team filter for that aggregate. This is a weekly Matrix presentation rule only; it does not change the database semantics. The Chart treats Holiday as a normal shift series and applies the active team filter before aggregation.

## Move mutation

Selecting a destination and rendering Move Preview are read-only operations. A write occurs only after the user explicitly activates `移動を確定`, which sends an authenticated POST to `/api/plan-scheduling/move/` with the Plan id, expected source date/team, and destination date/team.

The mutation service executes one atomic transaction:

1. Lock the Plan with `select_for_update()` through the authenticated request organization scope. A missing and a cross-organization Plan both produce the same not-found result.
2. Require `PlanStatus.WAITING` and `plan_time IS NULL`.
3. Compare the locked `p_date` and `planned_affilation` with the expected source precondition to reject stale browser state.
4. Resolve both source and destination shifts from the actual `Calendar_tb` date/team assignments through the same `resolve_distinct_shift()` and `is_display_slot()` rules used by the read model. Client-provided shift or workload data is never authoritative.
5. Update only `Plan_tb.p_date` and `Plan_tb.planned_affilation`.
6. Append exactly one `PlanScheduleChangeHistory` row with nullable relational references and immutable source, destination, shift, actor, organization, and Plan identity snapshots.

The Plan update and history insert commit together or roll back together. Move history is application-append-only, and its shift snapshots record the resolved meaning at mutation time rather than recomputing history from a later calendar state.

After a committed response, the frontend rebuilds the display from authoritative timeline/week reads instead of applying Preview arithmetic locally. The committed server receipt supplies the success dialog. A refresh failure after commit is reported as a display-refresh warning, not as a failed Move.

## Known unknowns

- The business meaning and lifecycle of `holiday_group_id` remain **UNKNOWN**.
- No general shift/team rotation formula has been verified. Observed production samples must not be converted into such a rule.
