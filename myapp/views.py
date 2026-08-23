from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpRequest, HttpResponseBadRequest, Http404
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from datetime import datetime

from .backends import MemberAuthenticationBackend
from django.views.decorators.cache import never_cache


from .forms import LoginForm

import json
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

def handle_view_error(e, **kwargs):
    """
    共通のエラーハンドリングを行う関数
    """
    status_code = kwargs.get('status_code', 500)
    message = kwargs.get('message', str(e))
    
    logger.error(f'Error: {message} - {str(e)}', exc_info=True)
    
    #JsonResponseでエラーメッセージとステータスコード
    return JsonResponse(
        {'status': 'error', 'message': message}, 
        status=status_code,
        json_dumps_params={'ensure_ascii': False})
        
def extract_request_data(request: HttpRequest):
    try:
        data = json.loads(request.body)
        action = data.get('action')
        return data, action, None
    except json.JSONDecodeError as e:
        #JSONデータのバーズに失敗した場合、エラーハンドリング関数
        return None, None, e
    
    
    
        

                
@never_cache
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
def workContents_view(request):
    cache_manager_if = request.cache_manager_if
    team_profiles = build_team_profile_context(
        request=request,
        cache_manager_if=cache_manager_if,
    )
    organization_code = request.organization_code
    
        

    if (
        request.method != "POST"
        or request.headers.get("X-Requested-With") != "XMLHttpRequest"
    ):
        applications_data = select_work_contents_plans(
            organization_code=organization_code,
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
    try:
        data, action, parse_error = extract_request_data(request)
        if parse_error:
            return handle_view_error(parse_error, status_code=400, message='Invalid JSON data')
        if action != "fetch_approval_or_rejection":
            return HttpResponseBadRequest('Invalid action')
        detailObj = data.get('detail')
        applicant_user = team_profiles["user_profile"].user


        details = detailObj if isinstance(detailObj, list) else [detailObj]
        update_work_contents_plans(
            details=details,
            applicant_user=applicant_user,
        )
        plan_ids = [d.get('planId') for d in details if d.get('planId') is not None]
                        
        return JsonResponse({'status': 'success', 
                             'message': 'Plan updated successfuly', 
                             'planId': plan_ids,
                            })
        
    except ValueError as e:
        return handle_view_error(e, message=str(e))
    except Exception as e:
        return handle_view_error(e, message=f'Error processing request: {str(e)}')


     
     
@login_required
def inspectionStadards_view(request):
    if request.method == 'GET':
        context = build_inspection_standards_context(
            organization_code=request.organization_code,
        )

        return render(
            request,
            'inspectionStandards/inspectionStandards.html',
            context,
        )

    if (
        request.method == 'POST'
        and request.headers.get('X-Requested-With') == 'XMLHttpRequest'
    ):
        data, action, parse_error = extract_request_data(request)

        if parse_error:
            return handle_view_error(
                parse_error,
                status_code=400,
                message='Invalid JSON data',
            )

        if action != 'get_details':
            return JsonResponse(
                {
                    'status': 'error',
                    'message': 'Unsupported action.',
                },
                status=400,
                json_dumps_params={'ensure_ascii': False},
            )

        try:
            payload = build_inspection_standard_details_payload(
                filter_data=data.get('data'),
            )
        except InvalidMachineSelection as e:
            return handle_view_error(
                e,
                status_code=400,
                message=str(e),
            )

        return JsonResponse(
            payload,
            json_dumps_params={'ensure_ascii': False},
        )

    return HttpResponseBadRequest('Unsupported request.')
    
    
@login_required
def achievements_view(request):
    cache_manager = request.cache_manager
    cache_manager_if = request.cache_manager_if
    team_profiles = build_team_profile_context(
        request=request,
        cache_manager_if=cache_manager_if,
    )
    login_number = team_profiles['login_number']
    
    
        
    if request.method == 'GET':

        
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
    elif request.method == 'POST' and request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data, action, parse_error = extract_request_data(request)
        if parse_error:
            return handle_view_error(parse_error, status_code=400, message='Invalid JSON data')
        if action == "get_month_details":
            date_str = data.get('data')
            selected_month = parse_year_month_label(
                date_str
            )
            
            daily_works_inf = build_achievement_month_details(
                cache_manager=cache_manager,
                login_number=login_number,
                year=selected_month.year,
                month=selected_month.month,
            )
            
            return JsonResponse({
                'status': 'success',
                'details': daily_works_inf
            })
            
def planned_maintenance_view(request):
    if request.method == 'GET':
        return render(
            request,
            'plannedMaintenance/plannedMaintenance.html'
        )
        
        

@login_required
def equipment_ledger_view(request):
    if request.method == "GET":
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
def csv_download_page(request):
    return render(request, 'csvDownload/csvDownload.html')

@login_required
def schedule_page(request):
    context = {
        "schedule_initial_data": build_schedule_initial_filters(user=request.user),
    }

    return render(request, "schedule/schedule.html", context)

@login_required
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