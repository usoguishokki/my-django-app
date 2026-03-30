from django.db.models import QuerySet

from myapp.models import Member_tb


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