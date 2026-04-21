import { ScheduleTimeLayoutService } from './ScheduleTimeLayoutService.js';
import { ScheduleViewConfigService } from './ScheduleViewConfigService.js';
import { ScheduleViewMapper } from './ScheduleViewMapper.js';

export class ScheduleTimelineViewBuilder {
  static build({ minuteHeight, visibleHours }) {
    const scheduleHeightPx =
      ScheduleTimeLayoutService.getScheduleHeightPx(minuteHeight);

    const baseAxes = ScheduleTimeLayoutService.buildAxisLabels();
    const axisIntervalMinutes =
      ScheduleViewConfigService.getAxisIntervalMinutes(visibleHours);

    const axisLabels = baseAxes
      .filter((axis) => axis.minute % axisIntervalMinutes === 0)
      .map((axis) => ScheduleViewMapper.mapAxis(axis, minuteHeight));

    const gridLines = baseAxes.map((axis) =>
      ScheduleViewMapper.mapAxis(axis, minuteHeight)
    );

    return {
      scheduleHeightPx,
      axisLabels,
      gridLines,
    };
  }
}