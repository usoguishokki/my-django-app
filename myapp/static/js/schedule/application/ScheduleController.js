import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';
import { UtilityManager } from '../../manager/UtilityManager.js';
import { fetchScheduleDay } from '../../api/fetchers.js';

export class ScheduleController {
  static MINUTE_HEIGHT = 6.5;
  static HEADER_OFFSET_PX = 44;
  static CURRENT_ROW_OFFSET_PX = 54;
  static TIME_AXIS_OFFSET_PX =
    ScheduleController.HEADER_OFFSET_PX + ScheduleController.CURRENT_ROW_OFFSET_PX;

  constructor({ state, timeRenderer, elements }) {
    this.state = state;
    this.timeRenderer = timeRenderer;
    this.elements = elements;
  }

  async init() {
    if (!this.elements.title || !this.elements.timeViewRoot) {
      return;
    }

    this.syncInitialAffiliationId();
    this.syncInitialActiveTeamButton();
    this.bindEvents();
    await this.render();
  }

  syncInitialAffiliationId() {
    const affiliationId = UtilityManager.$id('employeeName')?.dataset?.affiliation_id ?? '';

    if (affiliationId) {
      this.state.setSelectedAffiliationId(affiliationId);
    }
  }

  syncInitialActiveTeamButton() {
    const selectedAffiliationId = this.state.getSelectedAffiliationId();
    this.updateTeamButtonsByAffiliationId(selectedAffiliationId);
  }

  getScheduleQueryParams() {
    return {
      date: this.state.getSelectedDate(),
      affiliationId: this.state.getSelectedAffiliationId(),
    };
  }

  bindEvents() {
    this.elements.prevButton?.addEventListener('click', async () => {
      this.state.moveDay(-1);
      await this.render();
    });

    this.elements.nextButton?.addEventListener('click', async () => {
      this.state.moveDay(1);
      await this.render();
    });

    this.elements.teamButtons?.forEach((button) => {
      button.addEventListener('click', async () => {
        const affiliationId = this.getTeamButtonAffiliationId(button);

        if (!affiliationId) {
          return;
        }

        this.state.setSelectedAffiliationId(affiliationId);
        this.updateTeamButtonsByAffiliationId(affiliationId);
        await this.render();
      });
    });
  }

  getTeamButtonAffiliationId(button) {
    return button?.dataset?.affiliationId ?? '';
  }

  updateTeamButtonsByAffiliationId(activeAffiliationId) {
    this.elements.teamButtons?.forEach((button) => {
      const buttonAffiliationId = this.getTeamButtonAffiliationId(button);
      const isActive = buttonAffiliationId === activeAffiliationId;

      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  async render() {
    const params = this.getScheduleQueryParams();
    const response = await fetchScheduleDay(params);

    const selectedDate = this.state.getSelectedDate();
    const members = response.data?.members ?? [];
    const rawItems = response.data?.items ?? [];
    const breaks = response.data?.breaks ?? [];

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

    const breakBands = breaks.map((item) => {
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
      breakBands,
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

  updateTitle(dateText) {
    this.elements.title.textContent = `${dateText}`;
  }
}