# Knowledge maintenance policy

Repository knowledge is maintained semi-automatically during focused work and remains subject to Human Review. Do not build an autonomous background documentation updater.

## Must persist

Update an authoritative repository document when evidence establishes a durable fact that materially affects future engineering decisions, including:

- safety rules and official database-access paths;
- architecture and data-flow responsibilities;
- durable business rules and repository conventions;
- recurring failure modes whose cause changes how future work should proceed.

Examples include “Oracle research must use `scripts/research/oracle_readonly.py`” and “Plan Scheduling weekly shift/team membership derives from actual daily Calendar slots.”

## Test or Git history only

Do not expand permanent architecture documentation for transient or implementation-local facts such as:

- tiny spacing or styling adjustments;
- temporary diagnostic values and debugging details;
- local variable names;
- resolved defects that do not alter future engineering choices.

Capture these in regression tests, commit history, and the task's project handoff instead.

## Unresolved or unknown

Never convert a hypothesis, assumption, or unverified production pattern into repository fact. If an unresolved item must be recorded, label it explicitly as **UNKNOWN** and state what evidence is missing.

## End-of-task check

Before completing a task, ask:

1. Did we verify a new durable repository fact?
2. Will future work make a wrong decision without knowing it?
3. Is there already an authoritative document for it?
4. Should that document be updated as part of this focused work?
5. Is the statement supported by code, tests, runtime evidence, or approved read-only research?

Only update documentation when those questions support doing so. Business meaning and production-behavior documentation must remain clear and reviewable by a human.
