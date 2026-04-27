const INSPECTION_TYPE_ITEMS = Object.freeze([
    {
      key: 'all',
      label: '全て',
    },
    {
      key: '日常点検',
      label: '日常',
    },
    {
      key: '定期点検',
      label: '定期',
    },
  ]);
  
  export class ScheduleTestCardInspectionTypeBuilder {
    static build(selectedInspectionType = 'all') {
      const normalizedSelectedInspectionType =
        selectedInspectionType ? String(selectedInspectionType) : 'all';
  
      return INSPECTION_TYPE_ITEMS.map((item) => ({
        ...item,
        isActive: String(item.key) === normalizedSelectedInspectionType,
      }));
    }
  }