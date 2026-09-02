from __future__ import annotations

import ast
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
READ_METHODS = {
    "all", "aggregate", "annotate", "count", "distinct", "exclude",
    "exists", "filter", "first", "get", "iterator", "last", "only",
    "order_by", "prefetch_related", "select_related", "values",
    "values_list",
}
DOMAIN_FORBIDDEN_PREFIXES = (
    "myapp.models",
    "myapp.selectors",
    "myapp.services",
    "myapp.presenters",
    "myapp.api",
)
PRESENTER_FORBIDDEN_PREFIXES = (
    "myapp.models",
    "myapp.selectors",
    "myapp.services",
    "myapp.api",
)


def python_files(relative: str):
    yield from (ROOT / relative).rglob("*.py")


def imported_modules(tree: ast.AST):
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield node, alias.name
        elif isinstance(node, ast.ImportFrom):
            yield node, node.module or ""


def dotted_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = dotted_name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    if isinstance(node, ast.Call):
        return dotted_name(node.func)
    return ""


class ArchitectureBoundaryTests(unittest.TestCase):
    maxDiff = None

    def parse(self, path: Path):
        return ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))

    def assert_layer_imports(self, relative: str, forbidden):
        failures = []
        for path in python_files(relative):
            tree = self.parse(path)
            for node, module in imported_modules(tree):
                if module.startswith(forbidden):
                    failures.append(f"{path.relative_to(ROOT)}:{node.lineno}: {module}")
        self.assertEqual([], failures)

    def assert_no_objects_access(self, relative: str):
        failures = []
        for path in python_files(relative):
            tree = self.parse(path)
            for node in ast.walk(tree):
                if isinstance(node, ast.Attribute) and node.attr == "objects":
                    failures.append(f"{path.relative_to(ROOT)}:{node.lineno}")
        self.assertEqual([], failures)

    def test_domain_has_no_infrastructure_or_orm_dependency(self):
        self.assert_layer_imports("myapp/domain", DOMAIN_FORBIDDEN_PREFIXES)
        self.assert_no_objects_access("myapp/domain")

        # Django enums and utilities are intentionally outside this ORM-boundary task.
        allowed_django_model_names = {"TextChoices", "IntegerChoices"}
        failures = []
        for path in python_files("myapp/domain"):
            tree = self.parse(path)
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module == "django.db.models":
                    names = {alias.name for alias in node.names}
                    unexpected = names - allowed_django_model_names
                    if unexpected:
                        failures.append(
                            f"{path.relative_to(ROOT)}:{node.lineno}: {sorted(unexpected)}"
                        )
        self.assertEqual([], failures)

    def test_presenters_have_no_outer_layer_or_orm_dependency(self):
        self.assert_layer_imports("myapp/presenters", PRESENTER_FORBIDDEN_PREFIXES)
        self.assert_no_objects_access("myapp/presenters")

    def test_controllers_do_not_import_models_or_selectors(self):
        failures = []
        paths = [ROOT / "myapp/views.py", ROOT / "myapp/context_processors.py"]
        paths.extend(python_files("myapp/api"))
        for path in paths:
            tree = self.parse(path)
            for node, module in imported_modules(tree):
                if module.startswith(("myapp.models", "myapp.selectors")):
                    failures.append(f"{path.relative_to(ROOT)}:{node.lineno}: {module}")
        self.assertEqual([], failures)

    def test_services_have_no_direct_model_reads(self):
        failures = []
        for path in python_files("myapp/services"):
            tree = self.parse(path)
            parents = {
                child: parent
                for parent in ast.walk(tree)
                for child in ast.iter_child_nodes(parent)
            }
            model_names = set()
            selector_names = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module == "myapp.models":
                    model_names.update(alias.asname or alias.name for alias in node.names)
                if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("myapp.selectors"):
                    selector_names.update(alias.asname or alias.name for alias in node.names)

            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                chain = dotted_name(node.func)
                parts = chain.split(".")
                if len(parts) >= 3 and parts[0] in model_names and parts[1] == "objects":
                    if any(part in READ_METHODS for part in parts[2:]):
                        # A filter used solely as the receiver of delete is a write operation.
                        parent = parents.get(node)
                        used_only_for_delete = (
                            isinstance(parent, ast.Attribute)
                            and parent.attr == "delete"
                            and isinstance(parents.get(parent), ast.Call)
                        )
                        if not chain.endswith(".delete") and not used_only_for_delete:
                            failures.append(f"{path.relative_to(ROOT)}:{node.lineno}: {chain}")
                if isinstance(node.func, ast.Name) and node.func.id in {"list", "tuple", "set"}:
                    if node.args and isinstance(node.args[0], ast.Call):
                        called = dotted_name(node.args[0].func).split(".")[0]
                        if called in selector_names:
                            failures.append(
                                f"{path.relative_to(ROOT)}:{node.lineno}: evaluate {called} in service"
                            )
        self.assertEqual([], failures)


if __name__ == "__main__":
    unittest.main()
