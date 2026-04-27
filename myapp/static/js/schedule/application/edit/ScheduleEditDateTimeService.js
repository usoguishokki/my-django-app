import { ScheduleMoveTimeService } from '../../domain/ScheduleMoveTimeService.js';

export class ScheduleEditDateTimeService {
  static buildUpdatedEvent({ event, planDate, startTime }) {
    if (!event || !planDate || !startTime) {
      return null;
    }

    const durationMinutes =
      ScheduleMoveTimeService.getDurationMinutes(event);

    return {
      ...event,
      planDate,
      startTime,
      endTime: ScheduleMoveTimeService.addMinutesToTime(
        startTime,
        durationMinutes
      ),
    };
  }

  static getInputValues(root) {
    const dateInput = root?.querySelector('[data-role="edit-date"]');
    const timeInput = root?.querySelector('[data-role="edit-time"]');
  
    return {
      planDate: dateInput?.value ?? '',
      startTime: timeInput?.value ?? '',
    };
  }
  
  static buildUpdatedEventFromRoot({ event, root }) {
    const { planDate, startTime } = this.getInputValues(root);
  
    return this.buildUpdatedEvent({
      event,
      planDate,
      startTime,
    });
  }

  static bindInputChangeEvents(root, onChange) {
    const dateInput = root?.querySelector('[data-role="edit-date"]');
    const timeInput = root?.querySelector('[data-role="edit-time"]');
  
    if (dateInput) {
      dateInput.onchange = () => {
        onChange?.();
      };
    }
  
    if (timeInput) {
      timeInput.onchange = () => {
        onChange?.();
      };
    }
  }
}