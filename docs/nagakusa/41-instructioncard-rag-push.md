# InstructionCard Spec 27 push preparation

Status: PARTIAL. No mutation transport, live ingestion, or permission change.
Checkpoint: `20260910T095147510652Z-93361b6e`.

Historical preparation only. The owner-confirmed response and durable-journal
contract is documented in `44-rag-mutation-contract.md` and supersedes this
file's envelope and journal blockers.

The live configured Spec Channel was read on 2026-09-10 and returned version
27. `contracts.rag_ingestion.plugin_push_api` supersedes the earlier source-only
decision in 40-instructioncard-rag-source.md. The dirty v25 snapshot is preserved.
The existing InstructionCard source implementation is reused without changes.

## Authoritative API

All paths start `/plugins/<module_slug>/host-api/rag/`:

| Operation | Method / suffix | Published contract |
|---|---|---|
| Info | GET empty suffix | `info.revision`; full response envelope unspecified |
| Upsert | POST `upsert/` | request_id UUID, expected_revision integer, visibility plugin, documents |
| Delete | POST `delete/` | same envelope, ids instead of documents |
| Receipt | GET `requests/<request_id>/` | processing/succeeded/superseded/failed/unknown; envelope unspecified |

Server Bearer authentication uses the registered plugin token (Nika's existing
`NAGAKUSA_PLUGIN_AI_API_TOKEN` mapping), never a session or Gateway credential.
Required permission: `rag.documents.write`. Host requires `PLUGIN_RAG_ENABLED`,
Gateway setup allowing the Host-generated `plugin_rag:<collection_uuid>` source
and `plugin_document` record type, and an approved permission for production.
Host generates source_type db and the collection ACL. Only plugin-shared content
is supported. Collection source names and ACL must never be submitted by Nika.

Limits: 1 MiB request, 100 documents/batch, 10,000 stored IDs; ID 128, title 512,
content 100,000, path 1,000 characters. The user request's “1100 documents” is
interpreted as 1–100 according to this published maximum.

202 is QUEUED, not indexed. Pending jobs retry in Host. After a dead job, a
deliberate new request uses the same documents, a new UUID and current revision.
Same UUID/body replays its receipt; different body yields request_id_conflict.
Revision mismatch yields revision_conflict: STOP and fetch info for a new sync
decision, never automatically substitute the new revision. No published revision
increment rule is assumed across batches.

Published errors: 401 unauthorized; 403 rag_forbidden/rag_approval_required/
ambiguous_token; 409 revision_conflict/request_id_conflict; 413 request_too_large/
document_limit; 429 rate_limited with Retry-After; 503 rag_disabled/rag_not_configured.
The feed does not specify complete success/error envelopes, numeric rate limits,
poll interval, or HTTP timeout. Obtain Host repository `docs/plugin-rag-api.md`
before finishing receipt parsing. The client uses local policy of a 10-second
deadline and 1 MiB response cap; these are not asserted Host requirements.

## Implemented local boundary

`myapp/domain/instruction_card_rag_push.py` maps the existing source document to
exactly id/title/content/path/updated_at. ID is the primary-key-based identity;
title uses ID and safe equipment field; content is existing bounded historical
evidence. No internal hash, metadata, ACL, source or configuration is transmitted.

There is no confirmed InstructionCard-specific browser route. `/card/<control_no>/`
belongs to a different existing resource contract. `/ai-chat/` is a genuine Nika
consultation page, used as the fallback path. Provenance retains the record ID in
content, but the link does not open that record automatically.

An explicitly supplied aware source datetime is accepted. Existing model
updated_at is auto_now and the importer saves models, but that does not cover all
Oracle writers. The unchanged source projection does not include it. Fallback is
completed_date then issued_date at midnight +09:00, representing a date-only
historical event, NOT last modification. Undated records fail closed. Content
hashes remain the change detector. Approve this freshness limitation or extend the
source projection with a validated timestamp before production synchronization.

Lazy document batching respects count and UTF-8 byte budgets with an envelope
reserve; final serialization checks exact bytes. UUID/revision assigned only when
a batch is deliberately prepared. Identical-byte replay validation is available.
Explicit deletion construction requires known IDs and an externally reviewed
complete-scan evidence reference. The reference is not sent to Host and is NOT
proof by itself: no current mutable paginated scan can establish that proof.

`myapp/nagakusa/rag_client.py` reuses bounded_http for HTTPS same-origin GET,
redirect rejection, deadlines and response bounds. It filters remote errors to
known safe codes and does not propagate remote messages or exception chains.
Info models revision only; an unrecognized response shape fails closed.
`myapp/services/instruction_card_rag_push.py` provides bounded polling over a
normalized status reader and an always-blocked submission entry point. No POST
transport is present. Polling has bounded attempts/waits; total time also includes
the supplied reader's bounded request duration. A long Retry-After ends polling
instead of retrying early. No automatic write retries or revision rebasing exist.

## Deliberate blockers

The existing registration JSON state is best-effort, single-record bookkeeping
which tolerates write failure. It is not a durable multi-request journal. No
suitable existing application-owned journal was found. Per the user stop rule,
no new production persistence mechanism was invented. Before submission, approve
a private, durable, atomic, concurrency-controlled journal with crash recovery,
exact immutable request bytes and hash, UUID, operation, expected revision,
PREPARED/SUBMITTED/QUEUED/PROCESSING/SUCCEEDED/FAILED/SUPERSEDED/UNKNOWN states and
receipts. Persist before send; ambiguous transport retains the same UUID/body.
Journal retention/access must account for maintenance text. No Oracle migration.

Plugin-shared visibility is BLOCKED pending content-owner review. Named employee,
injury and secret/configuration fields are excluded, but request/action/reflection,
card references and replacement-part free text are not PII-redacted. Existing
server-token Tool authentication does not prove that every authorized Host plugin
user may see all this text. Do not remove useful evidence or claim safety without
review. This task does not broaden or change the existing projection or Tools.

## Live evidence and prepared permission task

The only Host RAG request performed was GET info: HTTP 403 `rag_forbidden`.
No further Host requests were made. Collection revision, enabled/configuration
state and identifier remain unknown. This error alone does not identify every
missing prerequisite.

Prepared manifest change, NOT applied: append to host_permissions independently
of the chat mode:

```json
{"scope":"rag.documents.write","reason":"Submit reviewed plugin-shared historical InstructionCard documents to Host RAG."}
```

Preserve ai.message.send and both Tools. Spec 27 does not require changing
features.rag_ingest for this client; it remains false, with no plugin ingestion
endpoint or speculative data_sources. Permission publication/sync and production
reapproval require the separate authorized Plugin Hub step. Host owner must
confirm enablement, Gateway allowance, queue worker and search readiness.

## Future procedure — PREPARED ONLY

1. Obtain complete API schemas, approve visibility and journal, implement/test
   durable replay and receipt wire handling. Resolve timestamp/path limitations.
2. Authorize manifest permission sync/reapproval and Host readiness configuration.
3. GET info, then prepare one reviewed document using returned revision and UUID.
4. Durably save exact bytes before POST. Record response; 202 remains QUEUED.
5. Poll receipt within bounds. On ambiguous delivery retain identical UUID/body;
   on revision conflict stop for a new deliberate decision. Do not infer indexing.
6. Confirm Gateway search readiness and test plugin_search_rag_documents with
   InstructionCard provenance. Subsequent batches use newly observed revision.
7. Explicit deletions need verified retirement/complete-scan evidence; never use
   a missing page record as deletion authorization.

Future positive test: 「成形2号機の過去のInstructionCardから、ノズル周辺の樹脂漏れに関連する事例を探して、実施した処置を要約してください。」
No-match test: ask for an intentionally nonexistent equipment ID and require a
no-evidence response, with no fabricated record or maintenance standard.

## Validation after interruption recovery

All 86 selected Python tests pass, covering the source, push preparation, two
Tools, chat integration, entry flow and architecture/layer boundaries. All 10
Nagakusa browser tests pass. Django check, compilation of the four new Python
files, git diff --check and the five-file configured-secret/whitespace scan pass.
Migration drift check initially encountered sandbox ORA-12638; the authorized
read-only retry outside the sandbox reported no changes. No migrations applied.
All 661 checkpoint entries and their stored objects verified; pre-existing
checkpointed files remain byte-for-byte unchanged. No second live RAG info GET
was attempted after the recorded 403. Production receipt wire parsing, journal
crash recovery and live ingestion are explicitly not tested or implemented.
