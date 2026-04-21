import { ScheduleAutoRefreshManager } from './ScheduleAutoRefreshManager.js';
import { ScheduleTitleService } from './ScheduleTitleService.js';
import { ScheduleRenderService } from './ScheduleRenderService.js';
import { ScheduleEditSummaryService } from './ScheduleEditSummaryService.js';
import { ScheduleAutoScrollService } from './ScheduleAutoScrollService.js';
import { ScheduleMemberDropdownService } from './ScheduleMemberDropdownService.js';
import { ScheduleEditMemberDropdownService } from './ScheduleEditMemberDropdownService.js';
import { ScheduleDragPreviewService } from './ScheduleDragPreviewService.js';
import { ScheduleDropOrchestratorService } from './ScheduleDropOrchestratorService.js';
import { ScheduleDragTimeIndicatorService } from './ScheduleDragTimeIndicatorService.js';

import { ScheduleViewConfigService } from '../domain/ScheduleViewConfigService.js';
import { ScheduleTeamResolver } from '../domain/ScheduleTeamResolver.js';
import { ScheduleDateResolver } from '../domain/ScheduleDateResolver.js';
import { ScheduleMoveTimeService } from '../domain/ScheduleMoveTimeService.js';

import { ScheduleDragManager } from '../ui/ScheduleDragManager.js';
import { ScheduleDragTargetHighlighter } from '../ui/ScheduleDragTargetHighlighter.js';

import { UtilityManager } from '../../manager/UtilityManager.js';

import { renderButtonHTML } from '../../ui/componets/buttons/Button.js';

import {
  buildPlanDetailCardsVM,
  buildExtraDetailVM,
} from '../../presenters/planDetailPresenter.js';

import {
  renderPlanDetailCardsHTML,
} from '../../ui/renderers/planDetailCardsRenderer.js';

import {
  fetchScheduleDay,
  fetchScheduleMemberWeek,
  fetchInspectionCardDetail,
  executeScheduleEventMove,
} from '../../api/fetchers.js';

import { bindUIActions } from '../../ui/componets/actions/UIActionDispatcher.js';
import { DrawerStack } from '../../ui/componets/drawer/DrawerStack.js';

export class ScheduleController {
  static AUTO_SCROLL_SUPPRESS_MS = 30 * 1000;

  constructor({ state, timeRenderer, memberWeekRenderer, elements }) {
    this.state = state;
    this.timeRenderer = timeRenderer;
    this.memberWeekRenderer = memberWeekRenderer;
    this.elements = elements;

    this.autoRefreshManager = new ScheduleAutoRefreshManager({
      onRefresh: () => this.handleAutoRefresh(),
      intervalMinutes: 15,
    });

    this.renderService = new ScheduleRenderService({
      getMinuteHeight: () =>
        ScheduleViewConfigService.getMinuteHeight(this.state.getVisibleHours()),
      getVisibleHours: () => this.state.getVisibleHours(),
      timeRenderer: this.timeRenderer,
      memberWeekRenderer: this.memberWeekRenderer,
    });

    this.editSummaryService = new ScheduleEditSummaryService({
      getSelectedDate: () => this.state.getSelectedDate(),
      getMemberNameById: (memberId) => this.getMemberNameById(memberId),
      elements: this.elements,
    });

    this.autoScrollService = new ScheduleAutoScrollService({
      getVisibleHours: () => this.state.getVisibleHours(),
      getTimeViewRoot: () => this.elements.timeViewRoot,
      onUserScroll: () => this.updateTitleByScrollPosition(),
      suppressMs: ScheduleController.AUTO_SCROLL_SUPPRESS_MS,
    });

    this.memberDropdownService = new ScheduleMemberDropdownService({
      state: this.state,
      elements: this.elements,
      getMembers: () => this.currentMembers,
      onSyncViewHeaderUI: () => this.syncViewHeaderUI(),
      onChange: ({ memberId, memberName }) =>
        this.handleMemberWeekDropdownChange({ memberId, memberName }),
    });

    this.editMemberDropdownService = new ScheduleEditMemberDropdownService({
      elements: this.elements,
      getMembers: () => this.currentMembers,
      onChange: ({ memberId }) => this.handleEditMemberChange(memberId),
    });

    this.dragPreviewService = new ScheduleDragPreviewService();
    this.dragTimeIndicatorService = new ScheduleDragTimeIndicatorService();
    this.dragTargetHighlighter = new ScheduleDragTargetHighlighter();

    this.unbindUIActions = null;
    this.currentMembers = [];
    this.detailDrawerStack = null;

    this.selectedEditEvent = null;
    this.pendingEditEvent = null;
    
  }

  async init() {
    if (!this.elements.title || !this.elements.timeViewRoot) {
      return;
    }

    this.syncInitialScheduleDate();
    this.syncInitialAffiliationId();
    this.syncInitialActiveTeamButton();
    this.updateRangeButtonsByHours(this.state.getVisibleHours());
    this.ensureEditSubmitFooter();
    this.bindEvents();
    this.bindDrawerKeyboardEvents();
    this.memberDropdownService.bindGlobalEvents();
    this.syncDrawerUI();
    this.autoScrollService.bindUserInteractionTracking(this.elements.root);
    this.initializeDetailDrawerStack();

    await this.render();
    this.autoScrollService.scrollToCurrentTime({ offsetMinutes: 15 });
    this.autoRefreshManager.start();
  }

  getMemberNameById(memberId) {
    const member = this.currentMembers.find(
      (item) => String(item.id) === String(memberId)
    );
  
    return member?.name ?? '';
  }

  async handleMemberWeekDropdownChange({ memberId, memberName }) {
    if (!memberId) {
      return;
    }
  
    const selectedMember = this.currentMembers.find(
      (member) => String(member.id) === String(memberId)
    );
  
    const resolvedMemberName = memberName || selectedMember?.name || '';
  
    this.state.showMemberWeekView(memberId, resolvedMemberName);
    await this.render();
  }



  async resolveAutoAffiliationForCurrentState() {
    const params = this.getScheduleQueryParams();
    const response = await fetchScheduleDay(params);
    const payload = response;

    this.syncTeamSchedules(payload.data?.teamSchedules ?? payload.teamSchedules ?? []);

    const affiliationChanged = this.syncAutoSelectedAffiliation();

    return {
      affiliationChanged,
      payload,
    };
  }

  buildPendingEditPreview(dragState) {
    const scheduleContainer =
      this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
  
    return ScheduleDropOrchestratorService.buildDropResult({
      dragState,
      scheduleContainer,
      selectedDate: this.state.getSelectedDate(),
      selectedMemberId: this.state.getSelectedMemberId(),
      visibleHours: this.state.getVisibleHours(),
      beforeEvent: this.selectedEditEvent,
    });
  }
  
  syncPendingEditPreview(pendingEditEvent) {
    this.pendingEditEvent = pendingEditEvent;
  
    const scheduleContainer =
      this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
  
    if (pendingEditEvent) {
      this.editSummaryService.syncAfter(pendingEditEvent);
    }
  
    this.dragTimeIndicatorService.sync({
      scheduleContainer,
      selectedDate: this.state.getSelectedDate(),
      pendingEditEvent,
      visibleHours: this.state.getVisibleHours(),
    });
  
    this.dragTargetHighlighter.sync({
      scheduleContainer,
      memberId: this.state.isMemberWeekView()
        ? ''
        : pendingEditEvent?.memberId ?? '',
      dayKey: this.state.isMemberWeekView()
        ? pendingEditEvent?.planDate ?? ''
        : '',
    });

    this.syncEditSubmitButton();
  }
  
  resetPendingEditPreview() {
    this.pendingEditEvent = null;
  
    const scheduleContainer =
      this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
  
    this.dragTimeIndicatorService.reset();
    this.dragTargetHighlighter.reset(scheduleContainer);
  
    if (this.selectedEditEvent) {
      this.editSummaryService.syncAfter(this.selectedEditEvent);
    } else {
      this.editSummaryService.resetAll();
    }

    this.syncEditSubmitButton();
  }

  openEditMode() {
    this.state.enableMoveMode();
    this.state.openDrawer('edit');
  
    this.syncMoveModeButton();
    this.syncMoveModeView();
    this.syncDrawerUI();
  
    this.selectedEditEvent = null;
    this.pendingEditEvent = null;
  
    this.dragPreviewService.reset();
    this.dragTimeIndicatorService.reset();
    this.editSummaryService.resetAll();

    const scheduleContainer =
      this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;

    this.dragTargetHighlighter.reset(scheduleContainer);

    this.syncEditSubmitButton();
  }

  toggleEditMode() {
    if (this.state.getIsMoveMode()) {
      this.closeEditMode();
      return;
    }
  
    this.openEditMode();
  }

  isEditModeActive() {
    return (
      this.state.getIsMoveMode() &&
      this.state.getIsDrawerOpen() &&
      this.state.getActivePanelId() === 'edit'
    );
  }

  closeEditMode() {
    this.state.disableMoveMode();
    this.state.closeDrawer();
  
    this.selectedEditEvent = null;
    this.pendingEditEvent = null;
  
    this.dragPreviewService.reset();
    this.editSummaryService.resetAll();
  
    this.syncMoveModeButton();
    this.syncMoveModeView();
    this.syncDrawerUI();
    this.dragTimeIndicatorService.reset();

    const scheduleContainer =
      this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;

    this.dragTargetHighlighter.reset(scheduleContainer);
    this.syncEditSubmitButton();
  }

  async handleAutoRefresh() {
    this.syncBaseDateIfNeeded();
    this.resetSelectedDateToBaseDate();

    const { affiliationChanged, payload } =
      await this.resolveAutoAffiliationForCurrentState();

    if (affiliationChanged) {
      await this.render();
    } else {
      this.renderCurrentView(payload);
    }

    this.autoScrollService.scrollToCurrentTimeIfAllowed({ offsetMinutes: 15 });
  }

  renderCurrentView(payload, { preservedScroll = null } = {}) {
    if (this.state.isMemberWeekView()) {
      const viewModel = this.renderService.renderMemberWeekView({
        response: payload,
        container: this.elements.timeViewRoot,
        selectedDate: this.state.getSelectedDate(),
      });
  
      this.afterRender({
        viewModel,
        isMemberWeekView: true,
      });
  
      if (preservedScroll) {
        this.restoreTimeScrollPosition(preservedScroll);
      }
  
      return viewModel;
    }
  
    const viewModel = this.renderService.renderDayView({
      response: payload,
      container: this.elements.timeViewRoot,
      selectedDate: this.state.getSelectedDate(),
    });
  
    this.afterRender({
      viewModel,
      isMemberWeekView: false,
    });
  
    if (preservedScroll) {
      this.restoreTimeScrollPosition(preservedScroll);
    }
  
    return viewModel;
  }

  handleEditMemberChange(memberId) {
    if (!this.pendingEditEvent || !memberId) {
      return;
    }
  
    this.pendingEditEvent = {
      ...this.pendingEditEvent,
      memberId,
    };
  
    const scheduleContainer =
      this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
  
    this.editSummaryService.syncAfter(this.pendingEditEvent);
    this.editMemberDropdownService.sync();
  
    this.dragTimeIndicatorService.sync({
      scheduleContainer,
      selectedDate: this.state.getSelectedDate(),
      pendingEditEvent: this.pendingEditEvent,
      visibleHours: this.state.getVisibleHours(),
    });
  
    this.dragTargetHighlighter.sync({
      scheduleContainer,
      memberId: this.pendingEditEvent.memberId,
    });

    this.syncEditSubmitButton();
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

  initializeDetailDrawerStack() {
    const stackEl = this.elements.drawerStackRoot;
    const rootEl = this.elements.root;

    if (!stackEl || !rootEl) {
      return;
    }

    this.detailDrawerStack = new DrawerStack({
      stackEl,
      rootEl,
      rootClassBase: 'page',
      side: 'right',
      order: ['cell', 'detail'],
      enableEscapeClose: true,
    });
  }

  initializeDragAndDrop() {
    if (!this.elements?.scheduleContainer) {
      return;
    }
  
    this.dragManager?.destroy();
  
    this.dragManager = new ScheduleDragManager({
      rootEl: this.elements.scheduleContainer,
      canStartDrag: () => this.isEditModeActive(),
      onDragStart: (dragState) => {
        this.handleScheduleDragStart(dragState);
      },
      onDragMove: (dragState) => {
        this.handleScheduleDragMove(dragState);
      },
      onDrop: (dragState) => {
        this.handleScheduleDrop(dragState);
      },
      onCancel: () => {
        this.handleScheduleDragCancel();
      },
    });
  
    this.dragManager.bind();
  }

  handleScheduleDragStart(dragState) {
    const sourceEl = dragState?.sourceEl;
    if (!sourceEl) {
      return;
    }
  
    this.selectedEditEvent =
      this.editSummaryService.buildEventSummaryFromElement(sourceEl);
  
    this.pendingEditEvent = this.selectedEditEvent;
  
    this.editSummaryService.syncBefore(this.selectedEditEvent);
    this.editSummaryService.syncAfter(this.selectedEditEvent);
    this.editMemberDropdownService.sync();
  
    this.dragTimeIndicatorService.reset();
    this.dragPreviewService.start(sourceEl);
    this.syncEditSubmitButton();
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

    this.bindDrawerEvents();

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

      'schedule:open-member-week': async ({ element }) => {
        const memberId = element?.dataset?.memberId ?? '';
        const memberName = element?.dataset?.memberName ?? '';

        if (!memberId) {
          return;
        }

        this.state.showMemberWeekView(memberId, memberName);
        await this.render();
      },

      'schedule:return-team-day': async () => {
        this.state.showTeamDayView();
        await this.render();
      },

      'schedule:change-member-week': async ({ element }) => {
        const memberId = element?.value ?? '';

        if (!memberId) {
          return;
        }

        const selectedMember = this.currentMembers.find(
          (member) => String(member.id) === String(memberId)
        );

        if (!selectedMember) {
          return;
        }

        this.state.showMemberWeekView(selectedMember.id, selectedMember.name);
        await this.render();
      },

      'schedule:toggle-member-dropdown': () => {
        this.memberDropdownService.toggle();
      },

      'schedule:select-member': async ({ element }) => {
        const memberId = element?.dataset?.memberId;
        const memberName = element?.dataset?.memberName;

        if (!memberId) {
          return;
        }

        this.state.showMemberWeekView(memberId, memberName);
        await this.render();
      },

      'schedule:open-plan-detail': async ({ element }) => {
        if (this.isEditModeActive()) {
          this.selectedEditEvent =
            this.editSummaryService.buildEventSummaryFromElement(element);
          this.editSummaryService.syncBefore(this.selectedEditEvent);
          return;
        }
      
        const inspectionNo = element?.dataset?.inspectionNo ?? '';
      
        if (!inspectionNo) {
          return;
        }
      
        await this.openInspectionCardDetail(inspectionNo);
      },

      'schedule:open-edit-mode': () => {
        this.toggleEditMode();
      },

      'schedule:open-edit-member-dropdown': () => {
        this.editMemberDropdownService.open();
      },

      'schedule:submit-edit': async () => {
        await this.handleEditSubmit();
      },

    });
  }

  async handleEditSubmit() {
    const payload = this.buildEditSubmitPayload();
  
    if (!payload) {
      console.warn('[handleEditSubmit] payload is invalid');
      return;
    }
  
    const preservedScroll = this.captureTimeScrollPosition();
  
    try {
      await executeScheduleEventMove(payload);
  
      this.dragPreviewService.reset();
      this.dragTimeIndicatorService.reset();
  
      const scheduleContainer =
        this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
  
      this.dragTargetHighlighter.reset(scheduleContainer);
  
      await this.render({ preservedScroll });
      this.closeEditMode();
    } catch (error) {
      console.error('[handleEditSubmit] move failed:', error);
    }
  }


  syncEditSubmitButton() {
    const button = this.elements.root?.querySelector(
      '[data-ui-action="schedule:submit-edit"]'
    );
  
    if (!button) {
      return;
    }
  
    const isEnabled = this.hasPendingEditChanges();
  
    button.disabled = !isEnabled;
    button.setAttribute('aria-disabled', String(!isEnabled));
  }

  buildEditSubmitPayload() {
    if (!this.selectedEditEvent || !this.pendingEditEvent) {
      return null;
    }
  
    return {
      id: this.selectedEditEvent.id,
      holderId: this.pendingEditEvent.memberId,
      planTime: `${this.pendingEditEvent.planDate}T${this.pendingEditEvent.startTime}:00`,
    };
  }

  hasPendingEditChanges() {
    if (!this.selectedEditEvent || !this.pendingEditEvent) {
      return false;
    }
  
    return !(
      String(this.selectedEditEvent.memberId) === String(this.pendingEditEvent.memberId) &&
      this.selectedEditEvent.planDate === this.pendingEditEvent.planDate &&
      this.selectedEditEvent.startTime === this.pendingEditEvent.startTime
    );
  }

  bindEditDateTimeEvents() {
    const root = this.elements?.editAfterSummary;
    const dateInput = root?.querySelector('[data-role="edit-date"]');
    const timeInput = root?.querySelector('[data-role="edit-time"]');
  
    if (dateInput) {
      dateInput.onchange = () => {
        this.handleEditDateTimeChange();
      };
    }
  
    if (timeInput) {
      timeInput.onchange = () => {
        this.handleEditDateTimeChange();
      };
    }
  }
  

  handleEditDateTimeChange() {
    if (!this.pendingEditEvent) {
      console.log('[Controller] handleEditDateTimeChange skipped: no pendingEditEvent');
      return;
    }
  
    const root = this.elements?.editAfterSummary;
    const dateInput = root?.querySelector('[data-role="edit-date"]');
    const timeInput = root?.querySelector('[data-role="edit-time"]');
  
    const nextDate = dateInput?.value ?? '';
    const nextStartTime = timeInput?.value ?? '';
  
    if (!nextDate || !nextStartTime) {
      return;
    }
  
    const durationMinutes =
      ScheduleMoveTimeService.getDurationMinutes(this.pendingEditEvent);
  
    this.pendingEditEvent = {
      ...this.pendingEditEvent,
      planDate: nextDate,
      startTime: nextStartTime,
      endTime: ScheduleMoveTimeService.addMinutesToTime(
        nextStartTime,
        durationMinutes
      ),
    };
  
    this.editSummaryService.syncAfter(this.pendingEditEvent);
    this.editMemberDropdownService.sync();
    
    this.dragTimeIndicatorService.sync({
      scheduleContainer: this.elements?.scheduleContainer ?? this.elements?.timeViewRoot,
      selectedDate: this.state.getSelectedDate(),
      pendingEditEvent: this.pendingEditEvent,
      visibleHours: this.state.getVisibleHours(),
    });

    this.syncEditSubmitButton();
  }
  bindDrawerKeyboardEvents() {
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }
  
      if (!this.state.getIsDrawerOpen()) {
        return;
      }
  
      const wasEditActive = this.isEditModeActive();
  
      this.state.closeDrawer();
  
      if (wasEditActive) {
        this.state.disableMoveMode();
        this.dragPreviewService.reset();
        this.resetPendingEditPreview();
      }
  
      this.syncMoveModeButton();
      this.syncMoveModeView();
      this.syncDrawerUI();
    });
  }

  bindDrawerEvents() {
    this.elements.panelButtons?.forEach((button) => {
      button.addEventListener('click', () => {
        const panelId = button.dataset.panelId ?? '';
        this.handleDrawerPanelToggle(panelId);
      });
    });
  }

  handleDrawerPanelToggle(panelId) {
    if (!panelId) {
      return;
    }
  
    const wasEditActive = this.isEditModeActive();
  
    this.state.toggleDrawer(panelId);
  
    const isEditPanelClosed =
      wasEditActive &&
      (!this.state.getIsDrawerOpen() || this.state.getActivePanelId() !== 'edit');
  
    if (isEditPanelClosed) {
      this.state.disableMoveMode();
      this.dragPreviewService.reset();
      this.resetPendingEditPreview();
    }
  
    this.syncMoveModeButton();
    this.syncMoveModeView();
    this.syncDrawerUI();
  }

  syncDrawerUI() {
    const isDrawerOpen = this.state.getIsDrawerOpen();
    const activePanelId = this.state.getActivePanelId();
  
    if (this.elements.layout) {
      this.elements.layout.dataset.drawerOpen = String(isDrawerOpen);
      this.elements.layout.dataset.activePanel = activePanelId;
    }
  
    if (this.elements.drawer) {
      this.elements.drawer.setAttribute('aria-hidden', String(!isDrawerOpen));
    }
  
    this.elements.panelButtons?.forEach((button) => {
      const isActive =
        isDrawerOpen && button.dataset.panelId === activePanelId;
  
      button.setAttribute('aria-pressed', String(isActive));
    });
  
    this.elements.panels?.forEach((panel) => {
      const isActive =
        isDrawerOpen && panel.dataset.panelId === activePanelId;
  
      panel.hidden = !isActive;
    });
  
    this.syncAutoRefreshByDrawerState(isDrawerOpen);
  }

  getTimeScheduleScrollContainer() {
    return this.elements.timeViewRoot?.querySelector('.time-schedule') ?? null;
  }
  
  captureTimeScrollPosition() {
    const scrollContainer = this.getTimeScheduleScrollContainer();
  
    return {
      scrollTop: scrollContainer?.scrollTop ?? 0,
    };
  }
  
  restoreTimeScrollPosition({ scrollTop = 0 } = {}) {
    const scrollContainer = this.getTimeScheduleScrollContainer();
  
    if (!scrollContainer) {
      return;
    }
  
    scrollContainer.scrollTop = scrollTop;
  }

  syncAutoRefreshByDrawerState(isDrawerOpen = this.state.getIsDrawerOpen()) {
    if (isDrawerOpen) {
      this.autoRefreshManager.stop();
      return;
    }
  
    if (!this.autoRefreshManager.isRunning()) {
      this.autoRefreshManager.start();
    }
  }

  async openInspectionCardDetail(inspectionNo) {
    const detailStack = this.detailDrawerStack;
    const detailPanel = detailStack?.panel('detail');

    if (!detailPanel || !inspectionNo) {
      return;
    }

    detailStack.openPanels(['detail']);
    detailPanel.setTitle('作業詳細');
    detailPanel.setBodyHtml('<p>読み込み中...</p>');
    detailPanel.showBody();

    try {
      const response = await fetchInspectionCardDetail({ inspectionNo });
      const workName = response.plan.check.work_name

      const title = `${workName}(${inspectionNo})`;
      const cardsVm = buildPlanDetailCardsVM(response, { title });
      const extraVm = buildExtraDetailVM(response, { title });

      const bodyHtml = `
        ${renderPlanDetailCardsHTML(cardsVm)}
      `;

      detailPanel.setTitle(title);
      detailPanel.setBodyHtml(bodyHtml);
      detailPanel.showBody();
    } catch (error) {

      detailPanel.setTitle('作業詳細');
      detailPanel.setBodyHtml('<p>詳細情報の取得に失敗しました。</p>');
      detailPanel.showBody();
    }
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

  syncViewHeaderUI() {
    const returnButton = this.elements.returnTeamDayButton;
    const teamButtonsContainer = this.elements.teamButtonsContainer;
    const memberDropdown = this.elements.memberDropdown;
    const memberDropdownTrigger = this.elements.memberDropdownTrigger;
    const memberDropdownTriggerText = this.elements.memberDropdownTriggerText;
    const memberDropdownPanel = this.elements.memberDropdownPanel;
    const navButtons = this.elements.navButtons;
  
    const isMemberWeekView = this.state.isMemberWeekView();
    const isMemberDropdownOpen = this.state.getIsMemberDropdownOpen();
  
    if (isMemberWeekView) {
      this.memberDropdownService.renderOptions();
    }
  
    if (returnButton) {
      returnButton.hidden = !isMemberWeekView;
    }
  
    if (teamButtonsContainer) {
      teamButtonsContainer.hidden = isMemberWeekView;
    }
  
    if (memberDropdown) {
      memberDropdown.hidden = !isMemberWeekView;
      memberDropdown.dataset.state =
        isMemberWeekView && isMemberDropdownOpen ? 'open' : 'closed';
    }
  
    if (memberDropdownTrigger) {
      memberDropdownTrigger.setAttribute(
        'aria-expanded',
        String(isMemberWeekView && isMemberDropdownOpen)
      );
    }
  
    if (memberDropdownTriggerText) {
      memberDropdownTriggerText.textContent = isMemberWeekView
        ? this.state.getSelectedMemberName()
        : '';
    }
  
    if (memberDropdownPanel) {
      memberDropdownPanel.hidden = !(isMemberWeekView && isMemberDropdownOpen);
    }
  
    if (navButtons) {
      navButtons.hidden = isMemberWeekView;
    }
  }

  ensureEditSubmitFooter() {
    const footer = this.elements?.editFooter;
  
    if (!footer || footer.childElementCount > 0) {
      return;
    }
  
    footer.innerHTML = renderButtonHTML({
      label: '登録',
      action: 'schedule:submit-edit',
      variant: 'primary',
      size: 'md',
      className: 'schedule-page__editSubmit',
      disabled: true,
    });
  }
  syncTeamSchedules(teamSchedules) {
    this.state.setTeamSchedules(teamSchedules);
  }

  afterRender({ viewModel = null, isMemberWeekView = false } = {}) {
    if (isMemberWeekView) {
      this.updateTitle(viewModel?.weekRangeText ?? this.state.getSelectedDate());
    } else {
      this.currentMembers = viewModel?.members ?? [];
      this.updateTitleByScrollPosition(this.state.getSelectedDate());
    }
  
    this.syncViewHeaderUI();
    this.autoScrollService.bindScrollTracking();
    this.syncMoveModeButton();
    this.syncMoveModeView();
    this.editSummaryService.syncBefore(this.selectedEditEvent);
    this.editSummaryService.syncAfter(this.pendingEditEvent);
    this.editMemberDropdownService.sync();
    this.ensureEditSubmitFooter();
    this.bindEditDateTimeEvents();
    this.initializeDragAndDrop();
    this.syncEditSubmitButton();
  }

  async render({ preservedScroll = null } = {}) {
    if (this.state.isMemberWeekView()) {
      const response = await fetchScheduleMemberWeek({
        date: this.state.getSelectedDate(),
        memberId: this.state.getSelectedMemberId(),
      });
  
      this.renderCurrentView(response, { preservedScroll });
      return;
    }
  
    const params = this.getScheduleQueryParams();
    const response = await fetchScheduleDay(params);
    const payload = response;
  
    this.syncTeamSchedules(payload.data?.teamSchedules ?? payload.teamSchedules ?? []);
    this.renderCurrentView(payload, { preservedScroll });
  }

  updateRangeButtonsByHours(activeHours) {
    this.elements.rangeButtons?.forEach((button) => {
      const buttonHours = Number(button.dataset.hours ?? 0);
      const isActive = buttonHours === activeHours;

      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  updateTitle(dateText) {
    this.elements.title.textContent = `${dateText}`;
  }

  syncMoveModeButton() {
    const button = this.elements?.editModeButton;
    if (!button) return;
  
    const isMoveMode = this.state.getIsMoveMode();
  
    button.setAttribute('aria-pressed', String(isMoveMode));
    button.classList.toggle('is-active', isMoveMode);
    button.setAttribute(
      'aria-label',
      isMoveMode ? '編集モードを終了する' : '編集モードを開く'
    );
    button.setAttribute(
      'title',
      isMoveMode ? '編集モード中' : '編集モード'
    );
  }

  syncMoveModeView() {
    const container = this.elements?.scheduleContainer;
    if (!container) return;
  
    container.classList.toggle('is-move-mode', this.isEditModeActive());
  }

  handleScheduleDragMove(dragState) {
    this.dragPreviewService.move({
      startClientX: dragState.startClientX,
      startClientY: dragState.startClientY,
      currentClientX: dragState.currentClientX,
      currentClientY: dragState.currentClientY,
    });
  
    const { isValid, pendingEditEvent } = this.buildPendingEditPreview(dragState);
  
    if (!isValid) {
      this.dragPreviewService.reset();
      this.resetPendingEditPreview();
      return;
    }
  
    this.syncPendingEditPreview(pendingEditEvent);
  }
  
  async handleScheduleDrop(dragState) {
    const scheduleContainer =
      this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
  
    const { isValid, payload, pendingEditEvent } =
      ScheduleDropOrchestratorService.buildDropResult({
        dragState,
        scheduleContainer,
        selectedDate: this.state.getSelectedDate(),
        selectedMemberId: this.state.getSelectedMemberId(),
        visibleHours: this.state.getVisibleHours(),
        beforeEvent: this.selectedEditEvent,
      });
  
    if (!isValid) {
      this.dragPreviewService.reset();
      this.resetPendingEditPreview();
      return;
    }

    this.syncPendingEditPreview(pendingEditEvent);
  
    const preservedScroll = this.captureTimeScrollPosition();
  
    try {
      await executeScheduleEventMove(payload);
      await this.render({ preservedScroll });
    } catch (error) {
      console.error('[handleScheduleDrop] move failed:', error);
    } finally {
      this.dragPreviewService.reset();
      this.dragTimeIndicatorService.reset();
    
      const scheduleContainer =
        this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
    
      this.dragTargetHighlighter.reset(scheduleContainer);
    }
  }

  handleScheduleDragCancel() {
    this.dragPreviewService.reset();
    this.pendingEditEvent = null;
    this.dragTimeIndicatorService.reset();
  
    const scheduleContainer =
      this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
  
    this.dragTargetHighlighter.reset(scheduleContainer);
  
    if (this.selectedEditEvent) {
      this.editSummaryService.syncAfter(this.selectedEditEvent);
      this.editMemberDropdownService.sync();
    }
  
    this.syncEditSubmitButton();
  }
}