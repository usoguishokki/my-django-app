# Repository guidance for AI/Codex work

Read this file before changing the repository. Detailed guidance lives in the linked documents.

## Engineering rules

- **SOLID + DRY + KISS + YAGNI are mandatory.** Preserve responsibility boundaries; reuse an existing selector, service, helper, or state path when its responsibility fits; prefer the smallest correct change; and do not add speculative frameworks or future features. Clarity and SOLID take precedence over forced reuse.
- Investigate narrowly first. Follow the existing data flow before editing code.
- Do not invent business rules. If evidence is missing, stop and report the unknown.
- Keep focused tasks focused; do not mix broad refactors or unrelated cleanup into them.
- Run focused verification first. Use broad or full suites only when focused evidence requires them.

## Database and browser-verification safety

- Development and production application runtimes are separate, but they currently share the production Oracle `HOZENPDB`. A development runtime is not a development database: any write through the normal Django database connection is a production change. See [database access architecture](docs/architecture/database-access.md).
- Never use the normal production Oracle connection for ad-hoc AI/Codex research. In particular, do not use ordinary `python manage.py shell` for that purpose.
- Use `scripts/research/oracle_readonly.py` with the dedicated `HOZEN_READONLY_*` configuration. Research SQL is read-only: no `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `ALTER`, `DROP`, `TRUNCATE`, or other DDL.
- Never print, store, log, prompt with, or commit real credentials.
- Browser verification uses `myproject/settings_browser_verification.py` and `myapp/browser_verification.py`, with `NIKA_ZERO_WRITE_BROWSER_VERIFY=1` and the browser-verification settings module.
- See [database access architecture](docs/architecture/database-access.md) for commands and safeguards.
- Writable validation uses `myproject.settings_validation`, dedicated `HOZEN_VALIDATION_*` credentials, and fixed `NIKA_TEST_USER` identity checks. The account/schema and unmanaged worker view are provisioned; runtime has CREATE SESSION only. Synthetic seed/reset must use the guarded validation commands. Never substitute normal settings when validation fails. See [validation workflow](docs/engineering/validation-environment.md).

Production and validation use the same business code and migration chain. Rehearse schema changes in validation before an approved production application of the same migration. Temporary migration privileges require a reviewed DBA window and must be removed before normal validation use; follow the [migration operating standard](docs/engineering/validation-environment.md#future-schema-migration-standard).

## Plan Scheduling data rule

Do not invent maintenance-week shift/team rotations. Plan Scheduling assignments come from actual `Calendar_tb`-derived daily slots. See [Plan Scheduling data flow](docs/architecture/plan-scheduling-data-flow.md).

## Knowledge updates

At the end of a task, evaluate whether newly verified information is durable repository knowledge. If it is, update the relevant authoritative document in the same focused work unless documentation changes are explicitly forbidden. Never document speculation as fact. See [knowledge maintenance](docs/engineering/knowledge-maintenance.md).
