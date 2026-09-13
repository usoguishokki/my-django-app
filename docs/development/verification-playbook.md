# Repository Verification Playbook

This is the verification standard for Codex-driven development. Verification is risk-based: run the smallest set of checks that establishes the changed behavior, but never claim success when a required layer has not run.

## Verification levels

| Level | Purpose | Typical checks |
|---|---|---|
| 1. Static / Code | Catch structural and mechanical defects. | Syntax or compile checks, `git diff --check`, import/module checks, documentation links, and relevant architecture guards. |
| 2. Unit / Logic | Prove deterministic rules and orchestration. | Domain/service tests, filtering, mocks, error and rollback paths, and duplicate safety. |
| 3. DOM / Interface Contract | Prove rendered elements and interfaces support the behavior. Required when frontend behavior depends on the DOM. | Editable/focusable element type, IDs, data/ARIA attributes, and the connection between UI selection and canonical backend identity. Hidden logic alone does not prove a usable UI. |
| 4. Runtime / Browser | Prove interactive behavior that unit tests cannot fully establish. | Click, focus, input and keyboard events; JS/CSS loading; console errors; and stale asset/runtime detection. |
| 5. Human Visual / Manual Review | Confirm appearance and practical usability when automation is insufficient. | Layout, dropdown placement, clipping/overflow, visible input behavior, and the real user workflow. |
| 6. Database / Integration | Exercise database integration only when necessary. | Prefer mocks and read-only checks. Development and production share Oracle; writes require explicit human approval. |
| 7. Production / Deployment | Validate an explicitly approved deployment. | Deployed commit, Django check, migration state, static files, HTTP/browser checks, application-pool state, and production smoke tests. |

Select levels according to risk, not ceremony:

- A pure backend service change commonly needs Levels 1–2.
- An interactive frontend change commonly needs Levels 1–5.
- A model or migration change may also need Level 6.
- A documentation-only change normally needs focused Level 1 review.
- Level 7 always requires explicit deployment approval.

The current local baseline for application changes is:

```text
python manage.py test myapp.tests.test_architecture_boundaries myapp.tests.test_layer_boundary_contracts --verbosity 1 --noinput
python manage.py check
python manage.py makemigrations --check --dry-run
git diff --check
```

Compile each changed Python file with `python -m py_compile <changed files>`. Do not run migrations merely to validate a refactor. `myapp/tests/test_architecture_boundaries.py` is a permanent regression guard; do not weaken it merely to make a change pass.

## UI completion and false-PASS prevention

Interactive UI work is not complete merely because unit or frontend tests pass. Determine whether DOM contract, browser, and human review are required, then report any unexecuted required layer honestly.

The Inspection Standard equipment combobox is the repository example. Its automated tests originally passed because they called working filter and selection methods directly. The visible primary control was nevertheless a non-editable `<button>`; its editable input existed only inside the dropdown. Human Review caught that the user could not type into the visible equipment control, and the regression tests were strengthened after the defect was fixed.

A searchable combobox is proven only when required verification confirms that:

- a real editable input appears on the usable surface;
- typing emits input events and filters actual candidates;
- selection preserves canonical backend identity;
- editing after selection invalidates stale selected identity;
- unmatched free text is rejected;
- required keyboard interaction works; and
- browser/manual interaction passes when automation cannot fully prove the behavior.

When browser or human review finds a defect missed by automation:

1. Identify and fix the root cause.
2. Add or strengthen a practical regression test that would have failed before the fix.
3. Rerun the relevant automated tests.
4. Repeat required browser verification and Human Review.

## Local browser and Human Review

The runtime under review must come from the intended worktree and branch:

```text
Source worktree: E:\repos\myproject-prod-fix
Required branch: fix/production-improvements
Python environment: E:\repos\myproject\venv
Local URL: http://127.0.0.1:8010/
```

Before starting, confirm the directory, branch, working tree, and port owner:

```powershell
Set-Location E:\repos\myproject-prod-fix
git branch --show-current
git status --short
Get-NetTCPConnection -State Listen -LocalPort 8010 -ErrorAction SilentlyContinue
```

A stale port 8010 listener or `runserver`/autoreload child can make verification exercise old code and create false results. Identify every listener before stopping or reusing it, confirm the port is clear, then start the known runtime:

```powershell
E:\repos\myproject\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8010 --noreload
```

Use `127.0.0.1`, not a production/server address, for normal local review. Hard-refresh changed JavaScript, CSS, or templates and disable browser cache when appropriate. After review, stop the server and confirm that port 8010 has no listener.

## Local environment and secrets

The production-improvement worktree may reuse `E:\repos\myproject\venv`, but the source under test must remain `E:\repos\myproject-prod-fix`. If normal Django startup needs a development `.env`, the approved source is `E:\repos\myproject\.env` and the local target is `E:\repos\myproject-prod-fix\.env`.

- The development `.env` may be copied locally only when required.
- It must remain ignored and must never be committed or printed.
- Never copy the production IIS `.env` into a development worktree.
- Do not change credentials to bypass a validation failure.

Check only ignore/tracking state:

```powershell
git check-ignore -v .env
git status --short .env
```

## Database and deployment safety

- Prefer unit tests, mocks, and narrow read-only checks.
- Never run `INSERT`, `UPDATE`, `DELETE`, `migrate`, or another database write without explicit approval.
- Do not bypass authentication failure with another account or credential without approval.
- Production and deployment verification never imply permission to deploy.

### Zero-write authenticated browser verification

When an authenticated browser workflow must read shared Oracle data without any
Oracle write risk, use the explicitly gated settings module:

```powershell
$env:NIKA_ZERO_WRITE_BROWSER_VERIFY = "1"
E:\repos\myproject\venv\Scripts\python.exe manage.py runserver `
  127.0.0.1:8010 `
  --noreload `
  --settings=myproject.settings_browser_verification
```

The five `HOZEN_READONLY_*` environment variables used by
`scripts/research/oracle_readonly.py` must already be present. Never print their
values or copy them into tracked files. This mode fails closed unless the
dedicated `HOZEN_READONLY` Oracle identity, container, roles, system privileges,
and object grants match the approved read-only contract.

This settings module:

- uses signed-cookie sessions instead of `django_session`;
- disconnects Django's `last_login` update receiver;
- uses a process-local Oracle Net configuration;
- verifies every default database connection against the existing read-only
  research contract; and
- requires an explicit environment flag and alternate `--settings` argument.

Production WSGI and normal `manage.py runserver` continue to use
`myproject.settings`; this mode cannot be selected by the flag alone. During UI
verification, intercept only the exact mutating endpoint under test. If
interception is missing or incorrect, the database account remains unable to
write.

## Ready-to-Commit status

Use these standardized fields:

```text
Implementation: PASS / FAIL
Automated Verification: PASS / FAIL / PARTIAL / N/A
DOM Contract Verification: PASS / FAIL / NOT EXECUTED / N/A
Browser Verification: PASS / FAIL / NOT EXECUTED / N/A
Human Review: PASS / REQUIRED / N/A
Database Verification: PASS / BLOCKED / NOT EXECUTED / N/A
Ready to Commit: YES / NO
```

`Ready to Commit: YES` is valid only when every layer required for the specific change has passed. If a required layer was not executed, do not claim a final `PASS`. For example:

```text
Implementation: PASS
Automated Verification: PASS
DOM Contract Verification: PASS
Browser Verification: NOT EXECUTED
Human Review: REQUIRED
Database Verification: N/A
Ready to Commit: NO
```

## Efficient verification and handoff reuse

- Start with focused tests; run broader regression only when the affected boundary or risk warrants it.
- Do not run unrelated full suites ceremonially.
- Reuse current `PROJECT HANDOFF` evidence when it still applies.
- Do not rediscover unchanged repository, worktree, or environment facts.
- Repeat environment checks when state changed or stale-runtime evidence exists.
- Record what was and was not exercised instead of overstating coverage.

Model guidance:

- Default to `gpt-5.6-sol` with medium reasoning.
- Use Luna for simple deterministic discovery, routine inspection, and basic search/log work.
- Use Sol with high reasoning only for genuinely difficult root-cause analysis, merge conflicts, or architecture decisions, or after medium reasoning proves insufficient.

## Worktree boundaries

- Production improvements: `E:\repos\myproject-prod-fix` on `fix/production-improvements`.
- Nagakusa Nika: `E:\repos\myproject` on `feature/nagakusa-nika`.

Do not modify Nagakusa Nika as part of production-improvement work. Reusing its virtual environment and, under the rules above, its approved development `.env` does not authorize changes to its source tree.
