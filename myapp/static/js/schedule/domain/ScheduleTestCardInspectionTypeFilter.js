function normalizeInspectionType(value) {
    return value == null ? '' : String(value).trim();
  }
  
function resolveItemInspectionType(item) {
  return normalizeInspectionType(item?.inspectionType);
}

export class ScheduleTestCardInspectionTypeFilter {
  static filter(items = [], selectedInspectionType = 'all') {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const normalizedSelectedInspectionType =
      normalizeInspectionType(selectedInspectionType);

    if (
      normalizedSelectedInspectionType === '' ||
      normalizedSelectedInspectionType === 'all'
    ) {
      return items;
    }

    return items.filter(
      (item) =>
        resolveItemInspectionType(item) === normalizedSelectedInspectionType
    );
  }
}