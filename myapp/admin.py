from django.contrib import admin
from .models import (
    Control_tb, Affilation_tb, Member_tb, UserProfile, 
    ShiftPattan_tb, Check_tb, Db_details_tb, Hozen_calendar_tb, 
    Plan_tb, WeeklyDuty, PlanApproval, Calendar_tb, Field_worker_tb, 
    Practitioner_tb, Shift_pattern_worker_view, Organization, Linename_tb, User
)
# Register your models here.
    
# Control_tb管理クラス
@admin.register(Control_tb)
class Control_tbAdmin(admin.ModelAdmin):
    list_display = ('id', 'control_no', 'line_name', 'machine', 'criterion_link')
    search_fields = ('control_no', 'machine')
    list_filter = ('line_name',)

# Affilation_tb管理クラス
@admin.register(Affilation_tb)
class Affilation_tbAdmin(admin.ModelAdmin):
    list_display = ('affilation_id', 'affilation')
    search_fields = ('affilation',)

# Member_tb管理クラス
@admin.register(Member_tb)
class Member_tbAdmin(admin.ModelAdmin):
    list_display = ('member_id', 'name', 'is_staff')
    search_fields = ('member_id', 'name')
    list_filter = ('is_staff',)

# UserProfile管理クラス
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'qualification', 'job_title', 'belongs', 'organization')
    search_fields = ('qualification', 'job_title')
    list_filter = ('belongs', 'organization')

# ShiftPattan_tb管理クラス
@admin.register(ShiftPattan_tb)
class ShiftPattan_tbAdmin(admin.ModelAdmin):
    list_display = ('pattern_id', 'pattern_name', 'start_time', 'end_time', 'lunch_time_start', 'lunch_time_end')
    search_fields = ('pattern_name',)
    list_filter = ('start_time', 'end_time')

# Check_tb管理クラス
@admin.register(Check_tb)
class Check_tbAdmin(admin.ModelAdmin):
    list_display = ('id', 'inspection_no', 'wark_name', 'man_hours', 'control_no', 'day_of_week', 'practitioner', 'time_zone')
    search_fields = ('inspection_no', 'wark_name')
    list_filter = ('day_of_week', 'time_zone')

# Db_details_tb管理クラス
@admin.register(Db_details_tb)
class Db_details_tbAdmin(admin.ModelAdmin):
    list_display = ('id', 'inspection_no', 'applicable_device', 'method', 'contents', 'standard', 'remarks', 'inspection_man_hours')
    search_fields = ('applicable_device', 'method', 'contents')
    list_filter = ('inspection_no',)

# Hozen_calendar_tb管理クラス
@admin.register(Hozen_calendar_tb)
class Hozen_calendar_tbAdmin(admin.ModelAdmin):
    list_display = ('h_id', 'h_date', 'h_month', 'h_week', 'date_alias')
    search_fields = ('h_date', 'date_alias')
    list_filter = ('h_month', 'h_week')

# Plan_tb管理クラス
@admin.register(Plan_tb)
class Plan_tbAdmin(admin.ModelAdmin):
    list_display = ('plan_id', 'inspection_no', 'p_date', 'plan_time', 'implementation_date', 'result', 'status', 'approver', 'holder', 'applicant')
    search_fields = ('result', 'status', 'comment')
    list_filter = ('status', 'p_date')

# WeeklyDuty管理クラス
@admin.register(WeeklyDuty)
class WeeklyDutyAdmin(admin.ModelAdmin):
    list_display = ('plan', 'affilation', 'status', 'this_week')
    search_fields = ('status',)
    list_filter = ('this_week',)

# PlanApproval管理クラス
@admin.register(PlanApproval)
class PlanApprovalAdmin(admin.ModelAdmin):
    list_display = ('plan', 'member', 'role')
    search_fields = ('role',)
    list_filter = ('role',)

# Calendar_tb管理クラス
@admin.register(Calendar_tb)
class Calendar_tbAdmin(admin.ModelAdmin):
    list_display = ('c_id', 'c_date', 'affilation', 'pattern')
    search_fields = ('c_id',)
    list_filter = ('affilation', 'pattern')

# Field_worker_tb管理クラス
@admin.register(Field_worker_tb)
class Field_worker_tbAdmin(admin.ModelAdmin):
    list_display = ('pattern_id', 'pattern_name', 'start_time', 'end_time', 'lunch_break_start', 'lunch_break_end')
    search_fields = ('pattern_name',)
    list_filter = ('start_time', 'end_time')

# Practitioner_tb管理クラス
@admin.register(Practitioner_tb)
class Practitioner_tbAdmin(admin.ModelAdmin):
    list_display = ('id', 'plan_id', 'member_id')
    search_fields = ('plan_id', 'member_id')

# Shift_pattern_worker_view管理クラス
@admin.register(Shift_pattern_worker_view)
class ShiftPatternWorkerViewAdmin(admin.ModelAdmin):
    list_display = ('shift_pattern_name', 'shift_start_time', 'shift_end_time', 'hot_time_start_a', 'hot_time_end_a')
    search_fields = ('shift_pattern_name',)
    list_filter = ('shift_start_time', 'shift_end_time')

# Organization管理クラス
@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ('id', 'organization', 'organization_name')
    search_fields = ('organization', 'organization_name')

# Linename_tb管理クラス
@admin.register(Linename_tb)
class Linename_tbAdmin(admin.ModelAdmin):
    list_display = ('id', 'line_name', 'organization')
    search_fields = ('line_name',)
    list_filter = ('organization',)

# User管理クラス
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('id', 'login_number')
    search_fields = ('login_number',)