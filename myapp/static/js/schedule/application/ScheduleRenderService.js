import { ScheduleViewModelBuilder } from '../domain/ScheduleViewModelBuilder.js';
import { MemberWeekViewModelBuilder } from '../domain/MemberWeekViewModelBuilder.js';
import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';

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
    const currentRelativeMinute =
      ScheduleTimeLayoutService.getCurrentRelativeMinute();

    return members.map((member) => {
      const currentEvent = events.find((event) => {
        if (event.memberId !== member.id) {
          return false;
        }

        return ScheduleTimeLayoutService.isRelativeMinuteInDuration({
          targetMinute: currentRelativeMinute,
          startMinute: event.startMinute,
          durationMinutes: event.durationMinutes,
        });
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