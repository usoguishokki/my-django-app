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

    def test_api_overlay_is_bounded_by_child_grid_without_viewport_overflow(self):
        base_scss = (STATIC_CSS / "base.scss").read_text(encoding="utf-8")
        base_css = (STATIC_CSS / "base.css").read_text(encoding="utf-8")

        for source in (base_scss, base_css):
            with self.subTest(source="scss" if source is base_scss else "css"):
                child_rule = self.rule(source, ".child-grid")
                overlay_rule = self.rule(source, ".api-loading")

                self.assertIn("position: relative;", child_rule)
                self.assertIn("overflow-y: auto;", child_rule)
                self.assertIn("position: absolute;", overlay_rule)
                self.assertIn("inset: 0;", overlay_rule)
                self.assertNotIn("100vw", overlay_rule)
                self.assertNotIn("100vh", overlay_rule)

        self.assertIn("&--hidden", base_scss)
        self.assertIn("pointer-events: none;", base_scss)
        self.assertIn("&--visible", base_scss)
        self.assertIn(".api-loading__overlay", base_css)
        inner_overlay_rule = self.rule(base_css, ".api-loading__overlay")
        self.assertIn("width: 100%;", inner_overlay_rule)
        self.assertIn("height: 100%;", inner_overlay_rule)

    def test_plan_scheduling_uses_shell_scroll_and_drawer_local_card_scroll(self):
        plan_scss = (STATIC_CSS / "pages" / "planScheduling.scss").read_text(
            encoding="utf-8"
        )
        plan_css = (STATIC_CSS / "pages" / "planScheduling.css").read_text(
            encoding="utf-8"
        )

        plan_list_rule = plan_scss.split(
            ".plan-scheduling__planList {", 1
        )[1].split("}", 1)[0]
        page_rule = plan_scss.split(".plan-scheduling {", 1)[1].split("}", 1)[0]
        planning_main_rule = plan_scss.split(
            ".plan-scheduling__planningMain {", 1
        )[1].split("}", 1)[0]
        planning_canvas_rule = plan_scss.split(
            ".plan-scheduling__planningCanvas {", 1
        )[1].split("}", 1)[0]
        chart_rule = plan_scss.split(
            ".plan-scheduling__chart {", 1
        )[1].split("}", 1)[0]
        maintenance_week_rule = plan_scss.split(
            ".plan-scheduling__maintenanceWeek {", 1
        )[1].split("}", 1)[0]
        chart_plot_rule = plan_scss.split(
            ".plan-scheduling__chartPlot {", 1
        )[1].split("}", 1)[0]
        date_grid_rule = plan_scss.split(
            ".plan-scheduling__dateGrid {", 1
        )[1].split("}", 1)[0]
        self.assertIn("box-sizing: border-box;", page_rule)
        self.assertIn("height: 100%;", page_rule)
        self.assertIn("overflow: hidden;", page_rule)
        self.assertIn("overflow-x: auto;", planning_main_rule)
        self.assertIn("overflow-y: hidden;", planning_main_rule)
        self.assertIn("height: 100%;", planning_main_rule)
        self.assertIn("--plan-date-column-width: 190px;", planning_canvas_rule)
        self.assertIn("--plan-date-column-gap: 10px;", planning_canvas_rule)
        self.assertIn(
            "grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);",
            planning_canvas_rule,
        )
        self.assertIn("grid-template-rows: minmax(0, 1fr) auto;", chart_rule)
        self.assertIn("grid-auto-columns: var(--plan-date-column-width);", maintenance_week_rule)
        self.assertIn("grid-auto-flow: column;", maintenance_week_rule)
        self.assertIn("gap: var(--plan-date-column-gap);", maintenance_week_rule)
        self.assertNotIn("max-height", plan_list_rule)
        self.assertIn("overflow-y: auto;", plan_list_rule)
        workspace_rule = plan_scss.split(
            ".plan-scheduling__workspace {", 1
        )[1].split("}", 1)[0]
        self.assertIn("min-height: 0;", workspace_rule)
        self.assertIn("overflow: hidden;", workspace_rule)
        self.assertIn(".plan-scheduling__drawer {", plan_scss)
        self.assertIn("height: 100%;", plan_scss)
        self.assertIn(".plan-scheduling__matrix,", plan_scss)
        self.assertIn("min-width: 0;", plan_scss)
        self.assertIn(".plan-scheduling__dateGrid {", plan_scss)
        self.assertIn("grid-auto-columns: var(--plan-date-column-width);", date_grid_rule)
        self.assertIn("overflow-x: visible;", date_grid_rule)
        self.assertIn("overflow-y: auto;", date_grid_rule)
        self.assertIn("overflow: visible;", chart_plot_rule)
        self.assertNotIn("overflow-x: auto;", chart_plot_rule)
        self.assertIn("height: 100%;", chart_plot_rule)
        self.assertIn("height: 100%;", plan_scss.split(
            '.plan-scheduling__chart > [data-role="workload-chart"] {', 1
        )[1].split("}", 1)[0])
        chart_columns_rule = plan_scss.split(
            ".plan-scheduling__chartColumns {", 1
        )[1].split("}", 1)[0]
        self.assertIn("height: 100%;", chart_columns_rule)
        self.assertIn("box-sizing: border-box;", chart_columns_rule)

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

    def test_plan_scheduling_uses_prebuilt_css_with_runtime_sass_disabled(self):
        template = (
            TEMPLATES / "planScheduling" / "plan_scheduling.html"
        ).read_text(encoding="utf-8")
        settings_source = (
            Path(__file__).resolve().parents[1] / "myproject" / "settings.py"
        ).read_text(encoding="utf-8")

        self.assertIn("{% static 'css/pages/planScheduling.css' %}", template)
        self.assertNotIn("sass_src", template)
        self.assertIn("SASS_PROCESSOR_ENABLED = False", settings_source)
