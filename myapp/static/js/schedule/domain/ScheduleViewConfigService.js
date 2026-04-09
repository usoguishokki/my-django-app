export class ScheduleViewConfigService {
    static getMinuteHeight(visibleHours) {
      const minuteHeightMap = {
        2: 6.5,
        4: 1.6,
        8: 0.7,
      };
  
      return minuteHeightMap[visibleHours] ?? 6.5;
    }
  
    static getAxisIntervalMinutes(visibleHours) {
      const intervalMap = {
        2: 15,
        4: 30,
        8: 120,
      };
  
      return intervalMap[visibleHours] ?? 15;
    }
  }