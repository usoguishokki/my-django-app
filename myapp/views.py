from django.shortcuts import render, redirect
from django.http import HttpResponseBadRequest, Http404
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from datetime import datetime

from .backends import MemberAuthenticationBackend
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_http_methods


from .forms import LoginForm

import logging


from myapp.domain.schedule_initial_filters import (
    build_schedule_initial_filters,
)
from myapp.domain.errors import InvalidMachineSelection

from myapp.services.inspection_standards import (
    build_inspection_standards_context,
    build_inspection_standard_details_payload,
)

from myapp.services.card_work.card_work_page import (
    build_card_work_page_context,
)

from myapp.selectors.work_contents import (
    select_work_contents_plans,
)
from myapp.presenters.work_contents import (
    build_work_contents_rows,
)
from myapp.services.work_contents import (
    update_work_contents_plans,
)
from myapp.services.user_context import (
    build_team_profile_context,
)
from myapp.services.achievements import (
    build_achievement_month_details,
)
from myapp.domain.periods import (
    parse_year_month_label,
)
from myapp.presenters.achievements import (
    build_achievement_page_context,
)
from myapp.selectors.equipment import (
    get_equipment_by_control_no,
    find_equipment_by_control_no,
    select_checks_by_control,
)
from myapp.presenters.equipment import (
    build_inspection_list_checks,
)
from myapp.http.json import (
    InvalidJsonBody,
    json_response,
    parse_json_body,
)
from myapp.http.errors import (
    logged_json_error_response,
)

        
    
    
    
        

                
@never_cache
@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            login_number = form.cleaned_data['login_number']
            user = MemberAuthenticationBackend().authenticate(request, member_id=login_number)
            if user:
                login(request, user)
                request.session['login_number'] = login_number
                return redirect('home')
            else:
                form.add_error('login_number', 'ログイン番号が存在しません。')
    else:
        form = LoginForm()
    return render(request, 'login.html', {'form': form})

   




    
logger = logging.getLogger(__name__)


    
                        

@login_required
@require_GET
def card_work(request):
    cache_manager_if = request.cache_manager_if
    team_profiles = build_team_profile_context(
        request=request,
        cache_manager_if=cache_manager_if,
    )

    context = build_card_work_page_context(
        request=request,
        team_profiles=team_profiles,
    )

    return render(request, "card/card_work.html", context)
        
@login_required
@require_http_methods(["GET", "POST"])
def workContents_view(request):
    if request.method == "GET":
        cache_manager_if = request.cache_manager_if

        team_profiles = build_team_profile_context(
            request=request,
            cache_manager_if=cache_manager_if,
        )

        applications_data = select_work_contents_plans(
            organization_code=request.organization_code,
        )

        applications_data_list = build_work_contents_rows(
            applications_data,
        )

        return render(
            request,
            "workContents/workContents.html",
            {
                "applications_data_list": applications_data_list,
                "members": team_profiles["profiles"],
            },
        )

    if (
        request.headers.get("X-Requested-With")
        != "XMLHttpRequest"
    ):
        return HttpResponseBadRequest(
            "Unsupported request."
        )

    try:
        data = parse_json_body(
            request
        )
    except InvalidJsonBody as exc:
        return logged_json_error_response(
            logger=logger,
            exc=exc,
            message="Invalid JSON data",
            status=400,
        )

    action = data.get("action")

    if action != "fetch_approval_or_rejection":
        return HttpResponseBadRequest(
            "Invalid action"
        )

    try:
        cache_manager_if = request.cache_manager_if

        team_profiles = build_team_profile_context(
            request=request,
            cache_manager_if=cache_manager_if,
        )

        detail_obj = data.get("detail")

        details = (
            detail_obj
            if isinstance(detail_obj, list)
            else [detail_obj]
        )

        applicant_user = (
            team_profiles["user_profile"].user
        )

        update_work_contents_plans(
            details=details,
            applicant_user=applicant_user,
        )

        plan_ids = [
            detail.get("planId")
            for detail in details
            if detail.get("planId") is not None
        ]

        return json_response({
            "status": "success",
            "message": "Plan updated successfuly",
            "planId": plan_ids,
        })

    except ValueError as exc:
        return logged_json_error_response(
            logger=logger,
            exc=exc,
            message=str(exc),
            status=500,
        )

    except Exception as exc:
        return logged_json_error_response(
            logger=logger,
            exc=exc,
            message=(
                "Error processing request: "
                f"{str(exc)}"
            ),
            status=500,
        )


@login_required
@require_http_methods(["GET", "POST"])
def inspectionStadards_view(request):
    if request.method == "GET":
        context = build_inspection_standards_context(
            organization_code=request.organization_code,
        )

        return render(
            request,
            "inspectionStandards/inspectionStandards.html",
            context,
        )

    if (
        request.headers.get("X-Requested-With")
        != "XMLHttpRequest"
    ):
        return HttpResponseBadRequest(
            "Unsupported request."
        )

    try:
        data = parse_json_body(
            request
        )
    except InvalidJsonBody as exc:
        return logged_json_error_response(
            logger=logger,
            exc=exc,
            message="Invalid JSON data",
            status=400,
        )

    action = data.get("action")

    if action != "get_details":
        return json_response(
            {
                "status": "error",
                "message": "Unsupported action.",
            },
            status=400,
        )

    try:
        payload = (
            build_inspection_standard_details_payload(
                filter_data=data.get("data"),
            )
        )
    except InvalidMachineSelection as exc:
        return logged_json_error_response(
            logger=logger,
            exc=exc,
            message=str(exc),
            status=400,
        )

    return json_response(
        payload,
    )


@login_required
@require_http_methods(["GET", "POST"])
def achievements_view(request):
    if request.method == "GET":
        cache_manager = request.cache_manager
        cache_manager_if = request.cache_manager_if

        team_profiles = build_team_profile_context(
            request=request,
            cache_manager_if=cache_manager_if,
        )

        login_number = team_profiles["login_number"]

        today = datetime.today()
        current_year = today.year
        current_month = today.month

        daily_works_inf = build_achievement_month_details(
            cache_manager=cache_manager,
            login_number=login_number,
            year=current_year,
            month=current_month,
        )

        context = build_achievement_page_context(
            current_year=current_year,
            daily_works_inf=daily_works_inf,
        )

        return render(
            request,
            "achivements.html",
            context,
        )

    if (
        request.headers.get("X-Requested-With")
        != "XMLHttpRequest"
    ):
        return HttpResponseBadRequest(
            "Unsupported request."
        )

    try:
        data = parse_json_body(
            request
        )
    except InvalidJsonBody as exc:
        return logged_json_error_response(
            logger=logger,
            exc=exc,
            message="Invalid JSON data",
            status=400,
        )

    action = data.get("action")

    if action != "get_month_details":
        return HttpResponseBadRequest(
            "Invalid action"
        )

    date_str = data.get("data")

    try:
        selected_month = parse_year_month_label(
            date_str
        )
    except ValueError as exc:
        return logged_json_error_response(
            logger=logger,
            exc=exc,
            message=str(exc),
            status=400,
        )

    cache_manager = request.cache_manager
    cache_manager_if = request.cache_manager_if

    team_profiles = build_team_profile_context(
        request=request,
        cache_manager_if=cache_manager_if,
    )

    login_number = team_profiles["login_number"]

    daily_works_inf = build_achievement_month_details(
        cache_manager=cache_manager,
        login_number=login_number,
        year=selected_month.year,
        month=selected_month.month,
    )

    return json_response({
        "status": "success",
        "details": daily_works_inf,
    })


@require_GET
def planned_maintenance_view(request):
    return render(
        request,
        "plannedMaintenance/plannedMaintenance.html",
    )
        
        

@login_required
@require_GET
def equipment_ledger_view(request):
    code = request.GET.get(
        "machine-code"
    )

    equipment = get_equipment_by_control_no(
        control_no=code,
    )

    return render(
        request,
        "mobilLedger.html",
        {
            "EquipmentInformation": equipment,
        },
    )

@login_required
@require_GET
def card_by_control_view(
    request,
    control_no,
):
    equipment = find_equipment_by_control_no(
        control_no=control_no,
    )

    if equipment is None:
        raise Http404(
            "Equipment not found."
        )

    checks = select_checks_by_control(
        equipment=equipment,
    )

    prepared_checks = build_inspection_list_checks(
        checks,
    )

    return render(
        request,
        "mobileInspectionList.html",
        {
            "plans": prepared_checks,
        },
    )

@login_required
@require_GET
def csv_download_page(request):
    return render(request, 'csvDownload/csvDownload.html')

@login_required
@require_GET
def schedule_page(request):
    context = {
        "schedule_initial_data": build_schedule_initial_filters(user=request.user),
    }

    return render(request, "schedule/schedule.html", context)

@login_required
@require_GET
def home_view(request):
    """
    正式なhome画面。

    左   : 全体進捗
    中央 : ログインユーザー所属班の進捗
    右   : 個別進捗
    """
    return render(
        request,
        "home/home_dashboard.html",
        {},
    )

@login_required
@require_GET
def parts_search_view(request):
    """
    部品検索画面を表示する。

    実際の検索処理はJavaScriptから
    /api/parts-search/ を呼び出して行う。
    """
    return render(
        request,
        "parts_search/parts_search.html",
    )