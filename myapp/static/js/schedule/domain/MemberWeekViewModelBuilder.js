import { ScheduleViewMapper } from './ScheduleViewMapper.js';
import { ScheduleTimelineViewBuilder } from './ScheduleTimelineViewBuilder.js';
import { formatJsDayToDowLabel } from '../../ui/formatters/labelFormatters.js';

export class MemberWeekViewModelBuilder {
  static build({ response, selectedDate, minuteHeight, visibleHours }) {
    const rawDays = response?.data?.days ?? [];
    const rawItems = response?.data?.items ?? [];

    const {
      scheduleHeightPx,
      axisLabels,
      gridLines,
    } = ScheduleTimelineViewBuilder.build({
      minuteHeight,
      visibleHours,
    });

    const days = rawDays.length
      ? this.normalizeDays(rawDays)
      : this.buildWeekDays(selectedDate);

    const dayIndexMap = this.buildDayIndexMap(days);

    const events = rawItems.map((item) =>
      this.mapEventWithColumnIndex(item, minuteHeight, dayIndexMap)
    );

    const weekRangeText = this.buildWeekRangeText(days);

    return {
      scheduleHeightPx,
      axisLabels,
      gridLines,
      days,
      events,
      weekRangeText,
    };
  }

  static buildDayIndexMap(days = []) {
    return new Map(
      days.map((day, index) => [day.key, index])
    );
  }

  static mapEventWithColumnIndex(item, minuteHeight, dayIndexMap) {
    const mapped = ScheduleViewMapper.mapTimedItem(item, minuteHeight);

    return {
      ...mapped,
      columnIndex: dayIndexMap.get(item.dayKey) ?? 0,
    };
  }

  static normalizeDays(days = []) {
    return days.map((day) => {
      const key = day.key ?? '';
      const current = key ? new Date(`${key}T00:00:00`) : null;

      if (!current || Number.isNaN(current.getTime())) {
        return {
          key,
          label: '',
          dateText: '',
        };
      }

      const month = String(current.getMonth() + 1).padStart(2, '0');
      const date = String(current.getDate()).padStart(2, '0');

      return {
        key,
        label: formatJsDayToDowLabel(current.getDay()),
        dateText: `${month}/${date}`,
      };
    });
  }

  static buildWeekDays(selectedDate) {
    const baseDate = new Date(`${selectedDate}T00:00:00`);
    const dayOfWeek = baseDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + index);

      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');

      return {
        key: `${year}-${month}-${day}`,
        label: formatJsDayToDowLabel(current.getDay()),
        dateText: `${month}/${day}`,
      };
    });
  }

  static buildWeekRangeText(days) {
    if (!days.length) {
      return '';
    }

    const start = days[0]?.key ?? '';
    const end = days[days.length - 1]?.key ?? '';

    return `${start} - ${end}`;
  }
}