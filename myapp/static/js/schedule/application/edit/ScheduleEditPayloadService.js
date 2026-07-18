import { SchedulePlanStatusPolicy } from '../../domain/SchedulePlanStatusPolicy.js';


const SCHEDULE_DAY_START_TIME = '06:30';

function toMinutes(timeText) {
  const [hourText, minuteText] = String(timeText ?? '').split(':');

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function addDays(dateText, days) {
  const text = String(dateText ?? '');

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return text;
  }

  const [, yearText, monthText, dayText] = match;

  const date = new Date(Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText)
  ));

  date.setUTCDate(date.getUTCDate() + days);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getEventPlanDate(event) {
  return String(
    event?.planDate ?? event?.dayKey ?? ''
  );
}

function isBeforeScheduleDayStart(timeText) {
  const timeMinutes = toMinutes(timeText);
  const dayStartMinutes = toMinutes(SCHEDULE_DAY_START_TIME);

  if (
    timeMinutes === null ||
    dayStartMinutes === null
  ) {
    return false;
  }

  return timeMinutes < dayStartMinutes;
}

function isSameSchedulePlanDateForTime({
  beforeDate,
  afterDate,
  startTime,
}) {
  if (beforeDate === afterDate) {
    return true;
  }

  if (!isBeforeScheduleDayStart(startTime)) {
    return false;
  }

  return afterDate === addDays(beforeDate, 1);
}


export class ScheduleEditPayloadService {
  static canRetract(selectedEvent) {
    if (!selectedEvent?.planId) {
      return false;
    }

    return SchedulePlanStatusPolicy.isRetractable(
      selectedEvent.planStatus
    );
  }

  static buildRetractPayload(selectedEvent) {
    if (!selectedEvent?.planId) {
      return null;
    }

    return {
      planId: selectedEvent.planId,
    };
  }

  static hasChanges(beforeEvent, afterEvent) {
    if (!beforeEvent || !afterEvent) {
      return false;
    }

    const beforeMemberId = String(beforeEvent.memberId ?? '');
    const afterMemberId = String(afterEvent.memberId ?? '');

    const beforeStartTime = String(beforeEvent.startTime ?? '');
    const afterStartTime = String(afterEvent.startTime ?? '');

    const beforePlanDate = getEventPlanDate(beforeEvent);
    const afterPlanDate = getEventPlanDate(afterEvent);

    const isSameMember = beforeMemberId === afterMemberId;
    const isSameStartTime = beforeStartTime === afterStartTime;
    const isSamePlanDate = isSameSchedulePlanDateForTime({
      beforeDate: beforePlanDate,
      afterDate: afterPlanDate,
      startTime: afterStartTime,
    });

    return !(
      isSameMember &&
      isSamePlanDate &&
      isSameStartTime
    );
  }
}