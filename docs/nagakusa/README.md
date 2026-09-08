# Nika Nagakusa Integration

Nika hosts the native Nagakusa plugin runtime and provides factual maintenance data to the Nagakusa Host AI. The Plugin Hub identity remains Hozen during the migration. The runtime implementation is in Nika so business Tools call Nika Services directly rather than relying on the former Hozen-to-Nika HTTP hop.

```text
Nagakusa Host
  -> Hozen Plugin identity
  -> Nika runtime
  -> Nagakusa AI Tool
  -> Nika Service / Selector
  -> Oracle
```

The first native Tool is `nika_search_instruction_cards`. It returns historical InstructionCard facts and evidence identifiers. Nagakusa AI chooses whether to call the Tool and produces natural-language responses; Nika does not generate maintenance advice in the Tool path.

Read next:

1. [00-architecture.md](00-architecture.md)
2. [10-development-debug.md](10-development-debug.md)
3. [20-e2e-testing.md](20-e2e-testing.md)
4. [30-production-and-cutover.md](30-production-and-cutover.md)
5. [90-troubleshooting.md](90-troubleshooting.md)

Credentials are environment variables only. Do not put values in source, browser assets, documentation, logs, or test fixtures.