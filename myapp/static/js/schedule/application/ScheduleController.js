import { ScheduleAutoRefreshManager } from './ScheduleAutoRefreshManager.js';

import { ScheduleTitleService } from '../application/ScheduleTitleService.js';

import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';
import { ScheduleViewConfigService } from '../domain/ScheduleViewConfigService.js';
import { ScheduleViewModelBuilder } from '../domain/ScheduleViewModelBuilder.js';
import { ScheduleTeamResolver } from '../domain/ScheduleTeamResolver.js';
import { ScheduleDateResolver } from '../domain/ScheduleDateResolver.js';

import { UtilityManager } from '../../manager/UtilityManager.js';
import { fetchScheduleDay } from '../../api/fetchers.js';

import { bindUIActions } from '../../ui/componets/actions/UIActionDispatcher.js';

export class ScheduleController {

  static AUTO_SCROLL_SUPPRESS_MS = 30 * 1000;

  constructor({ state, timeRenderer, elements }) {
    this.state = state;
    this.timeRenderer = timeRenderer;
    this.elements = elements;
    this.autoRefreshManager = new ScheduleAutoRefreshManager({
      onRefresh: () => this.handleAutoRefresh(),
      intervalMinutes: 15,
    });
    this.unbindUIActions = null;
    this.lastUserInteractionAt = 0;
    this.boundScrollContainer = null;
    this.isProgrammaticScrolling = false;
  }

  async init() {
    if (!this.elements.title || !this.elements.timeViewRoot) {
      return;
    }
  
    this.syncInitialScheduleDate();
    this.syncInitialAffiliationId();
    this.syncInitialActiveTeamButton();
    this.updateRangeButtonsByHours(this.state.getVisibleHours());
    this.bindEvents();
    this.bindUserInteractionTracking();
    await this.render();
    this.scrollToCurrentTime({ offsetMinutes: 15 });
    this.autoRefreshManager.start();
  }

  async resolveAutoAffiliationForCurrentState() {
    const params = this.getScheduleQueryParams();
    const response = await fetchScheduleDay(params);
    const payload = response;
  
    this.syncTeamSchedules(payload.data.teamSchedules);
  
    const affiliationChanged = this.syncAutoSelectedAffiliation();
  
    return {
      affiliationChanged,
      payload,
    };
  }

  renderPayload(payload) {
    const selectedDate = this.state.getSelectedDate();
    const visibleHours = this.state.getVisibleHours();
    const minuteHeight =
      ScheduleViewConfigService.getMinuteHeight(visibleHours);
  
    const viewModel = ScheduleViewModelBuilder.build({
      response: payload,
      minuteHeight,
      visibleHours,
      currentSchedules: (members, events) =>
        this.buildCurrentSchedules(members, events),
    });
  
    this.updateTitleByScrollPosition(selectedDate);
  
    this.timeRenderer.render(this.elements.timeViewRoot, {
      ...viewModel,
      visibleHours,
    });
  
    this.bindScrollTracking();
  }

  async handleAutoRefresh() {
    this.syncBaseDateIfNeeded();
    this.resetSelectedDateToBaseDate();
  
    const { affiliationChanged, payload } =
      await this.resolveAutoAffiliationForCurrentState();
  
    if (affiliationChanged) {
      await this.render();
    } else {
      this.renderPayload(payload);
    }
  
    this.scrollToCurrentTimeIfAllowed({ offsetMinutes: 15 });
  }
  
  syncAutoSelectedAffiliation() {
    const teamSchedules = this.state.getTeamSchedules();
    const resolvedAffiliationId =
      ScheduleTeamResolver.resolveCurrentAffiliationId(teamSchedules);
  
    if (resolvedAffiliationId === null || resolvedAffiliationId === undefined) {
      return false;
    }
  
    if (String(this.state.getSelectedAffiliationId()) === String(resolvedAffiliationId)) {
      return false;
    }
  
    this.state.setSelectedAffiliationId(resolvedAffiliationId);
    this.updateTeamButtonsByAffiliationId(String(resolvedAffiliationId));
  
    return true;
  }

  syncInitialScheduleDate(now = new Date()) {
    const resolvedDate = ScheduleDateResolver.resolveScheduleDate(now);
    this.state.setBaseDate(resolvedDate);
    this.state.setSelectedDate(resolvedDate);
  }
  
  syncBaseDateIfNeeded(now = new Date()) {
    const resolvedDate = ScheduleDateResolver.resolveScheduleDate(now);
  
    if (this.state.getBaseDate() === resolvedDate) {
      return false;
    }
  
    this.state.setBaseDate(resolvedDate);
    return true;
  }
  
  resetSelectedDateToBaseDate() {
    this.state.setSelectedDate(this.state.getBaseDate());
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

  getTitleTextByScrollPosition(dateText = this.state.getSelectedDate()) {
    const scrollContainer =
      this.elements.timeViewRoot?.querySelector('.time-schedule');
  
    if (!scrollContainer) {
      return dateText;
    }
  
    const visibleHours = this.state.getVisibleHours();
  
    return ScheduleTitleService.getTitleTextByScrollPosition({
      dateText,
      scrollTop: scrollContainer.scrollTop,
      clientHeight: scrollContainer.clientHeight,
      visibleHours,
    });
  }
  
  updateTitleByScrollPosition(dateText = this.state.getSelectedDate()) {
    this.updateTitle(this.getTitleTextByScrollPosition(dateText));
  }
  
  bindEvents() {
    this.bindAsideToggle({
      card: this.elements.legend,
      toggle: this.elements.legendToggle,
    });
  
    this.bindAsideToggle({
      card: this.elements.range,
      toggle: this.elements.rangeToggle,
    });
  
    this.unbindUIActions?.();
  
    this.unbindUIActions = bindUIActions(this.elements.root, {
      'schedule:prev-day': async () => {
        this.state.moveDay(-1);
        await this.render();
      },
  
      'schedule:next-day': async () => {
        this.state.moveDay(1);
        await this.render();
      },
  
      'schedule:change-team': async ({ element }) => {
        const affiliationId = this.getTeamButtonAffiliationId(element);
  
        if (!affiliationId) {
          return;
        }
  
        this.state.setSelectedAffiliationId(affiliationId);
        this.updateTeamButtonsByAffiliationId(String(affiliationId));
        await this.render();
      },
  
      'schedule:change-range': async ({ element }) => {
        const hours = Number(element.dataset.hours ?? 2);
  
        this.state.setVisibleHours(hours);
        this.updateRangeButtonsByHours(this.state.getVisibleHours());
        await this.render();
      },
    });
  }

  bindAsideToggle({ card, toggle }) {
    if (!card || !toggle) {
      return;
    }
  
    toggle.addEventListener('click', () => {
      this.toggleAsideCard(card, toggle);
    });
  
    toggle.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
  
      event.preventDefault();
      this.toggleAsideCard(card, toggle);
    });
  }
  
  toggleAsideCard(card, toggle) {
    const isCollapsed = card.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!isCollapsed));
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

  syncTeamSchedules(teamSchedules) {
    this.state.setTeamSchedules(teamSchedules);
  }

  async render() {
    const params = this.getScheduleQueryParams();
    const response = await fetchScheduleDay(params);
    const payload = response;
  
    this.syncTeamSchedules(payload.teamSchedules);
    this.renderPayload(payload);
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

  updateRangeButtonsByHours(activeHours) {
    this.elements.rangeButtons?.forEach((button) => {
      const buttonHours = Number(button.dataset.hours ?? 0);
      const isActive = buttonHours === activeHours;
  
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  markUserInteraction() {
    this.lastUserInteractionAt = Date.now();
  }

  shouldSuppressAutoScroll() {
    if (!this.lastUserInteractionAt) {
      return false;
    }
  
    return Date.now() - this.lastUserInteractionAt <
      ScheduleController.AUTO_SCROLL_SUPPRESS_MS;
  }

  scrollToCurrentTimeIfAllowed({ offsetMinutes = 15 } = {}) {
    if (this.shouldSuppressAutoScroll()) {
      return;
    }
  
    this.scrollToCurrentTime({ offsetMinutes });
  }

  bindScrollTracking() {
    const scrollContainer =
      this.elements.timeViewRoot?.querySelector('.time-schedule');
  
    if (!scrollContainer || this.boundScrollContainer === scrollContainer) {
      return;
    }
  
    this.boundScrollContainer = scrollContainer;
  
    scrollContainer.addEventListener('scroll', () => {
      if (this.isProgrammaticScrolling) {
        return;
      }
    
      this.markUserInteraction();
      this.updateTitleByScrollPosition();
    }, { passive: true });
  }

  scrollToCurrentTime({ offsetMinutes = 15 } = {}) {
    const scrollContainer =
      this.elements.timeViewRoot?.querySelector('.time-schedule');
  
    if (!scrollContainer) {
      return;
    }
  
    const visibleHours = this.state.getVisibleHours();
    const minuteHeight =
      ScheduleViewConfigService.getMinuteHeight(visibleHours);
  
    const now = new Date();
    const currentRelativeMinute = ScheduleTimeLayoutService.toRelativeMinute(
      now.getHours(),
      now.getMinutes()
    );
  
    const targetMinute = Math.max(currentRelativeMinute - offsetMinutes, 0);
    const targetTop = ScheduleTimeLayoutService.toPositionPx(
      targetMinute,
      minuteHeight
    );
  
    this.isProgrammaticScrolling = true;
    scrollContainer.scrollTop = targetTop;
    
    window.setTimeout(() => {
      this.isProgrammaticScrolling = false;
      this.updateTitleByScrollPosition();
    }, 0);
  }

  updateTitle(dateText) {
    this.elements.title.textContent = `${dateText}`;
  }

  bindUserInteractionTracking() {
    const root = this.elements.root;
  
    if (!root) {
      return;
    }
  
    const markInteraction = () => {
      this.markUserInteraction();
    };
  
    root.addEventListener('click', markInteraction, { passive: true });
    root.addEventListener('wheel', markInteraction, { passive: true });
    root.addEventListener('touchstart', markInteraction, { passive: true });
  
    root.addEventListener('keydown', (event) => {
      const isMeaningfulKey =
        event.key === 'Enter' ||
        event.key === ' ' ||
        event.key === 'Spacebar' ||
        event.key.startsWith('Arrow') ||
        event.key === 'PageUp' ||
        event.key === 'PageDown' ||
        event.key === 'Home' ||
        event.key === 'End';
  
      if (!isMeaningfulKey) {
        return;
      }
  
      this.markUserInteraction();
    });
  }
}