from myapp.domain.sort_keys.member_sort import sort_profiles


def serialize_member_profile(profile):
    return {
        'user': {
            'name': profile.user.name,
            'member_id': profile.user.member_id,
            'job_title': profile.job_title,
        },
        'belongs': {
            'affilation': profile.belongs.affilation,
            'affilation_id': profile.belongs.affilation_id,
        },
        'user_id': profile.user.member_id,
        'shift_start_time': profile.shift_start_time,
        'shift_end_time': profile.shift_end_time,
    }


def build_members_with_profiles(profiles):
    sorted_profiles = sort_profiles(profiles)
    return [serialize_member_profile(profile) for profile in sorted_profiles]