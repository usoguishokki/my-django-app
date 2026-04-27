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

import { ScheduleMemberService } from './member/ScheduleMemberService.js';

import { ScheduleDetailDrawerService } from './details/ScheduleDetailDrawerService.js';

import { ScheduleHeaderUiService } from './view/ScheduleHeaderUiService.js';
import { ScheduleButtonStateUiService } from './view/ScheduleButtonStateUiService.js';
import { ScheduleAsideUiService } from './view/ScheduleAsideUiService.js';

import { ScheduleEditModeUiService } from './edit/ScheduleEditModeUiService.js';
import { ScheduleEditSubmitUiService } from './edit/ScheduleEditSubmitUiService.js';

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

import { ScheduleDragManager } from '../ui/ScheduleDragManager.js';
import { ScheduleActiveDateAliasRenderer } from '../ui/ScheduleActiveDateAliasRenderer.js';
import { ScheduleDragTargetHighlighter } from '../ui/ScheduleDragTargetHighlighter.js';


import { bindUIActions } from '../../ui/componets/actions/UIActionDispatcher.js';

export class ScheduleController {
  static AUTO_SCROLL_SUPPRESS_MS = 30 * 1000;

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

      handleTestCardTeamChange: (affiliationId) =>
        this.handleTestCardTeamChange(affiliationId),
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

  async loadTestCardsWeek() {
    await this.testCardDataService.loadWeek();
    this.testCardRenderService.renderAll();
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
  
  resetPendingEditPreview() {
    this.editSessionService.setPending(null);
  
    const { selectedEditEvent } = this.editSessionService.getSnapshot();
  
    this.editInteractionService.resetPending({
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

  handleTestCardCaseChange(caseKey) {
    this.state.setSelectedTestCardCaseKey(caseKey);
    this.state.closeActiveTestCardFilter();
    this.testCardRenderService.renderAll();
  }

  handleTestCardInspectionTypeChange(inspectionType) {
    this.state.setSelectedTestCardInspectionType(inspectionType);
    this.state.closeActiveTestCardFilter();
    this.testCardRenderService.renderAll();
  }

  handleTestCardTimeZoneChange(timeZone) {
    this.state.setSelectedTestCardTimeZone(timeZone);
    this.state.closeActiveTestCardFilter();
    this.testCardRenderService.renderAll();
  }

  handleTestCardProcessChange(processName) {
    this.state.setSelectedTestCardProcessName(processName);
    this.state.closeActiveTestCardFilter();
    this.testCardRenderService.renderAll();
  }
  
  handleTestCardMachineChange(machineName) {
    this.state.setSelectedTestCardMachineName(machineName);
    this.state.closeActiveTestCardFilter();
    this.testCardRenderService.renderAll();
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

  async handleFilterPaneToggle() {
    const result = this.panelStateService.toggleFilterPane();
  
    this.syncPanelUI();
  
    if (!result.isOpen) {
      return;
    }
  
    this.testCardRenderService.renderFilterPane();
  
    if (result.shouldLoadTestCards) {
      await this.loadTestCardsWeek();
    }
  }

  async handleTestCardTeamChange(affiliationId) {
    const nextAffiliationId = String(affiliationId ?? '');
  
    if (!nextAffiliationId) {
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
  
    this.testCardRenderService.renderAll();
  }

  async handleTestCardDateAliasChange(dateAlias) {
    this.state.setSelectedTestCardDateAlias(dateAlias);
    this.state.closeActiveTestCardFilter();
  
    await this.loadTestCardsWeek();
  }

  syncInitialActiveTeamButton() {
    const selectedAffiliationId = this.state.getSelectedAffiliationId();
    this.updateTeamButtonsByAffiliationId(selectedAffiliationId);
  }

  syncPanelUI() {
    this.syncDrawerUI();
    this.syncFilterPaneUI();
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
  
    this.updateTitle(this.getTitleTextByScrollPosition(dateText));
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
    const payload = this.buildEditSubmitPayload();
  
    await this.editCommitService.commitMove({
      payload,
      committedEditEvent: this.editSessionService.getPendingForCommit(),
      successMessage: '登録を完了しました',
      failureMessage: '登録に失敗しました。',
      keepDragPreviewUntilRender: true,
    });
  }

  handleEditMemberChange(memberId) {
    if (!memberId) {
      return;
    }
  
    this.updatePendingEditSession((pendingEditEvent) => ({
      ...pendingEditEvent,
      memberId,
    }));
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
    return this.editSessionService.hasPendingChanges(
      (selectedEditEvent, pendingEditEvent) =>
        ScheduleEditPayloadService.hasChanges(selectedEditEvent, pendingEditEvent)
    );
  }

  bindEditDateTimeEvents() {
    ScheduleEditDateTimeService.bindInputChangeEvents(
      this.elements?.editAfterSummary,
      () => this.handleEditDateTimeChange()
    );
  }

  handleEditDateTimeChange() {
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

  handleDrawerPanelToggle(panelId) {
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
      this.loadTestCardsWeek();
    }
  }

  syncDrawerUI() {
    const isDrawerOpen = this.state.getIsDrawerOpen();
    const activePanelId = this.state.getActivePanelId();
    const shouldKeepFilterPaneOpen = isDrawerOpen && activePanelId === 'test';
  
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
  }

  async render(options = {}) {
    await this.renderFlowService.render(options);
  }

  updateRangeButtonsByHours(activeHours) {
    this.buttonStateUiService.syncRangeButtonsByHours(activeHours);
  }

  updateTitle(dateText) {
    this.elements.title.textContent = `${dateText}`;
  }

  handleScheduleDragMove(dragState) {
    this.editInteractionService.moveDragPreview(dragState);
  
    const { isValid, pendingEditEvent } =
      this.dragDropService.buildDropResult(dragState);
  
    if (!isValid) {
      this.resetPendingEditPreview();
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

    await this.editCommitService.commitMove({
      payload,
      committedEditEvent: this.editSessionService.getPendingForCommit(),
      successMessage: '登録を完了しました',
      failureMessage: '登録に失敗しました。',
      keepDragPreviewUntilRender: true,
      resetDragOnFailure: true,
    });
  }

  handleScheduleDragCancel() {
    this.resetPendingEditPreview();
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