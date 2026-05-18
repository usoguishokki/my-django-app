import { ScheduleTestCardFilterService } from './testCards/ScheduleTestCardFilterService.js';
import { ScheduleTestCardRenderService } from './testCards/ScheduleTestCardRenderService.js';
import { ScheduleTestCardDataService } from './testCards/ScheduleTestCardDataService.js';

import { ScheduleEditPayloadService } from './edit/ScheduleEditPayloadService.js';
import { ScheduleEditModeStateService } from './edit/ScheduleEditModeStateService.js';
import { ScheduleEditDateTimeService } from './edit/ScheduleEditDateTimeService.js';
import { ScheduleEditSelectionService } from './edit/ScheduleEditSelectionService.js';
import { ScheduleEditInteractionService } from './edit/ScheduleEditInteractionService.js';
import { ScheduleEditCommitService } from './edit/ScheduleEditCommitService.js';

import { ScheduleDragDropService } from './dragDrop/ScheduleDragDropService.js';

import { ScheduleActionHandlers } from './actions/ScheduleActionHandlers.js';

import { ScheduleDataService } from './data/ScheduleDataService.js';

import { ScheduleInitialStateService } from './state/ScheduleInitialStateService.js';

import { ScheduleAffiliationService } from './team/ScheduleAffiliationService.js';
import { ScheduleTeamDropdownService } from './team/ScheduleTeamDropdownService.js';

import { ScheduleMemberService } from './member/ScheduleMemberService.js';

import { ScheduleDetailDrawerService } from './details/ScheduleDetailDrawerService.js';

import {
  ScheduleBulkRegistrationPayloadService,
} from './details/ScheduleBulkRegistrationPayloadService.js';

import {
  ScheduleBulkRegistrationMemberHighlightService,
} from './details/ScheduleBulkRegistrationMemberHighlightService.js';

import {
  ScheduleBulkRegistrationMemberDropdownService,
} from './details/ScheduleBulkRegistrationMemberDropdownService.js';

import {
  ScheduleBulkRegistrationPanelService,
} from './details/ScheduleBulkRegistrationPanelService.js';

import { ScheduleHeaderUiService } from './view/ScheduleHeaderUiService.js';
import { ScheduleButtonStateUiService } from './view/ScheduleButtonStateUiService.js';
import { ScheduleAsideUiService } from './view/ScheduleAsideUiService.js';

import { ScheduleEditModeUiService } from './edit/ScheduleEditModeUiService.js';
import { ScheduleEditSubmitUiService } from './edit/ScheduleEditSubmitUiService.js';
import { ScheduleRangeMovePayloadService } from './edit/ScheduleRangeMovePayloadService.js';

import { SchedulePanelUiService } from './panels/SchedulePanelUiService.js';
import { SchedulePanelStateService } from './panels/SchedulePanelStateService.js';

import { ScheduleRenderFlowService } from './render/ScheduleRenderFlowService.js';

import { ScheduleAutoRefreshFlowService } from './autoRefresh/ScheduleAutoRefreshFlowService.js';

import { ScheduleEditSessionService } from './edit/ScheduleEditSessionService.js';

import { ScheduleAutoRefreshManager } from './ScheduleAutoRefreshManager.js';
import { ScheduleTitleService } from './ScheduleTitleService.js';
import { ScheduleRenderService } from './ScheduleRenderService.js';
import { ScheduleEditSummaryService } from './ScheduleEditSummaryService.js';
import { ScheduleAutoScrollService } from './ScheduleAutoScrollService.js';
import { ScheduleMemberDropdownService } from './ScheduleMemberDropdownService.js';
import { ScheduleEditMemberDropdownService } from './ScheduleEditMemberDropdownService.js';
import { ScheduleDragPreviewService } from './ScheduleDragPreviewService.js';
import { ScheduleDragTimeIndicatorService } from './ScheduleDragTimeIndicatorService.js';

import { ScheduleViewConfigService } from '../domain/ScheduleViewConfigService.js';
import { ScheduleMoveTimeService } from '../domain/ScheduleMoveTimeService.js';
import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';
import { ScheduleRangeSelectionEventCollector } from '../domain/ScheduleRangeSelectionEventCollector.js';
import { ScheduleRangeSelectionMovePlanner } from '../domain/ScheduleRangeSelectionMovePlanner.js';
import { ScheduleRangeSelectionResolver } from '../domain/ScheduleRangeSelectionResolver.js';
import { SchedulePlanStatusPolicy } from '../domain/SchedulePlanStatusPolicy.js';

import { ScheduleDragManager } from '../ui/ScheduleDragManager.js';
import { ScheduleRangeSelectionManager } from '../ui/ScheduleRangeSelectionManager.js'
import { ScheduleActiveDateAliasRenderer } from '../ui/ScheduleActiveDateAliasRenderer.js';
import { ScheduleDragTargetHighlighter } from '../ui/ScheduleDragTargetHighlighter.js';
import {
  ScheduleFeedbackPresenter,
} from '../ui/ScheduleFeedbackService.js';

import { bindUIActions } from '../../ui/componets/actions/UIActionDispatcher.js';

import {
  withElementLoading,
} from '../../manager/loadingManager.js';

import {
  formatCompactDateLabel,
  formatTitleWeekdayLabel,
  normalizeDateInputValue,
  normalizeTimeInputValue,
  addDaysToDateInputValue,
  isNextDayTimeRange,
} from '../../utils/dateTime.js';

export class ScheduleController {
  static AUTO_SCROLL_SUPPRESS_MS = 30 * 1000;

  static DRAG_SOURCE_SELECTOR =
    '[data-role="schedule-event"], [data-role="schedule-test-card"]';

  constructor({
    state,
    timeRenderer,
    memberWeekRenderer,
    elements,
    initialData = {},
  }) {
    this.state = state;
    this.timeRenderer = timeRenderer;
    this.memberWeekRenderer = memberWeekRenderer;
    this.elements = elements;
    this.initialData = initialData;

    this.unbindUIActions = null;
  
    this.initializeCoreServices();
    this.initializeViewServices();
    this.initializeEditServices();
    this.initializeTestCardServices();
    this.initializePanelServices();
    this.initializeAutoRefreshServices();
    this.initializeActionHandlers();
  }

  async init() {
    if (!this.canInitialize()) {
      return;
    }
  
    this.initializeInitialState();
    this.initializeInitialUI();
    this.bindInitialEvents();
    this.initializeDrawerStack();
  
    await this.renderInitialView();
  }
  
  initializeCoreServices() {
    this.dataService = new ScheduleDataService();

    this.activeDateAliasRenderer = new ScheduleActiveDateAliasRenderer({
      element: this.elements.scheduleActiveDateAlias,
    });
  
    this.initialStateService = new ScheduleInitialStateService({
      state: this.state,
    });
  
    this.affiliationService = new ScheduleAffiliationService({
      state: this.state,
      dataService: this.dataService,
      onSyncTeamButtons: (affiliationId) =>
        this.updateTeamButtonsByAffiliationId(affiliationId),
    });
  
    this.memberService = new ScheduleMemberService();
  
    this.detailDrawerService = new ScheduleDetailDrawerService({
      elements: this.elements,
      dataService: this.dataService,
    });
  
    this.autoRefreshManager = new ScheduleAutoRefreshManager({
      onRefresh: () => this.handleAutoRefresh(),
      intervalMinutes: 15,
    });
  }

  initializeActionHandlers() {
    this.actionHandlers = new ScheduleActionHandlers({
      state: this.state,
      render: () => this.render(),
  
      updateTeamButtonsByAffiliationId: (affiliationId) =>
        this.updateTeamButtonsByAffiliationId(affiliationId),
  
      updateRangeButtonsByHours: (hours) =>
        this.updateRangeButtonsByHours(hours),
  
      memberService: this.memberService,
      memberDropdownService: this.memberDropdownService,
      teamDropdownService: this.teamDropdownService,
  
      testCardRenderService: this.testCardRenderService,
  
      handleTestCardMachineChange: (machineName) =>
        this.handleTestCardMachineChange(machineName),

      handleTestCardInspectionTypeChange: (inspectionType) =>
        this.handleTestCardInspectionTypeChange(inspectionType),

      handleTestCardTimeZoneChange: (timeZone) =>
        this.handleTestCardTimeZoneChange(timeZone),  
      
      handleTestCardProcessChange: (processName) =>
        this.handleTestCardProcessChange(processName),
  
      handleTestCardCaseChange: (caseKey) =>
        this.handleTestCardCaseChange(caseKey),

      handleTestCardDateAliasChange: (dateAlias) =>
        this.handleTestCardDateAliasChange(dateAlias),
  
      isEditModeActive: () => this.isEditModeActive(),
  
      selectEditEventFromElement: (element) =>
        this.selectEditEventFromElement(element),
  
      detailDrawerService: this.detailDrawerService,
  
      toggleEditMode: () => this.toggleEditMode(),
  
      editMemberDropdownService: this.editMemberDropdownService,
  
      handleFilterPaneToggle: () => this.handleFilterPaneToggle(),
  
      handleEditSubmit: () => this.handleEditSubmit(),

      handleEditRetract: () => this.handleEditRetract(),

      handleTestCardTeamChange: (affiliationId) =>
        this.handleTestCardTeamChange(affiliationId),
      
      openBulkRegistrationDrawer: () =>
        this.openBulkRegistrationDrawer(),
      
      openBulkPullbackDrawer: ({ element }) =>
        this.openBulkPullbackDrawer({ element }),
        
      
      backToTestCardsPanel: () =>
        this.backToTestCardsPanel(),
      
      bulkRegistrationMemberDropdownService:
        this.bulkRegistrationMemberDropdownService,
      
      handleBulkRegistrationSubmit: () =>
        this.handleBulkRegistrationSubmit(),
      
      handleBulkPullbackSubmit: () =>
        this.handleBulkPullbackSubmit(),
    });
  }

  initializeViewServices() {
    this.renderService = new ScheduleRenderService({
      getMinuteHeight: () =>
        ScheduleViewConfigService.getMinuteHeight(this.state.getVisibleHours()),
      getVisibleHours: () => this.state.getVisibleHours(),
      timeRenderer: this.timeRenderer,
      memberWeekRenderer: this.memberWeekRenderer,
    });

    this.renderFlowService = new ScheduleRenderFlowService({
      state: this.state,
      elements: this.elements,
      renderService: this.renderService,
      dataService: this.dataService,
      affiliationService: this.affiliationService,
      onActiveDateAliasChange: () => this.renderActiveDateAlias(),
      afterRender: (options) => this.afterRender(options),
      restoreTimeScrollPositionIfNeeded: (preservedScroll) =>
        this.restoreTimeScrollPositionIfNeeded(preservedScroll),
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
      getMembers: () => this.memberService.getMembers(),
      onSyncViewHeaderUI: () => this.syncViewHeaderUI(),
      onChange: ({ memberId, memberName }) =>
        this.handleMemberWeekDropdownChange({ memberId, memberName }),
    });

    this.teamDropdownService = new ScheduleTeamDropdownService({
      elements: this.elements,
    });
    
    this.headerUiService = new ScheduleHeaderUiService({
      elements: this.elements,
      memberDropdownService: this.memberDropdownService,
    });

    this.buttonStateUiService = new ScheduleButtonStateUiService({
      elements: this.elements,
    });

    this.asideUiService = new ScheduleAsideUiService({
      elements: this.elements,
    });
  }

  initializeEditServices() {
    this.editSessionService = new ScheduleEditSessionService();
    this.editSummaryService = new ScheduleEditSummaryService({
      getSelectedDate: () => this.state.getSelectedDate(),
      getMemberNameById: (memberId) => this.memberService.getNameById(memberId),
      elements: this.elements,
    });
  
    this.editSelectionService = new ScheduleEditSelectionService({
      buildEventSummaryFromElement: (element) =>
        this.editSummaryService.buildEventSummaryFromElement(element),
    });
  
    this.editMemberDropdownService = new ScheduleEditMemberDropdownService({
      elements: this.elements,
      getMembers: () => this.memberService.getMembers(),
      onChange: ({ memberId }) => this.handleEditMemberChange(memberId),
    });
  
    this.editModeStateService = new ScheduleEditModeStateService({
      state: this.state,
    });

    this.editModeUiService = new ScheduleEditModeUiService({
      elements: this.elements,
    });

    this.editSubmitUiService = new ScheduleEditSubmitUiService({
      elements: this.elements,
      hasPendingChanges: () => this.hasPendingEditChanges(),
      canRetractEdit: () => this.canRetractSelectedEditEvent(),
    });
  
    this.dragPreviewService = new ScheduleDragPreviewService();
    this.dragTimeIndicatorService = new ScheduleDragTimeIndicatorService();
    this.dragTargetHighlighter = new ScheduleDragTargetHighlighter();
  
    this.editInteractionService = new ScheduleEditInteractionService({
      editSummaryService: this.editSummaryService,
      editMemberDropdownService: this.editMemberDropdownService,
      dragPreviewService: this.dragPreviewService,
      dragTimeIndicatorService: this.dragTimeIndicatorService,
      dragTargetHighlighter: this.dragTargetHighlighter,
      getScheduleContainer: () => this.getScheduleContainer(),
      getSelectedDate: () => this.state.getSelectedDate(),
      getVisibleHours: () => this.state.getVisibleHours(),
      onBindDateTimeEvents: () => this.bindEditDateTimeEvents(),
      onSyncSubmitButton: () => this.syncEditSubmitButton(),
    });
  
    this.editCommitService = new ScheduleEditCommitService({
      captureScrollPosition: () => this.captureTimeScrollPosition(),
      finalizeCommit: (options) => this.finalizeEditCommit(options),
      finalizeRetract: (options) => this.finalizeEditRetract(options),
      resetDragInteraction: () => this.resetDragInteractionUI(),
    });
  
    this.dragDropService = new ScheduleDragDropService({
      getScheduleContainer: () => this.getScheduleContainer(),
      getSelectedDate: () => this.state.getSelectedDate(),
      getSelectedMemberId: () => this.state.getSelectedMemberId(),
      getVisibleHours: () => this.state.getVisibleHours(),
      getBeforeEvent: () => this.editSessionService.getSelected(),
      hasEditChanges: (beforeEvent, afterEvent) =>
        ScheduleEditPayloadService.hasChanges(beforeEvent, afterEvent),
    });

    this.bulkRegistrationMemberDropdownService =
      new ScheduleBulkRegistrationMemberDropdownService({
        elements: this.elements,
        getMembers: () => this.memberService.getMembers(),
        getSelectedMemberId: () =>
          this.state.getBulkRegistrationMemberId?.() ?? '',
        onChange: ({ memberId, memberName }) => {
          this.state.setBulkRegistrationMember({
            memberId,
            memberName,
          });
        
          this.bulkRegistrationMemberDropdownService.syncSelection({
            memberId,
            memberName,
          });
        
          this.syncBulkRegistrationMemberHighlight(memberId);
        },
      });

    this.bulkRegistrationMemberHighlightService =
      new ScheduleBulkRegistrationMemberHighlightService();
  }

  initializeTestCardServices() {
    this.testCardDataService = new ScheduleTestCardDataService({
      state: this.state,
      dataService: this.dataService,
  
      getSelectedDate: () => this.state.getSelectedDate(),
  
      getSelectedDateAlias: () =>
        this.state.getSelectedTestCardDateAlias(),
  
      getSelectedShiftPatternId: () =>
        this.state.getSelectedTestCardShiftPatternId?.() ?? '',
  
      initialDateAliasOptions:
        this.initialData?.filterOptions?.dateAliases
        ?? this.initialData?.dateAliases
        ?? [],
    });
  
    this.testCardFilterService = new ScheduleTestCardFilterService({
      state: this.state,
      getItems: () => this.testCardDataService.getItems(),
      getDateAliasOptions: () => this.testCardDataService.getDateAliasOptions(),
    });
  
    this.testCardRenderService = new ScheduleTestCardRenderService({
      elements: this.elements,
      filterService: this.testCardFilterService,
    });
  
    this.bulkRegistrationPanelService =
      new ScheduleBulkRegistrationPanelService({
        elements: this.elements,
        filterService: this.testCardFilterService,
      });

    this.bulkRegistrationPayloadService =
      new ScheduleBulkRegistrationPayloadService({
        getRoot: () => this.elements.testCardsPanelBody,
        getMemberId: () =>
          this.state.getBulkRegistrationMemberId?.() ?? '',
      });
  }

  initializePanelServices() {
    this.panelUiService = new SchedulePanelUiService({
      elements: this.elements,
    });
  
    this.panelStateService = new SchedulePanelStateService({
      state: this.state,
    });
  }

  initializeInitialUI() {
    this.syncInitialActiveTeamButton();
    this.updateRangeButtonsByHours(this.state.getVisibleHours());
    this.ensureEditSubmitFooter();
    this.testCardRenderService.renderFilterPane();
    this.syncPanelUI();
  }

  initializeInitialState() {
    this.initialStateService.syncInitialScheduleDate();
    this.initialStateService.syncInitialAffiliationId();
  }

  initializeAutoRefreshServices() {
    this.autoRefreshFlowService = new ScheduleAutoRefreshFlowService({
      initialStateService: this.initialStateService,
      affiliationService: this.affiliationService,
      render: () => this.render(),
      renderCurrentView: (payload, options) =>
        this.renderFlowService.renderCurrentView(payload, options),
      scrollToCurrentTimeIfAllowed: (options) =>
        this.autoScrollService.scrollToCurrentTimeIfAllowed(options),
    });
  }

  bindInitialEvents() {
    this.bindEvents();
    this.bindDrawerKeyboardEvents();
    this.memberDropdownService.bindGlobalEvents();
    this.teamDropdownService.bindGlobalEvents();
    this.autoScrollService.bindUserInteractionTracking(this.elements.root);
  }
  
  initializeDrawerStack() {
    this.detailDrawerService.initializeStack();
  }

  async renderInitialView() {
    await this.render();
    this.autoScrollService.scrollToCurrentTime({ offsetMinutes: 15 });
    this.autoRefreshManager.start();
  }

  canInitialize() {
    return Boolean(this.elements.title && this.elements.timeViewRoot);
  }

  async handleMemberWeekDropdownChange({ memberId, memberName }) {
    if (!memberId) {
      return;
    }
  
    const selectedMember = this.memberService.findById(memberId);
    const resolvedMemberName = memberName || selectedMember?.name || '';

    this.state.showMemberWeekView(memberId, resolvedMemberName);
    await this.render();
  }

  async loadTestCardsWeek({ loading = true } = {}) {
    const run = async () => {
      const shiftPatternId =
        this.state.getSelectedTestCardShiftPatternId?.() ?? '';
  
      if (!shiftPatternId) {
        this.testCardDataService.clearItems?.();
        this.renderTestCardPanelByCurrentMode();
        return;
      }
  
      await this.testCardDataService.loadWeek();
      this.renderTestCardPanelByCurrentMode();
    };
  
    if (!loading) {
      await run();
      return;
    }
  
    await withElementLoading(
      this.getTestCardsLoadingTarget(),
      run,
      {
        title: this.isBulkRegistrationPanelActive?.()
          ? '一括登録を更新中'
          : 'カードを読み込み中',
        sub: '点検カードを取得しています',
        size: 'md',
        duration: 120,
      }
    );
  }

  async refreshTestCardsWeekWithLoading({
    syncTeamOptions = false,
  } = {}) {
    await withElementLoading(
      this.getTestCardsLoadingTarget(),
      async () => {
        if (syncTeamOptions) {
          await this.syncTestCardTeamOptionsByDateAlias();
        }
  
        await this.loadTestCardsWeek({
          loading: false,
        });
      },
      {
        title: this.isBulkRegistrationPanelActive?.()
          ? '一括登録を更新中'
          : 'カードを読み込み中',
        sub: '点検カードを取得しています',
        size: 'md',
        duration: 120,
      }
    );
  }

  syncPendingEditPreview(pendingEditEvent) {
    this.setPendingEditSession(pendingEditEvent);
  }

  syncPendingEditEventUI() {
    const { pendingEditEvent } = this.editSessionService.getSnapshot();
  
    this.editInteractionService.syncPending({
      pendingEditEvent,
      isMemberWeekView: this.state.isMemberWeekView(),
    });
  }

  syncMoveModeUI() {
    this.editModeUiService.sync({
      isMoveMode: this.isEditModeActive(),
    });
  }

  async syncTestCardTeamOptionsByDateAlias() {
    const teamOptions = await this.testCardDataService.loadTeamOptions();
  
    if (!Array.isArray(teamOptions) || teamOptions.length === 0) {
      this.state.setTestCardTeamOptions([]);
      this.state.setSelectedTestCardAffiliationId('');
      return false;
    }
  
    this.state.setTestCardTeamOptions(teamOptions);
    this.syncSelectedTestCardAffiliationIdByTeamOptions(teamOptions);
  
    return true;
  }
  
  syncSelectedTestCardAffiliationIdByTeamOptions(teamOptions = []) {
    const options = Array.isArray(teamOptions) ? teamOptions : [];
  
    if (options.length === 0) {
      this.state.setSelectedTestCardAffiliationId('');
      return false;
    }
  
    const currentAffiliationId = String(
      this.state.getSelectedTestCardAffiliationId?.() ?? ''
    );
  
    const hasCurrentAffiliation = options.some(
      (teamOption) =>
        String(teamOption.affiliationId ?? '') === currentAffiliationId
    );
  
    if (hasCurrentAffiliation) {
      return true;
    }
  
    this.state.setSelectedTestCardAffiliationId('');
    return false;
  }

  resetPendingEditPreview() {
    this.editSessionService.setPending(null);
  
    const { selectedEditEvent } = this.editSessionService.getSnapshot();
  
    this.editInteractionService.resetPending({
      selectedEditEvent,
    });
  }

  resetPendingDropIndicators() {
    this.editSessionService.setPending(null);
  
    const { selectedEditEvent } = this.editSessionService.getSnapshot();
  
    this.editInteractionService.resetDropIndicators({
      selectedEditEvent,
    });
  }

  openEditMode() {
    this.closeFilterPane();
    this.editModeStateService.open();
  
    this.syncMoveModeUI();
    this.syncDrawerUI();
  
    this.resetEditState();
    this.resetEditInteractionUI();
  }

  openBulkPullbackDrawer({ element } = {}) {
    const memberId =
      element?.dataset?.memberId
      || this.state.getSelectedMemberId?.()
      || '';
  
    const memberName =
      element?.dataset?.memberName
      || this.state.getSelectedMemberName?.()
      || '';
  
    const dayKey = element?.dataset?.dayKey ?? '';
    const dayLabel = element?.dataset?.dayLabel ?? '';
  
    if (!memberId) {
      console.warn('[bulk pullback] memberId is empty.');
      return;
    }
  
    const items = this.collectVisibleScheduleEventsByMemberId(memberId, {
      dayKey,
    });
  
    this.closeFilterPane();
  
    this.state.openDrawer('test');
  
    this.panelUiService.setDrawerVariant('bulk-pullback');
  
    this.syncPanelUI();
  
    this.bulkRegistrationPanelService.renderPullback({
      items,
      memberId,
      memberName,
      dayKey,
      dayLabel,
    });
  
    this.bulkRegistrationMemberHighlightService?.sync({
      scheduleContainer: this.getScheduleContainer(),
      memberId,
      enabled: true,
    });
  }
  
  closeBulkPullbackDrawer() {
    this.bulkRegistrationMemberDropdownService?.close?.();
    this.clearBulkRegistrationMemberHighlight();
  
    this.panelUiService.setDrawerVariant('');
  
    this.panelUiService.syncBulkRegistrationButton({
      isBulkRegistration: false,
    });
  
    this.closeFilterPane();
  
    this.state.closeDrawer();
  
    this.panelUiService.syncDrawer({
      isDrawerOpen: false,
      activePanelId: '',
    });
  
    this.syncFilterPaneUI();
  
    this.syncAutoRefreshByDrawerState(false);
  }
  
  collectVisibleScheduleEventsByMemberId(memberId, { dayKey = '' } = {}) {
    const scheduleContainer = this.getScheduleContainer();
  
    if (!scheduleContainer) {
      return [];
    }
  
    const targetMemberId = String(memberId ?? '');
    const targetDayKey = String(dayKey ?? '');
  
    return Array
      .from(scheduleContainer.querySelectorAll('[data-role="schedule-event"]'))
      .filter((eventElement) =>
        String(eventElement.dataset.memberId ?? '') === targetMemberId
      )
      .filter((eventElement) => {
        if (!targetDayKey) {
          return true;
        }
  
        return String(eventElement.dataset.dayKey ?? '') === targetDayKey;
      })
      .filter((eventElement) =>
        this.isBulkPullbackTargetPlanStatus(
          eventElement.dataset.planStatus
        )
      )
      .map((eventElement) => ({
        planId: eventElement.dataset.planId ?? '',
        memberId: eventElement.dataset.memberId ?? '',
        dayKey: eventElement.dataset.dayKey ?? '',
        startTime: eventElement.dataset.startTime ?? '',
        endTime: eventElement.dataset.endTime ?? '',
        status: eventElement.dataset.status ?? '',
        planStatus: eventElement.dataset.planStatus ?? '',
        workName: eventElement.dataset.workName ?? '',
        inspectionNo: eventElement.dataset.inspectionNo ?? '',
      }))
      .sort((a, b) => {
        const aKey = `${a.dayKey} ${a.startTime}`;
        const bKey = `${b.dayKey} ${b.startTime}`;
  
        return aKey.localeCompare(bKey);
      });
  }

  isBulkPullbackTargetPlanStatus(planStatus) {
    const normalizedStatus = String(planStatus ?? '').trim();
  
    return normalizedStatus === '実施待ち'
      || normalizedStatus === '遅れ';
  }
  
  isBulkPullbackPanelActive() {
    return (
      this.elements?.layout?.dataset?.drawerVariant === 'bulk-pullback'
    );
  }

  toggleEditMode() {
    if (this.editModeStateService.isActive()) {
      this.closeEditMode();
      return;
    }
  
    this.openEditMode();
  }

  isEditModeActive() {
    return this.editModeStateService.isActive();
  }

  closeEditMode() {
    this.editModeStateService.close();
  
    this.resetEditState();
    this.resetEditInteractionUI();
  
    this.syncMoveModeUI();
    this.syncDrawerUI();
  }

  async handleAutoRefresh() {
    await this.autoRefreshFlowService.refresh();
  }

  buildBulkRegistrationCommitPayload(payload = {}) {
    return {
      ...payload,
      mode: 'commit',
    };
  }

  async handleBulkRegistrationSubmit() {
    const result = this.bulkRegistrationPayloadService?.buildPayload?.();
  
    if (!result?.isValid) {
      await ScheduleFeedbackPresenter.showSaveError(
        result?.message || '一括登録の入力内容を確認してください。'
      );
      return false;
    }
  
    const preservedScroll = this.captureTimeScrollPosition();
  
    return withElementLoading(
      this.getTestCardsLoadingTarget(),
      async () => {
        try {
          const response = await this.dataService.executeBulkRegistration(
            this.buildBulkRegistrationCommitPayload(result.payload)
          );
  
          await this.render({
            preservedScroll,
          });
  
          await this.loadTestCardsWeek({
            loading: false,
          });
  
          await ScheduleFeedbackPresenter.showSaveSuccess(
            this.buildBulkRegistrationSuccessMessage(response)
          );
  
          return true;
        } catch (error) {
          console.error('[bulk registration failed]:', error);
  
          await ScheduleFeedbackPresenter.showSaveError(
            '一括登録に失敗しました。'
          );
  
          return false;
        }
      },
      {
        title: '一括登録中',
        sub: '対象カードを登録しています',
        size: 'md',
        duration: 120,
      }
    );
  }

  async handleBulkPullbackSubmit() {
    const root = this.elements.testCardsPanelBody?.querySelector(
      '[data-mode="bulk-pullback"]'
    );
  
    if (!root) {
      await ScheduleFeedbackPresenter.showSaveError(
        '一括引き戻し画面が見つかりません。'
      );
      return false;
    }
  
    const planIds = Array
      .from(root.querySelectorAll('tr[data-plan-id]'))
      .filter((row) => {
        if (row.dataset.registerState === 'off') {
          return false;
        }
  
        const toggle = row.querySelector('[data-ui-action="toggle-register"]');
  
        if (!toggle) {
          return true;
        }
  
        return toggle.dataset.checked !== '0'
          && toggle.getAttribute('aria-pressed') !== 'false';
      })
      .map((row) => String(row.dataset.planId ?? '').trim())
      .filter(Boolean);
  
    if (!planIds.length) {
      await ScheduleFeedbackPresenter.showSaveError(
        '引き戻し対象を1件以上選択してください。'
      );
      return false;
    }
  
    const preservedScroll = this.captureTimeScrollPosition();
  
    return withElementLoading(
      this.getTestCardsLoadingTarget(),
      async () => {
        try {
          const response =
            await this.dataService.executeScheduleBulkEventRetract({
              planIds,
            });
        
          this.closeBulkPullbackDrawer();
        
          await this.render({
            preservedScroll,
          });
        
          this.closeBulkPullbackDrawer();
        
          await ScheduleFeedbackPresenter.showSaveSuccess(
            this.buildBulkPullbackSuccessMessage(response)
          );
        
          return true;
        } catch (error) {
          console.error('[bulk pullback failed]:', error);
        
          await ScheduleFeedbackPresenter.showSaveError(
            error?.message || '一括引き戻しに失敗しました。'
          );
        
          return false;
        }
      },
      {
        title: '一括引き戻し中',
        sub: '対象予定を引き戻しています',
        size: 'md',
        duration: 120,
      }
    );
  }

  async renderBulkRegistrationPreview(response, { preservedScroll = null } = {}) {
    const previewItems =
      this.bulkRegistrationPreviewService.extractPreviewItems(response);

    if (!previewItems.length) {
      return false;
    }

    const dayResponse = await this.dataService.fetchDay({
      date: this.state.getSelectedDate(),
      affiliationId: this.state.getSelectedAffiliationId(),
    });

    this.renderFlowService.syncTeamDayDate(dayResponse);
    this.renderFlowService.syncActiveDateAlias(dayResponse);

    this.affiliationService.syncTeamSchedules(
      dayResponse.data?.teamSchedules
      ?? dayResponse.teamSchedules
      ?? []
    );

    const previewResponse =
      this.bulkRegistrationPreviewService.mergePreviewItemsIntoDayResponse(
        dayResponse,
        previewItems
      );

    this.renderFlowService.renderCurrentView(previewResponse, {
      preservedScroll,
      isMemberWeekView: false,
    });

    this.removeAssignedBulkRegistrationTestCards(response);

    return true;
  }

  removeAssignedBulkRegistrationTestCards(response = {}) {
    const assignedPlanIds =
      this.bulkRegistrationPreviewService.extractAssignedPlanIds(response);

    if (!assignedPlanIds.length) {
      return;
    }

    assignedPlanIds.forEach((planId) => {
      this.testCardDataService.removeItemByPlanId?.(planId);
    });

    this.renderTestCardPanelByCurrentMode();
  }

  buildBulkRegistrationSuccessMessage(response = {}) {
    const events =
      response?.data?.events
      ?? response?.events
      ?? {};

    const count =
      events?.count
      ?? events?.plan_ids_list?.length
      ?? 0;

    if (count) {
      return `${count}件の一括登録を完了しました。`;
    }

    return '一括登録を完了しました。';
  }

  buildBulkPullbackSuccessMessage(response = {}) {
    const events =
      response?.data?.events
      ?? response?.events
      ?? {};
  
    const count =
      events?.count
      ?? events?.plan_ids_list?.length
      ?? 0;
  
    if (count) {
      return `${count}件の一括引き戻しを完了しました。`;
    }
  
    return '一括引き戻しを完了しました。';
  }

  buildBulkRegistrationPreviewMessage(response = {}) {
    const events =
      response?.data?.events
      ?? response?.events
      ?? {};

    const assignedCount =
      events?.count
      ?? events?.plan_ids_list?.length
      ?? 0;

    const unassignedCount =
      events?.unassigned_plan_ids?.length
      ?? events?.unassignedPlanIds?.length
      ?? 0;

    if (assignedCount && unassignedCount) {
      return `${assignedCount}件を仮反映しました。${unassignedCount}件は空き枠不足で未配置です。`;
    }

    if (assignedCount) {
      return `${assignedCount}件をスケジュールに仮反映しました。`;
    }

    return '一括登録の仮反映を完了しました。';
  }

  handleTestCardCaseChange(caseKey) {
    this.state.setSelectedTestCardCaseKey(caseKey);
    this.state.closeActiveTestCardFilter();
    this.renderTestCardPanelByCurrentMode();
  }

  handleTestCardInspectionTypeChange(inspectionType) {
    this.state.setSelectedTestCardInspectionType(inspectionType);
    this.state.closeActiveTestCardFilter();
    this.renderTestCardPanelByCurrentMode();
  }

  handleTestCardTimeZoneChange(timeZone) {
    this.state.setSelectedTestCardTimeZone(timeZone);
    this.state.closeActiveTestCardFilter();
    this.renderTestCardPanelByCurrentMode();
  }

  handleTestCardProcessChange(processName) {
    this.state.setSelectedTestCardProcessName(processName);
    this.state.closeActiveTestCardFilter();
    this.renderTestCardPanelByCurrentMode();
  }
  
  handleTestCardMachineChange(machineName) {
    this.state.setSelectedTestCardMachineName(machineName);
    this.state.closeActiveTestCardFilter();
    this.renderTestCardPanelByCurrentMode();
  }

  handleDrawerEscape() {
    const wasEditActive = this.isEditModeActive();
  
    this.state.closeDrawer();
  
    if (wasEditActive) {
      this.resetEditMode();
    }
  
    this.syncMoveModeUI();
    this.syncDrawerUI();
  }

  handleFilterPaneToggle() {
    const result = this.panelStateService.toggleFilterPane();
  
    this.syncPanelUI();
  
    if (!result.isOpen) {
      return;
    }
  
    this.testCardRenderService.renderFilterPane();
  }

  async handleTestCardTeamChange(affiliationId) {
    const nextAffiliationId = String(affiliationId ?? '');
  
    if (!nextAffiliationId) {
      return;
    }
  
    const nextTeamOption =
      this.findTestCardTeamOptionByAffiliationId(nextAffiliationId);
  
    if (!nextTeamOption) {
      this.state.setSelectedTestCardAffiliationId('');
      await this.loadTestCardsWeek();
      return;
    }
  
    const currentAffiliationId = String(
      this.state.getSelectedTestCardAffiliationId?.() ?? ''
    );
  
    if (currentAffiliationId === nextAffiliationId) {
      return;
    }
  
    this.state.setSelectedTestCardAffiliationId(nextAffiliationId);
  
    this.state.setSelectedTestCardMachineName?.('all');
    this.state.setSelectedTestCardProcessName?.('all');
  
    await this.loadTestCardsWeek();
  }

  findTestCardTeamOptionByAffiliationId(affiliationId) {
    const targetAffiliationId = String(affiliationId ?? '');
  
    if (!targetAffiliationId) {
      return null;
    }
  
    const teamOptions =
      this.state.getTestCardTeamOptions?.() ?? [];
  
    return (
      teamOptions.find(
        (teamOption) =>
          String(teamOption.affiliationId ?? '') === targetAffiliationId
      ) ?? null
    );
  }

  async handleTestCardDateAliasChange(dateAlias) {
    this.state.setSelectedTestCardDateAlias(dateAlias);
    this.state.closeActiveTestCardFilter();
  
    this.state.setSelectedTestCardMachineName?.('all');
    this.state.setSelectedTestCardProcessName?.('all');
  
    await this.refreshTestCardsWeekWithLoading({
      syncTeamOptions: true,
    });
  }

  syncInitialActiveTeamButton() {
    const selectedAffiliationId = this.state.getSelectedAffiliationId();
    this.updateTeamButtonsByAffiliationId(selectedAffiliationId);
  }

  syncPanelUI() {
    this.syncDrawerUI();
    this.syncFilterPaneUI();
  }

  getTestCardsLoadingTarget() {
    return (
      this.elements.testCardsPanelBody
      ?? this.elements.testCardsPanel
      ?? this.elements.drawer
      ?? null
    );
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
    if (!this.shouldUpdateTitleByScroll()) {
      return;
    }
  
    const titleText = this.getTitleTextByScrollPosition(dateText);
  
    this.updateTitle(titleText);
  }

  updateTitle(dateText) {
    const titleText = String(dateText ?? '');
    const compactTitleText = formatCompactDateLabel(titleText);
    const weekdayText = formatTitleWeekdayLabel(titleText);
  
    if (this.elements.title) {
      this.elements.title.textContent = titleText;
      this.elements.title.dataset.compactTitle = compactTitleText;
      this.elements.title.setAttribute('aria-label', titleText);
    }
  
    this.updateTitleWeekday(weekdayText);
  }
  
  updateTitleWeekday(weekdayText = '') {
    const element = this.elements.titleWeekday;
  
    if (!element) {
      return;
    }
  
    const text = String(weekdayText ?? '').trim();
  
    element.textContent = text;
    element.hidden = !text;
  
    if (text) {
      element.setAttribute('aria-label', `曜日 ${text}`);
      return;
    }
  
    element.removeAttribute('aria-label');
  }

  initializeDragAndDrop() {
    const dragRoot = this.elements?.root ?? this.elements?.scheduleContainer;
  
    if (!dragRoot) {
      return;
    }
  
    this.dragManager?.destroy();
  
    this.dragManager = new ScheduleDragManager({
      rootEl: dragRoot,
      sourceSelector: ScheduleController.DRAG_SOURCE_SELECTOR,
      canStartDrag: ({ sourceEl }) => this.canStartScheduleDrag(sourceEl),
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

  initializeRangeSelection() {
    const rootEl = this.elements?.root ?? this.elements?.scheduleContainer;
  
    if (!rootEl) {
      return;
    }
  
    this.rangeSelectionManager?.destroy();
  
    this.rangeSelectionManager = new ScheduleRangeSelectionManager({
      rootEl,
      canStartSelection: () => this.isEditModeActive(),
      getScheduleContainer: () => this.getScheduleContainer(),
      getSelectedDate: () => this.state.getSelectedDate(),
      getSelectedMemberId: () => this.state.getSelectedMemberId(),
      getVisibleHours: () => this.state.getVisibleHours(),
      getMoveSourceRange: ({ selectedRange }) =>
        this.buildRangeMoveFrameRange(selectedRange),
      onSelectionComplete: (range) =>
        this.handleRangeSelectionComplete(range),
      onMovePreview: ({ sourceRange, targetRange }) =>
        this.handleRangeSelectionMovePreview({
          sourceRange,
          targetRange,
        }),
      onMoveComplete: ({ sourceRange, targetRange }) =>
        this.handleRangeSelectionMoveComplete({
          sourceRange,
          targetRange,
        }),
      onMoveCancel: () =>
        this.resetRangeMoveTargetIndicators(),
    });
  
    this.rangeSelectionManager.bind();
  }

  canStartScheduleDrag(sourceEl) {
    const sourceType = sourceEl?.dataset?.dragSource ?? 'schedule-event';
  
    if (sourceType === 'test-card') {
      return true;
    }
  
    return (
      this.isEditModeActive() &&
      SchedulePlanStatusPolicy.isMovable(sourceEl?.dataset?.planStatus)
    );
  }

  handleScheduleDragStart(dragState) {
    const sourceEl = dragState?.sourceEl;
  
    if (!sourceEl) {
      return;
    }
  
    this.selectEditEventFromElement(sourceEl);
    this.editInteractionService.startDragPreview(sourceEl);
  }

  selectEditEventFromElement(element) {
    const selection =
      this.editSelectionService.selectFromElement(element);
  
    if (!selection) {
      return;
    }
  
    this.editSessionService.setSession({
      selectedEditEvent: selection.selectedEditEvent,
      pendingEditEvent: selection.pendingEditEvent,
    });
  
    this.syncSelectedEditEventUI();
  }

  bindEvents() {
    this.bindAsideEvents();
    this.bindDrawerEvents();
  
    this.unbindUIActions?.();
  
    this.unbindUIActions = bindUIActions(
      this.elements.root,
      this.buildUIActionHandlers()
    );
  }

  bindAsideEvents() {
    this.asideUiService.bindEvents();
  }

  buildUIActionHandlers() {
    return this.actionHandlers.build();
  }

  closeFilterPane() {
    const changed = this.panelStateService.closeFilterPane();
  
    if (!changed) {
      return;
    }
  
    this.syncFilterPaneUI();
  }

  async handleEditSubmit() {
    if (this.isRangeMoveEditActive()) {
      await this.handleRangeMoveSubmit();
      return;
    }
  
    const payload = this.buildEditSubmitPayload();
  
    await this.editCommitService.commitMove({
      payload,
      committedEditEvent: this.editSessionService.getPendingForCommit(),
      successMessage: '登録を完了しました',
      failureMessage: '登録に失敗しました。',
      keepDragPreviewUntilRender: true,
      resetDragOnFailure: true,
    });
  }

  async handleRangeMoveSubmit({
    source = 'submit-button',
  } = {}) {
    this.updateRangeMoveEditDraftFromInputs();
  
    const payloads = this.buildRangeMoveSubmitPayloads();
  
    if (!payloads.length) {
      console.warn('[schedule range move] submit payloads are empty.');
      return;
    }
  
    const successMessage =
      source === 'drag-drop'
        ? `ドロップ位置へ一括移動しました（${payloads.length}件）`
        : `一括移動を完了しました（${payloads.length}件）`;
  
    const isCommitted = await this.editCommitService.commitBulkMove({
      payloads,
      successMessage,
      failureMessage: '一括移動に失敗しました。',
    });
  
    if (!isCommitted) {
      return;
    }
  
    this.resetEditState();
    this.resetEditInteractionUI();
    this.syncEditSubmitButton();
  }
  
  buildRangeMoveSubmitPayloads() {
    return ScheduleRangeMovePayloadService.buildPayloads({
      session: this.selectedRangeMoveSession,
    });
  }

  async handleEditRetract() {
    if (this.hasRangeSelectionRetractTargets()) {
      await this.handleRangeSelectionRetract();
      return;
    }
  
    const payload = ScheduleEditPayloadService.buildRetractPayload(
      this.editSessionService.getSelected()
    );
  
    await this.editCommitService.commitRetract({
      payload,
      successMessage: '引き戻しを完了しました',
      failureMessage: '引き戻しに失敗しました。',
    });
  }

  getRangeSelectionRetractPlanIds() {
    if (!this.isRangeMoveEditActive()) {
      return [];
    }
  
    const sourceEvents =
      this.selectedRangeMoveSession?.selectedEvents
      ?? this.selectedRangeSelectionEvents
      ?? [];
  
    const planIds = this.filterRangeMovableEvents(sourceEvents)
      .map((event) => String(event?.planId ?? '').trim())
      .filter(Boolean);
  
    return [...new Set(planIds)];
  }
  
  hasRangeSelectionRetractTargets() {
    return this.getRangeSelectionRetractPlanIds().length > 0;
  }
  
  async handleRangeSelectionRetract() {
    const planIds = this.getRangeSelectionRetractPlanIds();
  
    if (!planIds.length) {
      await ScheduleFeedbackPresenter.showSaveError(
        '選択範囲内に引き戻し対象がありません。'
      );
      return false;
    }
  
    const isCommitted = await this.editCommitService.commitBulkRetract({
      planIds,
      successMessage: `${planIds.length}件の引き戻しを完了しました`,
      failureMessage: '選択範囲の引き戻しに失敗しました。',
    });
  
    if (!isCommitted) {
      return false;
    }
  
    this.resetEditInteractionUI();
    this.syncEditSubmitButton();
  
    return true;
  }

  handleEditMemberChange(memberId) {
    if (!memberId) {
      return;
    }
  
    if (this.isRangeMoveEditActive()) {
      const updated = this.updateRangeMoveEditDraftFromInputs({
        memberId,
      });
  
      if (updated) {
        this.syncRangeMoveAfterSummary();
      }
  
      return;
    }
  
    this.updatePendingEditSession((pendingEditEvent) => ({
      ...pendingEditEvent,
      memberId,
    }));
  }

  isRangeMoveEditActive() {
    return this.selectedRangeMoveSession?.mode === 'bulk-range-move';
  }
  
  updateRangeMoveEditDraftFromInputs({
    memberId: overrideMemberId = '',
  } = {}) {
    if (!this.isRangeMoveEditActive()) {
      return false;
    }
  
    const root = this.elements?.editAfterSummary;
  
    if (!root) {
      return false;
    }
  
    const memberInput = root.querySelector(
      '[data-role="edit-member-dropdown-value"]'
    );
  
    const dateInput = root.querySelector('[data-role="edit-date"]');
    const timeInput = root.querySelector('[data-role="edit-time"]');
  
    const memberId =
      overrideMemberId
      || memberInput?.value
      || this.selectedRangeMoveSession.afterInfo?.memberId
      || '';
  
    const planDate =
      dateInput?.value
      || this.selectedRangeMoveSession.afterInfo?.planDate
      || '';
  
    const startTime =
      timeInput?.value
      || this.selectedRangeMoveSession.afterInfo?.startTime
      || '';
  
    this.selectedRangeMoveSession = {
      ...this.selectedRangeMoveSession,
      afterInfo: {
        ...this.selectedRangeMoveSession.afterInfo,
        memberId,
        planDate,
        startTime,
        timeText: startTime,
      },
    };
  
    console.log(
      '[schedule range move edit draft]',
      this.selectedRangeMoveSession.afterInfo
    );
  
    this.syncRangeMoveTargetIndicators();
    this.syncEditSubmitButton();
    
    return true;
  }

  syncRangeMoveTargetIndicators() {
    const indicatorEvent = this.buildRangeMoveIndicatorEvent();
  
    if (!indicatorEvent) {
      this.resetRangeMoveTargetIndicators();
      return;
    }
  
    const scheduleContainer = this.getScheduleContainer();
  
    this.dragTimeIndicatorService.sync({
      scheduleContainer,
      selectedDate: this.state.getSelectedDate(),
      pendingEditEvent: indicatorEvent,
      visibleHours: this.state.getVisibleHours(),
    });
  
    this.dragTargetHighlighter.sync({
      scheduleContainer,
      memberId: this.state.isMemberWeekView()
        ? ''
        : indicatorEvent.memberId,
      dayKey: this.state.isMemberWeekView()
        ? indicatorEvent.planDate
        : '',
    });
  }
  
  resetRangeMoveTargetIndicators() {
    const scheduleContainer = this.getScheduleContainer();
  
    this.dragTimeIndicatorService.reset();
    this.dragTargetHighlighter.reset(scheduleContainer);
  }
  
  buildRangeMoveIndicatorEvent() {
    const session = this.selectedRangeMoveSession;
    const afterInfo = session?.afterInfo;
  
    if (
      !afterInfo?.memberId ||
      !afterInfo?.planDate ||
      !afterInfo?.startTime
    ) {
      return null;
    }
  
    const durationMinutes =
      this.calculateRangeMoveIndicatorDurationMinutes(session);
  
    if (!durationMinutes) {
      return null;
    }
  
    const endTime = ScheduleMoveTimeService.addMinutesToTime(
      afterInfo.startTime,
      durationMinutes
    );
  
    return {
      ...afterInfo,
      sourceType: 'bulk-range-move',
      workName: '一括移動',
  
      // dragTimeIndicatorService / target highlighter 用
      memberId: afterInfo.memberId,
      planDate: afterInfo.planDate,
      dayKey: afterInfo.planDate,
      startTime: afterInfo.startTime,
      endTime,
      durationMinutes,
      manHours: durationMinutes,
    };
  }
  
  calculateRangeMoveIndicatorDurationMinutes(session) {
    const sourceEvents =
      this.getRangeMoveDurationSourceEvents(session);
  
    if (sourceEvents.length) {
      const ranges = sourceEvents
        .map((event) => {
          const startTime = event.startTime ?? '';
          const endTime = event.endTime ?? '';
  
          if (!startTime || !endTime) {
            return null;
          }
  
          const startMinute =
            ScheduleTimeLayoutService.toRelativeMinuteFromTimeString(startTime);
  
          const durationMinutes =
            ScheduleMoveTimeService.calculateDurationMinutes(
              startTime,
              endTime
            );
  
          if (!Number.isFinite(startMinute) || durationMinutes <= 0) {
            return null;
          }
  
          return {
            startMinute,
            endMinute: startMinute + durationMinutes,
          };
        })
        .filter(Boolean);
  
      if (ranges.length) {
        const minStartMinute = Math.min(
          ...ranges.map((range) => range.startMinute)
        );
  
        const maxEndMinute = Math.max(
          ...ranges.map((range) => range.endMinute)
        );
  
        return Math.max(maxEndMinute - minStartMinute, 1);
      }
    }
  
    const sourceRange = session?.sourceRange;
  
    if (
      Number.isFinite(sourceRange?.startMinute) &&
      Number.isFinite(sourceRange?.endMinute)
    ) {
      return Math.max(sourceRange.endMinute - sourceRange.startMinute, 1);
    }
  
    return 0;
  }
  
  getRangeMoveDurationSourceEvents(session) {
    if (Array.isArray(session?.selectedEvents) && session.selectedEvents.length) {
      return session.selectedEvents;
    }
  
    if (Array.isArray(session?.moveCandidates) && session.moveCandidates.length) {
      return session.moveCandidates
        .map((candidate) => candidate.before)
        .filter(Boolean);
    }
  
    return [];
  }

  syncRangeMoveAfterSummary() {
    if (!this.isRangeMoveEditActive()) {
      return;
    }
  
    const afterInfo = this.selectedRangeMoveSession?.afterInfo;
  
    if (!afterInfo) {
      return;
    }
  
    this.editSummaryService.syncAfter(afterInfo, {
      editableMember: true,
      editableDateTime: true,
    });
  
    this.editMemberDropdownService.sync();
    this.bindEditDateTimeEvents();
    this.syncRangeMoveTargetIndicators();
    this.syncEditSubmitButton();
  }

  commitEditState(
    committedEditEvent = this.editSessionService.getPendingForCommit()
  ) {
    this.editSessionService.commit(committedEditEvent);
  }

  syncEditSubmitButton() {
    this.editSubmitUiService.syncButton();
  }

  buildEditSubmitPayload() {
    return ScheduleEditPayloadService.buildSubmitPayload(
      this.editSessionService.getSubmitPayloadSource()
    );
  }

  hasPendingEditChanges() {
    if (this.isRangeMoveEditActive()) {
      return this.hasRangeMovePendingChanges();
    }
  
    return this.editSessionService.hasPendingChanges(
      (selectedEditEvent, pendingEditEvent) =>
        ScheduleEditPayloadService.hasChanges(selectedEditEvent, pendingEditEvent)
    );
  }
  
  hasRangeMovePendingChanges() {
    const session = this.selectedRangeMoveSession;
  
    if (!session?.beforeInfo || !session?.afterInfo) {
      return false;
    }
  
    const hasRequiredValues = Boolean(
      session.afterInfo.memberId &&
      session.afterInfo.planDate &&
      session.afterInfo.startTime
    );
  
    if (!hasRequiredValues) {
      return false;
    }
  
    const hasChanged = !(
      String(session.beforeInfo.memberId) === String(session.afterInfo.memberId) &&
      session.beforeInfo.planDate === session.afterInfo.planDate &&
      session.beforeInfo.startTime === session.afterInfo.startTime
    );
  
    if (!hasChanged) {
      return false;
    }
  
    return this.buildRangeMoveSubmitPayloads().length > 0;
  }

  canRetractSelectedEditEvent() {
    if (this.hasRangeSelectionRetractTargets()) {
      return true;
    }
  
    return ScheduleEditPayloadService.canRetract(
      this.editSessionService.getSelected()
    );
  }

  hasSelectedEditEvent() {
    return Boolean(this.editSessionService.getSelected()?.planId);
  }

  bindEditDateTimeEvents() {
    ScheduleEditDateTimeService.bindInputChangeEvents(
      this.elements?.editAfterSummary,
      () => this.handleEditDateTimeChange()
    );
  }

  handleEditDateTimeChange() {
    if (this.isRangeMoveEditActive()) {
      this.updateRangeMoveEditDraftFromInputs();
      this.bindEditDateTimeEvents();
      return;
    }
  
    const updated = this.updatePendingEditSession((pendingEditEvent) =>
      ScheduleEditDateTimeService.buildUpdatedEventFromRoot({
        event: pendingEditEvent,
        root: this.elements?.editAfterSummary,
      })
    );
  
    if (!updated) {
      console.log('[Controller] handleEditDateTimeChange skipped: no pendingEditEvent');
      return;
    }
  
    this.bindEditDateTimeEvents();
  }

  bindDrawerKeyboardEvents() {
    this.panelUiService.bindEscapeKey({
      shouldHandle: () => this.state.getIsDrawerOpen(),
      onEscape: () => this.handleDrawerEscape(),
    });
  }

  bindDrawerEvents() {
    this.panelUiService.bindDrawerPanelButtons({
      onTogglePanel: (panelId) => this.handleDrawerPanelToggle(panelId),
    });
  }

  async handleDrawerPanelToggle(panelId) {
    const result = this.panelStateService.toggleDrawerPanel(panelId, {
      wasEditActive: this.isEditModeActive(),
    });
  
    if (!result.changed) {
      return;
    }
  
    if (result.shouldResetEdit) {
      this.resetEditMode();
    }
  
    this.syncMoveModeUI();
    this.syncDrawerUI();
  
    if (result.shouldLoadTestCards) {
      this.restoreTestCardsPanelMode({
        renderCards: true,
      });
    
      await this.refreshTestCardsWeekWithLoading({
        syncTeamOptions: true,
      });
    }
  }

  syncDrawerUI() {
    const isDrawerOpen = this.state.getIsDrawerOpen();
    const activePanelId = this.state.getActivePanelId();
    const shouldKeepFilterPaneOpen = isDrawerOpen && activePanelId === 'test';
  
    if (!isDrawerOpen || activePanelId !== 'test') {
      this.restoreTestCardsPanelMode({
        renderCards: true,
      });
    }
  
    this.panelUiService.syncDrawer({
      isDrawerOpen,
      activePanelId,
    });
  
    if (!shouldKeepFilterPaneOpen) {
      const filterPaneChanged = this.panelStateService.closeFilterPane();
  
      if (filterPaneChanged) {
        this.syncFilterPaneUI();
      }
    }
  
    this.syncAutoRefreshByDrawerState(isDrawerOpen);
  }

  syncSelectedEditEventUI() {
    this.editInteractionService.syncSelected(
      this.editSessionService.getSnapshot()
    );
  }

  syncFilterPaneUI() {
    this.panelUiService.syncFilterPane({
      isFilterOpen: this.state.getIsFilterPaneOpen(),
    });
  }

  getTimeScheduleScrollContainer() {
    return this.elements.timeViewRoot?.querySelector('.time-schedule') ?? null;
  }

  getScheduleContainer() {
    return this.elements?.scheduleContainer ?? this.elements?.timeViewRoot;
  }

  openBulkRegistrationDrawer() {
    if (this.isBulkRegistrationPanelActive()) {
      this.backToTestCardsPanel();
      return;
    }
  
    this.state.openDrawer('test');
  
    this.panelUiService.setDrawerVariant('bulk-registration');
  
    this.syncPanelUI();
  
    this.bulkRegistrationMemberDropdownService?.close?.();
  
    this.renderBulkRegistrationPanel();
  }

  renderTestCardPanelByCurrentMode({
    renderFilterPane = true,
  } = {}) {
    if (renderFilterPane) {
      this.testCardRenderService.renderFilterPane();
    }
  
    if (this.isBulkRegistrationPanelActive()) {
      this.renderBulkRegistrationPanel();
      return;
    }
  
    this.testCardRenderService.renderPanel();
  }
  
  renderBulkRegistrationPanel() {
    const items = this.testCardFilterService?.getFilteredItems?.() ?? [];
    const memberId = this.state.getBulkRegistrationMemberId?.() ?? '';
    const memberName = this.state.getBulkRegistrationMemberName?.() ?? '';
  
    const dateTimeDefaults = this.getBulkRegistrationDateTimeDefaults();
  
    this.bulkRegistrationPanelService.render({
      items,
      memberId,
      memberName,
      ...dateTimeDefaults,
    });
  
    this.bulkRegistrationMemberDropdownService?.syncSelection({
      memberId,
      memberName,
    });
  
    this.panelUiService.syncBulkRegistrationButton({
      isBulkRegistration: true,
    });
  
    this.syncBulkRegistrationMemberHighlight(memberId);
  }

  syncBulkRegistrationMemberHighlight(
    memberId = this.state.getBulkRegistrationMemberId?.() ?? ''
  ) {
    this.bulkRegistrationMemberHighlightService?.sync({
      scheduleContainer: this.getScheduleContainer(),
      memberId,
      enabled: this.isBulkRegistrationPanelActive(),
    });
  }
  
  clearBulkRegistrationMemberHighlight() {
    this.bulkRegistrationMemberHighlightService?.reset(
      this.getScheduleContainer()
    );
  }

  getBulkRegistrationDateTimeDefaults() {
    const startDate = normalizeDateInputValue(
      this.state.getCurrentTeamDayDate?.() ?? this.state.getSelectedDate()
    );
  
    const startTime = normalizeTimeInputValue(
      this.resolveBulkRegistrationStartTime()
    );
  
    const endTime = normalizeTimeInputValue(
      this.resolveBulkRegistrationEndTime()
    );
  
    const endDate = this.resolveBulkRegistrationEndDate({
      startDate,
      startTime,
      endTime,
    });
  
    return {
      startDate,
      startTime,
      endDate,
      endTime,
    };
  }

  resolveBulkRegistrationTargetTeamSchedule() {
    const teamSchedules = this.state.getTeamSchedules?.() ?? [];
  
    if (!Array.isArray(teamSchedules) || !teamSchedules.length) {
      return null;
    }
  
    const targetAffiliationId = this.getBulkRegistrationTargetAffiliationId();
  
    const matchedSchedule = teamSchedules.find((schedule) =>
      String(schedule.affiliationId ?? '') === String(targetAffiliationId)
    );
  
    return matchedSchedule ?? teamSchedules[0] ?? null;
  }

  
  
  resolveBulkRegistrationStartTime() {
    const schedule = this.resolveBulkRegistrationTargetTeamSchedule();
  
    return schedule?.startTime ?? '';
  }

  resolveBulkRegistrationEndTime() {
    const schedule = this.resolveBulkRegistrationTargetTeamSchedule();
  
    return schedule?.endTime ?? '';
  }

  resolveBulkRegistrationEndDate({
    startDate = '',
    startTime = '',
    endTime = '',
  } = {}) {
    if (!startDate) {
      return '';
    }
  
    const shouldUseNextDay = isNextDayTimeRange(startTime, endTime);
  
    return shouldUseNextDay
      ? addDaysToDateInputValue(startDate, 1)
      : startDate;
  }
  
  
  
  getBulkRegistrationTargetAffiliationId() {
    return (
      this.state.getSelectedTestCardAffiliationId?.()
      || this.state.getSelectedAffiliationId?.()
      || ''
    );
  }

  isBulkRegistrationPanelActive() {
    return (
      this.elements?.layout?.dataset?.drawerVariant === 'bulk-registration'
    );
  }

  backToTestCardsPanel() {
    this.restoreTestCardsPanelMode({
      renderCards: true,
    });
  }

  restoreTestCardsPanelMode({ renderCards = true } = {}) {
    this.bulkRegistrationMemberDropdownService?.close?.();
    this.clearBulkRegistrationMemberHighlight();
  
    this.panelUiService.setDrawerVariant('');
  
    this.panelUiService.syncBulkRegistrationButton({
      isBulkRegistration: false,
    });
  
    if (renderCards) {
      this.testCardRenderService.renderPanel();
    }
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

  restoreTimeScrollPositionIfNeeded(preservedScroll) {
    if (!preservedScroll) {
      return;
    }
  
    this.restoreTimeScrollPosition(preservedScroll);
  }

  resetEditState() {
    this.editSessionService.reset();
  }
  
  resetEditInteractionUI() {
    this.editInteractionService.resetEdit();
    this.rangeSelectionManager?.reset?.();
    this.clearRangeSelectedEventStyles();
  
    this.selectedRangeSelection = null;
    this.selectedRangeSelectionEvents = [];
    this.selectedRangeMoveCandidates = [];
    this.selectedRangeMoveSession = null;
  }

  resetEditMode() {
    this.editModeStateService.disableMoveMode();
    this.resetEditState();
    this.resetEditInteractionUI();
  }

  renderActiveDateAlias() {
    this.activeDateAliasRenderer.render(this.state.getActiveDateAlias?.());
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

  updateTeamButtonsByAffiliationId(activeAffiliationId) {
    this.buttonStateUiService.syncTeamButtonsByAffiliationId(activeAffiliationId);
  }

  setPendingEditSession(pendingEditEvent) {
    const nextPending = this.editSessionService.setPending(pendingEditEvent);
  
    if (!nextPending) {
      return false;
    }
  
    this.syncPendingEditEventUI();
    return true;
  }

  updatePendingEditSession(updater) {
    const updatedPending = this.editSessionService.updatePending(updater);
  
    if (!updatedPending) {
      return false;
    }
  
    this.syncPendingEditEventUI();
    return true;
  }

  syncViewHeaderUI() {
    this.headerUiService.sync({
      isMemberWeekView: this.state.isMemberWeekView(),
      isMemberDropdownOpen: this.state.getIsMemberDropdownOpen(),
      selectedMemberName: this.state.getSelectedMemberName(),
    });
  }

  ensureEditSubmitFooter() {
    this.editSubmitUiService.ensureFooter();
  }

  afterRender({ viewModel = null, isMemberWeekView = false } = {}) {
    if (isMemberWeekView) {
      this.afterMemberWeekRender({ viewModel });
    } else {
      this.afterTeamDayRender({ viewModel });
    }
  
    this.afterCommonRender();
  }

  afterMemberWeekRender({ viewModel = null } = {}) {
    this.updateTitle(
      viewModel?.weekRangeText ?? this.state.getSelectedDate()
    );
  }

  afterTeamDayRender({ viewModel = null } = {}) {
    this.memberService.setMembers(viewModel?.members ?? []);
    this.updateTitleByScrollPosition(this.state.getSelectedDate());
  }

  afterCommonRender() {
    this.syncViewHeaderUI();
    this.autoScrollService.bindScrollTracking();
    this.syncMoveModeUI();
    this.ensureEditSubmitFooter();
    this.syncSelectedEditEventUI();
    this.initializeDragAndDrop();
    this.initializeRangeSelection();
  
    this.syncBulkRegistrationMemberHighlight();
  }

  async render(options = {}) {
    await this.renderFlowService.render(options);
  }

  updateRangeButtonsByHours(activeHours) {
    this.buttonStateUiService.syncRangeButtonsByHours(activeHours);
  }

  handleScheduleDragMove(dragState) {
    this.editInteractionService.moveDragPreview(dragState);
  
    const { isValid, pendingEditEvent } =
      this.dragDropService.buildDropResult(dragState);
  
    if (!isValid) {
      this.resetPendingDropIndicators();
      return;
    }
  
    this.syncPendingEditPreview(pendingEditEvent);
  }

  async handleScheduleDrop(dragState) {
    const dropEvaluation = this.dragDropService.evaluateDrop(dragState);
  
    if (!dropEvaluation.shouldCommit) {
      this.resetPendingEditPreview();
      return;
    }
  
    const { payload, pendingEditEvent } = dropEvaluation;
  
    this.syncPendingEditPreview(pendingEditEvent);

    const isCommitted = await this.editCommitService.commitMove({
      payload,
      committedEditEvent: this.editSessionService.getPendingForCommit(),
      successMessage: '登録を完了しました',
      failureMessage: '登録に失敗しました。',
      keepDragPreviewUntilRender: true,
      resetDragOnFailure: true,
    });
    
    if (isCommitted && this.isTestCardDrag(dragState)) {
      this.removeCommittedTestCard(payload.planId);
    }
  }

  isTestCardDrag(dragState) {
    return dragState?.eventData?.sourceType === 'test-card';
  }
  
  removeCommittedTestCard(planId) {
    const removed = this.testCardDataService.removeItemByPlanId(planId);
  
    if (!removed) {
      return;
    }
  
    this.testCardRenderService.renderAll();
  }

  handleScheduleDragCancel() {
    this.resetPendingEditPreview();
  }

  handleRangeSelectionComplete(range) {
    this.clearRangeSelectedEventStyles();
  
    const selectedEvents = this.collectRangeSelectionEvents(range);
  
    this.selectedRangeSelectionEvents = selectedEvents;
  
    this.applyRangeSelectedEventStyles(selectedEvents);
  
    const adjustedRange =
      this.buildRangeMoveFrameRange(range) ?? range;
  
    this.selectedRangeSelection = adjustedRange;
  
    this.syncRangeSelectionEditSummary({
      range: adjustedRange,
      selectedEvents,
    });
  
    console.log('[schedule range selection]', adjustedRange);
    console.log(
      '[schedule range selection events]',
      selectedEvents.map(({ element, ...item }) => item)
    );
  
    return adjustedRange;
  }

  syncRangeSelectionEditSummary({
    range,
    selectedEvents = [],
  } = {}) {
    const movableEvents = this.filterRangeMovableEvents(selectedEvents);
  
    if (!movableEvents.length) {
      this.selectedRangeMoveSession = null;
    
      this.editSummaryService.resetAll();
      this.resetRangeMoveTargetIndicators();
      this.syncEditSubmitButton();
    
      console.warn('[schedule range selection] movable events are empty.');
      return;
    }
  
    const { beforeInfo, afterInfo } =
      this.buildRangeSelectionEditSummaryInfo({
        range,
        selectedEvents: movableEvents,
      });
  
    this.selectedRangeMoveSession = {
      mode: 'bulk-range-move',
      sourceRange: range,
      targetRange: range,
      selectedEvents: movableEvents,
      moveCandidates: [],
      beforeInfo,
      afterInfo,
    };
  
    this.editSummaryService.syncBefore(beforeInfo, {
      editableMember: false,
      editableDateTime: false,
    });
  
    this.editSummaryService.syncAfter(afterInfo, {
      editableMember: true,
      editableDateTime: true,
    });
  
    this.editMemberDropdownService.sync();
    this.bindEditDateTimeEvents();
    this.syncRangeMoveTargetIndicators();
    this.syncEditSubmitButton();
  }

  filterRangeMovableEvents(selectedEvents = []) {
    return selectedEvents.filter((event) =>
      ['実施待ち', '遅れ'].includes(String(event?.planStatus ?? ''))
    );
  }
  
  buildRangeSelectionEditSummaryInfo({
    range,
    selectedEvents = [],
  } = {}) {
    const firstEvent =
      this.getFirstSelectedRangeEvent(selectedEvents);
  
    const baseInfo = firstEvent
      ? this.buildRangeSummaryInfoFromSelectedEvent(firstEvent)
      : this.buildRangeSummaryInfoFromRange(range);
  
    const beforeInfo = {
      ...baseInfo,
      sourceType: 'bulk-range-move',
      planId: '__bulk_range_move__',
      workName: '一括移動',
      timeText: baseInfo.startTime || '-',
    };
  
    const afterInfo = {
      ...baseInfo,
      sourceType: 'bulk-range-move',
      planId: '__bulk_range_move__',
      workName: '一括移動',
      timeText: baseInfo.startTime || '-',
    };
  
    return {
      beforeInfo,
      afterInfo,
    };
  }
  
  getFirstSelectedRangeEvent(selectedEvents = []) {
    return [...selectedEvents]
      .filter(Boolean)
      .sort((a, b) => {
        const aKey = `${a.dayKey ?? ''} ${a.startTime ?? ''}`;
        const bKey = `${b.dayKey ?? ''} ${b.startTime ?? ''}`;
  
        return aKey.localeCompare(bKey);
      })[0] ?? null;
  }
  
  buildRangeSummaryInfoFromSelectedEvent(event = {}) {
    return {
      memberId: event.memberId ?? '',
      planDate: event.dayKey ?? this.state.getSelectedDate(),
      startTime: event.startTime ?? '',
      endTime: event.endTime ?? '',
      planStatus: event.planStatus ?? '',
    };
  }
  
  buildRangeSummaryInfoFromRange(range = {}) {
    return {
      memberId: range.memberId ?? '',
      planDate:
        range.dayKey
        || this.state.getSelectedDate(),
      startTime: this.extractTimeFromLocalDateTime(range.startDateTime),
      endTime: this.extractTimeFromLocalDateTime(range.endDateTime),
      planStatus: '実施待ち',
    };
  }
  
  extractTimeFromLocalDateTime(value = '') {
    const text = String(value ?? '');
  
    if (!text.includes('T')) {
      return '';
    }
  
    return text.split('T')[1]?.slice(0, 5) ?? '';
  }

  async handleRangeSelectionMoveComplete({
    sourceRange,
    targetRange,
  } = {}) {
    const moveCandidates = ScheduleRangeSelectionMovePlanner.build({
      sourceRange,
      targetRange,
      selectedEvents: this.selectedRangeSelectionEvents ?? [],
      visibleHours: this.state.getVisibleHours(),
    });
  
    this.selectedRangeMoveCandidates = moveCandidates;
  
    console.log('[schedule range move]', {
      sourceRange,
      targetRange,
    });
  
    console.log('[schedule range move candidates]', moveCandidates);
  
    const canMove = this.syncRangeMoveEditSummary({
      sourceRange,
      targetRange,
      moveCandidates,
    });
  
    if (!canMove) {
      return;
    }
  
    await this.handleRangeMoveSubmit({
      source: 'drag-drop',
    });
  }

  handleRangeSelectionMovePreview({
    sourceRange,
    targetRange,
  } = {}) {
    const indicatorEvent = this.buildRangeMovePreviewIndicatorEvent({
      sourceRange,
      targetRange,
    });
  
    if (!indicatorEvent) {
      this.resetRangeMoveTargetIndicators();
      return;
    }
  
    this.syncRangeMovePreviewIndicators(indicatorEvent);
  }

  buildRangeMoveFrameRange(sourceRange) {
    if (!sourceRange) {
      return null;
    }
  
    const pixelRange = this.buildSelectedMovableEventPixelRange();
  
    if (!pixelRange) {
      return sourceRange;
    }
  
    const visibleHours = this.state.getVisibleHours();
  
    const startMinute = ScheduleRangeSelectionResolver.toRelativeMinute(
      pixelRange.topPx,
      visibleHours
    );
  
    const endMinute = ScheduleRangeSelectionResolver.toRelativeMinute(
      pixelRange.bottomPx,
      visibleHours
    );
  
    if (
      startMinute === null
      || endMinute === null
      || endMinute <= startMinute
    ) {
      return sourceRange;
    }
  
    const baseDate =
      sourceRange.dayKey
      || sourceRange.startDateTime?.slice(0, 10)
      || this.state.getSelectedDate();
  
    return {
      ...sourceRange,
  
      topPx: pixelRange.topPx,
      bottomPx: pixelRange.bottomPx,
      heightPx: pixelRange.heightPx,
  
      startMinute,
      endMinute,
  
      startDateTime: ScheduleRangeSelectionResolver.toLocalDateTimeString(
        baseDate,
        startMinute
      ),
      endDateTime: ScheduleRangeSelectionResolver.toLocalDateTimeString(
        baseDate,
        endMinute
      ),
    };
  }
  
  buildSelectedMovableEventPixelRange() {
    const movableEvents = this.filterRangeMovableEvents(
      this.selectedRangeSelectionEvents ?? []
    );
  
    const ranges = movableEvents
      .map((event) => {
        const topPx = Number(event.eventTopPx);
        const bottomPx = Number(event.eventBottomPx);
  
        if (
          !Number.isFinite(topPx)
          || !Number.isFinite(bottomPx)
          || bottomPx <= topPx
        ) {
          return null;
        }
  
        return {
          topPx,
          bottomPx,
        };
      })
      .filter(Boolean);
  
    if (!ranges.length) {
      return null;
    }
  
    const topPx = Math.min(...ranges.map((range) => range.topPx));
    const bottomPx = Math.max(...ranges.map((range) => range.bottomPx));
  
    return {
      topPx,
      bottomPx,
      heightPx: bottomPx - topPx,
    };
  }

  syncRangeMovePreviewIndicators(indicatorEvent) {
    const scheduleContainer = this.getScheduleContainer();
  
    this.dragTimeIndicatorService.sync({
      scheduleContainer,
      selectedDate: this.state.getSelectedDate(),
      pendingEditEvent: indicatorEvent,
      visibleHours: this.state.getVisibleHours(),
    });
  
    this.dragTargetHighlighter.sync({
      scheduleContainer,
      memberId: this.state.isMemberWeekView()
        ? ''
        : indicatorEvent.memberId,
      dayKey: this.state.isMemberWeekView()
        ? indicatorEvent.planDate
        : '',
    });
  }

  buildRangeMovePreviewIndicatorEvent({
    sourceRange,
    targetRange,
  } = {}) {
    if (!sourceRange || !targetRange) {
      return null;
    }
  
    const moveCandidates = ScheduleRangeSelectionMovePlanner.build({
      sourceRange,
      targetRange,
      selectedEvents: this.selectedRangeSelectionEvents ?? [],
      visibleHours: this.state.getVisibleHours(),
    });
  
    if (!moveCandidates.length) {
      return null;
    }
  
    const firstCandidate = moveCandidates[0];
  
    const afterDateTimeParts = this.splitLocalDateTime(
      firstCandidate?.after?.startDateTime ?? ''
    );
  
    if (!afterDateTimeParts.date || !afterDateTimeParts.time) {
      return null;
    }
  
    const durationMinutes =
      this.calculateRangeMoveIndicatorDurationMinutes({
        sourceRange,
        targetRange,
        selectedEvents: this.filterRangeMovableEvents(
          this.selectedRangeSelectionEvents ?? []
        ),
        moveCandidates,
      });
  
    if (!durationMinutes) {
      return null;
    }
  
    const endTime = ScheduleMoveTimeService.addMinutesToTime(
      afterDateTimeParts.time,
      durationMinutes
    );
  
    return {
      sourceType: 'bulk-range-move-preview',
      workName: '一括移動',
  
      memberId:
        firstCandidate?.after?.memberId
        ?? targetRange.memberId
        ?? '',
  
      planDate: afterDateTimeParts.date,
      dayKey: afterDateTimeParts.date,
  
      startTime: afterDateTimeParts.time,
      endTime,
      durationMinutes,
      manHours: durationMinutes,
    };
  }

  syncRangeMoveEditSummary({
    sourceRange,
    targetRange,
    moveCandidates = [],
  } = {}) {
    if (!moveCandidates.length) {
      this.selectedRangeMoveSession = null;
  
      this.editSummaryService.resetAll();
      this.resetRangeMoveTargetIndicators();
      this.syncEditSubmitButton();
  
      console.warn('[schedule range move] movable events are empty.');
      return false;
    }
  
    const { beforeInfo, afterInfo } =
      this.buildRangeMoveEditSummaryInfo(moveCandidates);
  
    this.selectedRangeMoveSession = {
      mode: 'bulk-range-move',
      sourceRange,
      targetRange,
      selectedEvents: this.selectedRangeSelectionEvents ?? [],
      moveCandidates,
      beforeInfo,
      afterInfo,
    };
  
    this.editSummaryService.syncBefore(beforeInfo, {
      editableMember: false,
      editableDateTime: false,
    });
  
    this.editSummaryService.syncAfter(afterInfo, {
      editableMember: true,
      editableDateTime: true,
    });
  
    this.editMemberDropdownService.sync();
    this.bindEditDateTimeEvents();
    this.syncRangeMoveTargetIndicators();
    this.syncEditSubmitButton();
  
    return true;
  }
  
  buildRangeMoveEditSummaryInfo(moveCandidates = []) {
    const firstCandidate = moveCandidates[0];
  
    const beforeDate = firstCandidate?.before?.dayKey ?? this.state.getSelectedDate();
    const beforeTime = firstCandidate?.before?.startTime ?? '';
  
    const afterDateTimeParts = this.splitLocalDateTime(
      firstCandidate?.after?.startDateTime ?? ''
    );
  
    const beforeInfo = {
      sourceType: 'bulk-range-move',
      planId: '__bulk_range_move__',
      workName: '一括移動',
      memberId: firstCandidate?.before?.memberId ?? '',
      planDate: beforeDate,
      startTime: beforeTime,
      endTime: '',
      timeText: beforeTime || '-',
      planStatus: '実施待ち',
    };
  
    const afterInfo = {
      sourceType: 'bulk-range-move',
      planId: '__bulk_range_move__',
      workName: '一括移動',
      memberId: firstCandidate?.after?.memberId ?? '',
      planDate: afterDateTimeParts.date || beforeDate,
      startTime: afterDateTimeParts.time || beforeTime,
      endTime: '',
      timeText: afterDateTimeParts.time || beforeTime || '-',
      planStatus: '実施待ち',
    };
  
    return {
      beforeInfo,
      afterInfo,
    };
  }
  
  splitLocalDateTime(value = '') {
    const text = String(value ?? '');
  
    if (!text.includes('T')) {
      return {
        date: '',
        time: '',
      };
    }
  
    const [date, timePart = ''] = text.split('T');
    const time = timePart.slice(0, 5);
  
    return {
      date,
      time,
    };
  }

  collectRangeSelectionEvents(range) {
    return ScheduleRangeSelectionEventCollector.collect({
      scheduleContainer: this.getScheduleContainer(),
      range,
      minOverlapRatio: 0.2,
    });
  }
  
  applyRangeSelectedEventStyles(selectedEvents = []) {
    selectedEvents.forEach(({ element }) => {
      element?.classList?.add('is-range-selected');
    });
  }
  
  clearRangeSelectedEventStyles() {
    const scheduleContainer = this.getScheduleContainer();
  
    if (!scheduleContainer) {
      return;
    }
  
    scheduleContainer
      .querySelectorAll('[data-role="schedule-event"].is-range-selected')
      .forEach((eventElement) => {
        eventElement.classList.remove('is-range-selected');
      });
  }

  shouldUpdateTitleByScroll() {
    return !this.state.isMemberWeekView();
  }

  resetDragInteractionUI() {
    this.editInteractionService.resetDrag();
  }

  async finalizeEditCommit({
    committedEditEvent = this.editSessionService.getPendingForCommit(),
    preservedScroll,
    keepDragPreviewUntilRender = false,
  }) {
    this.commitEditState(committedEditEvent);
  
    await this.resetDragAroundRender({
      preservedScroll,
      keepDragPreviewUntilRender,
    });
  }

  async finalizeEditRetract({ preservedScroll } = {}) {
    this.resetEditState();
    this.resetDragInteractionUI();
  
    await this.render({ preservedScroll });
  
    if (this.state.getActivePanelId?.() === 'test') {
      await this.loadTestCardsWeek();
    }
  }

  async resetDragAroundRender({
    preservedScroll,
    keepDragPreviewUntilRender = false,
  } = {}) {
    if (!keepDragPreviewUntilRender) {
      this.resetDragInteractionUI();
    }
  
    await this.render({ preservedScroll });
  
    if (keepDragPreviewUntilRender) {
      this.resetDragInteractionUI();
    }
  }
}