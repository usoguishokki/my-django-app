# Database access architecture

This repository has three distinct Oracle access paths. Do not substitute one for another.

## Normal application path

The Django application uses the normal `DATABASES` configuration in `myproject.settings` to access Oracle. This is runtime application behavior, not an ad-hoc research interface. Credentials come from ignored environment configuration and must never appear in documentation, command output, prompts, logs, or commits.

## AI/Codex read-only research path

Ad-hoc Oracle research must use `scripts/research/oracle_readonly.py`. It loads the repository-local ignored `.env` without overriding process variables and requires these dedicated settings:

- `HOZEN_READONLY_HOST`
- `HOZEN_READONLY_PORT`
- `HOZEN_READONLY_SERVICE`
- `HOZEN_READONLY_USER`
- `HOZEN_READONLY_PASSWORD`

The CLI accepts one query through `--sql` or standard input and supports `--format table` (the default) and `--format json`:

```powershell
E:\repos\myproject\venv\Scripts\python.exe scripts/research/oracle_readonly.py --sql "SELECT ..."
```

The script fails closed unless all of its checks pass. It:

- permits one `SELECT` or `WITH ... SELECT` statement only;
- rejects write, DDL, procedural, locking, and multi-statement SQL;
- requires the dedicated `HOZEN_READONLY` user, expected Oracle container, approved role set, and `CREATE SESSION` as the only system privilege;
- rejects object grants outside the approved application owner or outside `READ`/`SELECT`;
- starts the connection with `SET TRANSACTION READ ONLY`;
- uses a process-local Oracle Net configuration and sanitizes driver failures.

Never place credentials directly in the command. If this dedicated path cannot connect or fails a safety check, report that failure. Do not fall back to Django's normal production connection.

### ORA-12638 research failure

An `ORA-12638` from an ordinary `manage.py shell` research attempt does not establish that the table or `SELECT` was invalid. It means that path did not provide a valid repository-supported research connection. Stop using the default connection, retry through `oracle_readonly.py`, and report any dedicated-path failure without falling back.

## Browser verification path

Browser verification uses the dedicated read-only account through:

- `myproject/settings_browser_verification.py`
- `myapp/browser_verification.py`

Start it only with the explicit safety flag and settings module, for example:

```powershell
$env:NIKA_ZERO_WRITE_BROWSER_VERIFY = "1"
E:\repos\myproject\venv\Scripts\python.exe manage.py runserver 8010 --settings=myproject.settings_browser_verification
```

The settings module refuses to load without the flag, replaces the default database credentials with `HOZEN_READONLY_*`, disables persistent connections, and uses signed-cookie sessions. The verification app config requires the read-only username, initializes the isolated Oracle Net configuration, disconnects Django's `update_last_login` handler, and verifies the connected Oracle identity, container, roles, system privileges, and effective object grants. It also sets the current schema to the approved application owner so unqualified Django model reads resolve correctly.

These safeguards reflect the implementation; they do not authorize writes. If verification startup or connection validation fails, stop and report the failure rather than switching to the normal application database path.
