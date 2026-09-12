# Host RAG readiness root-cause preflight — 2026-09-11

Host RAG Gate: **BLOCKED**. No registration changes, runtime restart, RAG writes,
RAG deletes, or Oracle connections were performed in this investigation.

## Identified mismatch

The successful registration did not represent the running runtime's AI setting:

| Evidence | Observed value |
|---|---|
| Project `.env`: `NAGAKUSA_PLUGIN_AI_ENABLED` | `0` |
| Registration process inherited override | Absent |
| Locally constructed registration `manifest.features.ai` | `false` |
| Locally constructed registration `manifest.tools` | `[]` |
| Saved registration status | `success` |
| Saved fingerprint matches current AI-disabled payload | Yes |
| Saved fingerprint matches otherwise equivalent AI-enabled/two-Tool payload | No |
| Saved state modification time | 2026-09-10T23:45:29.064903+00:00 |
| Running runtime `features.ai` | `true` |

`myapp/nagakusa/config.py::ai_tools_enabled` reads the process environment and
defaults to 0. Django loads the project `.env`. The registration command embeds
`build_manifest()` directly in the POST body; it does not copy the currently
served manifest. Its fingerprint covers the endpoint and complete request,
including credentials (neither credentials nor their fingerprint was printed).
It persists success only after a response with a truthy `ok`.

The request fields are registration_key, base_url, manifest_url, manifest and
api_token. The app_key/module_slug are nika; base_url is
`http://133.222.52.74:8011/`. Only `ai.message.send` is declared. `rag_ingest=false`.

This corrects the earlier handoff's implication that successful normal
registration necessarily synchronized the live manifest's AI-enabled state.
The saved successful request matches **AI disabled**, despite the running
server advertising AI enabled. This is a concrete Nika-side registration
configuration mismatch and strong evidence for the AI-integration rejection.

The exact Host-internal failing flag/value remains **UNKNOWN**: no full historical
registration response was saved, and no accessible documented diagnostic exposes
the stored Host values. Registration success does not establish which payload or
fetched manifest values the Host retained. Do not claim the plugin-use flag,
global RAG switch, approval, Gateway or user access are confirmed good.

## Current Spec and readable state

Fresh GET of the configured Spec Channel returned HTTP 200 and version **28**:
`https://nagakusa-dx.toyota-shokki.co.jp/api/pluginhub/spec-channel/`.
The fresh response is saved in ignored `local_tools/rag-gate-current-spec.json`.

Relevant paths within the feed:

- `contracts.starter_feature_defaults.ai`: `features.ai`, controlled by
  `PLUGIN_AI_ENABLED`, default disabled. Nika maps this to its prefixed variable.
- `contracts.starter_feature_defaults.guidance`: restart and re-register/sync
  after changing the AI feature. Desktop and launchbar visibility are not AI
  enablement or evidence that the plugin-use gate has passed.
- `contracts.rag_ingestion.plugin_push_api`: enabled plugin use and AI integration;
  server-side registered Bearer token, no session authentication; Host
  `PLUGIN_RAG_ENABLED`; applicable production manifest approval; Gateway source
  and record-type allowance. No RAG-specific grant or reapproval is required.
- `changes[0].required_actions`: Host settings, normal production approval and
  current user access checks remain. Search ACL is granted only after current
  plugin access validation. The feed documents no separate tenant RAG flag or
  named per-user RAG enablement setting; none was guessed.
- `contracts.host_ai_interop`: human AI chat uses a signed-in Host frame and
  `ai.message.send`; this is distinct from the server Bearer collection-info API.
- `contracts.host_apis.plugin_capabilities`: GET
  `/plugins/nika/host-api/capabilities/` requires a Host frame and
  `plugin.capabilities.read`, which Nika does not declare. Its published contract
  does not define plugin/AI/RAG gate fields or an applicable Nika RAG capability.
- `contracts.host_apis.host_environment`: GET
  `/plugins/nika/host-api/environment/` requires a Host frame and
  `environment.read`, which Nika does not declare. It returns public URLs/limits,
  not private settings or deployment internals.

Neither frame endpoint was called with an inappropriate Bearer token, and no
permissions were added. No documented server-token registration-state endpoint
was found. The referenced Host `docs/plugin-rag-api.md` is still unavailable in
the supplied repository. Host owner/admin inspection is required to expose the
remaining internal gate. No private endpoint names were guessed or probed.

## Runtime confirmation and collection retry

All four runtime GETs returned HTTP 200: manifest, health, AI help and AI Tools.
The served manifest differs from the registration process's manifest.

Safe invalid Tool calls, which dispatch no Oracle Tool, confirmed old runtime
code: unauthenticated request returns 401/unauthorized; authenticated missing or
unknown Tool returns 400/unknown_tool; responses lack ok/message and the expected
WWW-Authenticate header. The local Spec 28 implementation passes tests. A runtime
reload/restart is required to load it, but none was performed in this read-only
preflight. Restarting under the current `.env` would also change AI enablement to
false, so runtime/registration configuration must be reconciled deliberately.

After confirming runtime state, exactly one collection-info request was sent:

`GET https://nagakusa-dx.toyota-shokki.co.jp/plugins/nika/host-api/rag/`

HTTP **403**; response has only top-level `ok` and `error`. Safe error:

```json
{"code":"rag_forbidden","message":"プラグインの利用とAI連携を有効にしてください。"}
```

No failed-predicate details or collection revision are exposed. The response is
not `rag_disabled`, `rag_not_configured`, `rag_approval_required`, or an
authentication error; validation order is undocumented, so this does not prove
those other gates passed. Record the unobservable Host state as an external
Host configuration blocker, alongside the identified registration mismatch.

## Oracle, validation and external actions

All five variables remain absent from the process, project `.env`, and Windows
User/Machine environments: HOZEN_READONLY_HOST, HOZEN_READONLY_PORT,
HOZEN_READONLY_SERVICE, HOZEN_READONLY_USER, HOZEN_READONLY_PASSWORD.
No credentials were introduced and no Oracle connection was attempted.

35 local tests passed: Nagakusa foundation, phase 2, architecture and layer
boundaries. The existing readiness runner used in-memory SQLite to avoid Oracle.
Django system checks within that run and `git diff --check` passed. No migration
drift command was run because this task excludes Oracle access and changes no
application code. Runtime smoke checks are described above.

External actions only:

1. Host owner/admin: inspect the stored Nika plugin-use and AI-integration values
   and the exact `rag_forbidden` predicate. If those pass, inspect global RAG and
   applicable approval/configuration gates; do not broaden permissions.
2. User/operator: authorize reconciling the registration environment with the
   intended AI-enabled runtime, then normal sync and controlled reload. No such
   change was performed by this preflight.
3. User/operator: provide an approved local dedicated read-only credential setup
   for future Oracle research; never send secret values in chat.

Code changes: **NONE**. Documentation added: this report. Existing work and
checkpoint `instructioncard-rag-poc-20260910T234034Z` preserved.
Commit / Push: **NONE / NONE**.

## Independent recheck — 2026-09-11T00:09:58Z

The live Spec Channel again returned HTTP 200, version 28. Rebuilt registration
payload fingerprint again matches the saved successful registration, with
`features.ai=false`, no Tools, and only `ai.message.send`. The inherited AI
override is absent and the project `.env` specifies `NAGAKUSA_PLUGIN_AI_ENABLED=0`.
No registration command or POST was executed. The historical full response is
not retained: saved success proves the command received truthy `ok`, not which
Host settings were stored.

The four metadata/health GETs again returned 200 and the live manifest reports
`features.ai=true`. Port 8011 is still owned by PID 15388. Invalid Tool requests
again returned 401/unauthorized and 400/unknown_tool, without the Spec 28 envelope
or authentication challenge. These requests used no real Tool and performed no
Oracle query. Reload remains required and was not performed; current startup
configuration must first be reconciled with the intended runtime AI state.

Only after these runtime checks, one collection-info GET again returned
403/`rag_forbidden` with the same plugin-use/AI-integration message and no failed
gate detail. Exact Host failing gate: **UNKNOWN**. The registration mismatch is
confirmed locally; its effect on persisted Host state requires Host inspection.
No undocumented endpoints were probed and no permissions were changed.

All five dedicated Oracle variables remain absent in process/project `.env`
and Windows User/Machine environments. No Oracle connection was attempted.

Recheck validation: all 35 foundation, phase-2, architecture-boundary and
layer-contract tests PASS. Separate Django check and read-only migration drift
check PASS (`No changes detected`), using the existing readiness runner's
in-memory SQLite override to avoid Oracle. This does not validate Oracle schema
or connectivity. Diagnostic script compilation and `git diff --check` PASS.
Host browser/user-access behavior and real database Tools were not exercised.

Application code changes: **NONE**. This report was updated; ignored local
`local_tools/rag_gate_recheck.py` was added for the bounded read-only probes and
`local_tools/rag-gate-current-spec.json` refreshed. Existing worktree changes and
the checkpoint were preserved. No RAG upsert/delete, Oracle write, registration
mutation, restart, commit or push was performed.
