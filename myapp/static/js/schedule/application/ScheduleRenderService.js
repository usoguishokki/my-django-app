import { ScheduleViewModelBuilder } from '../domain/ScheduleViewModelBuilder.js';
import { MemberWeekViewModelBuilder } from '../domain/MemberWeekViewModelBuilder.js';

export class ScheduleRenderService {
  constructor({
    getMinuteHeight,
    getVisibleHours,
    timeRenderer,
    memberWeekRenderer,
  }) {
    this.getMinuteHeight = getMinuteHeight;
    this.getVisibleHours = getVisibleHours;
    this.timeRenderer = timeRenderer;
    this.memberWeekRenderer = memberWeekRenderer;
  }

  renderDayView({ response, container, selectedDate }) {
    const minuteHeight = this.getMinuteHeight();
    const visibleHours = this.getVisibleHours();

    const viewModel = ScheduleViewModelBuilder.build({
      response,
      minuteHeight,
      visibleHours,
      currentSchedules: this.buildCurrentSchedules.bind(this),
    });

    this.timeRenderer.render(container, {
      ...viewModel,
      selectedDate,
      visibleHours,
    });

    return viewModel;
  }

  renderMemberWeekView({ response, container, selectedDate }) {
    const minuteHeight = this.getMinuteHeight();
    const visibleHours = this.getVisibleHours();

    const viewModel = MemberWeekViewModelBuilder.build({
      response,
      selectedDate,
      minuteHeight,
      visibleHours,
    });

    this.memberWeekRenderer.render(container, viewModel);

    return viewModel;
  }

  buildCurrentSchedules(members = [], events = []) {
    const now = new Date();
    const currentMinute =
      now.getHours() * 60 + now.getMinutes();

    return members.map((member) => {
      const currentEvent = events.find((event) => {
        if (event.memberId !== member.id) {
          return false;
        }

        const startMinute = event.startMinute;
        const endMinute = startMinute + event.durationMinutes;

        return currentMinute >= startMinute && currentMinute < endMinute;
      });

      if (!currentEvent) {
        return {
          memberId: member.id,
          hasSchedule: false,
          startTime: '',
          endTime: '',
          status: '',
          machineName: '',
          workName: '予定なし',
        };
      }

      return {
        memberId: member.id,
        hasSchedule: true,
        startTime: currentEvent.startTime,
        endTime: currentEvent.endTime,
        status: currentEvent.status ?? '',
        machineName: currentEvent.machineName ?? '',
        workName: currentEvent.workName ?? currentEvent.title ?? '',
      };
    });
  }
}