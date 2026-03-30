from django.urls import path
from myapp.api.kpi import kpi_matrix_api, kpi_matrix_cell_detail_api, plan_detail_api, inspection_card_detail_api, inspection_card_plans_api
from myapp.api.member_plans import member_assigned_plans_api
from myapp.api.pullback import pullback_api, bulk_pullback_api
from myapp.api.csv_download import (
    inspection_standard_machines_api,
    inspection_standard_download_api,
    inspection_plan_result_download_api,
)
urlpatterns = [
    path("kpi-matrix/", kpi_matrix_api, name="kpi_matrix_api"),
    path("kpi-matrix/cell-detail/", kpi_matrix_cell_detail_api, name="kpi_matrix_cell_detail_api"),
    path("plans/<int:plan_id>/detail/", plan_detail_api, name="plan_detail_api"),
    path("inspection-cards/<str:inspection_no>/detail/", inspection_card_detail_api, name="inspection_card_detail_api"),
    path("inspection-cards/<str:inspection_no>/plans/", inspection_card_plans_api, name="inspection_card_plans_api"),
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
        "csv-download/inspection-plan-result/",
        inspection_plan_result_download_api,
        name="inspection_plan_result_download_api",
    ),
]