# Architecture

## Responsibilities

| Component | Responsibility |
|---|---|
| Nagakusa Host | AI planner, Tool invocation, Host bridge, natural-language answer generation |
| Nika | Plugin runtime, AI Chat page, Tool endpoint, business Services/Selectors, Oracle access |
| Hozen | Existing Plugin Hub identity and temporary starter/rollback runtime during migration |

Nika exposes the manifest and AI runtime endpoints, but it does not register or change Plugin Hub state unless an approved cutover stage explicitly allows it.

## InstructionCard Tool

```text
nagakusa_ai_tool_call_api
  -> execute_nagakusa_tool
  -> search_instruction_cards
  -> select_instruction_card_candidates
  -> InstructionCard ORM read
```

This is intentionally direct. Native Nika Tools must not call Nika's own integration endpoint over `localhost`, and must not bypass the Service/Selector layers with direct SQL.

`InstructionCard` results are historical work records, not formal maintenance standards. Preserve `legacy_id`, `instruction_card_id`, source facts, and match evidence so the Host can distinguish evidence from inference.

## Runtime Boundaries

- Server-to-server Tool route authentication uses `NAGAKUSA_PLUGIN_AI_API_TOKEN` from Nika's environment.
- Browser Chat uses the Host bridge `ai.send_message` through `window.parent.postMessage`; no token is available in browser code.
- Frame tickets are verified server-side from Host-provided signed headers. Browser-supplied user IDs and roles are not authorization input.
- Platform spec may use a bounded remote response or a Nika-owned snapshot fallback.