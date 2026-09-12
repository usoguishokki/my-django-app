# InstructionCard RAG PoC handoff — 2026-09-11

Historical handoff. See `44-rag-mutation-contract.md` for the subsequently
confirmed Host response contract and schema-v2 exact-byte journal boundary.

Result: **BLOCKED** before source selection and live upsert. No InstructionCard
content was uploaded. This report supersedes the permission and hash guidance in
40/41 where it differs; those documents describe earlier preparation stages.

## Current contract

The configured live Platform Spec feed returned HTTP 200, **version 28**. A fresh
read was saved in ignored `local_tools/rag-poc-live-spec.json`; the pre-existing
tracked snapshot was preserved. The feed is
`https://nagakusa-dx.toyota-shokki.co.jp/api/pluginhub/spec-channel/`.

- `required_manifest_permission` is null. Do **not** add `rag.documents.write`.
  Enabled plugins with AI integration may use RAG without individual grants.
- Existing production manifest approval remains required, but RAG requires no
  extra permission or reapproval. No production-status request was made.
- Keep `features.rag_ingest=false`; Host owns ingestion and Gateway credentials.
- Host requires `PLUGIN_RAG_ENABLED` and Gateway allowance for its generated
  `plugin_rag:<collection_uuid>` source and `plugin_document` record type.
- Server-side registered plugin Bearer token authenticates RAG; sessions do not.
- Under `/plugins/nika/host-api/rag/`: GET collection info, POST `upsert/`, and
  GET `requests/<request_id>/`. Delete is documented but was never called.
- Upsert fields remain request_id, expected_revision, visibility=plugin,
  documents; each document has exactly id/title/content/path/updated_at.
- Limits remain 1 MiB per request, 100 documents per batch, 10,000 stored IDs;
  ID/title/content/path limits are 128/512/100000/1000 characters. This PoC is
  limited to one initial document and at most three overall, never 13.
- IDs use the documented ASCII grammar; paths are plugin-internal, without
  traversal/query/fragment; updated_at must carry a timezone.
- Same UUID and body replays the receipt; changed body conflicts. Revision must
  match the observed collection revision. No revision increment rule is assumed.
- HTTP 202 only means queued. Poll processing/succeeded/superseded/failed/unknown;
  confirm retrieval separately through `plugin_search_rag_documents`.
- Complete RAG success/receipt schemas remain absent from the live feed. The
  referenced Host `docs/plugin-rag-api.md` is not available locally. The documented
  Starter UNC share could not be read even outside the sandbox. Do not guess
  response envelopes or wire up the mutation path without this contract.

## Live evidence and blockers

Runtime: `http://133.222.52.74:8011/`. Manifest, health, AI help and AI Tools all
returned HTTP 200. Manifest reports `features.ai=true`, `rag_ingest=false`.
The existing listener PID was 15388; it was left running. An attempted additional
normal runtime process failed Oracle startup with ORA-12638 inside the sandbox.
No Starter or production process was stopped.

Normal sync command: `venv\Scripts\python.exe manage.py register_nagakusa_plugin`.
Exact command response: `Nagakusa registration completed.` The command does not
expose the full Host response, so no complete registration receipt is claimed.
No force registration or permission changes were made.

Collection GET after sync returned HTTP **403**, code **rag_forbidden**. A second
read-only diagnostic GET confirmed the safe Host message:

> プラグインの利用とAI連携を有効にしてください。

The rejected condition is enabled plugin use and AI integration. The error does
not distinguish which Host-side flag is false. The served Nika manifest already
reports AI enabled and normal registration completed. The current feed documents
no additional Nika-side permission change to resolve this. Host registration
inspection is needed; administrator necessity versus owner self-service cannot
be conclusively determined without access to that state. No authorization bypass
or guessed Host configuration mutation was attempted. Collection revision,
Gateway readiness and worker readiness remain unknown.

Oracle readiness: the five `HOZEN_READONLY_*` variables are absent from this
process, project `.env`, and Windows User/Machine environments. The dedicated
read-only tooling rejected `SELECT 1 FROM DUAL` before connecting. No application
credentials were used for research, and no records were selected or reviewed.
An approved local research credential setup is required, not secrets in chat.

Live runtime Tool error smoke tests still show the old envelope (`unauthorized`,
`unknown_tool`, no ok/message). The running process has no reload enabled. The
local corrections below pass regression tests but are **not loaded in that
existing process**. A controlled reload is still required when resuming the PoC.

## Local changes

- `myapp/api/nagakusa.py`, `myapp/nagakusa/ai.py`: Spec 28 error envelope
  `ok=false,error={code,message}`, missing Tool 400/tool_required, unknown Tool
  404/tool_not_found, authentication 401/ai_authentication_required with the
  specified WWW-Authenticate header. Search semantics are unchanged.
- `myapp/domain/instruction_card_source.py` and its Selector: representation v2
  hashes all allowed source values before export truncation. Private/excluded
  fields never affect the hash. Wire fields remain capped at 2,000 characters.
  Source reads allow up to 1,000,000 characters per field and fail closed above
  that bound rather than hashing an incomplete value. Existing row-count and
  call/deadline limits remain. This increases source-read cost; live Oracle
  projection behavior has not been exercised in this turn.
- `myapp/nagakusa/rag_journal.py`: ignored local `.nika-rag-poc/` journal,
  one-document preparation only, canonical request bytes validated before saving,
  UUID, SHA-256 body digest, byte count, revision, document IDs, timestamps,
  latest status and optional UUID Host request identifier. Atomic replace after
  flush/fsync, OS process lock, corruption checksum, terminal-state protection.
  Contains no credentials or maintenance text. No real request entries exist.
- Replay is digest-only: reconstruct the original canonical bytes and verify
  them against the persisted digest. If the source changed or the bytes cannot
  be reconstructed, stop; do not invent a replacement UUID. The journal supports
  terminal/process restart, not guaranteed recovery from hardware/power failure.
- Mutation transport remains blocked in `submit_prepared_request`; the journal
  is available but is not yet connected to live POST/status schemas. No delete
  capability was enabled or executed.
- Tests updated/added in `test_instruction_card_source.py`,
  `test_instruction_card_detail_tool.py`, `test_nagakusa_foundation.py`, and
  `test_instruction_card_rag_journal.py`; `.gitignore` excludes the journal.

## Project handoff

| Field | Result |
|---|---|
| Result | BLOCKED |
| Platform Spec Version | 28, fresh live HTTP 200 |
| Runtime | 8011 endpoint checks PASS; existing process retains old Tool code |
| Oracle Readiness | BLOCKED: dedicated research configuration missing |
| Manifest / Permission Sync | Normal registration completed; no RAG scope required |
| RAG Collection Info | 403 rag_forbidden; revision unknown |
| Host RAG Readiness | BLOCKED at enabled-plugin/AI condition |
| Selected PoC InstructionCards | NONE |
| Documents Submitted | 0 |
| Live Upsert | NOT EXECUTED |
| Request IDs | NONE |
| Receipt / Index Status | NOT EXECUTED |
| RAG Search | NOT EXECUTED |
| Search Tool Used | NONE; required future tool is plugin_search_rag_documents |
| Retrieved Source IDs | NONE |
| Nagakusa AI Grounded Answer | NOT EXECUTED |
| No-Match Test | NOT EXECUTED |
| Provenance | FAIL — not demonstrated; no submitted source |
| Existing Nika Tools Regression | Local tests PASS; live Oracle not exercised |
| Existing AI Chat Regression | 10 browser harness tests PASS; human Host E2E not exercised |
| Durable Journal | Implemented/tested; no real request recorded |
| Oracle Writes | NONE |
| RAG Deletes | NONE |
| Rollback/Delete IDs | PREPARED ONLY: empty set, since nothing was submitted |
| Commit | NONE |
| Push | NONE |

Checkpoint ID: `instructioncard-rag-poc-20260910T234034Z`, a ZIP snapshot of all
60 pre-existing modified/untracked files, including the prior checkpoint lock.
SHA-256: `f8b9399587fe90e574e7f3db7218c170caaac4921c576a29894650a53fd94e47`.
No root README.md exists; AGENTS.md and the Nagakusa README/guides were read.

Validation: 93 relevant Python tests passed, including source, push, journal,
both Tools, chat/entry and architecture/layer guards. The 10 Node browser tests,
Django check and read-only migration drift check passed. Migration drift initially
failed with sandbox ORA-12638; the outside-sandbox retry reported no changes.
No migrations were created or applied. Compilation passed for all 37 modified or
untracked Python files. `git diff --check` passed. A configured-secret scan of all
64 modified/untracked worktree files (excluding checkpoint storage) found no
matches; this is not a universal secret detector. The journal path is Git-ignored.
All 54 checkpointed files outside this task's six edits remained byte-identical;
two previously clean tracked files and three new files complete the 11-file delta.

Remaining work: obtain the approved research environment and current Host RAG
response guide; inspect/resolve Host registration availability; load local Tool
fixes in the runtime; review one safe real record; implement the documented
submission/status adapters with journal-before-send; then execute exactly one
initial upsert and prove indexed retrieval, grounded AI answer and no-match
behavior. Do not infer PASS from 202, the live Oracle Tools, or unit tests.
