export class ScheduleInitialDataService {
    static read(elementId = 'schedule-initial-data') {
      const element = document.getElementById(elementId);
  
      if (!element?.textContent) {
        return {};
      }
  
      try {
        return JSON.parse(element.textContent);
      } catch (error) {
        console.error('[ScheduleInitialDataService] failed to parse:', error);
        return {};
      }
    }
}