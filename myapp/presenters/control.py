def build_control_machine_options_payload(items):
    return {
        "status": "success",
        "items": [
            {
                "value": item["control_no"],
                "label": item["machine"],
                "control_no": item["control_no"],
            }
            for item in items
        ],
    }