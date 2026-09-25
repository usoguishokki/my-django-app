"""Offline test runner: in-memory SQLite only; Oracle/SQL Server connections blocked."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
os.environ.pop("DJANGO_SETTINGS_MODULE", None)

from django.conf import settings
from myproject import settings_shared

config = {key: getattr(settings_shared, key) for key in dir(settings_shared) if key.isupper()}
config.update(SECRET_KEY="offline-tests-only", DATABASES={"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}},
              ALLOWED_HOSTS=["testserver"], LOGGING={},
              CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
              STATICFILES_STORAGE="django.contrib.staticfiles.storage.StaticFilesStorage")
settings.configure(**config)

with patch("cx_Oracle.connect", side_effect=AssertionError("Oracle forbidden in offline tests")), patch("pyodbc.connect", side_effect=AssertionError("MARP forbidden in offline tests")):
    import django
    django.setup()
    from django.core.management import call_command
    call_command("check")
    loader = unittest.TestLoader()
    modules = [arg for arg in sys.argv[1:] if arg != "--inspection-regressions"] or ["myapp.test_validation_dataset"]
    suite = loader.loadTestsFromNames(modules)
    if "--inspection-regressions" in sys.argv:
        suite.addTests(loader.discover(str(Path(__file__).resolve().parents[2] / "myapp" / "tests"), pattern="test_inspection_standard*.py"))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
