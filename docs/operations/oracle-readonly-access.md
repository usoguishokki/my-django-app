# Oracle read-only access

This runbook defines the safe configuration for Codex investigation and
zero-write local Browser Verification. It documents the contract, not any
credential values.

## Required configuration

Configure all five variables once in the worktree-root `.env`. This is the
preferred persistent local source and must remain Git-ignored:

```text
HOZEN_READONLY_HOST
HOZEN_READONLY_PORT
HOZEN_READONLY_SERVICE
HOZEN_READONLY_USER
HOZEN_READONLY_PASSWORD
```

The standalone research CLI and Django settings load this file automatically.
An explicit process environment value takes precedence over the corresponding
`.env` value, which permits temporary overrides without editing the file.

The alternate Django settings use an Easy Connect DSN (`host:port/service`),
because Django's Oracle backend treats `NAME` as a SID when `PORT` is set. The
browser-verification connection also sets `CURRENT_SCHEMA` to `MYDJANGO_USER`
so existing unqualified model queries resolve to the approved read-only owner.

The repository does not define the environment-specific host, port, service,
or password. Obtain those values from the DBA/secret-management process. The
read-only connection uses an explicit host/port/service DSN; do not infer or
copy values from a write-capable application account without approval.

`HOZEN_READONLY_USER` must be `HOZEN_READONLY`. The connection must identify
container `HOZENPDB`, role `HOZEN_APP_READ_ROLE`, and system privilege
`CREATE SESSION`. Object access is limited to owner `MYDJANGO_USER` with
`READ`/`SELECT` privileges. The contract permits no `INSERT`, `UPDATE`, or
`DELETE`.

## Provisioning and presence checks

The account and grants are provisioned by the DBA. The password is manual/
secret-management required; never guess it, print it, commit it, or place it
in prompts or logs. Store environment-specific values only in the approved
ignored local source. Never copy the production IIS `.env` or reuse the
write-capable production application credentials. Verify the file remains
ignored:

```powershell
git check-ignore -v .env
git status --short .env
```

The second command should produce no output. Verify loaded process values by
names only when process-local overrides are in use:

```powershell
$names = 'HOZEN_READONLY_HOST','HOZEN_READONLY_PORT',
  'HOZEN_READONLY_SERVICE','HOZEN_READONLY_USER','HOZEN_READONLY_PASSWORD'
$names | ForEach-Object {
  [pscustomobject]@{
    Name = $_
    Present = [bool][Environment]::GetEnvironmentVariable($_, 'Process')
  }
}
```

If any variable is missing, or the username is not `HOZEN_READONLY`,
`scripts/research/oracle_readonly.py` must fail closed. Its connection check
also rejects an unexpected container, role, system privilege, object owner, or
object privilege before executing a read query.

## Use

For investigation, use `scripts/research/oracle_readonly.py`; it loads the
worktree-root `.env`, validates SQL,
uses a process-local Oracle Net configuration, sets the transaction read-only,
verifies the identity and grants, and closes the connection.

```powershell
E:\repos\myproject\venv\Scripts\python.exe `
  scripts/research/oracle_readonly.py --sql "SELECT 1 FROM DUAL"
```

The persistent setup has been live-verified without any process-local
`HOZEN_READONLY_*` variables. The connection reported user `HOZEN_READONLY`
in container `HOZENPDB`; `SELECT 1 FROM DUAL` succeeded, and a harmless read
from `MYDJANGO_USER.MYAPP_CONTROL_TB` succeeded. The service endpoint remains
environment-local and is intentionally not recorded here. No Oracle writes are
part of this verification.

For future checks, verify identity and service context with read-only metadata
queries such as `SESSION_USER`, `CON_NAME`, and `SERVICE_NAME`, then perform a
limited read from a required `MYDJANGO_USER` table. Never print the password or
copy actual credentials into documentation.

For authenticated local Browser Verification, follow the dedicated settings
procedure in [`../development/verification-playbook.md`](../development/verification-playbook.md).
Set `NIKA_ZERO_WRITE_BROWSER_VERIFY=1` and use
`myproject.settings_browser_verification`. Intercept only the exact card-create
request under test. Never perform a real card creation merely to verify UI
behavior.

```powershell
$env:NIKA_ZERO_WRITE_BROWSER_VERIFY = "1"
E:\repos\myproject\venv\Scripts\python.exe manage.py runserver `
  127.0.0.1:8010 --noreload `
  --settings=myproject.settings_browser_verification
```

The activation flag intentionally remains process-local. Clear it and any
temporary credential overrides after verification; persistent values remain in
the ignored `.env` for the next shell:

```powershell
Remove-Item Env:NIKA_ZERO_WRITE_BROWSER_VERIFY -ErrorAction SilentlyContinue
'HOST','PORT','SERVICE','USER','PASSWORD' | ForEach-Object {
  Remove-Item "Env:HOZEN_READONLY_$_" -ErrorAction SilentlyContinue
}
```

Do not use Django production credentials or any other write-capable account as
a fallback. Oracle reads are allowed only when needed; Oracle writes,
migrations, and credential changes require explicit approval.
