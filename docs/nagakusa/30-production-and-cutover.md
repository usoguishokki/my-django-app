# Production And Cutover

Development uses Django `runserver` on port 8010. Production uses IIS/FastCGI on port 8000. Production users must not run Django `runserver` to use AI functionality.

The intended deployment order is:

```text
validated release
  -> external production backup
  -> reviewed source deployment
  -> production Nagakusa environment configuration
  -> collectstatic
  -> DjangoApp app-pool recycle
  -> endpoint verification
  -> Nagakusa Host verification
  -> approved Plugin Hub runtime cutover
```

Follow [開発・本番運用ルール（更新版）.md](../開発・本番運用ルール（更新版）.md) for backup, branch, static, app-pool, and deployment-record requirements. Production `.env` receives only the required Nagakusa variables; never copy a development `.env` wholesale. Its runtime base URL must be the reviewed production URL, not `http://127.0.0.1:8010`.

Until end-to-end cutover is confirmed, keep the Desktop Hozen runtime available as rollback/reference. If a registration URL switch fails, restore the previously confirmed Hozen runtime URL and verify manifest, health, and Tool behavior while retaining the same identity and credentials.