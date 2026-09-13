# Coding Standards

## SOLID + DRY + KISS + YAGNI

Apply SOLID, DRY, KISS, and YAGNI together. When principles appear to compete, use this practical priority:

1. **Correctness** — preserve current business rules and required behavior.
2. **KISS** — prefer the smallest clear implementation.
3. **YAGNI** — do not build options or infrastructure for hypothetical future needs.
4. **DRY** — keep each business rule or contract in one authoritative place.
5. **SOLID** — keep responsibilities and dependency directions clear and testable.

SOLID is a design aid, not permission to add complexity. A simple single-use case normally does not need new interfaces, factories, adapters, abstraction layers, dependency-injection machinery, or generalized frameworks. Prefer functions and modules unless state, lifecycle, substitution, or multiple real implementations creates a concrete need.

## Existing business rule first

Before writing new business logic:

1. Search for an existing service, helper, domain function, or frontend component.
2. Determine whether the same business rule already has an authoritative implementation.
3. Reuse or extend that implementation when it cleanly supports the requirement.
4. Create a new abstraction only when the existing design cannot cleanly support the requirement.

For example, card creation must not duplicate plan-date, calendar, or status rules. Reuse the established use case:

```python
sync_waiting_plans_for_inspection_standard(...)
```

DRY means avoiding duplicated business knowledge. It does not mean mechanically merging code merely because it looks similar. Small local repetition is preferable to an abstraction that obscures intent or couples unrelated workflows.

## Minimum-change rule

Prefer the smallest cohesive change that correctly solves the requested problem. Do not:

- refactor unrelated areas during a bug fix;
- redesign a subsystem for a local issue;
- introduce future options that were not requested; or
- combine cleanup with functional work when the changes can be reviewed independently.

When useful unrelated cleanup is discovered, report it without implementing it:

```text
FOLLOW-UP CANDIDATE: <concise description and reason>
```

## Rule Impact Check and living documentation

At the end of every implementation, investigation, or verification task,
determine whether the work confirmed a reusable repository-level lesson. This
check does not expand the application scope.

Update documentation automatically when a newly confirmed lesson is reusable
across future tasks and concerns at least one of these areas:

- preventing a demonstrated false PASS or regression;
- a safety constraint;
- a stable local development or environment rule;
- an architecture or layer-boundary rule;
- a coding-standard clarification;
- a verification procedure; or
- a deployment or operations procedure.

Do not update documentation for one-off debugging output, temporary process
IDs, transient errors without a reusable lesson, task-specific values without
general significance, temporary workarounds, unconfirmed assumptions,
speculation, or information already documented accurately. Keep the update as
small and durable as the lesson.

Choose the narrowest authoritative destination:

- coding rules: `docs/development/coding-standards.md`;
- verification, runtime, and browser rules:
  `docs/development/verification-playbook.md`;
- architecture and layer rules: `docs/architecture/layer-boundaries.md`;
- documentation navigation: `docs/README.md`; and
- operations, deployment, and environment procedures: the existing relevant
  operations or runbook document.

Keep `AGENTS.md` concise. Change it only when the Codex entry-point guidance
itself changes; do not copy detailed task lessons into it.

An unrelated application defect remains a `FOLLOW-UP CANDIDATE` and must not be
fixed automatically. A confirmed reusable development rule may receive a small
documentation-only update without broadening the application change.

Include these fields in the task handoff:

```text
Rule Impact: UPDATED / NONE
Rule Added: <short description / N/A>
Documentation Updated: <path(s) / NONE>
```

List multiple rules concisely. For example, proof that normal authenticated
login writes shared Oracle state belongs in the verification playbook, while a
temporary stale-server process ID does not belong in repository documentation.

## Working method

- Establish the current behavior and caller contracts before editing.
- Preserve ordering, empty behavior, return types, identity, exceptions, API/error contracts, and transaction behavior unless the task explicitly changes them.
- Keep deterministic business decisions independently testable.
- Preserve unrelated work, generated files, encoding, and line endings.
- Follow the [layer boundaries](../architecture/layer-boundaries.md) for architecture-sensitive changes and the [verification playbook](verification-playbook.md) before reporting completion.
