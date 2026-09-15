"""Fail a release when collectstatic didn't fingerprint browser assets."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


HASHED_NAME = re.compile(r"\.[0-9a-f]{12}\.[^.]+$")
MODULE_URL = re.compile(
    r"(?:\bfrom\s*|\bimport\s*)[\(]?[\"']"
    r"(?P<url>\.{1,2}/[^\"']+\.js)[\"']"
)
STATIC_TAG = re.compile(r"\{\%\s*static\s+[\"'](?P<url>[^\"']+)[\"']")


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "staticfiles").resolve()
    manifest_path = root / "staticfiles.json"
    if not manifest_path.is_file():
        print(f"Missing static manifest: {manifest_path}", file=sys.stderr)
        return 1

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    paths = manifest.get("paths", {})
    candidates = {
        source: hashed
        for source, hashed in paths.items()
        if Path(source).suffix.lower() in {".css", ".js"}
    }
    errors = []
    for source, hashed in sorted(candidates.items()):
        if not HASHED_NAME.search(hashed):
            errors.append(f"not fingerprinted: {source} -> {hashed}")
        if not (root / Path(hashed)).is_file():
            errors.append(f"missing output: {hashed}")
            continue

        if Path(source).suffix.lower() == ".js":
            content = (root / Path(hashed)).read_text(encoding="utf-8")
            for match in MODULE_URL.finditer(content):
                module_url = match.group("url")
                if not HASHED_NAME.search(module_url):
                    errors.append(
                        f"unfingerprinted module import in {hashed}: {module_url}"
                    )
                    continue
                target = (root / Path(hashed).parent / module_url).resolve()
                try:
                    target.relative_to(root)
                except ValueError:
                    errors.append(f"module import escapes static root: {module_url}")
                else:
                    if not target.is_file():
                        errors.append(f"missing module import target: {module_url}")

    if not candidates:
        errors.append("manifest contains no CSS or JavaScript assets")

    template_root = root.parent / "myapp" / "templates"
    if template_root.is_dir():
        for template in template_root.rglob("*.html"):
            relative_template = template.relative_to(template_root)
            if (
                relative_template.parts[0] == "backupHtml"
                or relative_template.name
                in {"_assets.scss-build.html", "homeTest.html", "test.html"}
            ):
                continue
            content = template.read_text(encoding="utf-8")
            for match in STATIC_TAG.finditer(content):
                asset_url = match.group("url")
                if asset_url not in paths:
                    errors.append(
                        f"template asset absent from manifest: "
                        f"{relative_template} -> {asset_url}"
                    )

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    print(
        f"Verified {len(candidates)} fingerprinted CSS/JavaScript assets "
        f"(manifest hash {manifest.get('hash', 'unknown')})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
