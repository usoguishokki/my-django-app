# Layer Boundaries

## Scope

This repository is a modular Django monolith with established `services`, `selectors`, `domain`, and `presenters` modules. These rules describe the current code direction and its architecture tests; they do not require a framework rewrite or a layer for every function.

## Backend direction

The default read path is:

```text
View / API / Controller / Context Processor / Middleware
  -> Application Service
  -> Selector
  -> Django Model / ORM
```

Services may also call Domain code. Results already loaded by the application layer may flow through Presenters before an HTTP or CSV response.

The default write path is:

```text
View / API / Controller
  -> transactional Application Service
  -> Django Model write
```

Supporting reads for a write use case go through Selectors. Django Models do not need Repository wrappers.

## Responsibilities

- **View / API / Controller:** Own HTTP-boundary parsing and validation, authentication/decorators, Service invocation, and response construction. Do not place business rules here or bypass Services with direct Model/Selector reads.
- **Application Service:** Represent a use case. Orchestrate Domain and Selector calls, authorization-sensitive workflow, transactions, and legitimate Model writes. Do not add a meaningless one-line Service solely to satisfy a diagram.
- **Selector / read helper:** Own database reads, filtering, joins, prefetching, ordering, and intentional evaluation. Do not perform unrelated mutations.
- **Domain:** Own deterministic rules, calculations, statuses, and validation concepts. Domain code must not depend on Models/ORM, Selectors, Services, Controllers, or Presenters.
- **Presenter:** Transform already-loaded application results. Do not query, call Services/Selectors, or decide business policy.
- **Model:** Define Django persistence and relationships.
- **Infrastructure:** Adapt external systems and technology-specific integrations.

Existing Django `TextChoices` and `IntegerChoices` used by Domain code are a compatibility exception. Do not broadly rewrite them without a separate approved task.

## Contracts and shared rules

- Shared business rules have one authoritative implementation. Search before adding a second copy and reuse or extend the existing implementation when appropriate.
- Avoid bypassing an established Service boundary, especially when it owns authorization, transaction, status, date, or calendar behavior.
- Preserve Selector contracts where relevant: ordering, empty behavior, return type, model identity, not-found behavior, and exceptions.
- Inspect every production caller before changing a QuerySet into a list, tuple, scalar, or differently filtered result.
- Keep transaction ownership and mutations visible in the Service use case.

For example, card creation should reuse `sync_waiting_plans_for_inspection_standard(...)` instead of duplicating plan-date, calendar, and status logic.

## Frontend direction

The repository's target frontend flow is:

```text
feature bootstrap / event handler
  -> application function
  -> API / Domain / State

application result
  -> Renderer / UI
```

Keep DOM access in bootstrap, UI, and Renderer modules. Keep formatting, business decisions, and state transitions independently testable. Share cross-feature infrastructure only when it represents the same contract.

Do not introduce a frontend framework rewrite, global event bus, dependency-injection container, or generalized abstraction layer without a demonstrated requirement.

## Architecture verification

The permanent guards are:

```text
myapp/tests/test_architecture_boundaries.py
myapp/tests/test_layer_boundary_contracts.py
```

Do not weaken them merely to make a change pass. If a legitimate exception is required, explain and document it before changing a guard. Select the full verification scope from the [verification playbook](../development/verification-playbook.md).
