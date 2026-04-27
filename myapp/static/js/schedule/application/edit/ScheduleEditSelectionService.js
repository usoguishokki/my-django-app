export class ScheduleEditSelectionService {
    constructor({ buildEventSummaryFromElement }) {
      this.buildEventSummaryFromElement = buildEventSummaryFromElement;
    }
  
    selectFromElement(element) {
      const selectedEditEvent =
        this.buildEventSummaryFromElement?.(element);
  
      if (!selectedEditEvent) {
        return null;
      }
  
      return {
        selectedEditEvent,
        pendingEditEvent: { ...selectedEditEvent },
      };
    }
}