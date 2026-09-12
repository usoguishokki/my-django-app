# InstructionCard RAG source preparation

Status: local draft adapter, **not a Nagakusa-approved source or ingestion API**.

The live Spec Channel returned version **26** on 2026-09-10. Its
`contracts.rag_ingestion` still approves only `nagakusa.chat_case`,
`gvis_qa.document`, and `gvis_qa.faq`. Nika therefore follows decision **C**:
prepare the source boundary locally, while Core must approve and implement a
new source contract before any live ingestion. The repository's existing v25
snapshot was preserved; this task read the current live contract directly.

The fresh Starter's `docs/75-rag-ingestion-boundary.md` explicitly says the
GVIS adapter is not generic. No `/api/ai/source-records`, `/api/rag/ingest`,
RAG credentials, registration action, public feed, or manifest RAG capability
has been added. `features.rag_ingest` remains false. The existing two live
InstructionCard Tools remain unchanged.

## Local call path and representation

`preview_instruction_card_source` management command ->
`build_instruction_card_source_page` Service -> fixed-projection Selector ->
existing Oracle `instruction_card` table. Pure formatting, identity, hashes,
and comparison helpers reside in Domain. No duplicate database or Oracle
synchronization state is created.

One record produces one document, with local representation version 1:

- `source_type`: `nika.instruction_card` (local semantic source identity,
  not an assertion about the RAG Gateway's transport `source_type`).
- `source_record_id`: `nika.instruction_card:<id>`.
- `metadata`: `instruction_card_id`, `source_application=nika`, `legacy_id`,
  equipment/process, issue/completion dates, maintenance/work type, completion
  status, request/action/reflection, replacement parts, and card reference.
- `text`: explicitly labeled historical evidence, not a maintenance standard;
  separate problem, action, reflection/result, parts, and reference sections.
- `truncated_fields`: names of fields whose exported text was shortened.
- `content_hash`: SHA-256 of canonical UTF-8 JSON for the exported document
  before the hash field is added. Dates use ISO formatting and keys are sorted.

The primary key is the existing BigAutoField `id`. `legacy_id` is not unique
and is never used as the source identity. `imported_at` and `updated_at` exist,
but Django `auto_now` does not establish a reliable source change feed for
all Oracle writers; comparison uses exported content instead.

Only the fixed maintenance projection is selected. Requester/assignee names,
supervisor names, injury information, credentials, configuration, and unrelated
model fields are excluded. This is a field allowlist, **not a promise of PII
redaction inside historical free text**. Core approval must cover those texts.

No Nika chunks, embeddings, index, citation syntax, ACL claims, or Gateway
payload format are invented. Core owns the ingestion/indexing pipeline; its
InstructionCard chunking policy and provenance-to-citation mapping are pending.

## Bounds and consistency

- Page limit: 1-10, default 2; at most limit+1 rows fetched, including lookahead.
- Integer identifiers: nonnegative cursor, positive selected ID, at most signed
  64-bit maximum. No arbitrary filters, tables, models, or SQL inputs.
- Ordering: ascending primary key, `after_id < id <= through_id`.
- First page obtains the highest ID with a bounded indexed lookup. Subsequent
  pages should reuse `through_id` and `next_after_id`.
- Text fields are shortened in the Oracle projection to 2001 characters,
  including one character for truncation detection; Oracle LOB reads use the
  same bound. Exported fields are capped at 2000 characters.
- Canonical source-page JSON is at most 128 KiB. A byte-limited page leaves
  unreturned rows for the next page; a single oversized document fails closed.
- Oracle round trips use `callTimeout` of at most 10 seconds, preserving a
  stricter existing timeout and restoring the old value afterward. A read
  taking over 15 seconds is rejected after control returns. Connection setup
  still uses existing Oracle Net settings; this is not a hard end-to-end HTTP
  timeout. No HTTP endpoint exists in this draft.

`through_id` is an insertion boundary, **not a database snapshot**. Updates and
deletes during paging can affect results. `range_exhausted` says only that the
bounded query has no more rows; it does not certify a complete source scan.
Every page sets `deletion_authorized=false`.

## Change and deletion handling

The Service optionally accepts an in-memory `previous_hashes` mapping.
`change_state` returns NEW, UNCHANGED, or UPDATED; absent a baseline it returns
UNCOMPARED. Changing only excluded fields or text beyond the exported prefix
does not change the hash, because the indexed representation is unchanged.

`reconciliation_summary(previous_hashes, observed_hashes)` reports missing
IDs as `not_observed_ids`, never as authorized deletes. A selected ID returning
zero records indicates current absence but does not publish a tombstone.
No local synchronization state is persisted. Core must own durable state,
successful-scan proof, retries, deletion reconciliation and retirement. Never
delete indexed records because of an incomplete page, timeout, failed scan,
or authorization failure.

## Preview

Run in the established database-capable environment:

```powershell
& .\venv\Scripts\python.exe manage.py preview_instruction_card_source --limit 2
```

The default output includes only count, IDs, equipment, dates, document size,
text length, metadata key names, truncation, and change state. It prints neither
full maintenance text nor content hashes. One explicitly selected record can
be inspected locally with `--instruction-card-id <id> --show-text`; never paste
that output into a public log. `--show-text` without an explicit ID fails.
The command reads exactly one bounded page and does not auto-page or ingest.

This is an operator-only management command under existing machine/database
access. It introduces no HTTP authentication bypass or public data access.
HTTP feed authentication and Nika user/record ACL eligibility cannot be
claimed until Core defines and approves them. Do not copy the GVIS ACL string.

## Required Core task and future E2E (prepared only)

1. Approve a Nika source name, record type, business scope and free-text policy.
2. Define the read-feed URL, schema, server authentication, version negotiation,
   response limits, cursor semantics, and complete-scan consistency proof.
   Then wire this local adapter behind that exact authenticated contract.
3. Implement the Core adapter and fixed authorization mapping. Establish
   whether every authorized Nika user may read every exported card; otherwise
   define per-record ACLs. Retrieval must check current access and fail closed.
4. Implement serializer, Core chunking/embedding/indexing, durable source-state
   comparison, retry/dead-letter, deletion/reconciliation and source manifest.
5. Map `nika.instruction_card:<id>` to Core-owned citations and a live lookup
   using `nika_get_instruction_card_detail`. Do not fabricate source URLs.
6. Add a Core dry-run showing counts/IDs only, review it, then obtain explicit
   authorization for ingestion. No Nika-specific Host command exists yet;
   do not run the GVIS sync command with a substituted source name.

Future positive question:
「成形2号機の過去のInstructionCardから、ノズル周辺の樹脂漏れに関連する事例を探して、実施した処置を要約してください。」

Expected: semantic retrieval of authorized historical documents, grounded
summary with InstructionCard primary-key provenance, and optional live Tool
detail to verify current evidence. Do not represent old work as a standard.

No-match/unsupported-evidence question:
「NIKA_RAG_NO_MATCH_20260910_7F3C9A に一致する記録を示してください。記録がなければ根拠なしと回答し、標準作業として推測しないでください。」

Also test access revocation, changed records, deliberate source retirement,
and failed/incomplete scans before enabling deletion in production.
