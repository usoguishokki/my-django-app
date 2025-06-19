
from django.contrib import admin
from django.contrib.auth.views import LogoutView
from django.urls import include, path, re_path
from django.http import HttpResponse
from myapp.views import (login_view, home_view, calendar_view, 
                         card_view, workContents_view, test_view, 
                         non_matching_weekly_duties_view, inspectionStadards_view,
                         achievements_view, planned_maintenance_view, get_chart_data_view,
                         get_employee, equipment_ledger_view, card_by_control_view
                        )
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
    path('login/', login_view, name='login'),
    path('home/', home_view, name='home'),
    path('calendar/', calendar_view, name='calendar'),
    path('card/', card_view, name='card'),
    path('workContents/', workContents_view, name='workContets'),
    path('card/<str:control_no>/', card_by_control_view, name='card_by_control'),
    path('inspectionStadards/', inspectionStadards_view, name='inspectionStadards'),
    path('achievements/', achievements_view, name='achievements'),
    path('plannedMaintenance/', planned_maintenance_view, name='plannedMaintenance'),
    path('mobileLider/', equipment_ledger_view, name='mobileLider'),
    path('logout/', LogoutView.as_view(next_page='login'), name='logout'),
    path('test/', test_view, name='test'),
    
#API
    path('api/get-chart-data/', get_chart_data_view, name='get_chart_data'),
    path('api/non-matching-weekly-duties/', non_matching_weekly_duties_view, name='non_matching_weekly_duties'),
    path('api/employee/', get_employee, name='get_employee'),
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
