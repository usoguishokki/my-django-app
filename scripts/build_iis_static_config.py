"""Generate exact IIS cache rules for files in a Django static manifest."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree


HASHED_NAME = re.compile(r"\.[0-9a-f]{12}(?:\.[^./]+)?$")
IMMUTABLE = "public, max-age=31536000, immutable"


def main() -> int:
    static_root = Path(sys.argv[1] if len(sys.argv) > 1 else "staticfiles").resolve()
    template_path = Path(
        sys.argv[2] if len(sys.argv) > 2 else "deploy/iis-static.web.config"
    ).resolve()
    manifest_path = static_root / "staticfiles.json"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    hashed_paths = sorted(set(manifest.get("paths", {}).values()))
    errors = []
    for relative_path in hashed_paths:
        if not HASHED_NAME.search(relative_path):
            errors.append(f"manifest output is not fingerprinted: {relative_path}")
        if not (static_root / Path(relative_path)).is_file():
            errors.append(f"manifest output is missing: {relative_path}")

    if not hashed_paths:
        errors.append("manifest contains no static assets")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    tree = ElementTree.parse(template_path)
    configuration = tree.getroot()
    for relative_path in hashed_paths:
        location = ElementTree.SubElement(
            configuration,
            "location",
            {"path": relative_path.replace("\\", "/")},
        )
        system_web_server = ElementTree.SubElement(location, "system.webServer")
        http_protocol = ElementTree.SubElement(system_web_server, "httpProtocol")
        custom_headers = ElementTree.SubElement(http_protocol, "customHeaders")
        ElementTree.SubElement(custom_headers, "remove", {"name": "Cache-Control"})
        ElementTree.SubElement(
            custom_headers,
            "add",
            {"name": "Cache-Control", "value": IMMUTABLE},
        )

    output_path = static_root / "web.config"
    ElementTree.indent(tree, space="  ")
    tree.write(output_path, encoding="utf-8", xml_declaration=True)
    # Parse the written file once more so a truncated/invalid config fails closed.
    ElementTree.parse(output_path)
    print(f"Wrote immutable IIS rules for {len(hashed_paths)} fingerprinted assets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
