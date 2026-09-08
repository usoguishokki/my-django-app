# E2E Testing

## Development Checklist

1. Start `Nika - Nagakusa Integration Debug`.
2. Verify `GET /api/health`, `GET /.well-known/nagakusa-plugin.json`, and `GET /api/ai/tools` at `http://133.222.52.74:8010`.
3. Confirm the Nagakusa Host can reach that URL from its own runtime context.
4. Use the approved Plugin Hub development runtime procedure.
5. Open Nika inside the Nagakusa Host and open `AI相談`.
6. Submit Q1, Q2, and Q3.
7. Confirm the flow below, then restart Nika and repeat the smoke test.

```text
Nika Chat
  -> ai.send_message
  -> Nagakusa AI
  -> nika_search_instruction_cards
  -> Oracle
  -> Nagakusa AI answer
  -> Nika Chat
```

## Evidence Cases

| Case | Question | Expected evidence |
|---|---|---|
| Q1 | 成形2号機ノズル先端より樹脂漏れが多発しています。処置方法を教えてください。 | `PU1278`, `PU4126`, `PU4564`, `PU4649` |
| Q2 | 成形2号機射出ユニットスラストBOXの油は何を使っている? | `PU917`, `PU3542`, `PU4189`, `PU6564`; `PU917` includes `テラス46 7.5l` |
| Q3 | 成形3号機で射出PJ4サイクルタイムオーバーが散発しています。どのような対応すればいいですか? | `PU2489` |

Verify that a zero-result query reports zero results and that the Tool does not create source facts or advice.