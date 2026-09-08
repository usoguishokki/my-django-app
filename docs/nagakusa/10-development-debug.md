# Development Debug

Use the VS Code launch profiles in `.vscode/launch.json`.

| Profile | URL | Use |
|---|---|---|
| `Nika - Local Debug` | `http://127.0.0.1:8010` | Normal Nika development, UI work, and local-only debugging |
| `Nika - Nagakusa Integration Debug` | `http://133.222.52.74:8010` | Nagakusa Host integration, AI Chat E2E, Tool and bridge verification |
| Production | `http://133.222.52.74:8000` | IIS/FastCGI runtime only |

Port 8010 is development. Port 8000 is production. Do not register `127.0.0.1:8010` as a remote Host runtime: a remote Nagakusa Host cannot reach another machine's loopback interface.

The profiles use the project virtual environment and `DJANGO_SETTINGS_MODULE=myproject.settings`. They contain no credentials. Nika settings load development environment values from the ignored project `.env`.

Development `DJANGO_ALLOWED_HOSTS` must include both `127.0.0.1` and `133.222.52.74`. Do not broaden production hosts merely to make development integration work.

When binding Integration Debug, check the listener locally:

```powershell
Get-NetTCPConnection -State Listen -LocalAddress 133.222.52.74 -LocalPort 8010
Invoke-WebRequest http://133.222.52.74:8010/api/health -UseBasicParsing
```

This confirms local LAN-interface binding only. Remote Host reachability must be tested from the Nagakusa Host context. Do not change firewall rules without a separate review.

## Future Tool Workflow

1. Define the business question and source data.
2. Reuse or add a Selector for reads.
3. Add a Service use case.
4. Expose a read-only Nagakusa Tool with factual response metadata.
5. Add grounding text and direct Tool tests.
6. Test representative query cases locally.
7. Start Integration Debug and test through the Host and AI Chat.
8. Prepare a reviewed production release only after E2E success.

Nagakusa AI selects Tools and writes answers. Nika Tools return factual data only.