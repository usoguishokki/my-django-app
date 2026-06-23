from django.urls import path

from myapp.api.kpi import (
    kpi_matrix_api,
    kpi_matrix_cell_detail_api,
    plan_detail_api,
)
from myapp.api.member_plans import member_assigned_plans_api
from myapp.api.pullback import pullback_api, bulk_pullback_api
from myapp.api.csv_download import (
    inspection_standard_machines_api,
    inspection_standard_download_api,
    inspection_plan_result_download_api,
)

from myapp.api.schedule import (
    schedule_day_api,
    schedule_member_week_api,
    schedule_event_move_api,
    schedule_test_cards_week_api,
    schedule_test_card_team_options_api,
    schedule_event_retract_api,
    schedule_bulk_registration_api,
    schedule_bulk_retract_api,
    schedule_bulk_move_api
)

from myapp.api.inspection_standards import (
    inspection_card_detail_api,
    inspection_card_plans_api,
    inspection_standard_detail_update_api,
    inspection_standard_common_item_options_api,
    inspection_standard_common_items_update_api,
    inspection_standard_common_items_plan_preview_api,
    inspection_standard_detail_create_api,
    inspection_standard_detail_delete_api,
    inspection_standard_card_create_api,
    inspection_standard_card_abolish_api,
    inspection_standard_history_list_api,
    inspection_standard_history_detail_api,
    inspection_standard_history_approve_api,
)

from myapp.api.home.dashboard import home_overall_progress_api


urlpatterns = [
    path("kpi-matrix/", kpi_matrix_api, name="kpi_matrix_api"),
    path("kpi-matrix/cell-detail/", kpi_matrix_cell_detail_api, name="kpi_matrix_cell_detail_api"),
    path("plans/<int:plan_id>/detail/", plan_detail_api, name="plan_detail_api"),
    path("inspection-cards/<str:inspection_no>/detail/", inspection_card_detail_api, name="inspection_card_detail_api"),
    path("inspection-cards/<str:inspection_no>/plans/", inspection_card_plans_api, name="inspection_card_plans_api"),
    path(
        "inspection-standards/details/<int:detail_id>/update/",
        inspection_standard_detail_update_api,
        name="inspection_standard_detail_update_api",
    ),
    path("member-assigned-plans/", member_assigned_plans_api, name="member_assigned_plans_api"),
    path("pullback/", pullback_api, name="pullback_api"),
    path("bulk-actions/pullback/", bulk_pullback_api, name="bulk_pullback_api"),
    path(
        "csv-download/inspection-standard/machines/",
        inspection_standard_machines_api,
        name="inspection_standard_machines_api",
    ),
    path(
        "csv-download/inspection-standard/",
        inspection_standard_download_api,
        name="inspection_standard_download_api",
    ),
    path(
        'inspection-standards/common-item-options/',
        inspection_standard_common_item_options_api,
        name='inspection_standard_common_item_options_api',
    ),
    path(
        "csv-download/inspection-plan-result/",
        inspection_plan_result_download_api,
        name="inspection_plan_result_download_api",
    ),
    path(
        'inspection-standards/common-items/<int:check_id>/update/',
        inspection_standard_common_items_update_api,
        name='inspection_standard_common_items_update_api',
    ),
    path(
        'inspection-standards/common-items/<int:check_id>/plan-preview/',
        inspection_standard_common_items_plan_preview_api,
        name='inspection_standard_common_items_plan_preview_api',
    ),
    path(
        'inspection-standards/details/create/',
        inspection_standard_detail_create_api,
        name='inspection_standard_detail_create_api',
    ),
    path(
        'inspection-standards/cards/create/',
        inspection_standard_card_create_api,
        name='inspection_standard_card_create_api',
    ),
    path(
        "inspection-standards/details/<int:detail_id>/delete/",
        inspection_standard_detail_delete_api,
        name="inspection_standard_detail_delete_api",
    ),
    path(
        'inspection-standards/cards/<int:check_id>/abolish/',
        inspection_standard_card_abolish_api,
        name='inspection_standard_card_abolish_api',
    ),
    path(
        'inspection-standards/history/',
        inspection_standard_history_list_api,
        name='inspection_standard_history_list_api',
    ),
    path(
        'inspection-standards/history/<int:history_id>/',
        inspection_standard_history_detail_api,
        name='inspection_standard_history_detail_api',
    ),
    path(
        'inspection-standards/history/<int:history_id>/approve/',
        inspection_standard_history_approve_api,
        name='inspection_standard_history_approve_api',
    ),
    path("schedule/day/", schedule_day_api, name="schedule_day_api"),
    path("schedule/member-week/", schedule_member_week_api, name="schedule_member_week_api"),
    path("schedule/events/move/", schedule_event_move_api, name="schedule_event_move_api"),
    path(
        "schedule/events/bulk-registration/",
        schedule_bulk_registration_api,
        name="schedule_bulk_registration_api",
    ),
    path("schedule/test-cards/week/", schedule_test_cards_week_api, name="schedule_test_cards_week_api"),
    path('schedule/events/retract/', schedule_event_retract_api, name='schedule_event_retract_api'),
    path(
        "schedule/events/bulk-retract/",
        schedule_bulk_retract_api,
        name="schedule_bulk_retract_api",
    ),
    path(
        "schedule/test-cards/team-options/",
        schedule_test_card_team_options_api,
        name="schedule_test_card_team_options_api",
    ),
    path(
        'schedule/events/bulk-move/',
        schedule_bulk_move_api,
        name='schedule_bulk_move_api',
    ),
    path(
        "home-dashboard/overall/",
        home_overall_progress_api,
        name="home_dashboard_overall_api",
    ),
]