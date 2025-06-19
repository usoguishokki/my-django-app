from django.core.cache import cache
from importlib import import_module

class CacheManager:
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        """
        本番消す
        """
        #self.all_clear()
        #self._initialized = False
        """"""
        if not self._initialized:
            self.timeouts = {
                'one_hour': 60 * 60,
                'eight_hour': 8 * 60 * 60,
                'one_day': 24 * 60 * 60,
                'one_week': 7 * 24 * 60 * 60,
                'one_month': 30 * 24 * 60 * 60
            }

            self.cache_keys = {
                'login_number': {'timeout': self.timeouts['eight_hour']},
                'share_data': {'timeout': self.timeouts['one_week']},
                'affilation_pattern_times': {'timeout': self.timeouts['one_week']},
                'user_profiles': {'timeout': self.timeouts['one_week']},
                'weekly_duties': {'timeout': self.timeouts['one_week']},
                'non_matching_weekly_duties': {'timeout': self.timeouts['one_week']},
                'hozen_calendar': {'timeout': self.timeouts['one_week']}
            }

            #一か月のタイムアウト時間(秒)

            self.models_to_cache = {
                'members': {
                    'app_label': 'myapp',
                    'model_name': 'Member_tb',
                    'cache_key': 'members',
                    'timeout': self.timeouts['one_month'],
                },
                'affiliations': {
                    'app_label': 'myapp',
                    'model_name': 'Affilation_tb',
                    'cache_key': 'affiliations',
                    'timeout': self.timeouts['one_month'],
                },
                'organizations': {
                    'app_label': 'myapp',
                    'model_name': 'Organization',
                    'cache_key': 'organizations',
                    'timeout': self.timeouts['one_month'],
                },
                'userprofiles': {
                    'app_label': 'myapp',
                    'model_name': 'UserProfile',
                    'cache_key': 'userprofiles',
                    'timeout': self.timeouts['one_month'],
                    'select_related': ['user', 'organization', 'belongs'],
                },
                'hozen_calendars': {
                    'app_label': 'myapp',
                    'model_name': 'Hozen_calendar_tb',
                    'cache_key': 'hozen_calendars',
                    'timeout': self.timeouts['one_month'],
                },
                'calendars': {
                    'app_label': 'myapp',
                    'model_name': 'Calendar_tb',
                    'cache_key': 'calendars',
                    'timeout': self.timeouts['one_month'],
                    'select_related': ['c_date', 'affilation', 'pattern']
                },
                'Shift_pattern_worker_view': {
                    'app_label': 'myapp',
                    'model_name': 'Shift_pattern_worker_view',
                    'cache_key': 'Shift_pattern_worker_view',
                    'timeout': self.timeouts['one_month'],
                }
            }
            self.cache_model_data()
            self._initialized =True
    
    def _get_model(self, app_label, model_name):
        return import_module(f"{app_label}.models").__dict__[model_name]
    
    def set_model(self, cache_key, model_config):
        """
        モデルのQuerySetを生成し、select_related / prefetch_relatedを適用のうえでキャッシュへ保存する。
    
        Args:
        cache_key (str): キャッシュのキー。
        model_config (dict): モデル情報と最適化設定（select_related, prefetch_related等）。
        
        Returns:
        QuerySet: キャッシュされたQuerySet（評価前の遅延オブジェクト）。
        """
        #モデルの取得
        model = self._get_model(model_config['app_label'], model_config['model_name'])
        
        #querySetの初期化(遅延評価)
        queryset = model.objects
        
        #select_relatedの運用(JOINによるリレーション解決)
        if 'select_related' in model_config:
            queryset = queryset.select_related(*model_config['select_related'])
            
        # 'prefetch_related'の運用(IN句 + python結合)
        if 'prefetch_related' in model_config:
            queryset = queryset.prefetch_related(*model_config['prefetch_related'])
            
        #最終的なクエリセット取得(all()で評価可能な状態に)
        queryset = queryset.all()
        
        #キャッシュ登録
        cache_model = self.set(
            cache_key,
            lambda: queryset,
            model_config['timeout']
        )
        
        return cache_model
        
        """
        model = self._get_model(model_config['app_label'], model_config['model_name'])
        data = model.objects.all()
        cache_model = self.set(cache_key, lambda: data, model_config['timeout'])
        return cache_model
        """
    
    def get_models_to_cache_config(self, key):
        cache_config = self.models_to_cache.get(key)
        return cache_config

    def cache_model_data(self):
        for cache_key, model_config in self.models_to_cache.items():
            if self.get(cache_key) is None:
                self.set_model(cache_key, model_config)

    def login_key(self, login_number):
        return {
            'cache_key': f'user_login_number_{login_number}',
            'timeout': self.cache_keys['login_number']['timeout']
        }
    
    def share_data_key(self):
        return {
            'cache_key': 'cache_key_share_data',
            'timeout': self.cache_keys['share_data']['timeout']
        }
    
    def affilation_pattern_times_key(self, organization_code):
        return {
            'cache_key': f'{organization_code}_affilation_pattern_times',
            'timeout': self.cache_keys['affilation_pattern_times']['timeout']
        }
    
    def profiles_key(self, organization_code):
        return {
            'cache_key': f'{organization_code}_user_profiles',
            'timeout': self.cache_keys['user_profiles']['timeout']
        }
    
    def weekly_duties_key(self, cache_name):
        return {
            'cache_key': cache_name,
            'timeout': self.cache_keys['weekly_duties']['timeout']
        }
    
    def get(self, cache_key):
        """
        キャッシュからデータを取得する。
        :param cache_key: キャッシュキー
        :return: キャッシュされたデータまたはNone
        """
        return cache.get(cache_key)

    def set(self, cache_key, data_fetch_func, timeout=900):
        """
        データをキャッシュに保存する。
        :param cache_key: キャッシュキー
        :param data_fetch_func: データを取得する関数
        :param timeout: キャッシュの有効期限（秒）
        """
        data = data_fetch_func() if callable(data_fetch_func) else data_fetch_func
        cache.set(cache_key, data, timeout)
        return data
    
    def clear(self, key):
        cache.delete(key)
    
    def all_clear(self):
        cache.clear()