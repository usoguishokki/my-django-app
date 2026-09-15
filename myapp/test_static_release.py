from pathlib import Path

from django.core.files.base import ContentFile
from django.http import HttpResponse
from django.test import SimpleTestCase

from myapp.middlewares import NoCacheHtmlMiddleware
from myproject.staticfiles import StaticFilesStorage


class StaticReleaseTests(SimpleTestCase):
    def test_html_is_never_served_from_browser_cache(self):
        middleware = NoCacheHtmlMiddleware(
            lambda _request: HttpResponse("<html></html>", content_type="text/html")
        )

        response = middleware(object())

        self.assertEqual(
            response["Cache-Control"],
            "no-store, no-cache, must-revalidate, max-age=0",
        )
        self.assertEqual(response["Pragma"], "no-cache")
        self.assertEqual(response["Expires"], "0")

    def test_non_html_cache_headers_are_untouched(self):
        middleware = NoCacheHtmlMiddleware(
            lambda _request: HttpResponse("{}", content_type="application/json")
        )

        response = middleware(object())

        self.assertNotIn("Cache-Control", response)

    def test_storage_rewrites_javascript_module_imports(self):
        storage = StaticFilesStorage()

        self.assertTrue(storage.support_js_module_import_aggregation)
        self.assertIn("*.js", storage._patterns)

    def test_asset_content_change_produces_a_different_url(self):
        storage = StaticFilesStorage()

        first = storage.hashed_name("css/app.css", ContentFile(b"a{}"))
        second = storage.hashed_name("css/app.css", ContentFile(b"b{}"))

        self.assertNotEqual(first, second)
        self.assertRegex(first.replace("\\", "/"), r"^css/app\.[0-9a-f]{12}\.css$")

    def test_runtime_templates_only_reference_built_css(self):
        template_root = Path(__file__).resolve().parent / "templates"
        build_manifest = template_root / "_assets.scss-build.html"

        for template in template_root.rglob("*.html"):
            relative_template = template.relative_to(template_root)
            if (
                template == build_manifest
                or relative_template.parts[0] == "backupHtml"
                or relative_template.name in {"homeTest.html", "test.html"}
            ):
                continue
            source = template.read_text(encoding="utf-8")
            self.assertNotIn("sass_src", source, template.as_posix())
