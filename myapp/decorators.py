from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from functools import wraps

def ajax_login_required(function=None):
    @wraps(function)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'error': 'Unauthorized'}, status=401)
            else:
                return login_required(function)(request, *args, **kwargs)
        return function(request, *args, **kwargs)
    return wrapper
"""
from functools import wraps
from myapp.cache_manager import CacheManager


def with_cache_manager(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # CacheManagerインスタンスをrequestオブジェクトに追加
        request.cache_manager = CacheManager()
        # 元のview_funcを呼び出す
        return view_func(request, *args, **kwargs)
    return _wrapped_view
"""