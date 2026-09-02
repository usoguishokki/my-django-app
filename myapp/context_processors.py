from myapp.services.user_context import build_employee_context

def employee_infomation(request):
    login_number = request.session.get('login_number')
    return build_employee_context(login_number=login_number)
