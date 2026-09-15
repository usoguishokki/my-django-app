from pathlib import Path
from unittest import TestCase


class ReleaseIisScriptContractTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.source = (
            Path(__file__).resolve().parents[1] / "scripts" / "release-iis.ps1"
        ).read_text(encoding="utf-8")

    def test_default_python_is_the_production_virtualenv_not_path(self):
        self.assertIn("[string]$Python\n", self.source)
        self.assertIn(
            'Join-Path (Split-Path -Parent $ProductionRoot) "django_iis_env\\Scripts\\python.exe"',
            self.source,
        )
        self.assertIn("Django Python executable does not exist", self.source)
        self.assertIn('Invoke-Checked $Python "-c" "import django"', self.source)
        self.assertIn("$candidate = $PythonOverride", self.source)

    def test_python_preflight_occurs_before_iis_mutation(self):
        django_preflight = self.source.index('Invoke-Checked $Python "-c" "import django"')
        iis_import = self.source.index("Import-Module WebAdministration")
        stop_pool = self.source.index("Stop-WebAppPool -Name $AppPoolName")
        self.assertLess(django_preflight, iis_import)
        self.assertLess(django_preflight, stop_pool)

    def test_pool_state_is_explicitly_safe_and_idempotent(self):
        self.assertIn('$initialAppPoolState -notin @("Started", "Stopped")', self.source)
        self.assertIn('if ($initialAppPoolState -eq "Started")', self.source)
        self.assertIn("IIS application pool is already stopped; continuing with release.", self.source)
        stop_pool = self.source.index("Stop-WebAppPool -Name $AppPoolName")
        collectstatic = self.source.index('"collectstatic" "--clear" "--noinput"')
        start_pool = self.source.index("Start-WebAppPool -Name $AppPoolName")
        self.assertLess(stop_pool, collectstatic)
        self.assertLess(collectstatic, start_pool)

    def test_existing_fail_closed_release_contract_remains(self):
        for guard in (
            "Release checkout mismatch",
            "Release requires a clean Git worktree",
            "Release branch mismatch",
            "DJANGO_DEBUG must be false",
            "runtime Sass must be disabled",
            "fingerprinted storage is not active",
            "IIS site path mismatch",
            "IIS site/app-pool mismatch",
        ):
            self.assertIn(guard, self.source)
        self.assertIn('"collectstatic" "--clear" "--noinput"', self.source)
        self.assertIn('"scripts/verify_static_manifest.py" "staticfiles"', self.source)
        self.assertIn('"scripts/build_iis_static_config.py"', self.source)
        self.assertNotIn("sass --", self.source.lower())

    def test_rollback_records_are_unique_on_rerun(self):
        self.assertIn("function New-UniqueReleasePath", self.source)
        self.assertIn('"staticfiles-$releaseStamp-$releaseSha"', self.source)
        self.assertIn('"static-cache-release-$releaseStamp-$releaseSha.json"', self.source)
        self.assertIn("latest-static-cache-release-$PID.tmp", self.source)
        self.assertIn("[void]$suffix++", self.source)
