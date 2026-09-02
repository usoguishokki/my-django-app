# Repository Development Contract

This file defines the default working agreement for humans and coding agents in this repository. Follow the user's task-specific instructions when they are stricter. Keep changes small, cohesive, and behavior-preserving unless behavior change is explicitly approved.

## Architecture

### Backend reads

The default read path is:

```text
Controller / API / View / Context Processor / Middleware
  -> Service
  -> Selector
  -> Django Model / ORM
```

- Controllers own HTTP-boundary parsing and validation, authentication/decorators, Service invocation, and response construction. They must not query Models or call Selectors directly.
- Services represent application use cases. They may orchestrate Domain and Selector calls, enforce authorization-sensitive workflow, and own transactions and writes. Database reads belong in Selectors; do not add meaningless one-line Services merely to satisfy a layer rule.
- Selectors own database reads. Their contracts must preserve and document, where relevant, ordering, empty behavior, return type, model identity, not-found behavior, and exception behavior. Before changing a QuerySet result to a list, tuple, or scalar, inspect every production caller for chaining and contract assumptions.
- Domain modules own deterministic business rules, calculations, statuses, and validation concepts. They must not depend on Models/ORM, Selectors, Services, Controllers, or Presenters.
- Presenters transform already-loaded application results. They must not query the database, call Selectors or Services, or decide business policy.

Existing Django `TextChoices` and `IntegerChoices` use in Domain code is a compatibility exception. Do not broadly rewrite it without a separate approved task.

### Backend writes

The default write path is:

```text
Controller
  -> transactional Service
  -> Django Model write
```

Supporting reads for a write use case must go through Selectors. Legitimate Model writes may remain in Services. Django Models do not require Repository wrappers.

### Frontend

The target direction is:

```text
feature bootstrap / event handler
  -> application function
  -> API / Domain / State

application result
  -> Renderer / UI
```

Keep DOM access in bootstrap, UI, and Renderer modules. Pure formatting, business decisions, and state transitions should be independently testable. Do not introduce a framework rewrite, global event bus, dependency-injection container, or generalized abstraction layer without a demonstrated need.

## SOLID and DRY

Apply SOLID pragmatically; do not force object-oriented patterns onto procedural Python or JavaScript. Prefer functions and modules unless stateful behavior, substitution, lifecycle, or multiple implementations provide a concrete reason for a class or interface.

DRY means one authoritative source for business knowledge. Consolidate duplicated business rules, status semantics, date/shift calculations, validation contracts, and API/error contracts. Harmless local repetition is allowed; do not abstract code merely because its syntax looks similar.

## Safety

Do not perform any of the following unless explicitly requested:

- `git commit` or `git push`
- merge, rebase, or branch deletion
- stash apply, pop, drop, or clear
- `git reset --hard` or `git clean`
- creating migration files, applying migrations, or destructive database operations
- creation or mutation of production-like data

Do not silently modify generated files. Do not normalize line endings or file encoding as part of unrelated work; preserve UTF-8. Inspect `git status --short` before and after work, inspect every untracked file before recommending a commit, and exclude unrelated changes.

`myapp/static/css/pages/parts_search.css` is protected. Do not change it unless the task explicitly targets Parts Search styling.

## Validation

The current local baseline is:

```text
python manage.py test myapp.tests.test_architecture_boundaries myapp.tests.test_layer_boundary_contracts --verbosity 1 --noinput
python manage.py check
python manage.py makemigrations --check --dry-run
git diff --check
```

For changed Python files, also run:

```text
python -m py_compile <changed files>
```

Do not run migrations merely to validate a refactor. Select manual smoke tests based on the changed use cases and report what was and was not exercised.

The read-only `python manage.py makemigrations --check --dry-run` command is allowed and is part of the standard validation baseline. Do not create migration files or run `migrate` unless explicitly requested.

`myapp/tests/test_architecture_boundaries.py` is a permanent regression guard. Do not weaken it merely to make a change pass. If a legitimate exception is necessary, explain, review, and document it before altering the guard.
