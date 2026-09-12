# Host RAG mutation contract and first-PoC gate

Status: parser and durable local recovery implemented; live POST disabled.

The response contract in this document was confirmed by the Nagakusa Host
owner from branch `vm-dev`, commit
`4bb5e2fc3c498cb96ac403a24912a06387847c20`, whose local Platform Spec is
version 30. The running Host must be checked separately before a live request.

## Local safety boundary

- `myapp.nagakusa.rag_client` strictly parses new HTTP 202 acceptances,
  HTTP 200 idempotent replays, receipt-status responses, conflicts, 404, and
  rate limits. It exposes no mutation POST transport.
- `myapp.nagakusa.rag_journal.PocRequestJournal` writes exact canonical UTF-8
  request bytes to an immutable `<request_id>.request.json` sidecar before a
  checksummed `<request_id>.journal.json` record can reach `PREPARED`.
- The default journal directory is ignored `.nika-rag-poc/`. Metadata and
  payload writes use a temporary file, flush, fsync, atomic replace, and a
  per-directory process lock. Credentials and HTTP headers are never stored.
- Local states distinguish `HOST_SUCCEEDED` from `SEARCH_VERIFIED`. A Host
  success means Gateway processing completed, not that retrieval is proven.
- Ambiguous recovery checks receipt status first. A 404 `request_not_found`
  yields a plan to replay the immutable stored bytes with the same UUID and
  expected revision; it does not itself send the replay.

## Future live preflight and first request

This is a prepared procedure, not authorization to run it:

1. Directly fetch the live Platform Spec without a stale snapshot/cache and
   require version 30 or newer.
2. GET collection info using the registered server token. Require
   `enabled=true`, supported collection `schema_version`, a nonnegative current
   revision, and the intended Host environment.
3. Confirm the running Host behavior is compatible with the owner-confirmed
   response contract. Do not infer compatibility from the owner's branch alone.
4. Load and review only InstructionCard `16327` through the approved source
   Service/Selector path. Confirm source ID `nika.instruction_card:16327`.
5. Only then assign the first UUID and build the canonical one-document request
   using the just-observed collection revision.
6. Persist the exact request bytes and journal metadata. Verify both can be read
   after reopening the journal.
7. Mark `SUBMITTED` immediately before opening the network connection, then use
   the separately reviewed/enabled POST adapter exactly once.
8. Parse HTTP 202 as queued acceptance, persist its original receipt revision,
   jobs, and source name, then poll the same request UUID with bounded waits.
9. For ambiguous delivery, status-check the same UUID. On 404 only, replay the
   same stored bytes; never regenerate from Oracle or rebase expected revision.
10. After `HOST_SUCCEEDED`, verify actual retrieval through
    `plugin_search_rag_documents`, matching source ID, source name, and
    citation/provenance before recording `SEARCH_VERIFIED`.

No delete is part of the first PoC. No Host mutation, Oracle write, migration,
registration, commit, or push was performed while implementing this boundary.
