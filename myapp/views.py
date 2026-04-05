from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpRequest, HttpResponseBadRequest, QueryDict, HttpResponse
from django.core import serializers
from django.core.exceptions import ValidationError, ObjectDoesNotExist
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Sum, Prefetch, Count, F, QuerySet, Min, Max, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db import transaction
from datetime import datetime, timedelta, time as dt_time, date
from .backends import MemberAuthenticationBackend
from .models import (
    Control_tb, Member_tb, Plan_tb, Db_details_tb, Calendar_tb, Check_tb,
    ShiftPattan_tb, Practitioner_tb, UserProfile, WeeklyDuty, Hozen_calendar_tb,
    DayOfWeek, PlanStatus
)
from django.views.decorators.cache import never_cache
from .filters_maps import get_field_map, get_status_map, get_op_map, get_negated_ops
from .services.query_builders import (
    build_q_from_simple_params,
    build_q_from_filters,
)

from collections import defaultdict
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes

#from .models import SHIFTPATTERN_WORKER_VIEW
from .workScheduleEntry import WorkScheduleEntry
from .decorators import ajax_login_required
from .forms import LoginForm , CardForm
from dateutil import parser as dparser
from zoneinfo import ZoneInfo
import json
import pytz
import itertools
import logging
import calendar
import logging
import csv
from typing import Optional, Dict, List, Sequence, Iterable, Union, Callable, Any, Tuple

from myapp.selectors.plan import (
    plan_base_qs, 
    filter_this_week_plans, 
    filter_status_plans, 
    filter_this_week_plan_time_plans
)

from myapp.selectors.calendar import (
    annotate_plan_affiliation_from_calendar
)


from myapp.selectors.members import (
    select_members_by_affiliation_id,
)

from myapp.domain.sort_keys.inspection_no import inspection_no_sort_key
from myapp.domain.checks.constants import NON_ACTIVE_CHECK_STATUSES
from myapp.domain.sort_keys.member_sort import build_member_dict

from myapp.services.member_profile_service import build_members_with_profiles



def download_test_csv(request):
    # 1) Content-Type（CSV）
    response = HttpResponse(content_type="text/csv; charset=utf-8")

    # 2) Content-Disposition（添付ファイルとして扱わせる＝ダウンロード）
    response["Content-Disposition"] = 'attachment; filename="test.csv"'

    # 3) Excelで文字化けしにくいようにBOM付与（任意だけど日本語ならほぼ必須）
    response.write("\ufeff")

    # 4) CSV本体（中身は何でもOK）
    writer = csv.writer(response)
    writer.writerow(["col1", "col2", "col3"])
    writer.writerow(["あ", "い", "う"])
    writer.writerow(["1", "2", "3"])

    return response

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

REMAINING_STATUSES = [STATUS_WAITING, STATUS_PENDING, STATUS_APPROVAL, STATUS_DELAYED]

# =========================
# 共通ヘルパー
# =========================
STATUS_MAP = {
    "waiting":  STATUS_WAITING,
    "pending":  STATUS_PENDING,
    "approval": STATUS_APPROVAL,
    "delayed":  STATUS_DELAYED,
    "done":     STATUS_DONE,
    "rejected": STATUS_REJECTED,
}

def status_annotations(
    status_field: str = "status",
    id_field: str = "id",
    include_remaining: bool = True,
    include_total: bool = True,
):
    """
    ステータス別の Count 式を dict で返す。
    aggregate()/annotate() のどちらにも **展開して** 渡せる。
    """
    expr = {
        key: Count(id_field, filter=Q(**{status_field: value}))
        for key, value in STATUS_MAP.items()
    }
    if include_remaining:
        expr["remaining"] = Count(id_field, filter=Q(**{f"{status_field}__in": REMAINING_STATUSES}))
    if include_total:
        expr["total"] = Count(id_field)
    return expr

def _aggregate_status_counts(qs):
    """単一の QuerySet をステータス別に集計して dict で返す"""
    return qs.aggregate(**status_annotations(status_field="status", id_field="plan_id"))

def _holders_breakdown(qs):
    """
    qsをplan.holder単位で集計してリスト返却。
    (NULL holder も1バケット/ラベルは「未割当」)
    """
    agg = (
        qs.values("holder_id", "holder__name")
          .annotate(**status_annotations(status_field="status", id_field="plan_id"))
          .order_by(
              F("remaining").desc(),
              F("holder__name").asc(nulls_last=True),
          )
    )
    return [
        {
            "holder_id":   row["holder_id"],
            "holder_name": row["holder__name"] or "未割当",
            "waiting":     row["waiting"],
            "pending":     row["pending"],
            "approval":    row["approval"],
            "delayed":     row["delayed"],
            "done":        row["done"],
            "rejected":    row["rejected"],
            "remaining":   row["remaining"],
            "total":       row["total"],
        }
        for row in agg
    ]

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
    

@login_required
def api_user_change(request):    
    try:
        cache_manager_if = request.cache_manager_if
        qs = request.GET
        holder_id = _get_param(qs, "holder_id", str, default=None)
        affilation_id = _get_param(qs, "affilation_id", str, default=None)
        status_key = _get_param(qs, "status", str, default=None)
        

    except Exception:
        return JsonResponse({"status": "error", "message": "Invalid query parameters."}, status=400)
        
    affiliation_pattern_times_dict, team_profiles = set_profiles_dict(request, cache_manager_if)
    
    plan_base = plan_base_qs()
            
    member_map = extract_team_member_map(team_profiles, affilation_id)
    team_holder_scope = _team_holder_scope(plan_base, affilation_id, member_map)
    
    # --- 外側ドーナツ集計 ---
    summary = team_holder_scope.aggregate(
        **status_annotations(status_field="status", id_field="plan_id")
    )
    #-----
    
    # --- 内側ドーナツ集計 ---
    holders_summary = _holders_breakdown(team_holder_scope)
    #-----
            
        
    plan_base_team = team_holder_scope
    
    
    # --- 今週の進捗 ---
    plan_week = filter_this_week_plan_time_plans(plan_base_team)

    group_all = _aggregate_status_counts(plan_base_team)
    group_week = _aggregate_status_counts(plan_week)
    
    if holder_id:
        me_qs   = plan_base.filter(holder=holder_id)
        me_all = _aggregate_status_counts(me_qs)
        me_all["waiting"] = group_week["waiting"]
        me_week = plan_week.filter(holder=holder_id)
        me_week = _aggregate_status_counts(me_week)
    else:
        me_qs = None
        me_week = None
        me_all = None
        
    personal_progress = {
        "group_this_week": group_week, 
        "group_this_all": group_all,
        "me_this_all": me_all
    }
    #-----
    
    
    return JsonResponse({
        "status": "success",
        "summary": summary,
        "holders_summary": holders_summary,
        "progress": personal_progress,
        "team_member_map": member_map,
        "meta": {"affilation_id": affilation_id},
    })

    
def _get_param(
    qs: QueryDict,
    name: str,
    cast: Optional[Callable[[str], Any]] = None,
    default: Any = None,
    allow_blank: bool = False
) -> Any:
    """
    QueryDict から name を取得し、必要なら型変換。
    空文字は None or default へ落とす（allow_blank=True の場合は空文字を許容）
    """
    raw = qs.get(name, None)
    if raw is None:
        return default
    raw = raw.strip()
    if raw == "" and not allow_blank:
        return default
    if cast:
        try:
            return cast(raw)
        except Exception:
            # キャスト失敗時は例外化して上位で 400 を返却
            raise ValueError(f"Invalid value for '{name}': {raw}")
    return raw

def apply_plan_filters(
    qs: QuerySet,
    *,
    holder_id: Optional[str] = None,
    affilation_id: Optional[str] = None,
    this_week_flag: Optional[str] = None,
) -> QuerySet:
    cond = Q()

    if holder_id:
        cond &= Q(holder_id=holder_id)

    if affilation_id:
        cond &= Q(approver__profile__belongs_id=affilation_id)

    qs = qs.filter(cond)

    if this_week_flag == "1":
        qs = filter_this_week_plans(qs)
    elif this_week_flag == "0":
        this_week_qs = filter_this_week_plans(qs)
        qs = qs.exclude(plan_id__in=this_week_qs.values("plan_id"))

    return qs


@login_required
def api_wd_rows(request):
    """
    WeeklyDuty の行データを返す API（テーブル用）
    クエリ:
      - status:        英語キー（waiting/approval/delayed/rejected/...）
      - holder_id:     個人絞り込み（Member_tb.member_id）※未指定なら班や全体での取得が可能
      - affilation_id: 班（Affilation_tb.affilation_id）での絞り込み
      - this_week:     "1" or "0"（今週フラグ）
      - limit/offset:  ページング（任意）
    戻り:
      { status:"success", rows:[...], count:<int> }
    """
    try:
        qs = request.GET
        holder_id = _get_param(qs, "holder_id", str, default=None)
        status_key = _get_param(qs, "status", str, default=None)
        affilation_id = _get_param(qs, "affilation_id", str, default=None)
        this_week_flag = _get_param(qs, "this_week", str, default=None)
        
        
    except Exception:
        return JsonResponse({"status": "error", "message": "Invalid query parameters."}, status=400)
    
    status_keys = request.GET.getlist("status")
    
    if not status_keys:
        return JsonResponse({"status": "error", "message": "status is required."}, status=400)
    
    unknown = [k for k in status_keys if k not in STATUS_MAP]
    if unknown:
        return JsonResponse({"status": "error", "message": f"Unknown status: {unknown}"}, status=400)

    jp_statuses = [STATUS_MAP[k] for k in status_keys]
    
    jp_status = STATUS_MAP.get(status_key)
    if not jp_status:
        return JsonResponse({"status": "error", "message": f"Unknown status '{status_key}'."}, status=400)

    qs = plan_base_qs()
    qs = apply_plan_filters(
        qs,
        holder_id=holder_id,
        affilation_id=affilation_id,
        this_week_flag=this_week_flag,
    )

    qs = (
        qs.filter(status__in=jp_statuses)
        .order_by("plan_time", "inspection_no__inspection_no")
        .prefetch_related("practitioners__member_id")
    )
    
    rows = _serialize_plan_rows(qs)
    return JsonResponse({"status": "success", "rows": rows})



def api_plans(request):
    field_map = get_field_map("plan")
    status_map = get_status_map('plan')
    op_map = get_op_map()
    negated_ops = get_negated_ops()
    
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

# ---------------------------
# API: グループスケジュール取得
# ---------------------------
@login_required
def api_group_schedule(request):
    """
    グループスケジュール（team_holder_scope）を「今日±days日」の plan_time で返す。
    クエリ:
      - days: 整数（デフォルト 1）… 今日±days（例: 1 → 前日〜翌日）
      - center_date: YYYY-MM-DD（省略時は今日）
    戻り:
      { status:"success", rows:[...], window:{start:str, end:str} }
    """
    affilation_id = (request.GET.get("affiliation_id") or "")

    days_str = (request.GET.get("days") or "").strip()
    try:
        days = int(days_str) if days_str else 1
    except ValueError:
        days = 1
    # 過度な範囲を防ぐ（必要なら調整）
    days = max(0, min(days, 7))

    center_str = (request.GET.get("center_date") or "").strip()
    if center_str:
        try:
            center_date = datetime.strptime(center_str, "%Y-%m-%d").date()
        except ValueError:
            center_date = date.today()
    else:
        center_date = date.today()

    start_date = center_date - timedelta(days=days)
    end_date_exclusive = center_date + timedelta(days=days + 1)

    start_dt = datetime.combine(start_date, dt_time.min)
    end_dt   = datetime.combine(end_date_exclusive, dt_time.min)
    
    plan_base = plan_base_qs()
    
    
    
    affilation_member = select_members_by_affiliation_id(affilation_id)
    
    sort_affilation_member = build_member_dict(affilation_member)
            
    #member_map = extract_team_member_map(team_profiles, affilation_id)
    
    scope = _team_holder_scope(plan_base, affilation_id, sort_affilation_member)


    # 期間で絞り込み（plan_time があるものだけ）
    qs = (
        scope
        .filter(
            plan_time__gte=start_dt,
            plan_time__lt=end_dt,
            plan_time__isnull=False,
            status__in=[PlanStatus.IN_PROGRESS, PlanStatus.DELAYED],
        )
        .order_by("holder__name", "plan_time", "inspection_no__inspection_no")
    )

    # 既存の行シリアライザを再利用（テーブルと同じ形式で返す）
    rows = _serialize_plan_rows(qs)

    return JsonResponse({
        "status": "success",
        "rows": rows,
        "member": sort_affilation_member,
        "window": {"start": start_dt.isoformat(), "end": end_dt.isoformat()},
    })
    
    
# ---------------------------
# Team_profiles['profiles'] から {member_id: member_name} をユニーク順序で抽出。
# ---------------------------
def extract_team_member_map(team_profiles, affiliation_id: int) -> Dict[str, str]:
    """
    team_profiles['profiles'] から {member_id: member_name} をユニーク順序で抽出。
    """
    profiles = team_profiles.get("profiles", [])
    profiles = profiles.filter(belongs_id=affiliation_id)
    seen: Dict[str, str] = {}
    for p in profiles:
        u = getattr(p, "user", None)
        if not u:
            continue
        mid  = getattr(u, "member_id", None)
        name = getattr(u, "name", None)
        if mid:
            key = str(mid)
            if key not in seen:
                seen[key] = name or ""
    return seen

# 既存 team_holder_scope は IDs を受ける想定のままでOK

def _team_holder_scope(qs, affilation_id: int, member_ids):
    return qs.filter(
        Q(approver__profile__belongs_id=affilation_id) |
        (
            Q(holder_id__in=member_ids) &
            ~Q(approver__profile__belongs_id=affilation_id)
        )
    )
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
def home_view(request):
    cache_manager = request.cache_manager
    cache_manager_if = request.cache_manager_if
    organization_code = request.organization_code
    if request.method == 'GET':
        try:
            affiliation_pattern_times_dict, team_profiles = set_profiles_dict(request, cache_manager_if)
            
            # ログインユーザー（Member_tb）
            default_user = team_profiles['user_profile'].user
            
            #グループ
            affilation_id = team_profiles['user_profile'].belongs_id
            
            plan_base = plan_base_qs()
            
            member_map = extract_team_member_map(team_profiles, affilation_id)
            team_holder_scope = _team_holder_scope(plan_base, affilation_id, member_map)
            

            summary = team_holder_scope.aggregate(
                **status_annotations(status_field="status", id_field="plan_id")
            )
            
            holders_summary = _holders_breakdown(team_holder_scope)
            
            
            plan_base_team = team_holder_scope
            plan_week = filter_this_week_plan_time_plans(plan_base_team)

            group_all = _aggregate_status_counts(plan_base_team)
            group_week = _aggregate_status_counts(plan_week)

            me_qs = plan_base.filter(holder=default_user)
            me_all = _aggregate_status_counts(me_qs)

            personal_progress = {
                "group_this_week": group_week,
                "group_this_all": group_all,
                "me_this_all": me_all,
            }
            
            # --- 最初にテーブルに表示する行 ---
            initial_rows = _serialize_plan_rows(
                me_qs.filter(status=STATUS_PENDING)
                    .order_by("plan_time","inspection_no__inspection_no")
            )
            #-----
            
            context = {
                "team_profiles": team_profiles['profiles'],
                "summary": summary,
                "holder_summary": holders_summary,
                "personal_progress": personal_progress,
                "initial_rows": initial_rows,
                "team_member_map": member_map,
                "meta": {"affilation_id": affilation_id},
            }
            return render(request, "home/home.html", context)
        except UserProfile.DoesNotExist:
            return handle_view_error(UserProfile.DoesNotExist(), status_code=404, message='User profile not found')
        except Exception as e:
            print("Error:", e)
            return handle_view_error(e)
        

#@login_required
@ajax_login_required
def calendar_view(request):
    cache_manager = request.cache_manager
    cache_manager_if = request.cache_manager_if

    team_label = ['A班', 'B班', 'C班']
    affiliation_pattern_times_dict, team_profiles = set_profiles_dict(request, cache_manager_if)

    login_number = team_profiles['login_number']
    user_dict = profile(cache_manager_if, login_number)
    now_datetime = datetime.now()
    today_idx = now_datetime.weekday()  # 0=Mon ... 6=Sun
    
    if request.method == 'GET':
        
        profiles_qs = team_profiles['profiles']
        members_with_profiles = build_members_with_profiles(profiles_qs)
        team_shifts = {}
        for p in profiles_qs:
            if p.user_id == login_number:
                login_user_shift_pattern = p.shift_pattern_name
                login_user_sfhit_start = p.shift_start_time
                login_user_sfhit_end = p.shift_end_time
    

        for k, v in sorted(affiliation_pattern_times_dict.items(), key=lambda x: x[0]):
            key = v.affiliation
            cur = team_shifts.get(key)
            if cur is None and key in team_label:
                team_shifts[key] = {
                    'affilation': key,
                    'affilation_id': k,
                    'shift_pattern': v.shift_pattern_name
                }
        team_shifts['休日'] = {
            'affilation': '休日',
            'affilation_id': 7,
            'shift_pattern': '休日'
        }

              
        base_qs  = plan_base_qs()
        #今週のデータ洗い出し
        this_week_plans   = filter_this_week_plans(base_qs)
        all_this_week_waiting_plans  = filter_status_plans(
            this_week_plans,
            statuses=[PlanStatus.WAITING],
        )
        
        this_week_waiting_plans = all_this_week_waiting_plans.order_by(
            "p_date__h_date",
            "plan_id",
        )
        
        this_week_waiting_plans = annotate_plan_affiliation_from_calendar(
            all_this_week_waiting_plans
        )

        
        plan_ids = list(
            this_week_waiting_plans.values_list('plan_id', flat=True)
        )

        data_alias = Hozen_calendar_tb.objects.get(h_date=now_datetime.date()).date_alias
        
        raw_team = user_dict['user_profile'].belongs.affilation
        selected_team = raw_team if raw_team in team_label else ""
        
        selected_dow = today_idx
        
        if (
            login_user_shift_pattern == '3直'
            and now_datetime.date() == login_user_sfhit_end.date()
        ):
           selected_dow = (today_idx - 1) % 7
            
        hozen_week_names = hozen_common_data()

        selected = {
            'team_name': selected_team,
            'data_alias': data_alias,
            'day_of_week': selected_dow
        }
        
        
        unique_filters = {
            'members_with_profiles': members_with_profiles,
            'hozen_week_names': hozen_week_names,
            'team_shifts': team_shifts,
            'selected': selected
        }
        
        return render(request, 
                      'calendar/calendar.html', 
                      {'plan_data': this_week_waiting_plans,
                       'filters': unique_filters,
                       'ssr_planId_list': plan_ids
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
            
            if not plan_id or not new_date or not entry_member or not _status:
                return JsonResponse({'status': 'error', 'message': 'missing required fields'}, status=400)
            
            try:
                with transaction.atomic():
                    enrty_user_dict = profile(cache_manager_if, entry_member)
                    
                    plan = plan_base_qs().get(plan_id=plan_id)
                    
                    plan.holder = enrty_user_dict["user_profile"].user
                    check = plan.inspection_no
                    
                    cal = (
                        Calendar_tb.objects
                        .select_related("affilation")
                        .filter(
                            c_date_id=plan.p_date_id,
                            pattern_id=check.practitioner_id,
                        )
                        .values("affilation_id")
                        .first()
                    )
                    
                    if not cal:
                        return JsonResponse({'status': 'error', 'message': 'calendar not found'}, status=404)

                    leader_profile = (
                        UserProfile.objects
                        .select_related("user")
                        .filter(belongs_id=cal["affilation_id"], job_title='班長')
                        .first()
                    )
                    
                    # leader_profile がいない場合のフォールバック
                    if leader_profile is None:
                        leader_profile = enrty_user_dict.get("leader_profile")

                    if leader_profile is None:
                        return JsonResponse({'status': 'error', 'message': 'leader not found'}, status=404)
                    
                    plan.approver = leader_profile.user
                    
                    dt_object = datetime.fromisoformat(new_date)  # ここが落ちるなら parse_datetime を検討
                    plan.plan_time = dt_object
                    plan.status = _status
                    plan.save()

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
                member_belong_id = user_dict['user_profile'].belongs_id
                member_shift_pattern = affiliation_pattern_times_dict[member_belong_id]
                        
                shift_start_time = member_shift_pattern.start_date_time
                member_name = user_dict['user_profile'].user
                
                base_qs = plan_base_qs()
                
                personal_card_plans = (
                    base_qs
                    .filter(
                        status__in=[PlanStatus.DELAYED, PlanStatus.IN_PROGRESS],
                        holder=member_name,
                    )
                )
                events_list = []
                for event in personal_card_plans:
                    man_hours = event.inspection_no.man_hours
                    start_datetime = event.plan_time
                    end_datetime = start_datetime + timedelta(minutes=man_hours)
                    events_list.append({
                        'id': event.plan_id,
                        'title': event.inspection_no.inspection_no,
                        'start': start_datetime.isoformat(),
                        'end': end_datetime.isoformat(),
                        'extendedProps': {
                            'title':event.inspection_no.wark_name,
                            'machineName': event.inspection_no.control_no.machine,
                            'man_hours': man_hours,
                            'dayOfWeek': event.inspection_no.get_day_of_week_display(),
                            'monthAndWeek': event.p_date.date_alias,
                            'planStatus': event.status,
                            'inspectionNo':event.inspection_no.inspection_no,
                            'weekOfDay': event.p_date.h_day_of_week
                        }
                    })
                return JsonResponse({'status': 'success', 'events': events_list, 'member_start_time': shift_start_time})
            except Member_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Member not found')
            except Calendar_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Calendar entry not found')
            except Exception as e:
                return handle_view_error(e)
        
        elif action == "fetch_registration":#一括登録
            try:
                with transaction.atomic():
                    member_id = data.get('member')
                    member_instance =  profile(cache_manager_if, member_id)
                    target_member = member_instance['user_profile']
                                 
                    #registration_date = parse(data.get('dateStart')).date()
                    registration_date = datetime.fromisoformat(data.get('dateStart'))
                    registration_end_date = datetime.fromisoformat(data.get('dateEnd'))                
                    registration_date_after = registration_date + timedelta(days=1)
                    
                    
                    calendar_entries = cache_manager_if.fetch_calendar_entries(registration_date)
                    affiliation_pattern_times_dict = cache_manager_if.fetch_affilation_pattern_tims_dict(calendar_entries)
                    target_inf = affiliation_pattern_times_dict[target_member.belongs_id]
                    
                    
                    leader_profile = user_dict["leader_profile"].user

                    work_schedule_entry_ins = WorkScheduleEntry(target_inf, 
                        member_instance, 
                        team_profiles, 
                        fallback_leader_handler=leader_profile
                    )

                    
                    work_schedule_entry_ins.set_time_frames(
                        registration_date=registration_date,
                        registration_end_date=registration_end_date
                    )
            
                    #work_schedule_entry_ins.change_time_frames(registration_date, registration_end_date)
                    
                    data_plan_ids = data.get('dataPlanIds') or []
                    target_plans = plan_base_qs().filter(plan_id__in=data_plan_ids)
                    
                    
                    member_plans_qs = (
                        plan_base_qs()
                        .filter(
                            holder=target_member.user,
                            plan_time__lt=registration_end_date,
                        )
                        .exclude(status__in=[PlanStatus.COMPLETED, PlanStatus.APPROVAL_WAITING])
                    )
                    
                    member_plans = []
                    for plan in member_plans_qs:
                        man_hours = plan.inspection_no.man_hours or 0
                        plan_start = plan.plan_time
                        plan_end = plan_start + timedelta(minutes=man_hours)

                        if plan_end > registration_date:
                            member_plans.append(plan)
                    
                
                    
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
                    
                    plan_ids_list = list(dict.fromkeys(registration_events['plan_ids_list']))  # 重複除去し順序維持
                    if plan_ids_list:
                        agg = (
                            Plan_tb.objects
                            .filter(plan_id__in=plan_ids_list)
                            .select_related('inspection_no')
                            .aggregate(
                                count=Count('plan_id'),
                                man_hours=Coalesce(Sum('inspection_no__man_hours'), 0),
                            )
                        )
                        count_val = agg['count'] or 0
                        man_hours_sum = agg['man_hours'] or 0
                    else:
                        count_val = 0
                        man_hours_sum = 0
                        
                    return JsonResponse({
                        'status': 'success', 
                        'events': {
                            'plan_ids_list': plan_ids_list,
                            'count': count_val,
                            'man_hours': man_hours_sum,
                        }
                    })
                
            except Member_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Member not found')
            except ShiftPattan_tb.DoesNotExist as e:
                return handle_view_error(e, status_code=404, message='Shift pattern not found')
            except ValueError as e:
                return handle_view_error(e, status_code=400, message='Invalid date format')
            except Exception as e:
                return handle_view_error(e)  

@login_required
def card_view(request):
    cache_manager_if = request.cache_manager_if
    affiliation_pattern_times_dict, team_profiles = set_profiles_dict(request, cache_manager_if)
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
                if not plan_id:
                    return JsonResponse({'status': 'error', 'message': 'plan_id がありません'}, status=400)
                plan_instance = Plan_tb.objects.get(plan_id=plan_id)
                practitioner_members_str = form_data.get('checkedCheckboxes', '[]')
                practitioner_members = json.loads(practitioner_members_str)
                form = CardForm(form_data)
                if form.is_valid():
                    with transaction.atomic():
                        Practitioner_tb.objects.filter(plan_id=plan_instance).delete()
                        plan_instance.applicant = user_dict['user_profile'].user
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
                        plan_instance.status = '承認待ち'
                        plan_instance.comment = form.cleaned_data.get('comment')
                        dt_str = form_data.get("datetime")
                        dt = parse_datetime(dt_str)
                        if dt is None:
                            form.add_error(None, "日時の形式が正しくありません。")
                            return JsonResponse({'status': 'error', 'message': '日時の形式が正しくありません。'}, status=400)
                        
                        plan_instance.implementation_date = dt
                        
                        plan_instance.save()
                    
                    return JsonResponse({'status': 'success', 'message': 'Plan updated successfully'})
                else:
                    return JsonResponse({
                        'status': 'error',
                        'message': 'Form validation failed',
                        'errors': form.errors,   # フロントで使いたいなら
                    }, status=400)
        
            except Plan_tb.DoesNotExist as e:
                return handle_view_error(e, plan_id=plan_id, message="指定されたPlanが見つかりません")
            except ValueError as e:
                return handle_view_error({'status': 'error', 'message': f'ValueError: {str(e)}'}, status=400)
            except Exception as e:
                return handle_view_error(e)            
    else:     
        try:
            form = CardForm()
            filterLabel = request.GET.get('filterLabel')
            plan_base = plan_base_qs()
            if filterLabel == 'getOne':
                _plan_id = request.GET.getlist('planId')
                plan_filtered = plan_base.filter(plan_id__in=_plan_id)
            elif filterLabel == 'userOnly':
                _holder_id = request.GET.get('holderId')
                _this_week = request.GET.get('thisWeek')
                _status = request.GET.get('status')
                plan_filtered = plan_base.filter(
                    holder_id=_holder_id,
                    status=_status
                )
            
            plans_qs = (
                plan_filtered
                .prefetch_related(
                    Prefetch(
                        'inspection_no__db_details',
                        queryset=Db_details_tb.objects.exclude(
                            status__in=NON_ACTIVE_CHECK_STATUSES
                        ).only(
                            'id',
                            'inspection_no_id',
                            'applicable_device',
                            'contents',
                            'standard',
                            'method',
                        ).order_by('id'),
                        to_attr='prefetched_details',
                    ),
                    Prefetch(
                        'practitioners',
                        queryset=Practitioner_tb.objects.select_related('member_id').only(
                            'id',
                            'plan_id_id',
                            'member_id__member_id',
                            'member_id__name'
                        ),
                        to_attr='prefetched_practitioners',
                    ),
                )
            )

            plans_qs = plans_qs[:300]
            
            member_check_list = []
            team_profile = team_profiles['profiles']
            login_user = team_profiles['user_profile']
            for u in team_profile:
                member_check_list.append({
                    'user_id': u.user_id,
                    'checked': login_user.user_id == u.user_id,
                })

                
            for plan in plans_qs:                
                practiced_ids = set()

                if plan.result:
                    practitioners = getattr(plan, 'prefetched_practitioners', [])
                    practiced_ids = {p.member_id_id for p in practitioners}

                    updated_member_check_list = [
                        {'user_id': m['user_id'], 'checked': (m['user_id'] in practiced_ids)}
                        for m in member_check_list
                    ]
                

                else:
                    updated_member_check_list = member_check_list
                
                unique_devices = {}
                for d in getattr(plan.inspection_no, 'prefetched_details', []):
                    unique_devices = get_details(d, unique_devices)

                plan.details_unique_devices = unique_devices
                plan.member_check_list = json.dumps(updated_member_check_list)

                
            context = {
                'plans': plans_qs,
                'members': list(team_profile),
                'form': form
            }
            
            return render(request, 'card/card.html', context)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
        
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
    cache_manager_if = request.cache_manager_if
    affiliation_pattern_times_dict, team_profiles = set_profiles_dict(request, cache_manager_if)
    organization_code = request.organization_code
    login_number = team_profiles['login_number']
    user_dict = profile(cache_manager_if, login_number)
    if request.method == 'GET':
        controls = Control_tb.objects.filter(
            line_name__organization__organization=organization_code
        )
        return render(request, 'inspectionStandards/inspectionStandards.html', {'controls': controls})
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
            
            sorted_details = sorted(
                details_queryset,
                key=lambda item: inspection_no_sort_key(item.get('inspection_no__inspection_no'))
            )
            details_list = list(sorted_details)
            
            return JsonResponse({
                    'status': 'success',
                    'details': details_list
            })
            
@login_required
def inspectionHistory_view(request):
    qs = request.GET
    inspection_no = _get_param(qs, "inspectionNo", str, default=None)
    if not inspection_no:
        return HttpResponseBadRequest("inspectionNo is required")

    pract_qs = (
        Practitioner_tb.objects
        .select_related('member_id')
        .only("member_id__name")
    )
        
    plans_qs  = (
        Plan_tb.objects
        .select_related('inspection_no__control_no', 'approver')
        .prefetch_related(Prefetch('practitioners', queryset=pract_qs,  to_attr="prefetched_practitioners"))
        .filter(
            inspection_no__inspection_no=inspection_no,
            implementation_date__isnull=False,
        )
        .order_by('-implementation_date', '-plan_id')
    )
    first_plan = plans_qs.first()
    if not first_plan:
        return render(request, "inspectionHistory.html", {
            "results": [],
            "control_name": "",
            "inspection_no": inspection_no,
        })
        
    control_name = getattr(first_plan.inspection_no.control_no, "machine", "")
    wark_name = getattr(first_plan.inspection_no, "wark_name", "")
    results = []
    for p in plans_qs:
        practitioner_names = [
            pr.member_id.name
            for pr in getattr(p, "prefetched_practitioners", [])
            if getattr(pr, 'member_id', None)
        ]
            
            
        results.append({
            'implementation_date': p.implementation_date,
            'resultManHour': p.result_man_hours,
            'result': p.result,
            'points_to_note': p.points_to_note,
            'practitioner': practitioner_names,
            'approver': getattr(p.approver, 'name', '')
        })
    return render(request, 
                  'inspectionHistory.html', 
                  {'results': results,
                   'control_name': control_name,
                   'wark_name': wark_name,
                   'inspection_no': inspection_no
                })
    
    
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
    return render(request, 'schedule/schedule.html')     

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
