# Repository Development Guide

This is the Codex entry point for repository work. Follow task-specific instructions when they are stricter, preserve unrelated work, and read:

- [Documentation index](docs/README.md)
- [Coding standards](docs/development/coding-standards.md)
- [Verification playbook](docs/development/verification-playbook.md)
- [Layer boundaries](docs/architecture/layer-boundaries.md) for architecture-sensitive work

## Core rules

- Make the smallest correct change. Do not combine bug fixes with unrelated refactoring; report useful out-of-scope cleanup as `FOLLOW-UP CANDIDATE`.
- Before adding business logic, search for the existing authoritative service, helper, component, or rule and reuse or extend it when appropriate.
- Apply SOLID, DRY, KISS, and YAGNI together, in the practical priority: correctness, KISS, YAGNI, DRY, SOLID.
- Do not use SOLID or DRY to justify speculative interfaces, factories, adapters, frameworks, or abstraction layers.
- Select and complete every verification level required by the change before claiming `PASS` or `Ready to Commit: YES`.
- End implementation, investigation, and verification tasks with the Rule Impact Check in the coding standards; update only the smallest appropriate document when a confirmed reusable lesson exists.

## Repository safety

- Do not commit, push, merge, rebase, delete branches, apply/pop/drop/clear stashes, create/apply migrations, or mutate production-like data unless explicitly requested.
- Do not use `git reset --hard`, `git clean`, or other destructive cleanup to remove work you did not create. Inspect `git status --short` before and after work and inspect untracked files before recommending a commit.
- Preserve UTF-8 and existing line endings; do not silently modify generated files.
- `myapp/static/css/pages/parts_search.css` is protected unless the task explicitly targets Parts Search styling.
- Oracle research uses only the dedicated `HOZEN_READONLY` account. Never expose credentials. Reads must be narrow and fail closed; no Oracle writes or global Oracle configuration changes.
