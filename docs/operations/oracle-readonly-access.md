# Oracle read-only access

This runbook defines the safe configuration for Codex investigation and
zero-write local Browser Verification. It documents the contract, not any
credential values.

## Required configuration

Provide all five variables through an approved local secret source (for
example, the ignored development `.env`, a process-local environment, or the
approved secret manager):

```text
HOZEN_READONLY_HOST
HOZEN_READONLY_PORT
HOZEN_READONLY_SERVICE
HOZEN_READONLY_USER
HOZEN_READONLY_PASSWORD
```

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
ignored local source. Verify presence by names only:

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

For investigation, use `scripts/research/oracle_readonly.py`; it validates SQL,
uses a process-local Oracle Net configuration, sets the transaction read-only,
verifies the identity and grants, and closes the connection.

For authenticated local Browser Verification, follow the dedicated settings
procedure in [`../development/verification-playbook.md`](../development/verification-playbook.md).
Set `NIKA_ZERO_WRITE_BROWSER_VERIFY=1` and use
`myproject.settings_browser_verification`. Intercept only the exact card-create
request under test. Never perform a real card creation merely to verify UI
behavior.

Do not use Django production credentials or any other write-capable account as
a fallback. Oracle reads are allowed only when needed; Oracle writes,
migrations, and credential changes require explicit approval.
