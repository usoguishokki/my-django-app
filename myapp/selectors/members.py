from django.db.models import QuerySet

from myapp.models import Member_tb

    
TEAM_LEADER_JOB_TITLE = '班長'

def member_base_qs() -> QuerySet:
    """
    Member_tb の共通取得条件。
    関連参照をまとめておくことで N+1 を防ぎやすくする。
    """
    return (
        Member_tb.objects
        .select_related('profile', 'profile__belongs')
    )


def select_members_by_affiliation_id(affiliation_id: int) -> QuerySet:
    """
    所属IDに紐づくメンバー一覧を取得する。
    """
    return member_base_qs().filter(profile__belongs_id=affiliation_id)


def select_member_by_user_id(user_id: str):
    """
    ユーザーIDに紐づく Member_tb を1件取得する用途。
    必要なら利用。
    """
    return (
        member_base_qs()
        .filter(profile__user_id=user_id)
        .first()
    )

def select_member_by_member_id(member_id: str):
    return (
        member_base_qs()
        .filter(member_id=member_id)
        .first()
    )

def select_team_leader_by_affiliation_id(affiliation_id: int):
    """
    所属IDから班長を1件取得する。

    注意:
      - 班長判定は UserProfile.job_title == '班長' とする
      - 複数いる場合は member_id 順で安定させる
    """
    if not affiliation_id:
        return None

    return (
        member_base_qs()
        .filter(
            profile__belongs_id=affiliation_id,
            profile__job_title=TEAM_LEADER_JOB_TITLE,
        )
        .order_by('member_id')
        .first()
    )