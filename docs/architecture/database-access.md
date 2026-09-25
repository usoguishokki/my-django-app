# Database access architecture

This repository has three existing Oracle access paths and a dedicated writable validation fourth path. Do not substitute one for another.

## Environment topology

The development application/runtime and production IIS application/runtime are separate, but both normal application connections currently use the same production Oracle database:

```text
Normal development / production IIS (myproject.settings)
    -> MYDJANGO_USER in HOZENPDB
Local validation (myproject.settings_validation)
    -> NIKA_TEST_USER in the same HOZENPDB
```

Verified production Oracle identity:

- Host: `jp1052vs074.ad.toyota-shokki.co.jp` (`JP1052VS074`)
- Oracle: 19c Standard Edition 2, `19.19.0.0.0`
- Instance/CDB: `ORCL` / `orcl`
- PDB: `HOZENPDB`
- Nika service: `hozenpdb.ad.toyota-shokki.co.jp`
- Production application owner: `MYDJANGO_USER`

Writable validation has separate application objects/data in `NIKA_TEST_USER`; it is not a fully isolated staging database or separate Oracle server. **Normal development settings still target production.** Any operation through the normal Django database connection that performs `migrate`, schema DDL, `INSERT`, `UPDATE`, `DELETE`, an application mutation API, Move persistence, fixture creation, or destructive test setup is a production database change even when initiated from the development worktree or runtime.

Accordingly:

- Unit, static, and frontend tests that do not connect to Oracle remain safe.
- Offline migration graph and state inspection remain safe.
- Authorized SELECT-only research through the dedicated read-only path remains safe.
- Synthetic fixture writes, intentional rollback/failure injection, concurrency mutation tests, and test Move writes require the guarded validation schema; never target `MYDJANGO_USER` for these tests.
- Normal development browser access is not isolated from production data. Use the guarded read-only browser-verification path for browser research that must not write.

## Normal application path

The Django application uses the normal `DATABASES` configuration in `myproject.settings` to access Oracle. This is runtime application behavior, not an ad-hoc research interface. Credentials come from ignored environment configuration and must never appear in documentation, command output, prompts, logs, or commits.

Running `python manage.py migrate` from the development worktree/runtime with the normal settings modifies the shared production `HOZENPDB`. A migration may be executed only as an explicitly approved production change procedure with the target, backup, change window, verification, and rollback approach understood. Never run a migration against the normal connection merely as a development experiment.

### Plan Scheduling Move production gate

The read-only validation design audit on 2026-09-25 verified that the production migration recorder includes `myapp.0025_planschedulechangehistory`. This corrects the earlier statement that it was unapplied. The research account could not see `PLAN_SCHEDULE_CHANGE_HISTORY` in its object inventory; its live structure and grants were not certified by that audit. A migration-recorder entry alone is not structural verification or authorization for a production Move. Intentional transaction failure or rollback testing requires a verified writable validation target and must not run against production application data.

## Writable validation path

`myproject.settings_validation` reuses non-secret defaults from `settings_shared.py` without importing normal settings or loading the normal `.env`. It requires explicit opt-in and dedicated credentials from process variables or ignored `.env.validation`. The fixed validation identity is `NIKA_TEST_USER` for session user, current user and current schema, in `HOZENPDB`, on service `hozenpdb.ad.toyota-shokki.co.jp`.

`NIKA_TEST_USER` is provisioned in `HOZENPDB`, with its own migrated tables and unmanaged worker view. The [validation runbook](../engineering/validation-environment.md) owns verified provisioning/migration evidence, quota, temporary privileges, runtime privileges, view maintenance, and synthetic seed/reset procedures. Identity preflight alone does not certify readiness or absence of production grants.

**Same code; different settings and data.** Production (`myproject.settings` -> `MYDJANGO_USER`) and validation (`myproject.settings_validation` -> `NIKA_TEST_USER`) execute the same application business logic. Do not create separate production/test business implementations. Validation-only differences are limited to environmental safeguards: identity verification, UI marker, cache/cookies/logging isolation and MARP disablement. There is one migration chain; follow the [future migration standard](../engineering/validation-environment.md#future-schema-migration-standard).

Every physical Django connection is checked through `connection_created`; a mismatch or identity-query error closes the connection and raises a fatal safety error. There is no schema repair or `SET CURRENT_SCHEMA`. The explicit preflight command checks the same identity before future Human Review. Validation has local-memory cache, console logs, independent secret and cookie names, a visible marker (including login/Admin), and disabled MARP access.

The validation schema lives on the **same Oracle instance/PDB** as production. Schema separation does not isolate CPU, RAM, storage, undo, redo or availability. It is not a separate Oracle server. The required DBA boundary is no production application-object grants, no broad roles/ANY privileges, a finite quota, and review of PUBLIC, nested-role, executable and database-link access. Use only the guarded minimal synthetic dataset; never copy production records.

Access responsibilities are distinct: `MYDJANGO_USER` owns production application data; `HOZEN_READONLY` is for SELECT-only production research/browser verification; `NIKA_TEST_USER` owns writable validation data. Never reuse the research account for validation writes or use production credentials as a fallback.

Documentation ownership: `AGENTS.md` owns mandatory repository safety rules; this document owns topology/access responsibilities; the [validation runbook](../engineering/validation-environment.md) owns validation operations and the migration standard; [runtime/deployment rules](../開発・本番運用ルール（更新版）.md) own IIS/production deployment. Link to these procedures rather than copying them.

## AI/Codex read-only research path

Ad-hoc Oracle research must use `scripts/research/oracle_readonly.py`. It loads the repository-local ignored `.env` without overriding process variables and requires these dedicated settings:

- `HOZEN_READONLY_HOST`
- `HOZEN_READONLY_PORT`
- `HOZEN_READONLY_SERVICE`
- `HOZEN_READONLY_USER`
- `HOZEN_READONLY_PASSWORD`

The CLI accepts one query through `--sql` or standard input and supports `--format table` (the default) and `--format json`:

```powershell
E:\repos\myproject\venv\Scripts\python.exe scripts/research/oracle_readonly.py --sql "SELECT ..."
```

The script fails closed unless all of its checks pass. It:

- permits one `SELECT` or `WITH ... SELECT` statement only;
- rejects write, DDL, procedural, locking, and multi-statement SQL;
- requires the dedicated `HOZEN_READONLY` user, expected Oracle container, approved role set, and `CREATE SESSION` as the only system privilege;
- rejects object grants outside the approved application owner or outside `READ`/`SELECT`;
- starts the connection with `SET TRANSACTION READ ONLY`;
- uses a process-local Oracle Net configuration and sanitizes driver failures.

Never place credentials directly in the command. If this dedicated path cannot connect or fails a safety check, report that failure. Do not fall back to Django's normal production connection.

### ORA-12638 research failure

An `ORA-12638` from an ordinary `manage.py shell` research attempt does not establish that the table or `SELECT` was invalid. It means that path did not provide a valid repository-supported research connection. Stop using the default connection, retry through `oracle_readonly.py`, and report any dedicated-path failure without falling back.

## Browser verification path

Browser verification uses the dedicated read-only account through:

- `myproject/settings_browser_verification.py`
- `myapp/browser_verification.py`

Start it only with the explicit safety flag and settings module, for example:

```powershell
$env:NIKA_ZERO_WRITE_BROWSER_VERIFY = "1"
E:\repos\myproject\venv\Scripts\python.exe manage.py runserver 8010 --settings=myproject.settings_browser_verification
```

The settings module refuses to load without the flag, replaces the default database credentials with `HOZEN_READONLY_*`, disables persistent connections, and uses signed-cookie sessions. The verification app config requires the read-only username, initializes the isolated Oracle Net configuration, disconnects Django's `update_last_login` handler, and verifies the connected Oracle identity, container, roles, system privileges, and effective object grants. It also sets the current schema to the approved application owner so unqualified Django model reads resolve correctly.

These safeguards reflect the implementation; they do not authorize writes. If verification startup or connection validation fails, stop and report the failure rather than switching to the normal application database path.
