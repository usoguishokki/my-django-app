import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';

export class ScheduleController {
  static MINUTE_HEIGHT = 6.5;
  static HEADER_OFFSET_PX = 44;
  static CURRENT_ROW_OFFSET_PX = 30;
  static TIME_AXIS_OFFSET_PX =
    ScheduleController.HEADER_OFFSET_PX + ScheduleController.CURRENT_ROW_OFFSET_PX;

  constructor({ state, timeRenderer, elements }) {
    this.state = state;
    this.timeRenderer = timeRenderer;
    this.elements = elements;
  }

  init() {
    if (!this.elements.title || !this.elements.timeViewRoot) {
      return;
    }

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    this.elements.prevButton?.addEventListener('click', () => {
      this.state.moveDay(-1);
      this.render();
    });

    this.elements.nextButton?.addEventListener('click', () => {
      this.state.moveDay(1);
      this.render();
    });
  }

  render() {
    const selectedDate = this.state.getSelectedDate();
    const members = this.buildDummyMembers();
    const rawItems = this.buildDummyTimeSchedule(selectedDate);
    const scheduleHeightPx = ScheduleTimeLayoutService.getScheduleHeightPx(
      ScheduleController.MINUTE_HEIGHT
    );

    const baseAxes = ScheduleTimeLayoutService.buildAxisLabels();

    const axisLabels = baseAxes.map((axis) => ({
      ...axis,
      isHour: axis.minute % 60 === 0,
      topPx:
        ScheduleController.TIME_AXIS_OFFSET_PX +
        ScheduleTimeLayoutService.toPositionPx(
          axis.minute,
          ScheduleController.MINUTE_HEIGHT
        ),
    }));

    const gridLines = baseAxes.map((axis) => ({
      ...axis,
      isHour: axis.minute % 60 === 0,
      topPx: ScheduleTimeLayoutService.toPositionPx(
        axis.minute,
        ScheduleController.MINUTE_HEIGHT
      ),
    }));

    const events = rawItems.map((item) => {
      const layout = ScheduleTimeLayoutService.calculateEventLayout({
        startTime: item.startTime,
        endTime: item.endTime,
        minuteHeight: ScheduleController.MINUTE_HEIGHT,
      });

      return {
        ...item,
        ...layout,
      };
    });

    const currentSchedules = this.buildCurrentSchedules(members, events);

    this.updateTitle(selectedDate);

    this.timeRenderer.render(this.elements.timeViewRoot, {
      scheduleHeightPx,
      axisLabels,
      gridLines,
      members,
      events,
      currentSchedules,
    });
  }

  buildCurrentSchedules(members, events) {
    const now = new Date();
    const currentMinute = ScheduleTimeLayoutService.toRelativeMinute(
      now.getHours(),
      now.getMinutes()
    );

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
          title: '予定なし',
        };
      }

      return {
        memberId: member.id,
        hasSchedule: true,
        startTime: currentEvent.startTime,
        endTime: currentEvent.endTime,
        title: currentEvent.title,
      };
    });
  }

  buildDummyMembers() {
    return [
      { id: 'm1', name: 'Aさん' },
      { id: 'm2', name: 'Bさん' },
      { id: 'm3', name: 'Cさん' },
      { id: 'm4', name: 'Dさん' },
    ];
  }

  buildDummyTimeSchedule(date) {
    return [
      {
        id: `${date}-1`,
        memberId: 'm1',
        startTime: '06:30',
        endTime: '07:15',
        title: '引継ぎ確認',
      },
      {
        id: `${date}-2`,
        memberId: 'm2',
        startTime: '09:00',
        endTime: '10:30',
        title: '日常点検',
      },
      {
        id: `${date}-3`,
        memberId: 'm3',
        startTime: '13:00',
        endTime: '14:15',
        title: '週次点検',
      },
      {
        id: `${date}-4`,
        memberId: 'm4',
        startTime: '23:30',
        endTime: '01:00',
        title: '夜間設備確認',
      },
      {
        id: `${date}-5`,
        memberId: 'm1',
        startTime: '05:30',
        endTime: '06:20',
        title: '早朝立上げ確認',
      },
      {
        id: `${date}-6`,
        memberId: 'm2',
        startTime: '15:00',
        endTime: '16:00',
        title: '設備清掃',
      },
      {
        id: `${date}-7`,
        memberId: 'm3',
        startTime: '18:00',
        endTime: '19:30',
        title: '巡回確認',
      },
    ];
  }

  updateTitle(dateText) {
    this.elements.title.textContent = `${dateText}`;
  }
}