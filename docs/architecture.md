# Application Architecture

## 1. Architecture goals

This repository is a modular Django monolith. Its architecture should make dependency direction explicit, preserve behavior during incremental changes, and keep business rules testable. Simplicity is preferred over maximum abstraction.

## 2. Backend dependency direction

Dependencies point inward from delivery code toward application and domain behavior, and outward to persistence only through defined read and write boundaries:

```text
Controller -> Service -> Selector -> Django Model / ORM
                     \-> Domain

Service result -> Presenter -> HTTP or CSV response
```

Views, APIs, context processors, and middleware are controller entry points. Infrastructure modules adapt external systems. A Selector may use the ORM or a relevant infrastructure adapter to fulfill a read contract.

## 3. Read path

All application database reads follow:

```text
Controller -> Service -> Selector -> Model / ORM
```

Selectors own filtering, joins, prefetching, ordering, and intentional QuerySet evaluation. A changed Selector contract must preserve relevant ordering, empty results, return type, model identity, not-found behavior, and exceptions. Inspect all production callers before converting a QuerySet to a concrete value.

## 4. Write path

Writes follow:

```text
Controller -> transactional Service -> Django Model write
```

Services may perform legitimate writes and own transaction boundaries. Supporting reads go through Selectors. Repository classes are not required around Django Models.

## 5. Layer responsibilities

- **Controller:** Parse and validate requests at the HTTP boundary, apply authentication/decorators, invoke Services, and construct responses. No direct Model or Selector reads.
- **Service:** Implement application use cases, orchestration, authorization-sensitive workflow, transactions, and writes. Call Domain and Selectors; do not perform Selector-owned database reads.
- **Selector:** Own database reads and explicit use-case read contracts.
- **Domain:** Own deterministic rules, calculations, statuses, and validation concepts. No dependency on Models/ORM, Selectors, Services, Controllers, or Presenters.
- **Presenter:** Transform already-loaded results without querying, invoking Services/Selectors, or deciding business policy.
- **Model:** Define Django persistence and relationships.
- **Infrastructure:** Adapt external systems and technology-specific integrations.

Django `TextChoices` and `IntegerChoices` already used by Domain code are a deliberate compatibility exception, separate from ORM access. A broad conversion requires its own approved task.

## 6. Frontend target direction

```text
feature bootstrap / event handler -> application function -> API / Domain / State
application result -> Renderer / UI
```

Bootstrap, UI, and Renderer modules own DOM access. Formatting, business decisions, and state transitions should be independently testable. Cross-feature infrastructure should be shared only when it represents the same contract.

## 7. SOLID and DRY policy

Apply SOLID where it resolves demonstrated coupling or responsibility problems. Prefer functions and modules; introduce classes or interfaces only for meaningful state, lifecycle, substitution, or multiple implementations.

DRY means a single authority for business knowledge such as rules, status semantics, date/shift calculations, validation, and API/error contracts. Similar local syntax does not by itself justify an abstraction.

## 8. Testing strategy

- Keep the AST architecture guard permanent and high-confidence.
- Test Domain behavior with pure unit tests.
- Test Service orchestration with focused contracts and mocks where practical.
- Test Selector ordering, empty behavior, identity, and exceptions with appropriately isolated integration tests.
- Test important API payloads, statuses, authentication, redirects, and not-found behavior.
- Add frontend tests around pure Domain/Application/State behavior and focused feature smoke tests.
- Choose manual smoke tests according to each changed use case.

The required current validation baseline is recorded in the root `AGENTS.md`. Migration drift is checked with `makemigrations --check --dry-run`; migrations are not run merely to validate a refactor.

## 9. Codex development workflow

1. Confirm branch, HEAD, working-tree state, and untracked files.
2. Inspect relevant callers and establish behavior contracts before editing.
3. Make the smallest cohesive change and preserve unrelated work.
4. Run focused regression tests and the repository validation baseline.
5. Review the complete diff, including untracked and generated files.
6. Report behavior, architecture impact, validation, risks, and manual smoke-test needs.

Generated files, encoding, and line endings are not changed silently. The Parts Search stylesheet named in `AGENTS.md` is protected unless explicitly in scope.

## 10. Explicit non-goals

The default architecture does not require:

- Repository-pattern wrappers for Django Models
- CQRS
- a dependency-injection container
- broad Django enum rewrites
- frontend framework rewrites or global event buses
- abstraction solely to reduce repeated syntax

Settings, KPI, cache, frontend, CI, and other broader refactors require separate approved tasks.
