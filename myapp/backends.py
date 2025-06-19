from django.contrib.auth.backends import BaseBackend
from .models import Member_tb

class MemberAuthenticationBackend(BaseBackend):
    def authenticate(self, request, member_id=None):
        try:
            return Member_tb.objects.get(member_id=member_id)
        except Member_tb.DoesNotExist:
            return None