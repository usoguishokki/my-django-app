JOB_TITLE_ORDER = {
    '工長': 1,
    '組長': 2,
    '班長': 3,
    '一般': 4,
}


def normalize_member_id(member_id):
    """
    member_id が数値文字列でも int でも安定して比較できるようにする。
    数値化できない場合は最後尾に寄せる。
    """
    try:
        return int(member_id)
    except (TypeError, ValueError):
        return 999999999


def build_profile_sort_key(profile):
    job_title = (getattr(profile, 'job_title', None) or '').strip()
    member_id = getattr(profile.user, 'member_id', None)

    return (
        JOB_TITLE_ORDER.get(job_title, 999),
        normalize_member_id(member_id),
    )


def sort_profiles(profiles):
    return sorted(profiles, key=build_profile_sort_key)


def build_member_sort_key(member):
    profile = getattr(member, 'profile', None)
    job_title = (getattr(profile, 'job_title', None) or '').strip()
    member_id = getattr(member, 'member_id', None)

    return (
        JOB_TITLE_ORDER.get(job_title, 999),
        normalize_member_id(member_id),
    )


def sort_members(members):
    return sorted(members, key=build_member_sort_key)


def build_member_dict(members):
    sorted_members = sort_members(members)

    member_list = []
    for member in sorted_members:
        member_id = getattr(member, 'member_id', None)
        name = getattr(member, 'name', None)

        if member_id is None or name is None:
            continue

        member_list.append({
            "member_id": str(member_id),
            "name": name,
        })

    return member_list