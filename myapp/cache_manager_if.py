from .models import WeeklyDuty
from datetime import datetime, timedelta
from django.shortcuts import get_object_or_404
from django.db.models.functions import Concat

class CacheManagerIF:
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, cache_manager=None):
        if not self._initialized:
            #self.request = request
            #self.cache_manager = request.cache_manager
            self.cache_manager = cache_manager
            self._get_middlewares()
            self._initialize_cache_attributes()
            self._initialized = True
        
    def _get_middlewares(self):
        cache_dict = {}
        for cache_key, model_config in self.cache_manager.models_to_cache.items():
            cache_config = self.cache_manager.get_models_to_cache_config(cache_key)
            cache_dict[cache_key] = self.cache_manager.get(cache_config['cache_key'])
            if cache_dict[cache_key] is None:
                cache_dict[cache_key] = self.cache_manager.set_model(cache_key, model_config)
        self.middlewares_cache = {
            'userprofiles': cache_dict['userprofiles'],
            'affiliations': cache_dict['affiliations'],
            'hozen_calendars': cache_dict['hozen_calendars'],
            'calendars': cache_dict['calendars'],
            'Shift_pattern_worker_view': cache_dict['Shift_pattern_worker_view'],
        }        
        
    def _initialize_cache_attributes(self):
        self.cache = {
            'profile_cache': None,
            'affiliation_cache': None,
            'share_cache': self.cache_manager.share_data_key(),
        }
        
        self.data = {
            'affiliation_pattern_times_dict': None,
        }
        
        self.get_holiday_information()
        self.get_week_information()
        
    def get_or_set_cache(self, cache_key, timeout, value_func):
        """
        キャッシュから値を取得し、存在しない場合は新しい値を設定します。
        :param cache_key: キャッシュキー
        :param timeout: タイムアウト値
        :param value_func: 新しい値を生成するための関数
        :return: キャッシュされた値
        """
        
        value = self.cache_manager.get(cache_key)
        if value is None:
            value = self.cache_manager.set(cache_key, value_func, timeout)
        return value
        
    def get_holiday_information(self):
        holiday_id = 7
        self.holiday_inf = {
            'id': holiday_id,
            'name': self.middlewares_cache['affiliations'].get(affilation_id=holiday_id).affilation
        }
        
    def get_week_information(self):
        week_information = self.get_or_set_cache(
            self.cache['share_cache']['cache_key'],
            self.cache['share_cache']['timeout'],
            lambda: self.get_current_week_dates()
        )
        return week_information
        
    """
    ・get_logged_in_userの記述場所を考える
    """
    def get_logged_in_user(self, request):
        return request.session.get('login_number')
        
    def get_login_number(self, request_login_number):
        #login_number_data = self.get_logged_in_user(self.request)
        login_cache_data = self.cache_manager.login_key(request_login_number)
        
        login_number = self.get_or_set_cache(
            login_cache_data['cache_key'],
            login_cache_data['timeout'],
            lambda: request_login_number,
        )
        return login_number
            
            
    def fetch_user_profiles(self, organization_code):
        return self.middlewares_cache['userprofiles'].select_related(
            'user',
            'organization',
            'belongs'
        ).filter(
            organization__organization=organization_code
        )    
    
    def get_profiles(self, login_number=None):
        user_profile_obj = self.get_user(login_number)
        organization_code = user_profile_obj.organization.organization
        self.cache['profile_cache'] = self.cache_manager.profiles_key(organization_code)
        profiles = self.get_or_set_cache(
            self.cache['profile_cache']['cache_key'],
            self.cache['profile_cache']['timeout'],
            lambda: self.fetch_user_profiles(organization_code)
        )
        user_profile = self.target_profile(login_number, profiles)
        return user_profile, profiles

    """
    ・get_user_related_members, get_userの記述場所を考える
    
    """
    
    def get_user(self, user):
        return get_object_or_404(self.middlewares_cache['userprofiles'], user=user)

    def target_profile(self, login_number, profiles):
        user_profile = profiles.get(user_id=login_number)
        return user_profile
    
    def get_affiliation_pattern_times_dict(self, user_profile, profiles=None):
        self.cache['affiliation_cache'] = self.cache_manager.affilation_pattern_times_key(user_profile.organization.organization)
        affiliation_pattern_times_dict = self.cache_manager.get(self.cache['affiliation_cache']['cache_key'])
        if affiliation_pattern_times_dict is None or all(value is None for value in affiliation_pattern_times_dict.values()):
            affiliation_pattern_times_dict = self.set_common_data(profiles)
        else:
            user_belong_id = user_profile.belongs_id
            user_affilation_pattern_times = affiliation_pattern_times_dict[user_belong_id]
            shift_end_datetime = user_affilation_pattern_times.end_date_time
            adjusted_shift_end_datetime = shift_end_datetime + timedelta(hours=8)
            if adjusted_shift_end_datetime < datetime.today():
                 affiliation_pattern_times_dict = self.set_common_data(profiles)
        return affiliation_pattern_times_dict

    def Hozen_calendar_week(self, today):
        hozen_calendar = self.middlewares_cache['hozen_calendars'].get(h_date=today)
        hozen_calendar_name = hozen_calendar.date_alias
        return hozen_calendar_name
    
    def get_current_week_dates(self):
        today = datetime.today()
        this_week = self.Hozen_calendar_week(today)
    
        start_week = (today - timedelta(days=today.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end_week = (start_week + timedelta(days=6)).replace(hour=23, minute=59, second=0, microsecond=0)
        long_time_ago = datetime(2000, 1, 1)
        return {'today': today, 'start_week': start_week, 
                'end_week': end_week, 
                'long_time_ago': long_time_ago,
                'this_week': this_week
                }
        
    def get_shift_pattern(self):
        return self.middlewares_cache['Shift_pattern_worker_view']
        
    def fetch_calendar_entries(self, date=None):
        if date is None:
            date = datetime.today()
        calendar_entries = self.middlewares_cache['calendars'].filter(
            c_date__h_date=date
        ).select_related(
            'pattern',
            'affilation'
        ).values(
            'affilation_id',
            'affilation__affilation',
            'pattern__pattern_name',
            'pattern__start_time',
            'pattern__end_time',
        ).distinct()
        return calendar_entries
       
    def fetch_affilation_pattern_tims_dict(self, calendar_entries):
        affiliation_pattern_times_dict = {}
        today_date = datetime.today()
        shift_patterns = self.get_shift_pattern()
        for entry in calendar_entries:
            affiliation_id = entry['affilation_id']
            _shift_pattern_name = entry['pattern__pattern_name']
            shift_pattern_obj = shift_patterns.filter(shift_pattern_name=_shift_pattern_name).first()
            if shift_pattern_obj is not None:
                shift_pattern_obj.obj = shift_pattern_obj
                shift_pattern_obj.affiliation = entry['affilation__affilation']
                start_time = shift_pattern_obj.shift_start_time
                end_time = shift_pattern_obj.shift_end_time
                adjusted_date = today_date
                if start_time > end_time:
                    date_end = adjusted_date + timedelta(days=1)
                else:
                    date_end = today_date
                shift_start_datetime = datetime.combine(adjusted_date, start_time)
                shift_end_datetime = datetime.combine(date_end, end_time)
                shift_pattern_obj.start_date_time = shift_start_datetime
                shift_pattern_obj.end_date_time = shift_end_datetime
            affiliation_pattern_times_dict[affiliation_id] = shift_pattern_obj
        return affiliation_pattern_times_dict
    
    def update_user_profiles_with_times(self, profiles, affiliation_pattern_times_dict):
        for user_profile in profiles:
            affiliation_id = user_profile.belongs_id
            pattern_times = affiliation_pattern_times_dict.get(affiliation_id, {})
            if pattern_times is not None:
                user_profile.shift_start_time = pattern_times.start_date_time
                user_profile.shift_end_time = pattern_times.end_date_time
        return profiles

    def set_common_data(self, profiles):
        calendar_entries = self.fetch_calendar_entries()
        affiliation_pattern_times_dict = self.cache_manager.set(
            self.cache['affiliation_cache']['cache_key'],
            lambda: self.fetch_affilation_pattern_tims_dict(calendar_entries),
            timeout=self.cache['affiliation_cache']['timeout']
        )

        self.cache_manager.set(
            self.cache['profile_cache']['cache_key'],
            lambda: self.update_user_profiles_with_times(profiles, affiliation_pattern_times_dict), 
            timeout=self.cache['profile_cache']['timeout']
        )
        
        return affiliation_pattern_times_dict
    
    def get_current_data_infomation(self, profiles):
        updateflg = False
        
        current_week_dates = self.cache_manager.get(self.cache['share_cache']['cache_key'])
        if current_week_dates is None or not(current_week_dates['start_week'] <= datetime.today() <= current_week_dates['end_week']):
            self.cache_manager.set(
                self.cache['share_cache']['cache_key'], 
                self.get_current_week_dates,
                self.cache['share_cache']['timeout']
            )
            self.set_common_data(profiles)
            updateflg = True
        
        return updateflg
    
    def fetch_weekly_duties(self, organization, affiliation_ids):
        weekly_duties = WeeklyDuty.objects.filter(
            affilation_id=affiliation_ids,
            plan__inspection_no__control_no__line_name__organization__organization=organization
        ).select_related(
            'plan', 'affilation'
        ).order_by(
            'plan__plan_time'
        )
        
        
        
        return weekly_duties
    
    def get_weekly_duties_cache(self, code, name):
        cache_name = cache_name = f"{code}_{name}"
        return cache_name
    
    def hasattr_nested(self, obj, attr_path):
        attrs = attr_path.split('.')
        for attr in attrs:
            if not hasattr(obj, attr):
                return False
            obj = getattr(obj, attr)
        return True
    
    def update_weekly_duties_cache(self, cache_key, instance):
        weekly_duties = list(self.cache_manager.get(cache_key))
        if not weekly_duties:
            raise Exception(f"キャッシュが存在しません: {cache_key}")
        for idx, duty in enumerate(weekly_duties):
            if duty.pk == instance.pk:
                weekly_duties[idx] = instance
                break
        weekly_duties_cache_inf = self.cache_manager.weekly_duties_key(cache_key)
        self.cache_manager.set(weekly_duties_cache_inf['cache_key'], weekly_duties, weekly_duties_cache_inf['timeout'])

    def weekly_duties_common_processing(self, cache_name, organization, id, update_flg=False):
        weekly_duties_cache_inf = self.cache_manager.weekly_duties_key(cache_name)
        
        if update_flg:
            self.cache_manager.set(
                weekly_duties_cache_inf['cache_key'], 
                lambda: self.fetch_weekly_duties(organization, id), 
                weekly_duties_cache_inf['timeout']
            )
            
        weekly_duties = self.get_or_set_cache(
            weekly_duties_cache_inf['cache_key'],
            weekly_duties_cache_inf['timeout'],
            lambda: self.fetch_weekly_duties(organization, id)
        )
        
        return weekly_duties
    
    def get_weekly_duties(self, organization, affilation_obj, update_flg=False):
        cache_name = self.get_weekly_duties_cache(
            organization, 
            affilation_obj.affilation
        )
        weekly_duties = self.weekly_duties_common_processing(cache_name, organization, affilation_obj.affilation_id, update_flg)
        return weekly_duties
    
    def get_holiday_weekly_duties(self, user_profile):
        cache_name = self.get_weekly_duties_cache(
            user_profile.organization.organization, 
            self.holiday_inf['name']
        )
        holiday_weekly_duties = self.weekly_duties_common_processing(cache_name, self.holiday_inf['id'])
        return holiday_weekly_duties

    def duties_combine(self, weekdays, holiday):
        combined_duties = list(weekdays) + list(holiday)
        #combined_duties = weekdays | holiday
        return combined_duties
    