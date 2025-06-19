from .cache_manager import CacheManager
from .cache_manager_if import CacheManagerIF

class ModelCacheMiddleware:
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.cache_manager = CacheManager()
        self.cache_manager_if = CacheManagerIF(self.cache_manager)

    def __call__(self, request):        
        #リクエストを次のミドルウェアまたはビューに渡す
        request.cache_manager = self.cache_manager
        request.cache_manager_if = self.cache_manager_if
        if request.user.is_authenticated:
            request.organization_code = request.user.profile.organization.organization
        response = self.get_response(request)
        return response
    