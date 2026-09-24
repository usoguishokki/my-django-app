from .models import UserProfile


def validation_environment(request):
    from django.conf import settings

    return {"nika_validation_mode": getattr(settings, "NIKA_VALIDATION_MODE", False)}


def employee_infomation(request):
    login_number = request.session.get('login_number')
    if login_number:
        employee = UserProfile.objects.get(user_id=login_number)
        if employee:
            return {'employee': employee}
    return {}
