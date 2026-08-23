def build_achievement_month_options(
    *,
    current_year: int,
):
    options = []

    for year_offset in (-1, 0, 1):
        year = current_year - year_offset

        for month in range(1, 13):
            options.append(
                f"{year}\u5e74{month}\u6708"
            )

    return options

def build_achievement_page_context(
    *,
    current_year: int,
    daily_works_inf,
):
    return {
        "months": build_achievement_month_options(
            current_year=current_year,
        ),
        "daily_works_inf": daily_works_inf,
    }

