# Troubleshooting

| Symptom | Likely cause | Safe check |
|---|---|---|
| `401 unauthorized` after a token change | Existing Django process did not reload environment configuration | Confirm token presence only, restart the development server, then retry without printing a token |
| Japanese search text becomes `?` | Shell or command encoding changed input | Use UTF-8 Python source or JSON encoding and verify expected evidence IDs, not echoed secret data |
| Remote Host cannot reach `127.0.0.1:8010` | Loopback points to the Host machine, not Nika | Use Integration Debug bound to `133.222.52.74:8010` and test from Host context |
| Manifest/help/tools return `503 runtime_not_configured` | Required Nagakusa identity/runtime environment variables are absent | Check only `SET` / `NOT SET`; do not invent identity values |
| Platform spec is served from `local_snapshot` | Remote spec is unavailable, invalid, oversized, redirected, or timed out | Confirm `served_from`; do not disable fallback safeguards |
| Plugin Hub rejects runtime URL | URL is not allowed or conflicts with another registration | Keep registration unchanged and inspect the approved Host/Hub response through the authorized process |
| Development and production disagree | Port 8010 and IIS port 8000 were confused | Confirm the launch profile, listener address, and IIS binding before testing |
| Host cannot reach Integration Debug | Server is bound only to loopback or network policy blocks 8010 | Verify `133.222.52.74:8010` listener locally, then have the Host owner test reachability; firewall changes need separate review |