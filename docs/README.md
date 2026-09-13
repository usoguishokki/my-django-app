# Documentation

Use this page as the entry point for repository documentation.

## Main sections

- [`development/`](development/) — how changes are designed, implemented, and verified. Start with the [coding standards](development/coding-standards.md) and [verification playbook](development/verification-playbook.md).
- [`architecture/`](architecture/) — practical dependency and layer rules. See [layer boundaries](architecture/layer-boundaries.md).
- [`nagakusa/`](nagakusa/) — Nagakusa/Nika architecture, development workflow, verification, and cutover guidance.
- `features/` — feature-specific behavior and specifications when such documents are added. Do not move historical specifications solely to enforce this layout.
- [`operations/`](operations/) — deployment, environment, and production-operation guidance, including the [Oracle read-only access runbook](operations/oracle-readonly-access.md).

## Existing root documents

- [`spec_rule_and_rule_condition.md`](spec_rule_and_rule_condition.md) — the existing rule/rule-condition domain specification.
- [`開発・本番運用ルール（更新版）.md`](開発・本番運用ルール（更新版）.md) — the existing development and production operations runbook.

Keep new documentation in the most specific section. Leave unrelated historical documents in place unless a task explicitly includes their reorganization.
