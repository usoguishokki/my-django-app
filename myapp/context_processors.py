from myapp.services.user_context import build_employee_context
from myapp.nagakusa.config import host_plugin_url

def employee_infomation(request):
    login_number = request.session.get('login_number')
    return {
        **build_employee_context(login_number=login_number),
        "nagakusa_host_plugin_url": host_plugin_url(),
    }
