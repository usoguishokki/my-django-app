import { ScheduleTimeLayoutService } from './ScheduleTimeLayoutService.js';
import { ScheduleViewConfigService } from './ScheduleViewConfigService.js';

export class ScheduleViewModelBuilder {
  static build({ response, minuteHeight, visibleHours, currentSchedules }) {
    const members = response.data?.members ?? [];
    const rawItems = response.data?.items ?? [];
    const breaks = response.data?.breaks ?? [];

    const scheduleHeightPx =
      ScheduleTimeLayoutService.getScheduleHeightPx(minuteHeight);

    const baseAxes = ScheduleTimeLayoutService.buildAxisLabels();
    const axisIntervalMinutes =
      ScheduleViewConfigService.getAxisIntervalMinutes(visibleHours);

    const axisLabels = baseAxes
      .filter((axis) => axis.minute % axisIntervalMinutes === 0)
      .map((axis) => ({
        ...axis,
        isHour: axis.minute % 60 === 0,
        topPx: ScheduleTimeLayoutService.toPositionPx(axis.minute, minuteHeight),
      }));

    const gridLines = baseAxes.map((axis) => ({
      ...axis,
      isHour: axis.minute % 60 === 0,
      topPx: ScheduleTimeLayoutService.toPositionPx(axis.minute, minuteHeight),
    }));

    const events = rawItems.map((item) => {
      const layout = ScheduleTimeLayoutService.calculateEventLayout({
        startTime: item.startTime,
        endTime: item.endTime,
        minuteHeight,
      });

      return {
        ...item,
        ...layout,
      };
    });

    const breakBands = breaks.map((item) => {
      const layout = ScheduleTimeLayoutService.calculateEventLayout({
        startTime: item.startTime,
        endTime: item.endTime,
        minuteHeight,
      });

      return {
        ...item,
        ...layout,
      };
    });

    return {
      scheduleHeightPx,
      axisLabels,
      gridLines,
      members,
      events,
      breakBands,
      currentSchedules: currentSchedules(members, events),
    };
  }
}