# Local Oracle validation environment

## Status and boundary

Phase 1 provides application/configuration safeguards only. **The validation Oracle account and schema have not been created.** No migration, seed, reset or writable Oracle scenario has been executed as part of this phase. A failed connection is expected until a later approved provisioning phase.

Production remains `MYDJANGO_USER` on `JP1052VS074`, Oracle `ORCL/orcl`, PDB `HOZENPDB`. Future validation is `NIKA_TEST_USER` in that same PDB. CPU, RAM, storage, undo, redo and availability remain shared. Start/use the local validation runtime only when needed.

Normal development/IIS still uses `myproject.settings` and `.env`. Browser research still uses the separately guarded read-only settings and account. Neither is a fallback for failed validation.

## Configuration

Use `myproject.settings_validation`. It imports `settings_shared.py`, which does not load environment files or credentials. Only `.env.validation` is loaded, without overriding process variables. This file is ignored by Git and must contain only validation configuration. Never copy the production `.env` into it.

All these values are mandatory; there are no credential or port defaults:

| Variable | Requirement |
|---|---|
| `NIKA_VALIDATION_MODE` | Exactly `1` |
| `NIKA_VALIDATION_SECRET_KEY` | Independently generated validation-only secret; never reuse the normal key |
| `HOZEN_VALIDATION_HOST` | DBA-approved hostname/IPv4 address; anticipated host `JP1052VS074` |
| `HOZEN_VALIDATION_PORT` | DBA-approved numeric port, 1–65535 |
| `HOZEN_VALIDATION_SERVICE` | Exactly `hozenpdb.ad.toyota-shokki.co.jp` |
| `HOZEN_VALIDATION_USER` | `NIKA_TEST_USER` (normalized to uppercase) |
| `HOZEN_VALIDATION_PASSWORD` | Dedicated account password supplied after provisioning |

The expected user/schema/PDB/service are fixed in code, not configurable target-switching variables. `DJANGO_SECRET_KEY`, `ORACLE_DATABASE_*`, `MARP_DB_*` and `HOZEN_READONLY_*` do not supply validation credentials. No real secrets belong in command arguments, logs, committed examples or the runbook.

The Oracle client/driver must be installed as for the normal local runtime. Client/network authentication setup has not been proven against the future account; failures must not cause a fallback to another account or settings module.

## Isolation and connection verification

- Only one Oracle alias (`default`) is configured.
- Every new physical connection, including reconnects, verifies `SESSION_USER`, `CURRENT_USER`, `CURRENT_SCHEMA`, `CON_NAME` and `SERVICE_NAME` with a SELECT from `DUAL`.
- All three user/schema attributes must be `NIKA_TEST_USER`; container and service must match the fixed values above.
- The guard closes rejected connections and raises `ValidationSafetyError`. It never changes `CURRENT_SCHEMA`.
- `AppConfig.ready()` registers the guard without opening a connection. The explicit preflight opens one early; ordinary requests do not carry an identity-check middleware.
- Oracle's normal Django connection initialization still runs before the connection signal. The validation verifier itself performs only the identity SELECT.
- Local-memory cache is process-local and cannot clear normal memcached data.
- Logging goes to console/stderr, never the IIS log directory.
- Session cookie: `nika_validation_sessionid`; CSRF cookie: `nika_validation_csrftoken`. Cookies are host-only by Django default; ports do not isolate cookies.
- Future database sessions belong in validation-owned `django_session`.
- MARP is disabled at the existing connection configuration boundary, before `pyodbc.connect`. The parts-search API returns a clear unavailable response (503).
- Application base, login and Django Admin display `検証環境 / VALIDATION`; titles carry `[検証環境]`. Normal runtime pages have no marker.
- `DEBUG=False`; allowed hosts are only `127.0.0.1`, `localhost`, `[::1]`. Cross-origin allowances are disabled.

## Future preflight and local launch

These commands are for a later approved phase after dedicated credentials are configured. Do not supply production credentials to make preflight succeed.

```powershell
E:\repos\myproject\venv\Scripts\python.exe manage.py validate_validation_environment --settings=myproject.settings_validation
```

Preflight reports settings mode, fixed expected identity, verified actual identity when available, cache, console logging, MARP state, cookies and allowed hosts. Connection errors are sanitized. Failure has a nonzero exit status and no fallback. It does not read application records or create objects.

Successful identity verification **does not certify privileges, local object ownership, view availability, migration completion or writable readiness**. These are separate DBA/provisioning gates. Once those later gates pass:

```powershell
E:\repos\myproject\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8011 --settings=myproject.settings_validation --insecure
```

`--insecure` here only enables Django development static serving with `DEBUG=False`; it does not bypass the database guard. Reviewed collected static assets must be available for the configured manifest storage. `ALLOWED_HOSTS` checks request host headers; it is not a socket-binding or firewall control. Never bind this local validation runtime to `0.0.0.0` or expose it through IIS/proxy/tunnel.

## Verification without Oracle

`myapp/test_validation_environment.py` uses subprocess settings imports with synthetic values and disabled dotenv IO, mocked cursors, and a mocked driver factory exercising Django's actual connect/close lifecycle. It also tests MARP, templates and sanitized preflight output. No Oracle account is needed.

For offline tests, configure Django from `settings_shared` with `DATABASES={}`, a synthetic secret, local-memory cache and no file logging before `django.setup()`, then use `unittest`. Do not use the normal settings or Django's Oracle test-database creation runner. System checks must use the same isolated configuration or mock driver connection methods before loading validation settings.

## Remaining DBA/provisioning gates

1. Review exact account identity, tablespace/quota and minimum initialization/runtime privileges. No production application-object grants are required.
2. Inspect direct, nested-role, non-default-role and PUBLIC privileges, proxy/executable access and public database links. Identity verification alone cannot prove write isolation.
3. Approve account provisioning separately. The application account must not receive DBA/RESOURCE, broad ANY privileges, user/tablespace administration or unlimited quota.
4. Rehearse the existing migration chain in the empty validation schema under the guard; establish the precise privilege minimum.
5. Provision local `SHIFTPATTERN_WORKER_VIEW` over validation-owned shift/field-worker tables. Migrations do not create this unmanaged view, and middleware loads it.
6. Implement minimal synthetic initialization and guarded transactional data reset. Preserve required legacy rule IDs 1/3/4/15, holiday shift ID 7, affiliation ID 1 and the view's matched pattern IDs. Align scenarios with the existing 2026 fiscal-window behavior; do not invent Calendar rotations.
7. Verify objects/grants and then implement real Oracle rollback, constraint and bounded concurrency tests.

Until those gates are complete, this foundation is not a usable writable validation environment. Do not run seed, flush, migrate, rollback fault injection or production-data copy as a workaround.
