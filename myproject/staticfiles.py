"""Static-file storage used by collectstatic for production releases."""

from django.contrib.staticfiles.storage import ManifestStaticFilesStorage


class StaticFilesStorage(ManifestStaticFilesStorage):
    """Fingerprint assets and rewrite relative imports in browser modules."""

    # Source maps aren't shipped by this repository. Keep their comments as-is
    # instead of failing on the intentionally absent *.map files.
    patterns = (
        (
            "*.css",
            (
                r"""(?P<matched>url\(['"]{0,1}\s*(?P<url>.*?)["']{0,1}\))""",
                (
                    r"""(?P<matched>@import\s*["']\s*(?P<url>.*?)["'])""",
                    '@import url("%(url)s")',
                ),
            ),
        ),
    )
    support_js_module_import_aggregation = True
    # Django 4.2's experimental patterns require semicolons.  This codebase
    # contains valid semicolon-less modules, so accept both styles and emit a
    # normalized semicolon in the collected copy.
    _js_module_import_aggregation_patterns = (
        "*.js",
        (
            (
                (
                    r"""(?P<matched>import(?s:(?P<import>[\s\{].*?))"""
                    r"""\s*from\s*['"](?P<url>[\.\/].*?)["']\s*;?)"""
                ),
                'import%(import)s from "%(url)s";',
            ),
            (
                (
                    r"""(?P<matched>export(?s:(?P<exports>[\s\{].*?))"""
                    r"""\s*from\s*["'](?P<url>[\.\/].*?)["']\s*;?)"""
                ),
                'export%(exports)s from "%(url)s";',
            ),
            (
                r"""(?P<matched>import\s*['"](?P<url>[\.\/].*?)["']\s*;?)""",
                'import"%(url)s";',
            ),
            (
                r"""(?P<matched>import\(["'](?P<url>.*?)["']\))""",
                'import("%(url)s")',
            ),
        ),
    )
    # A module graph may need more than Django's default five convergence passes.
    max_post_process_passes = 20
