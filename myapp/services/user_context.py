def build_team_profile_context(
    *,
    request,
    cache_manager_if,
):
    request_login_number = (
        cache_manager_if.get_logged_in_user(
            request
        )
    )

    login_number = (
        cache_manager_if.get_login_number(
            request_login_number
        )
    )

    user_profile, profiles = (
        cache_manager_if.get_profiles(
            login_number
        )
    )

    team_profiles = {
        "request_login_number": (
            request_login_number
        ),
        "login_number": login_number,
        "user_profile": user_profile,
        "profiles": profiles,
    }

    cache_manager_if.get_affiliation_pattern_times_dict(
        user_profile,
        profiles,
    )

    return team_profiles
