import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';
import { ScheduleViewConfigService } from '../domain/ScheduleViewConfigService.js';
import { addDays, formatDate } from '../../utils/dateTime.js';

export class ScheduleTitleService {
  static getTitleTextByScrollPosition({ dateText, scrollTop, clientHeight, visibleHours }) {
    const minuteHeight =
      ScheduleViewConfigService.getMinuteHeight(visibleHours);

    const midnightRelativeMinute =
      ScheduleTimeLayoutService.getMidnightRelativeMinute();

    const midnightTop =
      ScheduleTimeLayoutService.toPositionPx(midnightRelativeMinute, minuteHeight);

    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + clientHeight;

    const isMidnightVisible =
      viewportTop <= midnightTop && midnightTop <= viewportBottom;

    const hasScrolledPastMidnight = viewportTop > midnightTop;

    const nextDate = addDays(dateText, 1);
    const nextDateText = nextDate ? formatDate(nextDate) : dateText;

    if (isMidnightVisible) {
      return `${dateText} ～ ${nextDateText}`;
    }

    if (hasScrolledPastMidnight) {
      return nextDateText;
    }

    return dateText;
  }
}