from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpRequest,HttpResponseBadRequest
from django.core import serializers
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum, Prefetch
from django.db import transaction
from datetime import datetime, timedelta, time as dt_time
from .backends import MemberAuthenticationBackend
from .models import (
    Control_tb, Member_tb, Plan_tb, Db_details_tb, Calendar_tb, Check_tb,
    ShiftPattan_tb, Practitioner_tb, UserProfile, WeeklyDuty, Hozen_calendar_tb,
)
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .serializers import UserProfileSerializer

#from .models import SHIFTPATTERN_WORKER_VIEW
from .workScheduleEntry import WorkScheduleEntry
from .decorators import ajax_login_required
from .forms import LoginForm , CardForm
import json
import pytz
import itertools
import bisect
from dateutil.parser import parse
import logging
import time
import calendar
import logging

#from myapp.decorators import with_cache_manager #現在使っていません


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
        utc_zone = pytz.timezone('UTC')
        jst_zone = pytz.timezone('Asia/Tokyo')
        
        utc_time = datetime.strptime(utc_time_str, "%Y-%m-%dT%H:%M:%S.%fZ")
        
        utc_time = utc_zone.localize(utc_time)
        
        jst_time = utc_time.astimezone(jst_zone)
        
        return jst_time.strftime("%Y-%m-%d %H:%M:%S")
    
    except ValueError as e:
        return handle_view_error(e)
        
def convertToDateTimeObject(date_time_str):
    format_date_time = datetime.strptime(date_time_str, '%Y-%m-%d %H:%M:%S')
    return format_date_time
        
def addDateToTime(target_inf, registration_date, registration_date_after):
    update_with_registration_date_after ={
        '3直': [
            'hot_time_start_a', 
            'hot_time_end_a', 
            'shift_change_time_start', 
            'shift_end_time', 
            'shift_lunch_time_start', 
            'shift_lunch_time_end',
            'shift_change_time_start',
            'shift_change_time_end',
            'end_date_time',
        ],
        '連2A': [
            'shift_end_time',
            'end_date_time',
            'hot_time_start_b',
            'hot_time_end_b'
        ]
    }
    
    shift_pattern_name = target_inf.shift_pattern_name
    fields_to_update = update_with_registration_date_after.get(shift_pattern_name, [])


    for attr_name, value in target_inf.__dict__.items():
        if value is not None:
            if isinstance(value, datetime):
                new_date = registration_date_after if attr_name in fields_to_update else registration_date
                updated_value = value.replace(year=new_date.year, month=new_date.month, day=new_date.day)
                setattr(target_inf, attr_name, updated_value)
            elif isinstance(value, dt_time):
                new_date = registration_date_after if attr_name in fields_to_update else registration_date
                updated_value = datetime.combine(new_date, value)
                setattr(target_inf, attr_name, updated_value)

def login_view(request):
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
    user_profile ,profiles = cache_manager_if.get_profiles(login_number)
    team_profiles = {
        'request_login_number': request_login_number,
        'login_number': login_number,
        'user_profile': user_profile,
        'profiles': profiles
    }
    return team_profiles

def profile(cache_manager_if, login_number):
    user_profile, profiles = cache_manager_if.get_profiles(login_number)
    result_dict = {}
    result_dict["user_profile"] = user_profile
    mybelongs = user_profile.belongs
    leader_profile = set_leader_profile(profiles, mybelongs)
    result_dict["leader_profile"] = leader_profile
    return result_dict
    """
    try:
        result_dict['leader_profile'] = profiles.get(
            belongs=user_profile.belongs,
            job_title='班長'
        )
    except ObjectDoesNotExist:
        result_dict['leader_profile'] = None
    
    return result_dict
    """

def set_leader_profile(profiles, mybelongs):
    try:
        leader_profile = profiles.get(
            belongs=mybelongs,
            job_title='班長'
        )
    except ObjectDoesNotExist:
        leader_profile = None
    
    return leader_profile
    
    
def member_tb_get(name):
    return Member_tb.objects.get(name=name)

def convert_exclude_weekly_duties_list(exclude_weekly_duties):
    start_time = time.time()
    
    plan_ids = [duty.plan.plan_id for duty in exclude_weekly_duties]
    print(f"Time to create plan_ids: {time.time() - start_time} seconds")

    query_start_time = time.time()
    practitioners = Practitioner_tb.objects.filter(plan_id__in=plan_ids).select_related('member_id')
    print(f"Time for database query: {time.time() - query_start_time} seconds")
    
    dict_start_time = time.time()
    practitioner_dict = {}
    for practitioner in practitioners:
        plan_id = practitioner.plan_id.plan_id
        if plan_id not in practitioner_dict:
            practitioner_dict[plan_id] = []
        practitioner_dict[plan_id].append((
            practitioner.member_id_id,
            practitioner.member_id.name
        ))
    print(f"Time to build practitioner_dict: {time.time() - dict_start_time} seconds")
    
    loop_start_time = time.time()
    
    print(f"Time to process exclude_weekly_duties: {time.time() - loop_start_time} seconds")
    return exclude_weekly_duties, practitioner_dict


def get_cached_login_number(request, cache_manager):
    login_number_data = get_logged_in_user(request)
    login_cache = cache_manager.login_key(login_number_data)
    login_number = cache_manager.get(login_cache['cache_key'])
    return login_number_data, login_number, login_cache

def get_other_teams(cache_manager_if, team_profiles):
    user_and_holiday_affiliation_id = [team_profiles['user_profile'].belongs_id, 7]
    affiliations = cache_manager_if.middlewares_cache['affiliations']
    exclude_affiliations = affiliations.exclude(affilation_id__in = user_and_holiday_affiliation_id)
    return exclude_affiliations

def dutiesListSerialized(duty):
    return {
        'plan__plan_id': duty.plan_id,
        'status': duty.status,
        'plan__plan_time': duty.plan.plan_time,
        'plan__inspection_no__wark_name': duty.plan.inspection_no.wark_name,
        'plan__inspection_no__man_hours': duty.plan.inspection_no.man_hours,
        'plan__comment': duty.plan.comment,
        'this_week': duty.this_week,
        'affilation__affilation': duty.affilation.affilation,
        'plan__inspection_no__control_no__machine': duty.plan.inspection_no.control_no.machine,
        'plan__inspection_no__time_zone': duty.plan.inspection_no.time_zone,
        'plan__inspection_no__inspection_no': duty.plan.inspection_no.inspection_no,
        'plan__points_to_note': duty.plan.points_to_note,
        'plan__inspection_no__control_no__line_name__line_name': duty.plan.inspection_no.control_no.line_name.line_name,
        'plan__inspection_no__day_of_week': duty.plan.inspection_no.day_of_week,
        'plan__p_date__date_alias': duty.plan.p_date.date_alias,
        'plan__p_date__h_day_of_week': duty.plan.p_date.h_day_of_week
    }
    

def non_matching_weekly_duties_view(request):
    cache_manager = request.cache_manager
    cache_manager_if = request.cache_manager_if
    if request.method == 'GET':
        try:
            team_profiles = set_profiles_dict(request, cache_manager_if)
            user_organization = team_profiles['user_profile'].organization.organization
            user_affiliation = team_profiles['user_profile'].belongs.affilation
            affiliations_obj = cache_manager.get('affiliations')
            excluded_affiliations = [
                affil for affil in affiliations_obj
                if affil.affilation not in user_affiliation and affil.affilation != '休日'
            ]
            
            combined_duties = get_weekday_plan(cache_manager_if, user_organization, excluded_affiliations)
            filter_duties = [ 
                duty for duty in combined_duties
                if (duty.status == '配布待ち') or ((duty.status == '遅れ') and (not duty.plan.plan_time))
            ]
            duties_list_serialized = []
            for duty in filter_duties:
                serialized_duty = dutiesListSerialized(duty)
                duties_list_serialized.append(serialized_duty)

            data = {
                'duties': duties_list_serialized,
            }
            
        except UserProfile.DoesNotExist:
            return handle_view_error(UserProfile.DoesNotExist(), status_code=404, message='User profile not found')
        except Exception as e:
            return handle_view_error(e)
        return JsonResponse({'status': 'success', 'data': data})


def groupActualWorksByMachineBySave(target_plans, work_schedule_entry_ins, _time_zone, registration_events):
    actual_works = list(target_plans.filter(plan__inspection_no__time_zone=_time_zone).order_by(
        'plan__inspection_no__control_no__line_name', 'plan__inspection_no__control_no__machine')
    )
    
    actual_machine_data = {}
    actual_works_group = itertools.groupby(actual_works, key=lambda x: x.plan.inspection_no.control_no.machine)
    for machine, works in actual_works_group:
        works_list = list(works)
        total_man_hours = sum(work.plan.inspection_no.man_hours for work in works_list)
        plan_objs = [work.plan for work in works_list]
        actual_machine_data[machine] = {
            'total_man_hours': total_man_hours,
            'plan_objs': plan_objs
        }
    
    update_plan_objs = work_schedule_entry_ins.addTaskToSchedule(actual_machine_data)
    registration_events['plan_obj_list'].extend(update_plan_objs)
    
    for obj in update_plan_objs:
        registration_events['plan_ids_list'].append(obj.plan_id)
        
    return registration_events

def create_weekly_plan_cache_key(code, name):
    cache_key = f"{code}_{name}"
    return cache_key

def get_weekday_plan(cache_manager_if, user_organization, affiliations_obj, update_flg=False):
    combined_duties = []
    for affilation_obj in affiliations_obj:
        weekday_plan_list = cache_manager_if.get_weekly_duties(user_organization, affilation_obj, update_flg)
        ids = [wb.id for wb in weekday_plan_list if hasattr(wb, 'id')]
        weekday_plan = WeeklyDuty.objects.filter(id__in=ids).select_related(
            'plan',
            'plan__holder',
            'plan__applicant',
            'plan__inspection_no',
            'plan__inspection_no__control_no',
            'affilation'
        ).prefetch_related(
            Prefetch('plan__practitioners', 
                     queryset=Practitioner_tb.objects.select_related('member_id'))
        )

        for _plan in weekday_plan:
            if _plan.status == '完了':
                practitioners = list(_plan.plan.practitioners.all())
                _plan.practitioners = [p.member_id for p in practitioners]
                _plan.practitioners_name = [p.member_id.name for p in practitioners]

        combined_duties.extend(weekday_plan)

    return combined_duties

def sort_combined_duties_by_plan_time(combined_duties):
    """
    Sorts the list of WeeklyDuty objects by plan.plan_time in ascending order.
    """
    return sorted(
        combined_duties,
        key=lambda duty: duty.plan.plan_time.timestamp() if duty.plan and duty.plan.plan_time else float('inf')
    )
    
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
    
    
@login_required
def home_view(request):
    cache_manager = request.cache_manager
    cache_manager_if = request.cache_manager_if
    organization_code = request.organization_code
    if request.method == 'GET':
        try:
            team_profiles = set_profiles_dict(request, cache_manager_if)
            cache_manager_if.get_affiliation_pattern_times_dict(
                team_profiles['user_profile'], 
                team_profiles['profiles']
            )
            
            update_flg = cache_manager_if.get_current_data_infomation(team_profiles['profiles'])
            
            user_organization = team_profiles['user_profile'].organization.organization
            affiliations_obj = cache_manager.get('affiliations')
            combined_duties = get_weekday_plan(cache_manager_if, user_organization, affiliations_obj, update_flg)
            sorted_duties = sort_combined_duties_by_plan_time(combined_duties)
            
            context = {
                'cardAll': sorted_duties,
                'team_profiles': team_profiles['profiles']
            }
            
            return render(request, 'home.html', context)
            
        except UserProfile.DoesNotExist:
            return handle_view_error(UserProfile.DoesNotExist(), status_code=404, message='User profile not found')
        except Exception as e:
            print("Error:", e)
            return handle_view_error(e)
        
    elif request.method == 'POST' and request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data, action, parse_error = extract_request_data(request)
        if action == "fetch_update_bar":
            
            before_after_dict = {
                'plan_id': None,
                'old_member_holder': None,
                'new_member_holder': None,
                'new_member_holder_id': None,
                'old_plan_time': None,
                'new_plan_time': None
            }
            user_profiles = cache_manager.get(f'{organization_code}_user_profiles')
            upDateDict = data['upDateDict']
            plan_id = upDateDict.get('plan_id')
            try:
                plan = Plan_tb.objects.get(plan_id=plan_id)
                before_after_dict['plan_id'] = plan_id
                if 'member' in upDateDict:
                    member = upDateDict['member']
                    user_profile = user_profiles.get(user__name = member)
                    team_profile = profile(cache_manager_if, user_profile.user_id)
                    
                    before_after_dict['old_member_holder'] = plan.holder.name
                    plan.holder = team_profile['user_profile'].user
                    before_after_dict['new_member_holder'] = plan.holder.name
                    before_after_dict['new_member_holder_id'] = plan.holder.member_id
                    plan.approver = team_profile['leader_profile'].user
                
                if 'plan_time' in upDateDict:
                    
                    before_after_dict['old_plan_time'] = plan.plan_time.strftime("%Y-%m-%d %H:%M:%S")
                    jst_date_time = convert_utc_to_jst(upDateDict['plan_time'])
                    before_after_dict['new_plan_time'] = jst_date_time
                    
                    jst_date_tiem_str = convertToDateTimeObject(jst_date_time)
                    plan.plan_time = jst_date_tiem_str
                    
                plan.save()

                cache_key = create_weekly_plan_cache_key(
                    organization_code, 
                    plan.weekly_duties.affilation.affilation
                )
            
                cache_manager_if.update_weekly_duties_cache(cache_key, plan.weekly_duties)
                return JsonResponse({'status': 'success', 'data': before_after_dict})
            except Plan_tb.DoesNotExist:
                return handle_view_error(Exception("Plan_tb not found"), status_code=404, message="Plan_tb not found")
            except Exception as e:
                return handle_view_error(e)
    else:
        return handle_view_error(ValueError("Invalid requet"), status_code=400, message="Invalid request")
        

#@login_required
@ajax_login_required
def calendar_view(request):
    cache_manager = request.cache_manager
    cache_manager_if = request.cache_manager_if
    days_of_week = ['月', '火', '水', '木', '金', '土', '日']
    team_profiles = set_profiles_dict(request, cache_manager_if)
    organization_code = request.organization_code
    if request.method == 'GET':
        #今週のデータ洗い出し
        week_information = cache_manager_if.get_week_information()
        this_week = week_information['this_week']
        
        working_conditions_for_each_group = cache_manager_if.get_affiliation_pattern_times_dict(
            team_profiles['user_profile'], 
            team_profiles['profiles']
        )

        selected_conditions = [(k, v) for k, v in working_conditions_for_each_group.items() if k in [1,2,3,4,5]]
        
        common_data = hozen_common_data()
    
        weekly_dutys_cache_name = cache_manager_if.get_weekly_duties_cache(
            team_profiles['user_profile'].organization.organization,
            team_profiles['user_profile'].belongs.affilation
        )
        
        holiday_weekly_duties_cache = cache_manager_if.get_weekly_duties_cache(
            team_profiles['user_profile'].organization.organization,
            cache_manager_if.holiday_inf['name']
        )
        
        normal_weekday_plan = cache_manager.get(weekly_dutys_cache_name)
        holiday_weekday_plan = cache_manager.get(holiday_weekly_duties_cache)
        combined_duties = cache_manager_if.duties_combine(normal_weekday_plan, holiday_weekday_plan)

        weekly_duty_data = [duty for duty in combined_duties 
                            if (duty.status == '配布待ち') or ((duty.status == '遅れ') and (not duty.plan.plan_time))]
        
        unique_filters = {
            'line_names':Plan_tb.objects.values_list('inspection_no__control_no__line_name__line_name',
                                                     flat=True).distinct(),
            'machine_names':Plan_tb.objects.values_list('inspection_no__control_no__machine',
                                                         flat=True).distinct(),
            'hozen_date_alias': common_data['hozen_week'],
            'working_conditions_info': selected_conditions,
            'days_of_week': days_of_week,
            'today_weekday': days_of_week[datetime.today().weekday()],
            'time_zones': Plan_tb.objects.values_list('inspection_no__time_zone',
                                                      flat=True).distinct(),
        }
        
        return render(request, 
                      'calendar.html', 
                      {'plan_data': weekly_duty_data,
                       'members_with_profiles': team_profiles['profiles'],
                       'filters': unique_filters,
                       'this_week': this_week
                       })
    elif request.method == 'POST' and request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data, action, parse_error = extract_request_data(request)
        if parse_error:
            return handle_view_error(parse_error, status_code=400, message='Invalid JSON data')
        if action == "update_date_time":#配布用
            plan_id = data.get('plan_id')
            new_date = data.get('new_date')
            entry_member = data.get('member')
            _status = data.get('status')
            try:
                with transaction.atomic():
                    user_dict = profile(cache_manager_if, entry_member)
                    _plan = Plan_tb.objects.get(plan_id=plan_id)
                    _plan.holder = user_dict["user_profile"].user
                    if user_dict["leader_profile"] is None: 
                        leader_profile = assign_fallback_leader_if_missing(_plan, team_profiles)
                        _plan.approver = leader_profile.user
                    else:
                        _plan.approver = user_dict["leader_profile"].user
            
                    dt_object = datetime.fromisoformat(new_date.replace('Z', '+00:00'))
                    _plan.plan_time = dt_object
                    _plan.status = _status
                    _plan.save()
                   
                    _plan.weekly_duties.status = _status
                    _plan.weekly_duties.save()

                    cache_key = create_weekly_plan_cache_key(
                        organization_code, 
                        _plan.weekly_duties.affilation.affilation
                    )

                    cache_manager_if.update_weekly_duties_cache(cache_key, _plan.weekly_duties)
                    return JsonResponse({'status': 'success'})
            except Plan_tb.DoesNotExist as e:
                #Plan_tb.DoesNotExistエラーの場合
                return handle_view_error(e, status_code=404, message='Plan not found')
            except Exception as e:
                #その他の例外の場合
                return handle_view_error(e, status_code=500, message=str(e))
        elif action == "fetch_inspection_data":#点検カードのデータ取得
            inspection_no = data.get('inspection_no')
            try:
                records = Db_details_tb.objects.filter(inspection_no__inspection_no=inspection_no)
                if not records.exists():
                    e = Exception(f'No records found for provided inspection number: {inspection_no}')
                    return handle_view_error(e, status_code=404, message=f'No records found for the provided inspection number: {inspection_no}')
                records_json = serializers.serialize('json', records)
                return JsonResponse({'status': 'success', 'data': records_json})
            except ValidationError as e:
                return handle_view_error(e, status_code=400, message='Validation failed')
            except Exception as e:
                return handle_view_error(e)
        elif action == "calendar_open": #メンバー選択時
            try:
                login_number = data.get('member')
                user_dict = profile(cache_manager_if, login_number)
                current_data_infomation = cache_manager_if.get_affiliation_pattern_times_dict(user_dict['user_profile'])
                member_belong_id = user_dict['user_profile'].belongs_id
                member_shift_pattern = current_data_infomation[member_belong_id]
                #shift_start_time = member_shift_pattern.shift_start_time
                shift_start_time = member_shift_pattern.start_date_time
                member_name = user_dict['user_profile'].user
                
                personal_card_plans = WeeklyDuty.objects.filter(
                    Q(status='遅れ') | Q(status='実施待ち'),
                    plan__holder=member_name,
                ).select_related('plan__inspection_no')
                
                events_list = []
                for event in personal_card_plans:
                    man_hours = event.plan.inspection_no.man_hours
                    start_datetime = event.plan.plan_time
                    end_datetime = start_datetime + timedelta(minutes=man_hours)
                    events_list.append({
                        'id': event.plan.plan_id,
                        'title': event.plan.inspection_no.inspection_no,
                        'start': start_datetime.isoformat(),
                        'end': end_datetime.isoformat(),
                        'extendedProps': {
                            'title':event.plan.inspection_no.wark_name,
                            'machineName': event.plan.inspection_no.control_no.machine,
                            'man_hours': man_hours,
                            'dayOfWeek': event.plan.inspection_no.day_of_week,
                            'monthAndWeek': event.plan.p_date.date_alias,
                            'planStatus': event.status,
                            'inspectionNo':event.plan.inspection_no.inspection_no,
                        }
                    })
                return JsonResponse({'status': 'success', 'events': events_list, 'member_start_time': shift_start_time})
            except Member_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Member not found')
            except Calendar_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Calendar entry not found')
            except Exception as e:
                return handle_view_error(e)
        elif action == "fetch_registration":
            try:
                with transaction.atomic():
                    
                    member_id = data.get('member')
                    member_instance =  profile(cache_manager_if, member_id)
                    target_member = member_instance['user_profile']
                                 
                    registration_date = parse(data.get('dateStart')).date()
                    registration_date_after = registration_date + timedelta(days=1)
                    calendar_entries = cache_manager_if.fetch_calendar_entries(registration_date)
                    working_conditions_for_each_group = cache_manager_if.fetch_affilation_pattern_tims_dict(calendar_entries)
                    target_plans = WeeklyDuty.objects.filter(plan__plan_id__in=data.get('dataPlanIds'))
                    target_inf = working_conditions_for_each_group[target_member.belongs_id]
                    addDateToTime(target_inf, registration_date, registration_date_after)

                    work_schedule_entry_ins = WorkScheduleEntry(target_inf, 
                        member_instance, 
                        team_profiles, 
                        fallback_leader_handler=assign_fallback_leader_if_missing
                    )
                    work_schedule_entry_ins.set_time_frames()

                    member_plans = WeeklyDuty.objects.filter(
                        plan__holder=target_member.user,
                        plan__plan_time__gte=target_inf.shift_start_time,
                        plan__plan_time__lt=target_inf.shift_end_time
                    )
                    
                    work_schedule_entry_ins.initFrame(member_plans)
                    
                    registration_events = {
                        'plan_obj_list': [],
                        'plan_ids_list':  []
                    }
                    
                    work_schedule_entry_ins.set_busy_key_list('稼働中')
                    work_schedule_entry_ins.set_actual_time_frame()
                    registration_events = groupActualWorksByMachineBySave(target_plans, work_schedule_entry_ins, '稼動中', registration_events)            
                    
                    work_schedule_entry_ins.set_busy_key_list('停止中')
                    work_schedule_entry_ins.set_actual_time_frame()
                    registration_events = groupActualWorksByMachineBySave(target_plans, work_schedule_entry_ins, '停止中', registration_events)
                    
                    if registration_events['plan_obj_list']:
                        cache_key = create_weekly_plan_cache_key(
                            organization_code, 
                            registration_events['plan_obj_list'][0].affilation.affilation
                        )
                        
                        for card in registration_events['plan_obj_list']:
                            cache_manager_if.update_weekly_duties_cache(cache_key, card)
                    
                    return JsonResponse({'status': 'success', 'events': registration_events["plan_ids_list"]})
                
            except Member_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Member not found')
            except ShiftPattan_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Shift pattern not found')
            except ValueError as e:
                return handle_view_error(e, status_code=400, message='Invalid date format')
            except Exception as e:
                return handle_view_error(e)
        elif action == "fetch_pull-back":
            try:
                with transaction.atomic():
                    plan_id = data.get('planId')
                    _status = data.get('status')
                    plan = Plan_tb.objects.get(plan_id=plan_id)
                    plan.holder = None
                    plan.approver = None
                    plan.plan_time = None
                    plan.status = _status
                    plan.save()
                    
                    weekly_duty = WeeklyDuty.objects.get(plan=plan_id)
                    weekly_duty.status = _status
                    weekly_duty.save()
                    
                    cache_key = create_weekly_plan_cache_key(
                        organization_code, 
                        plan.weekly_duties.affilation.affilation
                    )
                    
                    update_weekly_duty = dutiesListSerialized(weekly_duty)
                    
                    cache_manager_if.update_weekly_duties_cache(cache_key, weekly_duty)
                return JsonResponse({
                    'status': 'success',
                    'update_weekly_duty': update_weekly_duty
                })
            except Plan_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Plan not found')
            except ValidationError as e:
                return handle_view_error(e, status_code=400, message='Data validation failed')
            except Exception as e:
                return handle_view_error(e)
            
    

@login_required
def card_view(request):
    cache_manager_if = request.cache_manager_if
    team_profiles = set_profiles_dict(request, cache_manager_if)
    organization_code = request.organization_code
    login_number = team_profiles['login_number']
    user_dict = profile(cache_manager_if, login_number)
    if request.method == 'POST' and request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data, action, parse_error = extract_request_data(request)
        if parse_error:
            return handle_view_error(parse_error, status_code=400, message='Invalid JSON data')
        if action == "fetch_post_form":
            try:
                form_data = data.get('form_data', {})
                plan_id = form_data.get('plan_id')
                plan_instance = Plan_tb.objects.get(plan_id=plan_id)
                practitioner_members_str = form_data.get('checkedCheckboxes', '[]')
                practitioner_members = json.loads(practitioner_members_str)
                form = CardForm(form_data)
                if form.is_valid():
                    today = datetime.today().date()
                    with transaction.atomic():
                        
                        Practitioner_tb.objects.filter(plan_id=plan_instance).delete()
                        plan_instance.applicant = user_dict['user_profile'].user
                        if user_dict["leader_profile"] is None:
                            leader_profile = assign_fallback_leader_if_missing(plan_instance, team_profiles)
                            plan_instance.approver = leader_profile.user
                        else:
                            plan_instance.approver = user_dict['leader_profile'].user
                        
                        practitioners_to_add = []
                        for member in practitioner_members:
                            user_obj = team_profiles['profiles'].get(user__name=member)
                            if user_obj:
                                practitioners_to_add.append(
                                    Practitioner_tb(plan_id=plan_instance, member_id=user_obj.user)
                                )
                        if practitioners_to_add:
                            Practitioner_tb.objects.bulk_create(practitioners_to_add)  
                                  
                        plan_instance.result = form.cleaned_data.get('options')                      
                        plan_instance.points_to_note = form.cleaned_data.get('issueDetails')
                        plan_instance.result_man_hours = form.cleaned_data.get('manhours')
                        plan_instance.implementation_date = today
                        plan_instance.status = '承認待ち'
                        plan_instance.comment = form.cleaned_data.get('comment')
                        
                        plan_instance.save()
                        
                        weekly_duty = WeeklyDuty.objects.get(plan=plan_instance)
                        weekly_duty.status = '承認待ち'
                        weekly_duty.save()

                        cache_key = create_weekly_plan_cache_key(
                            organization_code, 
                            plan_instance.weekly_duties.affilation.affilation
                        )
                        
                        cache_manager_if.update_weekly_duties_cache(cache_key, weekly_duty)
                        
                    return JsonResponse({'status': 'success', 'message': 'Plan updated successfully'})
                else:
                    return JsonResponse({'status': 'error', 'message': 'Form validation failed'}, status=400)
            except Plan_tb.DoesNotExist as e:
                return handle_view_error(e, plan_id=plan_id, message="指定されたPlanが見つかりません")
            except ValueError as e:
                return handle_view_error(e, message="無効な入力が検出されました。")
            except Exception as e:
                return handle_view_error(e)            
    else:     
        try:
            form = CardForm()
            plan_ids = request.GET.getlist('planId')
            plans = Plan_tb.objects.filter(plan_id__in=plan_ids)
            
            member_check_list = []
            team_profile = team_profiles['profiles']
            login_user = team_profiles['user_profile']
            
            for user_profile in team_profile:
                member_check_list.append({
                    'user_id': user_profile.user_id,
                    'checked': login_user.user_id == user_profile.user_id,
                })
                
            for plan in plans:
                #全てのメンバーのcheckedを初期値Falseとして設定
                updated_member_check_list = []
                if plan.result:
                    practitioner_members = Practitioner_tb.objects.filter(plan_id=plan.plan_id).values_list('member_id', flat=True)
                    for member in member_check_list:
                        updated_member_check_list.append({
                            'user_id': member['user_id'],
                            'checked': member['user_id'] in practitioner_members
                        })
                else:
                    updated_member_check_list = member_check_list
                check_objects = plan.inspection_no

                unique_devices = {}
                for detail in check_objects.db_details.all():
                    unique_devices = get_details(detail, unique_devices)
                plan.details_unique_devices = unique_devices
                plan.member_check_list = json.dumps(updated_member_check_list)
                
            context = {
                'plans': plans,
                'members': list(team_profile),
                'form': form
            }
            
            return render(request, 'card.html', context)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
        
@login_required
def workContents_view(request):
    cache_manager_if = request.cache_manager_if
    team_profiles = set_profiles_dict(request, cache_manager_if)
    organization_code = request.organization_code
    login_number = team_profiles['login_number']
    user_dict = profile(cache_manager_if, login_number)
    
    def update_plan(detail_obj, applicant_user, plan_list, weekly_duty_list, affiliation_dict):
        try:
            plan_id = detail_obj['planId']
            plan_status = detail_obj['planStatus']
            plan_comment = detail_obj['planComment']
            
            plan_instance = Plan_tb.objects.get(plan_id=plan_id)
            plan_instance.status = plan_status
            plan_instance.comment = plan_comment
            plan_instance.applicant = applicant_user
            
            plan_instance.weekly_duties.status = plan_status
            
            plan_list.append(plan_instance)
            weekly_duty_list.append(plan_instance.weekly_duties)
            
            affiliation_key = plan_instance.weekly_duties.affilation.affilation
            if affiliation_key not in affiliation_dict:
                affiliation_dict[affiliation_key] = []
            affiliation_dict[affiliation_key].append(plan_instance.weekly_duties)
            
            return plan_list, weekly_duty_list, affiliation_dict
        except KeyError as e:
            raise ValueError(f"Missing required field: {e}")
        

    if request.method != 'POST' or not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        
        applications_data = Plan_tb.objects.filter(
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
                      'workContents.html', 
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


        with transaction.atomic():
            applicant_user = user_dict['user_profile'].user
            update_plan_list = []
            update_weekly_duty_list = []
            affiliation_dict = {}
            if isinstance(detailObj, list):
                for item in detailObj:
                    update_plan_list, update_weekly_duty_list, unique_affiliations = update_plan(
                        item, 
                        applicant_user, 
                        update_plan_list, 
                        update_weekly_duty_list,
                        affiliation_dict
                    )
            else:
                update_plan_list, update_weekly_duty_list, unique_affiliations = update_plan(
                        detailObj, 
                        applicant_user, 
                        update_plan_list, 
                        update_weekly_duty_list,
                        affiliation_dict
                )
            
            if update_plan_list:
                plan_ids = []
                Plan_tb.objects.bulk_update(update_plan_list, ['status', 'applicant', 'comment'])
                WeeklyDuty.objects.bulk_update(update_weekly_duty_list, ['status'])
                for obj in update_plan_list:
                    plan_ids.append(obj.plan_id)
                    
                for affiliation,valueList in unique_affiliations.items():
                    cache_key = create_weekly_plan_cache_key(
                        organization_code, 
                        affiliation
                    )
                    
                    for value in valueList:
                        cache_manager_if.update_weekly_duties_cache(cache_key, value)
                        
        
            
        return JsonResponse({'status': 'success', 
                             'message': 'Plan updated successfuly', 
                             'planId': plan_ids,
                            })
        
    except (Plan_tb.DoesNotExist, ValueError, Exception) as e:
        return handle_view_error(e, message=f'Error processing request for plan_id: {str(e)}')


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
    cache_manager_if = request.cache_manager_if
    team_profiles = set_profiles_dict(request, cache_manager_if)
    organization_code = request.organization_code
    login_number = team_profiles['login_number']
    user_dict = profile(cache_manager_if, login_number)
    if request.method == 'GET':
        controls = Control_tb.objects.filter(
            line_name__organization__organization=organization_code
        )
        return render(request, 'inspectionStandards.html', {'controls': controls})
    elif request.method == 'POST' and request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data, action, parse_error = extract_request_data(request)
        if parse_error:
            return handle_view_error(parse_error, status_code=400, message='Invalid JSON data')
        if action == "get_details":
            filter_data = data.get('data')
            
            result_data = Control_tb.objects.filter(**filter_data)
            control_no = result_data[0].control_no
            details_queryset = Db_details_tb.objects.filter(
                inspection_no__control_no__control_no = control_no

            ).values(
                'inspection_no__inspection_no', 'inspection_no__wark_name', 'applicable_device',
                'method', 'contents', 'inspection_no__time_zone', 'standard', 'remarks'
            )
            
            sorted_details = sorted(details_queryset, key=lambda item: extract_number_from_key(item, 'inspection_no__inspection_no'))
            
            details_list = list(sorted_details)
            
            return JsonResponse({
                    'status': 'success',
                    'details': details_list
            })
@login_required
def achievements_view(request):
    cache_manager = request.cache_manager
    cache_manager_if = request.cache_manager_if
    team_profiles = set_profiles_dict(request, cache_manager_if)
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
            'plannedMaintenance.html'
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
    
    
        
        
        
        
    
def test_view(request):
    return render(request, 'test.html')

"""
def nika_app_view(request):
    logger.debug(f"🔍 request.COOKIES in nika_app_view: {request.COOKIES}")
    return render(request, 'index.html')
"""
@api_view(['GET'])
def get_employee(request):
    logger.debug(f"🔍 request.COOKIES in get_employee: {request.COOKIES}")
    logger.debug(f"🔍 Django 認証ユーザー: {request.user}")
    logger.debug(f"🔍 認証済みか？: {request.user.is_authenticated}")
    return JsonResponse({
        "user": str(request.user),
        "authenticated": request.user.is_authenticated
    })

    
    
    """
    employee = UserProfile.objects.get(user=request.user)
    serializer = UserProfileSerializer(employee)
    return Response(serializer.data)
    """