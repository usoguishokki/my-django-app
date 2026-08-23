
from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.urls import include, path

from myapp import views
from django.conf import settings
from django.conf.urls.static import static

from django.views.generic import RedirectView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', views.login_view, name='login'),
    path(
        "home/",
        views.home_view,
        name="home",
    ),
    path(
        "home-dashboard/",
        RedirectView.as_view(
            pattern_name="home",
            permanent=False,
        ),
        name="home_dashboard",
    ),
    path('workContents/', views.workContents_view, name='workContets'),
    path('card/<str:control_no>/', views.card_by_control_view, name='card_by_control'),
    path('inspectionStadards/', views.inspectionStadards_view, name='inspectionStadards'),
    path('achievements/', views.achievements_view, name='achievements'),
    path('plannedMaintenance/', views.planned_maintenance_view, name='plannedMaintenance'),
    path('mobileLider/', views.equipment_ledger_view, name='mobileLider'),
    path('logout/', LogoutView.as_view(next_page='login'), name='logout'),
    path("api/", include("myapp.urls_api")),
    path('csv-download/', views.csv_download_page, name='csvDownloadPage'),
    path('timeTable/', views.schedule_page, name='timeTable'),
    path("card-work/", views.card_work, name="card_work"),
    path(
        "parts-search/",
        views.parts_search_view,
        name="parts_search",
    ),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [
        path('__debug__/', include(debug_toolbar.urls)),
    ] + urlpatterns
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
