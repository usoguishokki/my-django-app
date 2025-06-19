from .models import UserProfile

def employee_infomation(request):
    login_number = request.session.get('login_number')
    if login_number:
        employee = UserProfile.objects.get(user_id=login_number)
        if employee:
            return {'employee': employee}
    return {}