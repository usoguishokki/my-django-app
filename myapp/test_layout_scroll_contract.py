from pathlib import Path
from unittest import TestCase


STATIC_CSS = Path(__file__).resolve().parent / "static" / "css"
TEMPLATES = Path(__file__).resolve().parent / "templates"


class SharedLayoutScrollContractTests(TestCase):
    @staticmethod
    def rule(source, selector):
        return source.split(f"{selector} {{", 1)[1].split("}", 1)[0]

    def test_shared_shell_owns_page_vertical_scrolling(self):
        base_scss = (STATIC_CSS / "base.scss").read_text(encoding="utf-8")
        document_rule = self.rule(base_scss, "body, html")
        parent_rule = self.rule(base_scss, ".parent-grid")
        child_rule = self.rule(base_scss, ".child-grid")

        self.assertIn("overflow: hidden;", document_rule)
        self.assertIn("height: 100dvh;", parent_rule)
        self.assertIn(
            "grid-template-rows: var(--header-h) minmax(0, 1fr);",
            parent_rule,
        )
        self.assertIn("min-height: 0;", child_rule)
        self.assertIn("overflow-x: hidden;", child_rule)
        self.assertIn("overflow-y: auto;", child_rule)

    def test_plan_scheduling_uses_natural_page_height(self):
        plan_scss = (STATIC_CSS / "pages" / "planScheduling.scss").read_text(
            encoding="utf-8"
        )

        plan_list_rule = plan_scss.split(
            ".plan-scheduling__planList {", 1
        )[1].split("}", 1)[0]
        self.assertNotIn("max-height", plan_list_rule)
        self.assertNotIn("overflow", plan_list_rule)
        self.assertIn(".plan-scheduling__matrix,", plan_scss)
        self.assertIn("min-width: 0;", plan_scss)
        self.assertIn(".plan-scheduling__dateGrid {", plan_scss)
        self.assertIn("overflow-x: auto;", plan_scss)

    def test_critical_pages_keep_their_layout_roots(self):
        expected_roots = {
            "home/home.html": 'id="itemProgress"',
            "workContents/workContents.html": 'class="parent-filterarea"',
            "card/card_work.html": 'class="card-work-page"',
            "inspectionStandards/inspectionStandards.html": (
                'class="planned-maintenance-container"'
            ),
            "schedule/schedule.html": 'class="schedule-page page"',
            "parts_search/parts_search.html": 'class="parts-search-page"',
            "planScheduling/plan_scheduling.html": (
                'data-role="plan-scheduling-root"'
            ),
        }

        for relative_path, root_marker in expected_roots.items():
            with self.subTest(template=relative_path):
                template = (TEMPLATES / relative_path).read_text(encoding="utf-8")
                self.assertIn(root_marker, template)
