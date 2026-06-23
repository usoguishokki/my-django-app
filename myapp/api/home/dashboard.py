# myapp/api/home/dashboard.py

import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from myapp.models import UserProfile
from myapp.services.home.dashboard import build_home_overall_progress_response


logger = logging.getLogger(__name__)


@login_required
def home_overall_progress_api(request):
    """
    home左側「全体の進捗」API。

    全体の進捗:
      ログインユーザーと同じ組織に属する班すべて
    """
    try:
        user_profile = (
            UserProfile.objects
            .select_related("organization", "belongs")
            .get(user=request.user)
        )
    except UserProfile.DoesNotExist:
        return JsonResponse(
            {
                "status": "error",
                "message": "ユーザープロフィールが見つかりません。",
            },
            status=404,
            json_dumps_params={"ensure_ascii": False},
        )

    try:
        payload = build_home_overall_progress_response(
            user_profile=user_profile,
        )
    except Exception:
        logger.exception("[home_overall_progress_api] failed")

        return JsonResponse(
            {
                "status": "error",
                "message": "全体進捗の取得に失敗しました。",
            },
            status=500,
            json_dumps_params={"ensure_ascii": False},
        )

    return JsonResponse(
        {
            "status": "success",
            "data": payload,
        },
        json_dumps_params={"ensure_ascii": False},
    )