from myapp.domain.errors import ScheduleApproverNotFound


def get_required_schedule_approver(requested_user):
    """
    スケジュール登録時の承認者をログインユーザーから解決する。

    Plan_tb.approver は Member_tb への FK。
    このアプリでは AUTH_USER_MODEL が Member_tb なので、
    request.user をそのまま approver として登録できる。
    """
    if requested_user is None or not getattr(requested_user, 'is_authenticated', False):
        raise ScheduleApproverNotFound('login user not found')

    return requested_user