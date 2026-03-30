
from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.urls import include, path, re_path
from django.http import HttpResponse

from myapp import views
from urllib.parse import urljoin
from django.conf import settings
from django.shortcuts import redirect
from django.conf.urls.static import static

import logging
logger = logging.getLogger('myapp')

"""
#React用のテストリダイレクト先
def dev_redirect_view(request):
    frontend_url = settings.FRONTEND_URL.rstrip("/")
    path = request.path
    redirect_url = urljoin(frontend_url, path)
    
    response = redirect(redirect_url)
    
    # 🔍 `Set-Cookie` の情報をログに出力
    logger.debug(f"🔍 dev_redirect_view: Redirecting to {redirect_url}")
    logger.debug(f"🔍 request.COOKIES in dev_redirect_view: {request.COOKIES}")
    logger.debug(f"🔍 Django Set-Cookie: SESSION_COOKIE_SAMESITE={settings.SESSION_COOKIE_SAMESITE}, SESSION_COOKIE_SECURE={settings.SESSION_COOKIE_SECURE}")

    return redirect(urljoin(frontend_url, path))
"""

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', views.login_view, name='login'),
    path('home/', views.home_view, name='home'),
    path('calendar/', views.calendar_view, name='calendar'),
    path('card/', views.card_view, name='card'),
    path('workContents/', views.workContents_view, name='workContets'),
    path('card/<str:control_no>/', views.card_by_control_view, name='card_by_control'),
    path('inspectionStadards/', views.inspectionStadards_view, name='inspectionStadards'),
    path('inspectionHistory/', views.inspectionHistory_view, name='inspectionHistory'),
    path('achievements/', views.achievements_view, name='achievements'),
    path('plannedMaintenance/', views.planned_maintenance_view, name='plannedMaintenance'),
    path('mobileLider/', views.equipment_ledger_view, name='mobileLider'),
    path('logout/', LogoutView.as_view(next_page='login'), name='logout'),
    path("api/wd/", views.api_wd_rows, name="api_wd_rows"),
    path("api/user_change/", views.api_user_change, name="api_user_change"),
    path("api/group-schedule/", views.api_group_schedule, name="api_group_schedule"),
    path("api/plans/<int:plan_id>/time/", views.api_update_plan_time, name="api_update_plan_time"),
    path('api/plans/', views.api_plans, name='api_plans'),
    path("api/", include("myapp.urls_api")),
    path('csv-download/', views.csv_download_page, name='csvDownloadPage'),
    path('schedule/', views.schedule_page, name='schedulePage'),
    
    
#API
    path('api/get-chart-data/', views.get_chart_data_view, name='get_chart_data'),
    path('api/employee/', views.get_employee, name='get_employee'),
#React用
    #re_path(r'^nika/.*$', nika_app_view, name='nika_app_view') 本番用
    #re_path(r'^nika/.*$', nika_app_view, name='nika_app_view'), #開発用
    
#React_SPA用
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns = [
        path('__debug__/', include(debug_toolbar.urls)),
    ] + urlpatterns
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
