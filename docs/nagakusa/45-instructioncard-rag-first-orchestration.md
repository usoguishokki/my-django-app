# InstructionCard RAG-First AI Orchestration v1

Status: implemented locally; Host metadata sync and human E2E remain pending.

## Control mechanism

The orchestration name is `instruction_card_rag_evaluation`. It applies to the
Nika `nika_ai_chat` screen through the documented `assistant_instructions` field
from `GET /api/ai/help`. Plugin Hub synchronization copies this bounded metadata
into the Host system prompt.

Live Platform Spec v30 exposes no `tool_choice`, `required_tool`, `allowed_tools`,
per-screen policy field, or temperature setting. The supported control is
therefore a plugin-level Host prompt policy. Routing is **STRONGLY INSTRUCTED**,
not forced. `POST /api/ai/route` remains the required compatibility endpoint and
continues to return control to the Host planner.

## Evaluation policy

For equipment, failure, repair, historical-action, and similar-case questions,
including contextual follow-ups, the Host is instructed to search the current
Nika plugin RAG with `plugin_search_rag_documents` before answering. The policy
excludes `nika_search_instruction_cards` and `nika_get_instruction_card_detail`
from this evaluation flow so retrieval can be assessed independently from live
Oracle Tools.

Equipment-specific actions may only be stated from retrieved InstructionCard
evidence. No action may be added from general model knowledge. A no-match must
say that supporting InstructionCard evidence was not found and may request the
equipment, location/PJ, symptom, or approximate date. Retrieved records must be
described as historical maintenance evidence, not an official maintenance
standard.

The policy preserves `source_id`, `source_name`, `title`, and citation/path when
available. Normal grounded answers show a concise source such as
`出典: InstructionCard 16327`; raw technical metadata need not be dumped into the
conversation.

General questions such as Python syntax, the meaning of RAG, the current date,
or Ohm's law remain under normal Host routing. A future production policy may
combine RAG history, live Nika Tools, and general knowledge after this controlled
evaluation is complete.

## User-message and conversation contract

The browser sends the original user-authored `message` unchanged with
`source_screen=nika_ai_chat` and an empty documented `context_snapshot`. It does
not append a Tool name or hidden prompt. The returned plugin-bound
`conversation_id` is reused for follow-up messages.

## Activation and evaluation

The local implementation alone does not update Host behavior. An explicitly
approved Plugin Hub manifest sync must refresh `GET /api/ai/help` and its AI
metadata integrity record. Until that sync occurs, live routing remains on the
previous Host prompt.

After approved sync, ask exactly:

`成形3号機のPJ1の樹脂漏れについて教えて`

Verify Host audit/tool evidence shows `plugin_search_rag_documents`, no live Nika
Oracle Tool call, retrieved `source_id=nika.instruction_card:16327` when
semantically appropriate, a grounded historical summary, and no unsupported
maintenance action. Repeated identical questions may still vary because the
published Host contract provides prompt guidance rather than forced Tool choice.
