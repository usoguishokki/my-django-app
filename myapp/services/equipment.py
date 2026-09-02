from myapp.selectors.equipment import (
    find_equipment_by_control_no,
    get_equipment_by_control_no,
    select_checks_by_control,
)


def load_equipment_by_control_no(*, control_no):
    return get_equipment_by_control_no(control_no=control_no)


def load_equipment_inspection_list(*, control_no):
    """Load an equipment and its ordered inspection rows as one page use case."""
    equipment = find_equipment_by_control_no(control_no=control_no)
    if equipment is None:
        return None, []
    return equipment, select_checks_by_control(equipment=equipment)
