import { ScheduleTimeLayoutService } from './ScheduleTimeLayoutService.js';

export class ScheduleViewMapper {
  static mapAxis(axis, minuteHeight) {
    return {
      ...axis,
      isHour: axis.minute % 60 === 0,
      topPx: ScheduleTimeLayoutService.toPositionPx(axis.minute, minuteHeight),
    };
  }

  static mapTimedItem(item, minuteHeight) {
    const layout = ScheduleTimeLayoutService.calculateEventLayout({
      startTime: item.startTime,
      endTime: item.endTime,
      minuteHeight,
    });

    return {
      ...item,
      ...layout,
    };
  }
}