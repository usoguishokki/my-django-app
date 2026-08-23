from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpRequest, HttpResponseBadRequest
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum
from datetime import datetime, timedelta

from .backends import MemberAuthenticationBackend
from .models import (
    Control_tb,
    Plan_tb,
    Check_tb,
)
from django.views.decorators.cache import never_cache


from .forms import LoginForm

import json
import logging
import calendar


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


    
                        
def get_details(detail, unique_devices):
    device = detail.applicable_device
    if device not in unique_devices:
        unique_devices[device] = {'details': []}
    unique_devices[device]['details'].append((detail.contents, detail.standard, detail.method))
    return unique_devices

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
        
    except Plan_tb.DoesNotExist as e:
        return handle_view_error(e, message='Plan not found')
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
    
    def get_month_start_and_end(year, month):
        month_start = datetime(year, month, 1)
        _, last_day = calendar.monthrange(year, month)
        month_end = datetime(year, month, last_day)
        return month_start.date(), month_end.date()
    
    def get_working_hours(month_start, month_end):
        hozen_calendar = cache_manager.get('hozen_calendars')
        statuses = ['完了', '承認待ち']
        base_queryset = Plan_tb.objects.filter(
            Q(status__in=statuses),
            implementation_date__range=(month_start, month_end),
            practitioners__member_id=login_number
        )
        daily_works_inf = []
        current_date = month_start
        while current_date <= month_end:
            day_queryset = base_queryset.filter(implementation_date=current_date)
            
            total_count = day_queryset.count()
            
            active_hours = day_queryset.filter(
                inspection_no__time_zone='稼動中'
            ).aggregate(total_hours=Sum('result_man_hours')).get('total_hours',0)
            
            inactive_hours = day_queryset.filter(
                inspection_no__time_zone='停止中'
            ).aggregate(total_hours=Sum('result_man_hours')).get('total_hours', 0)
            
            date_alias = hozen_calendar.get(h_date=current_date).date_alias
            
            daily_works_inf.append({
                'date': current_date,
                'hozen_calendar': date_alias,
                'active_hours': active_hours or 0,
                'inactive_hours': inactive_hours or 0,
                'total_count': total_count
            })
            current_date += timedelta(days=1)
        return daily_works_inf
        
    if request.method == 'GET':
        week_information = cache_manager_if.get_week_information()
        this_week = week_information['this_week']

        
        today = datetime.today()
        current_year = today.year
        current_month = today.month
        
        months = []
        for count in range(-1, 2):
            for month in range(1, 13):
                months.append(f"{current_year-count}年{month}月")
                
    

        month_start, month_end = get_month_start_and_end(current_year, current_month)
        daily_works_inf = get_working_hours(month_start, month_end)
        
    
        return render(
            request,
            'achivements.html',
            {
                'this_week': this_week,
                'months': months,
                'daily_works_inf': daily_works_inf
            }
        )
    elif request.method == 'POST' and request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data, action, parse_error = extract_request_data(request)
        if parse_error:
            return handle_view_error(parse_error, status_code=400, message='Invalid JSON data')
        if action == "get_month_details":
            date_str = data.get('data')
            year = int(date_str.split('年')[0])
            month = int(date_str.split('年')[1].replace('月', ''))
            
            month_start, month_end = get_month_start_and_end(year, month)
            daily_works_inf = get_working_hours(month_start, month_end)
            
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
    if request.method == 'GET':
        code  = request.GET.get('machine-code')
        result = Control_tb.objects.get(control_no=code)
        return render(
            request,
            'mobilLedger.html',
            {
                'EquipmentInformation': result,
            }
        )

@login_required       
def card_by_control_view(request, control_no):
    equipment = get_object_or_404(Control_tb, control_no=control_no)
    checks = Check_tb.objects.filter(control_no=equipment).order_by('id')
    
    for check in checks:
        unique_devices = {}
        for details in check.db_details.all():
            unique_devices = get_details(details, unique_devices)
        check.details_unique_devices = unique_devices
            
    return render(
        request,
        'mobileInspectionList.html',
        {
            'plans': checks
        }
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