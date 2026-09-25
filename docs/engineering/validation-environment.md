# Local Oracle validation environment

## Status and boundary

The human-verified provisioning handoff establishes that `NIKA_TEST_USER` exists in `HOZENPDB`, is OPEN, uses `USERS` with a **100 MB finite quota**, `TEMP`, and profile `DEFAULT`; it is local (`COMMON=NO`, `INHERITED=NO`). No roles or production application-object grants were found. The current runtime system privilege is **CREATE SESSION only**.

Fresh-schema migrations succeeded on real Oracle: admin 3, auth 12, contenttypes 2, myapp 25, sessions 1; myapp leaf `0025_planschedulechangehistory`. `showmigrations` confirmed all 43 applied, including myapp 0001 through 0025. Post-migration inventory was 37 tables, 158 indexes, 24 LOBs and 35 sequences. `CREATE SESSION` + `CREATE TABLE` was insufficient: creation of `django_migrations` failed with ORA-01031. Successful initialization required `CREATE SESSION`, `CREATE TABLE`, `CREATE SEQUENCE`, `CREATE PROCEDURE`, and `CREATE TRIGGER`. This empirical privilege finding supersedes the earlier design inference from identity-column syntax. It does not isolate which of the three added privileges was individually necessary.

The separately provisioned unmanaged (`managed=False`) `SHIFTPATTERN_WORKER_VIEW` is VALID and depends only on `NIKA_TEST_USER.MYAPP_SHIFTPATTAN_TB` and `NIKA_TEST_USER.MYAPP_FIELD_WORKER_TB`, with no production-owner or database-link dependency. Migration scripts do not create it. All initialization privileges, including `CREATE VIEW`, were subsequently revoked. Seed/reset require no DDL privileges. As owner, `NIKA_TEST_USER` can perform DML on its existing objects with `CREATE SESSION` only; ownership also retains substantial control over those objects.

These Oracle facts come from the human's verified handoff, not a new Codex connection. Real Oracle preflight and the initial synthetic seed succeeded. Subsequent runserver initialization exposed missing affiliation ID 7; the corrected seed preserves affiliation IDs 1–7 and has passed offline middleware/reset regressions. A successful real reset/reseed and UI startup after that correction have not yet been reported; do not infer that every Human Review scenario has passed.

Production remains `MYDJANGO_USER` on `JP1052VS074`, Oracle `ORCL/orcl`, PDB `HOZENPDB`. Validation is `NIKA_TEST_USER` in that same PDB. CPU, RAM, storage, undo, redo and availability remain shared. Start/use the local validation runtime only when needed.

Normal development/IIS still uses `myproject.settings` and `.env`. Browser research still uses the separately guarded read-only settings and account. Neither is a fallback for failed validation.

## Configuration

Never grant `DBA`, `RESOURCE`, `CONNECT`, `UNLIMITED TABLESPACE`, ANY privileges, production application-object privileges or production roles/proxies to the validation user. No production grants are required. Use the [same-code architecture and access boundaries](../architecture/database-access.md).

Use `myproject.settings_validation`. It imports `settings_shared.py`, which does not load environment files or credentials. Only `.env.validation` is loaded, without overriding process variables. This file is ignored by Git and must contain only validation configuration. Never copy the production `.env` into it.

All these values are mandatory; there are no credential or port defaults:

| Variable | Requirement |
|---|---|
| `NIKA_VALIDATION_MODE` | Exactly `1` |
| `NIKA_VALIDATION_SECRET_KEY` | Independently generated validation-only secret; never reuse the normal key |
| `HOZEN_VALIDATION_HOST` | DBA-approved hostname/IPv4 address; host `jp1052vs074.ad.toyota-shokki.co.jp` |
| `HOZEN_VALIDATION_PORT` | DBA-approved numeric port, 1–65535 |
| `HOZEN_VALIDATION_SERVICE` | Exactly `hozenpdb.ad.toyota-shokki.co.jp` |
| `HOZEN_VALIDATION_USER` | `NIKA_TEST_USER` (normalized to uppercase) |
| `HOZEN_VALIDATION_PASSWORD` | Dedicated validation account password |

The expected user/schema/PDB/service are fixed in code, not configurable target-switching variables. `DJANGO_SECRET_KEY`, `ORACLE_DATABASE_*`, `MARP_DB_*` and `HOZEN_READONLY_*` do not supply validation credentials. No real secrets belong in command arguments, logs, committed examples or the runbook.

The Oracle client/driver must be installed as for the normal local runtime. The human has successfully run preflight against the account. Codex connectivity has previously failed; failures must not cause a fallback to another account or settings module.

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
- Database sessions belong in validation-owned `django_session`.
- MARP is disabled at the existing connection configuration boundary, before `pyodbc.connect`. The parts-search API returns a clear unavailable response (503).
- Application base, login and Django Admin display `検証環境 / VALIDATION`; titles carry `[検証環境]`. Normal runtime pages have no marker.
- `DEBUG=False`; allowed hosts are only `127.0.0.1`, `localhost`, `[::1]`. Cross-origin allowances are disabled.

## Preflight and local launch

Use these commands with the dedicated local validation configuration. Do not supply production credentials to make preflight succeed.

```powershell
E:\repos\myproject\venv\Scripts\python.exe manage.py validate_validation_environment --settings=myproject.settings_validation
```

Preflight reports settings mode, fixed expected identity, verified actual identity when available, cache, console logging, MARP state, cookies and allowed hosts. Connection errors are sanitized. Failure has a nonzero exit status and no fallback. It does not read application records or create objects.

Successful identity verification **does not certify privileges, local object ownership, view availability, migration completion or writable readiness**. These are separate DBA/provisioning gates. Once those later gates pass:

```powershell
E:\repos\myproject\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8011 --settings=myproject.settings_validation --insecure
```

`--insecure` here only enables Django development static serving with `DEBUG=False`; it does not bypass the database guard. Reviewed collected static assets must be available for the configured manifest storage. `ALLOWED_HOSTS` checks request host headers; it is not a socket-binding or firewall control. Never bind this local validation runtime to `0.0.0.0` or expose it through IIS/proxy/tunnel.

## Future schema migration standard

Maintain **one Django migration file/chain** for both schemas. Schema changes (tables, columns, FKs, constraints or indexes) require reviewed migrations; ordinary Python, JavaScript, CSS, text or business-logic edits do not automatically require one. Do not create environment-specific business seed migrations.

1. Make the model/code change and create the migration once. Review its SQL/data operations, dependencies, reversibility and compatibility with deployed code. Rehearsal through `myapp.0025_planschedulechangehistory` is empirically proven; it does not certify future migrations automatically.
2. Stop validation writers, select `myproject.settings_validation`, and run identity preflight. Review quota headroom, target objects, isolation and the recovery plan. No production credentials may be used in this process.
3. In an approved migration window, a human DBA temporarily grants the reviewed capabilities to `NIKA_TEST_USER` in `HOZENPDB`: the empirically successful initialization set is `CREATE TABLE`, `CREATE SEQUENCE`, `CREATE PROCEDURE`, `CREATE TRIGGER`, in addition to retained `CREATE SESSION`. Review the actual new migration; do not improvise extra privileges after an error or retain schema-creation privileges for convenience. Codex must not request/use SYS credentials.
4. Apply the same reviewed migration files to validation using explicit settings:

   ```powershell
   python manage.py migrate --plan --settings=myproject.settings_validation
   python manage.py migrate --settings=myproject.settings_validation
   python manage.py showmigrations --settings=myproject.settings_validation
   ```

5. Verify the recorder, local objects, indexes/constraints and any approved data transformations. Stop on errors. Oracle DDL must not be assumed to roll back with `transaction.atomic`; recovery requires a reviewed repair/restore plan.
6. Have the DBA revoke temporary privileges back to `CREATE SESSION` only and verify effective privileges. Seed/reset/inventory require this runtime privilege state, so revoke **before** using those commands or resuming normal Human Review. Then verify real Oracle behavior and the applicable scenarios below; record results and obtain Human Review approval.
7. In an approved production maintenance window, apply the **same migration files** to `MYDJANGO_USER` using the production procedure, backup and recovery gates in the [runtime/deployment rules](../開発・本番運用ルール（更新版）.md). Select `myproject.settings` explicitly, verify the production target and plan, and coordinate migration/deployment order with code compatibility. Validation success does not authorize production writes.
8. Verify production and record the migration names, code revision and results. Each schema has its own migration recorder; do not generate a second production migration or use `--fake` to bypass an unexplained difference.

## Unmanaged view maintenance

For an approved creation/change of `NIKA_TEST_USER.SHIFTPATTERN_WORKER_VIEW`, obtain the authoritative definition through the dedicated read-only research path and review its source relations. A human DBA grants `CREATE VIEW` only for that window. Verify the exact validation identity, then provision a normal non-FORCE view over the two validation-owned tables. Verify `USER_VIEWS`, VALID status and `USER_DEPENDENCIES`: only those two local tables, no `MYDJANGO_USER` owner and no database link. The DBA then revokes `CREATE VIEW`; verify runtime privileges again. Django `migrate` does not provision this view. Stop for unexpected dependencies or Oracle errors; do not switch schema to repair them.

## Verification without Oracle

`myapp/test_validation_environment.py` uses subprocess settings imports with synthetic values and disabled dotenv IO, mocked cursors, and a mocked driver factory exercising Django's actual connect/close lifecycle. It also tests MARP, templates and sanitized preflight output. No Oracle account is needed.

For offline tests, configure Django from `settings_shared` with `DATABASES={}`, a synthetic secret, local-memory cache and no file logging before `django.setup()`, then use `unittest`. Do not use the normal settings or Django's Oracle test-database creation runner. System checks must use the same isolated configuration or mock driver connection methods before loading validation settings.

## Synthetic baseline and guarded reset

Human Review order: preflight -> seed an empty baseline (or explicitly reset an existing one) -> inspect -> [start local UI](#preflight-and-local-launch) -> exercise the scenario map below and record results. Stop/restart the validation server around reset. A seeded dataset is not evidence that the scenarios have passed.

No production data is read or copied. Add **`NIKA_VALIDATION_SEED_PASSWORD`** to ignored, access-restricted `.env.validation` with a locally chosen secret. No actual value belongs in examples, command arguments, logs or Git. Both seed and reset require it and use Django `create_user` / `set_password` hashing. Users are `VAL_A_USER` and `VAL_B_USER`, with synthetic profiles in organizations `VAL_A` and `VAL_B`; neither is staff/superuser.

**Existing Nika login is member-number-only:** `/login/` calls `MemberAuthenticationBackend.authenticate(member_id=...)` without a password. The seed password does not change that behavior or provide an additional access boundary for this page. Login with the synthetic member ID. Keep the server bound to loopback. Admin access is not granted by this dataset.

Stop the validation server and all other validation writers before seed/reset. Run one command at a time. There is no cross-process maintenance lock. Restart the server afterward so its process-local caches cannot retain deleted IDs. Reset deletes validation sessions, requiring a fresh login.

```powershell
E:\repos\myproject\venv\Scripts\python.exe -B manage.py validate_validation_environment --settings=myproject.settings_validation
$validationAnchor = Get-Date -Format yyyy-MM-dd
E:\repos\myproject\venv\Scripts\python.exe -B manage.py seed_validation_environment --anchor-date $validationAnchor --settings=myproject.settings_validation
E:\repos\myproject\venv\Scripts\python.exe -B manage.py inspect_validation_dataset --settings=myproject.settings_validation
```

Seed requires every managed `myapp` table to be empty; migration-created auth permissions/contenttypes are retained. A second seed refuses before DML. No fixtures or schema migrations contain synthetic data.

All commands require the exact validation settings module, explicit mode, single default connection, no routers, and reuse the existing identity verifier. Readiness checks require CREATE SESSION only, no enabled roles or directly received production object/column grants, all managed tables owned locally, complete migration graph, and the exact two local VALID view dependencies. These runtime checks do not replace DBA review of PUBLIC/nested-role/proxy/executable/database-link privileges.

Seed and reset use one `transaction.atomic` boundary. Reset requires explicit confirmation, refuses unrelated managed application tables or rows outside the reviewed synthetic scope, and deletes only the explicit model allowlist in child-first order. This includes Plans, approvals/practitioners/weekly duties, synthetic histories, details/cards, reference/calendar/profile rows and validation sessions. It preserves `django_migrations`, auth permission/group/contenttype metadata, schema objects and the unmanaged view. Do not add unrelated test datasets to this schema and expect this reset to remove them.

Reset uses ordinary DML, never Django `flush`, `TRUNCATE`, or schema drops. Production data is not a seed source.

```powershell
# Destructive to the reviewed synthetic baseline: stop the validation server first.
E:\repos\myproject\venv\Scripts\python.exe -B manage.py reset_validation_environment --anchor-date $validationAnchor --confirm-validation-reset --settings=myproject.settings_validation
E:\repos\myproject\venv\Scripts\python.exe -B manage.py inspect_validation_dataset --settings=myproject.settings_validation
```

The same anchor yields the same business scenarios, not the same generated IDs, timestamps or password hashes. Oracle identity counters do not roll back. The validation affiliation reference master preserves the verified IDs and exact names: `1=A班`, `2=B班`, `3=C班`, `4=連2_A`, `5=連2_B`, `6=常昼`, `7=休日`. Existing cache middleware resolves the holiday affiliation by ID 7. Calendar assignments use only A/B/C. This affiliation naming does not determine shift/worker pattern names. Before inserting these fixed IDs, the builder consumes generated affiliation IDs through 7 with temporary rows that it deletes in the same transaction; later generated IDs therefore do not collide with the reference rows. Shift 7=休日 and rules 1/3/4/15 remain fixed. Ordinary shifts use generated IDs; a generated reserved value is consumed and its temporary row deleted before inserting the special reference row. Field-worker IDs intentionally match shift IDs for the existing view join. No sequence reset or DDL is used.

### Calendar and scenario map

The anchor is explicit and should be today's date. The builder uses the existing `get_plan_sync_today` seam and fiscal range derived from `PLAN_SYNC_BASE_DATE=2026-04-01`. It refuses a window without both past and future dates inside that fiscal year. Never override the application clock to force this dataset to pass. After the application's current fiscal window expires, review its fiscal-date policy separately.

Past = Monday of the preceding week; future/Move source = next Monday strictly after the anchor; Move destination = following Tuesday. Calendar spans past through future+13 days. For anchor **2026-09-25**: past **09-14**, source **09-28**, destination **09-29**, last **10-11**. Future+6/+7 are explicitly LONG_HOLIDAY with holiday shift assignments. Other dates explicitly assign A班=1直, B班=2直, C班=3直. `VAL-W1..4` are synthetic maintenance-week labels. This is controlled fixture data, not an inferred production rotation.

Rules: 1=D1 weekdays `[0,1,2,3,4]`; 3=W2 weeks `[1,3]`; 4=W2 weeks `[2,4]`; 15=D1 NEXT_DATE_TAG EQ `{"value":"LONG_HOLIDAY"}`. Rules 1/15 automatically manage weekdays in the existing UI. No unrelated monthly/yearly rules are added.

Find cards by `VAL-<key>` inspection number and `[VALIDATION] <key>` name, under `VAL_A-EQUIP` or `VAL_B-EQUIP`. Initial Plan comments identify scenario variants; after regeneration identify Plans by card/date/team, not comment or generated ID. Inventory prints current IDs for API checks.

| Key | Human Review action / expected behavior |
|---|---|
| NO_RESYNC | Change description; existing Plans and a manually moved Plan remain. |
| SCHEDULE | Change practitioner from 1直 to 2直; eligible future WAITING rows regenerate using Calendar-derived teams. Past and timed WAITING remain unless explicitly confirmed. |
| LIFECYCLE | Rule 3 periodic card; switch to メーカ (ineligible), then back to 定期点検. Verify lifecycle resync and preserved protected/non-WAITING Plans. |
| INELIGIBLE | Rule 3 メーカ card initially has no Plans; switch to 定期点検 and verify generation. |
| ABOLISH | Abolish card; WAITING may delete, IN_PROGRESS preserves by default and requires explicit confirmation to delete; COMPLETED always preserves. |
| MOVE | Move future source from A班 to next-day B班. Exactly one Move history row; then descriptive edit preserves moved Plan, schedule edit can supersede it. |
| STALE | Open same Plan in two tabs; commit one Move then submit the old source from the other. Expect stale rejection without a second history row. |
| ROLLBACK | Dedicated card for later controlled Oracle transaction-failure tests. No fault-injection UI or Oracle write test is implemented here. |
| FOREIGN | VAL_B card/Plan: as VAL_A_USER, its Move ID must be rejected as not found. Log in as VAL_B_USER to see its own scope. |
| HOLIDAY | Rule 15, shift 7; Plan on future+5 (holiday eve), exercising affiliation 1 fallback. |

SCHEDULE/LIFECYCLE/ABOLISH/ROLLBACK each have future WAITING, past WAITING, future WAITING with `plan_time`, IN_PROGRESS with time, and COMPLETED. Explicit protected deletion must not regenerate past dates. Histories start empty and are created through actual application operations; this makes unexpected history inserts visible. No lineage behavior is added.

Before Human Review, inspect the real view row count/values, login and Calendar slots, verify schema quota headroom, and record the seed summary. Real Oracle FK/rollback/concurrency behavior remains to be tested there; offline SQLite tests are not proof of those engine behaviors.

### Offline verification

```powershell
E:\repos\myproject\venv\Scripts\python.exe -B scripts/testing/validation_dataset_tests.py
```

This runner configures only in-memory SQLite from non-secret shared settings and blocks Oracle/SQL Server driver connections. Schema creation inside this disposable SQLite test harness is not an Oracle migration. Tests cover identity rejection, deterministic baseline, reset rollback, scope rejection, actual resync and Move services, stale Move/history, and no reset DDL.
