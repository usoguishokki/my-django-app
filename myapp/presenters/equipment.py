def build_inspection_list_checks(
    checks,
):
    prepared_checks = list(checks)

    for check in prepared_checks:
        unique_devices = {}

        for detail in check.db_details.all():
            device = detail.applicable_device

            if device not in unique_devices:
                unique_devices[device] = {
                    "details": [],
                }

            unique_devices[device][
                "details"
            ].append((
                detail.contents,
                detail.standard,
                detail.method,
            ))

        check.details_unique_devices = (
            unique_devices
        )

    return prepared_checks
