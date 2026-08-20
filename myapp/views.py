from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpRequest, HttpResponseBadRequest, HttpResponse
from django.core import serializers
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum, Min, Max, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from django.db import transaction
from datetime import datetime, timedelta, time as dt_time, date
from .backends import MemberAuthenticationBackend
from .models import (
    Control_tb, Member_tb, Plan_tb, Db_details_tb, Calendar_tb, Check_tb,
    ShiftPattan_tb, UserProfile, WeeklyDuty, Hozen_calendar_tb,
    DayOfWeek, PlanStatus
)
from django.views.decorators.cache import never_cache

from collections import defaultdict
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes

#from .models import SHIFTPATTERN_WORKER_VIEW
from .workScheduleEntry import WorkScheduleEntry
from .decorators import ajax_login_required
from .forms import LoginForm
from dateutil import parser as dparser
from zoneinfo import ZoneInfo
import json
import pytz
import itertools
import logging
import calendar
import logging
import csv
from typing import Optional, List, Sequence, Iterable, Union, Tuple

from myapp.selectors.plan import (
    plan_base_qs,
)

from myapp.selectors.calendar import (
    annotate_plan_affiliation_from_calendar
)


from myapp.domain.sort_keys.inspection_no import inspection_no_sort_key
from myapp.domain.schedule_initial_filters import build_schedule_initial_filters
from myapp.domain.errors import InvalidMachineSelection

from myapp.domain.errors import InvalidMachineSelection
from myapp.services.inspection_standards import (
    build_inspection_standards_context,
    build_inspection_standard_details_payload,
)

from myapp.services.card_work.card_work_page import build_card_work_page_context

logger = logging.getLogger('myapp')

def hozen_common_data():
    common_data = {
        'hozen_week': ['4月1週目', '4月2週目', '4月3週目', '4月4週目', '5月1週目', '5月2週目', '5月3週目', '5月4週目',
            '6月1週目', '6月2週目', '6月3週目', '6月4週目', '7月1週目', '7月2週目', '7月3週目', '7月4週目',
            '8月1週目', '8月2週目', '8月3週目', '8月4週目', '9月1週目', '9月2週目', '9月3週目', '9月4週目',
            '10月1週目', '10月2週目', '10月3週目', '10月4週目', '11月1週目', '11月2週目', '11月3週目', '11月4週目',
            '12月1週目', '12月2週目', '12月3週目', '12月4週目', '1月1週目', '1月2週目', '1月3週目', '1月4週目',
            '2月1週目', '2月2週目', '2月3週目', '2月4週目', '3月1週目', '3月2週目', '3月3週目', '3月4週目'
        ]  
    }

    return common_data

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
    
    
    
utc_zone = pytz.timezone('UTC')
jst_zone = pytz.timezone('Asia/Tokyo')  
def convert_utc_to_jst(utc_time_str):
    """
    Convert UTC time string to JST (Japan Standard Time).
    
    Args:
    utc_time_str(str): UTC time in ISO format, e.g., "2024-05-06T05:45:00.000Z"
    
    Returns:
    str: The JST time as a atring in the format "YYYY-MM-DD HH:MM:SS"
    
    Raises:
    ValueError: If the input string is not a valid UTC date.
    """
    try:

        
        utc_time = datetime.strptime(utc_time_str, "%Y-%m-%dT%H:%M:%S.%fZ")
        
        utc_time = utc_zone.localize(utc_time)
        
        jst_time = utc_time.astimezone(jst_zone)
        
        return jst_time.strftime("%Y-%m-%d %H:%M:%S")
    
    except ValueError as e:
        return handle_view_error(e)
        
def convertToDateTimeObject(date_time_str):
    format_date_time = datetime.strptime(date_time_str, '%Y-%m-%d %H:%M:%S')
    return format_date_time

                
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

def get_logged_in_user(request):
    return request.session.get('login_number')
   
def set_profiles_dict(request, cache_manager_if):
    request_login_number = get_logged_in_user(request)
    login_number = cache_manager_if.get_login_number(request_login_number)
    user_profile, profiles = cache_manager_if.get_profiles(login_number)
    team_profiles = {
        'request_login_number': request_login_number,
        'login_number': login_number,
        'user_profile': user_profile,
        'profiles': profiles
    }
    
    affiliation_pattern_times_dict, profiles = cache_manager_if.get_affiliation_pattern_times_dict(
        team_profiles['user_profile'], 
        team_profiles['profiles']
    )
    
    return affiliation_pattern_times_dict, team_profiles

def profile(cache_manager_if, login_number):
    user_profile, profiles = cache_manager_if.get_profiles(login_number)
    result_dict = {}
    result_dict["user_profile"] = user_profile
    mybelongs = user_profile.belongs
    leader_profile = set_leader_profile(profiles, mybelongs)
    result_dict["leader_profile"] = leader_profile
    return result_dict

def set_leader_profile(profiles, mybelongs):
    try:
        leader_profile = profiles.get(
            belongs=mybelongs,
            job_title='班長'
        )
    except ObjectDoesNotExist:
        leader_profile = None
    
    return leader_profile


def get_cached_login_number(request, cache_manager):
    login_number_data = get_logged_in_user(request)
    login_cache = cache_manager.login_key(login_number_data)
    login_number = cache_manager.get(login_cache['cache_key'])
    return login_number_data, login_number, login_cache
    
logger = logging.getLogger(__name__)

def groupActualWorksByMachineBySave(target_plans, work_schedule_entry_ins, _time_zone, registration_events):
    actual_works = list(target_plans.filter(inspection_no__time_zone=_time_zone).order_by(
        'inspection_no__control_no__line_name', 'inspection_no__control_no__machine')
    )
    
    actual_machine_data = {}
    actual_works_group = itertools.groupby(actual_works, key=lambda x: x.inspection_no.control_no.machine)


    for machine, works in actual_works_group:
        works_list = list(works)
        total_man_hours = sum(work.inspection_no.man_hours for work in works_list)
        plan_objs = [work for work in works_list]
        actual_machine_data[machine] = {
            'total_man_hours': total_man_hours,
            'plan_objs': plan_objs
        }    
    

    update_plan_objs = work_schedule_entry_ins.addTaskToSchedule(actual_machine_data)
    registration_events['plan_obj_list'].extend(update_plan_objs)
    
    for obj in update_plan_objs:
        registration_events['plan_ids_list'].append(str(obj.plan_id))
        
    return registration_events

def create_weekly_plan_cache_key(code, name):
    cache_key = f"{code}_{name}"
    return cache_key
    
def assign_fallback_leader_if_missing(_plan, team_profiles):
    profiles = team_profiles["profiles"]
    mybelongs = _plan.weekly_duties.affilation
    leader_profile = set_leader_profile(profiles, mybelongs)
    return leader_profile
                        
def get_details(detail, unique_devices):
    device = detail.applicable_device
    if device not in unique_devices:
        unique_devices[device] = {'details': []}
    unique_devices[device]['details'].append((detail.contents, detail.standard, detail.method))
    return unique_devices

# --- ステータス定数（models の choices と合わせる）
STATUS_WAITING   = '配布待ち'
STATUS_PENDING   = '実施待ち'
STATUS_APPROVAL  = '承認待ち'
STATUS_DONE      = '完了'
STATUS_REJECTED  = '差戻し'
STATUS_DELAYED   = '遅れ'


def _serialize_plan_rows(qs):
    """
    Plan_tb の行をテーブル描画用の dict に変換
    """

    rows = []
    for plan in qs:
        chk = plan.inspection_no
        ctrl = chk.control_no if chk else None

        prac_names = []
        prac_member_id = []
        for p in getattr(plan, "practitioners", []).all():
            if p.member_id and p.member_id.name:
                prac_names.append(p.member_id.name)
                prac_member_id.append(p.member_id.member_id)

        approver_affilation = ""
        if plan.approver and hasattr(plan.approver, "profile") and plan.approver.profile.belongs:
            approver_affilation = plan.approver.profile.belongs.affilation

        rows.append({
            "plan__plan_id": plan.plan_id,
            "status": plan.status,
            "plan__plan_time": plan.plan_time.strftime("%Y-%m-%dT%H:%M") if plan.plan_time else "",
            "plan__inspection_no__wark_name": chk.wark_name if chk else "",
            "plan__inspection_no__man_hours": chk.man_hours if chk and chk.man_hours is not None else "",
            "holder_name": plan.holder.name if plan.holder else "未割当",
            "holder_member_id": plan.holder_id,
            "this_week": False,
            "affilation__affilation": approver_affilation,
            "plan__inspection_no__time_zone": chk.time_zone if chk else "",
            "plan__inspection_no__control_no__machine": ctrl.machine if ctrl else "",
            "practitioner_id": ", ".join(prac_member_id) if prac_member_id else "",
            "practitioner_name": ", ".join(prac_names) if prac_names else "",
            "plan__comment": plan.comment or "",
            "plan__inspection_no__inspection_no": chk.inspection_no if chk else "",
            "plan__points_to_note": plan.points_to_note or "",
        })
    return rows


def api_plans(request):    
    week_alias = request.GET.get("week")
    status = request.GET.getlist("status")
    
    qs = plan_base_qs()
    qs = qs.filter(status__in=status)
    qs = qs.filter(p_date__date_alias=week_alias)
    
    # --- 相関サブクエリ（Plan_tb の行ごとに Calendar_tb を (c_date, pattern) で特定）---
    cal_base = Calendar_tb.objects.filter(
        c_date_id = OuterRef('p_date_id'),
        pattern_id = OuterRef('inspection_no__practitioner_id'),
    )
    qs = qs.annotate(
        cal_affilation_id   = Subquery(cal_base.values('affilation_id')[:1]),
        cal_affilation_name = Subquery(cal_base.values('affilation__affilation')[:1]),
    )
    
    #simple_params = {
    #    "week_alias": request.GET.get("week"),
    #    "status": request.GET.get("status"),
    #}
    
    #q_simple = build_q_from_simple_params(simple_params, field_map=field_map, status_map=status_map)
    
    #q_adv = Q()
    #if (f := request.GET.get("filters")):
    #    try:
    #        q_adv = build_q_from_filters(json.loads(f), field_map=field_map,
    #                                     status_map=status_map, op_map=op_map,
    #                                     negated_ops=negated_ops)
    
    #qs = qs.filter(q_simple).filter(q_adv)
    rows = list(qs.values(
        "plan_id","status","p_date__date_alias","p_date__h_day_of_week",
        "inspection_no__time_zone","inspection_no__control_no__machine",
        "inspection_no__control_no__line_name__line_name",
        "inspection_no__wark_name", "inspection_no__man_hours", 
        "inspection_no__practitioner__pattern_name",
        "inspection_no__inspection_no", "inspection_no__day_of_week",
        "cal_affilation_name","inspection_no__rule__unit","inspection_no__rule__interval",
        "inspection_no__status"
    ))
    return JsonResponse({"status":"success", "rows":rows}, status=200)


def parse_client_iso_to_aware(s: str,
                              default_tz: Optional[ZoneInfo] = None
                              ) -> Optional[datetime]:
    """
    クライアントから来た ISO8601 を aware datetime にする。
    - Z/±HH:MM 付きならそのタイムゾーンを使用
    - 何も付いていなければ default_tz（未指定なら settings.TIME_ZONE）を付与
    """
    if not s:
        return None
    try:
        dt = dparser.isoparse(s)
    except Exception:
        return None
        
    if timezone.is_naive(dt):
        if default_tz is None:
            defulat_tz = timezone.getcurrent_timezone()
        dt = timezone.make_aware(dt, default_tz)
    return dt


@login_required
def api_update_plan_time(request, plan_id: int):
    """
    部分更新: Plan_tb.plan_time / holder を更新する
    受け取り(JSON):
      { "plan_time": "2025-08-29T10:30:00.000Z" }
    返り(JSON):
      { "status":"success", "plan_id": 123, "plan_time": "ISO8601", "tz": "UTC or local" }
    """
    ctype = (request.content_type or "").lower()
    if not ctype.startswith("application/json"):
        return JsonResponse(
            {"status": "error", "message": "Content-Type must be application/json"},
            status=415
        )

    data, action, err = extract_request_data(request)
    if err:
        return JsonResponse({"status": "error", "message": "Invalid JSON."}, status=400)

    payload = data.get("upDateDict") or {}
    plan_id = payload.get("planId")
    plan_time_str = payload.get("beforeStart")
    holder_id = payload.get("beforeHolderId")

    updates = {}
    rows = []

    if not plan_time_str and not holder_id:
        return JsonResponse(
            {"status": "error", "message": "Nothing to update: plan_time または holder を指定してください。"},
            status=400
        )

    dt = None
    if plan_time_str:
        dt = convertToDateTimeObject(plan_time_str)
        if dt is None:
            return JsonResponse(
                {"status": "error", "message": "Invalid datetime format."},
                status=400
            )
        updates["plan_time"] = dt

    member = None
    if holder_id:
        try:
            member = Member_tb.objects.get(pk=str(holder_id))
        except Member_tb.DoesNotExist:
            return JsonResponse(
                {"status": "error", "message": "Member not found."},
                status=404
            )
        updates["holder"] = member

    with transaction.atomic():
        try:
            plan = Plan_tb.objects.select_for_update().get(pk=plan_id)
        except Plan_tb.DoesNotExist:
            return JsonResponse(
                {"status": "error", "message": "Plan not found."},
                status=404
            )

        for field, value in updates.items():
            setattr(plan, field, value)

        plan.save(update_fields=list(updates.keys()))

        # 更新後の表示用データを Plan_tb 基準で取得
        qs = (
            plan_base_qs()
            .filter(plan_id=plan.plan_id)
            .prefetch_related("practitioners__member_id")
        )
        rows = _serialize_plan_rows(qs)

        data = {
            "rows": rows,
            "plan_id": plan.plan_id,
        }

    resp = {"status": "success", "data": data}
    return JsonResponse(resp, status=200)


@login_required
def card_work(request):
    cache_manager_if = request.cache_manager_if
    _affiliation_pattern_times_dict, team_profiles = set_profiles_dict(
        request,
        cache_manager_if,
    )

    context = build_card_work_page_context(
        request=request,
        team_profiles=team_profiles,
    )

    return render(request, "card/card_work.html", context)
        
@login_required
def workContents_view(request):
    cache_manager_if = request.cache_manager_if
    affiliation_pattern_times_dict, team_profiles = set_profiles_dict(request, cache_manager_if)
    organization_code = request.organization_code
    login_number = team_profiles['login_number']
    user_dict = profile(cache_manager_if, login_number)
    
    def batch_update_plans(details, applicant_user):
        """details: [{'planId', 'planStatus', 'planComment'}, ...]"""
        plan_ids = [d.get('planId') for d in details if d.get('planId') is not None]
        if not plan_ids:
            return [], {}, 0, 0
        
        plans = (
            Plan_tb.objects
            .filter(plan_id__in=plan_ids)
            .in_bulk(field_name='plan_id')
        )
        
        plan_list = []
        affiliation_dict = {}
        
        for d in details:
            pid = int(d.get('planId'))
            plan_status = d.get('planStatus')
            plan_comment = d.get('planComment')
            
            plan = plans.get(pid)
            if not plan:
                continue
            
            if plan_status is not None:
                plan.status = plan_status
            if plan_comment is not None:
                plan.comment = plan_comment
            plan.applicant = applicant_user
            plan_list.append(plan)
            
                    
        with transaction.atomic():
            if plan_list:
                Plan_tb.objects.bulk_update(plan_list, ['status', 'comment', 'applicant'])
        return len(plan_list)
        

    if request.method != 'POST' or not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        
        applications_data = Plan_tb.objects.select_related(
            'applicant',
            'approver',
            'inspection_no__control_no__line_name__organization'
        ).filter(
            plan_time__isnull=False,
            inspection_no__control_no__line_name__organization__organization=organization_code
        ).exclude(
            status='完了'
        )
        
        applications_data_list = []
        for application_data in applications_data:
            
            applicant_name = application_data.applicant.name if application_data.applicant else ''
            approver_name = application_data.approver.name if application_data.approver else ''
            
            application_dict = {
                'id': application_data.plan_id,
                'status': application_data.status,
                'work_name': application_data.inspection_no.wark_name,
                'points_to_note': application_data.points_to_note,
                'result': application_data.result,
                'applicant_name': applicant_name,
                'approver_name': approver_name,
                'comment': application_data.comment,
                'implementation_date': application_data.implementation_date
            }
            applications_data_list.append(application_dict)
        
        return render(request, 
                      'workContents/workContents.html', 
                      {'applications_data_list': applications_data_list,
                       'members': team_profiles['profiles']
                       })
    try:
        data, action, parse_error = extract_request_data(request)
        if parse_error:
            return handle_view_error(parse_error, status_code=400, message='Invalid JSON data')
        if action != "fetch_approval_or_rejection":
            return HttpResponseBadRequest('Invalid action')
        detailObj = data.get('detail')
        applicant_user = user_dict['user_profile'].user


        details = detailObj if isinstance(detailObj, list) else [detailObj]
        batch_update_plans(details, applicant_user)
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


def extract_number_from_key(item, key):
    """
    任意のキーから値を取得し、最後のアンダーバー以降の数値を抽出する関数。

    Args:
        item (dict): データ項目を格納した辞書。
        key (str): 数値抽出の対象となるキー。

    Returns:
        int: 抽出した数値（整数）。
    """
    value = item.get(key, "")
    if not value:
        raise ValueError(f"The key '{key}' does not exist in the item or its value is empty.")
    try:
        #最後のアンダーバー以降の部分を抽出して整数型に変換
        return int(value.split('_')[-1])
    except (ValueError, IndexError):
         raise ValueError(f"Cannot extract a valid number from the key '{key}' with value '{value}'.")
     
     
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
    affiliation_pattern_times_dict, team_profiles = set_profiles_dict(request, cache_manager_if)
    organization_code = request.organization_code
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
        #months = range(1, 13)
        #loop_count = range(-1, 1)
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
        
def get_chart_data_view(request):
    organization_code = request.organization_code
    # 色のリストを定義（必要に応じて追加）
    shiftpatterns = ['1直', '2直', '3直', '休日']
    
    background_colors = {
        '1直': "rgba(45, 120, 218, 0.8)",
        '2直': "rgba(52, 236, 123, 0.8)",
        '3直': "rgba(255, 105, 105, 0.8)",
        '休日': "rgba(112, 112, 112, 0.8)"
    }
    try:
        if request.method == 'GET':
            if request.GET.get('action') == 'weekly-manhours':
                
                hozen_week = hozen_common_data()
                result = Hozen_calendar_tb.objects.filter(
                    plans_by_date__inspection_no__control_no__line_name__organization__organization=organization_code,
                    h_date__range=("2025-04-01", "2026-03-31")
                ).filter(
                    plans_by_date__inspection_no__practitioner__pattern_name__isnull=False  # NULLを除外
                ).exclude(
                    plans_by_date__inspection_no__practitioner__pattern_name=''  # 空文字を除外
                ).values(
                    'date_alias',
                    'plans_by_date__inspection_no__practitioner__pattern_name'
                ).annotate(
                    total_man_hours=Sum('plans_by_date__inspection_no__man_hours')
                )

                result_list = list(result)
        
                chart_data = {
                    "labels": hozen_week['hozen_week'],
                    "datasets": []
                }
        
                for pattern in shiftpatterns:
                    dataset = {
                        "label": pattern,
                        "data": [],
                        "backgroundColor": background_colors[pattern]
                    }
            
                    for week in hozen_week['hozen_week']:
                        filtered_count = sum(
                            1 for item in result_list
                            if item['date_alias'] == week and
                            item['plans_by_date__inspection_no__practitioner__pattern_name'] == pattern
                        )
                
                        filtered = next(
                            (item['total_man_hours'] for item in result_list
                            if item['date_alias'] == week and
                            item['plans_by_date__inspection_no__practitioner__pattern_name'] == pattern),
                            0
                        )
                        dataset['data'].append(filtered)
                    chart_data['datasets'].append(dataset)
 
                return JsonResponse({
                    'status': 'success',
                    'data': chart_data
                })
            
            elif request.GET.get('action') == 'man-hours-by-machine':
                result = Plan_tb.objects.values(
                    'inspection_no__control_no__machine'
                ).annotate(
                    total_man_hours=Sum('inspection_no__man_hours')
                ).order_by('-total_man_hours')
            
                chart_data = {
                    "labels": [],
                    "datasets": [
                        {
                            "label": "工数合計",
                            "data": [],
                            "backgroundColor": "rgba(45, 120, 218, 0.8)"
                        }
                    ]
                }
                count = 0
                for item in result:
                    machine = item['inspection_no__control_no__machine'] or "不明"
                    man_hours = item['total_man_hours'] or 0
                
                    chart_data['labels'].append(machine)
                    chart_data["datasets"][0]['data'].append(man_hours)
                    count += 1
                    
                    if count == 50: 
                        break
                return JsonResponse({
                    'status': 'success',
                    'data': chart_data
                })
    except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
        

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

"""
def nika_app_view(request):
    logger.debug(f"🔍 request.COOKIES in nika_app_view: {request.COOKIES}")
    return render(request, 'index.html')
"""
@api_view(['GET'])
def get_employee(request):
    return JsonResponse({
        "user": str(request.user),
        "authenticated": request.user.is_authenticated
    })


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