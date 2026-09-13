# Nagakusa / Nika Development Workflow

This document defines the durable workflow for preserving and developing the
Nagakusa integration in Nika. General production and release procedures remain
in the [development and production runbook](../開発・本番運用ルール（更新版）.md).

## Development lines

The Nagakusa integration and production improvements use separate worktrees and
branches:

| Work | Directory | Branch |
|---|---|---|
| Nagakusa / Nika integration | `E:\repos\myproject` | `feature/nagakusa-nika` |
| Production improvements | `E:\repos\myproject-prod-fix` | `fix/production-improvements` |

The Nagakusa line is the preservation and integration line for Nagakusa Tools,
RAG, AI consultation, and orchestration. Production fixes must be developed in
the production-improvement worktree; do not reset, delete, or otherwise roll
back the Nagakusa line to make production work easier.

Do not check out the same branch in multiple worktrees. Do not synchronize the
worktrees by manually copying files. Use reviewed Git history and merges so the
source, scope, and provenance of each change remain visible.

## Preservation point and protected work

The preserved Nagakusa/Nika baseline is commit
`b416f20a7eba2641a18b687d98515da8e6e16a9a` on
`feature/nagakusa-nika`. The production-improvement line was separated before
the Nagakusa integration at base commit
`525f067b8c80e0559c88ad359102fef630034914`, immediately before the native
Nagakusa foundation commit `5a9ef6e` (`Add native Nagakusa AI foundation to
Nika.`).

Changes that must remain identifiable and preserved include:

- Nagakusa Plugin integration and the `nika_search_instruction_cards` and
  `nika_get_instruction_card_detail` Tools
- InstructionCard RAG source and RAG upsert/status handling
- the durable RAG journal
- AI consultation and InstructionCard RAG-first orchestration
- Host-frame behavior fixes, static-asset versioning, and related tests

Before merging unrelated work, confirm the Nagakusa branch and worktree, keep
the worktree clean, and inspect the proposed file and commit scope. Never add
credentials, tokens, logs, local journals, registration state, or checkpoint
data to the preservation commit.

## Reintegrating production improvements

Production improvements are reviewed and stabilized on
`fix/production-improvements`, then integrated through the normal Git history
into `main`. After the production-improvement result is accepted, merge the
approved `main` changes into `feature/nagakusa-nika`.

Before reintegration:

1. Confirm both worktree paths and branches.
2. Confirm both worktrees are clean and identify the exact source commits.
3. Review the merge scope for conflicts with Nagakusa, RAG, AI, static assets,
   and related tests.
4. Resolve conflicts by preserving the Nagakusa behavior and the approved
   production behavior, then run the checks required by the affected changes.

Do not confuse `fix/production-improvements` with
`feature/nagakusa-nika`, and do not merge a dirty worktree. A production
release branch or `main` must not be treated as proof that Nagakusa-specific
work is safe to discard.

## Codex working-directory discipline

At the start of each task, confirm the current directory, branch, and status:

```powershell
git branch --show-current
git status --short
```

Run Codex work in the worktree named by the task. Keep application changes,
database writes, RAG mutations, production operations, credential changes, and
pushes subject to the repository’s explicit approval rules. Report the exact
files changed, verification performed, remaining risks, commit, and push state
in the handoff.
