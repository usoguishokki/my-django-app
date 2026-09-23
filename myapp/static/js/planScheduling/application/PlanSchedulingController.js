/**
 * @file PlanSchedulingController.js
 * @module planScheduling/application/PlanSchedulingController
 * @summary 読取専用ページの取得・選択・描画を調整する
 * @responsibility (SRP)
 * - ページ状態と選択状態を保持する
 * - UIイベントをAPI・rendererへ委譲する
 * @not_responsible
 * - HTML生成、工数計算、データ更新
 * @inputs
 * - root、API client、renderer、preview policy
 * @outputs
 * - 画面描画
 * @side_effects
 * - GET通信とDOMイベント登録
 */

import {
  PlanSchedulingMode,
  beginMove,
  cancelMove,
  closeDrawer,
  initialInteractionState,
  selectMatrixSlot,
  setMoveSubmitting,
} from '../domain/PlanSchedulingPreviewPolicy.js';
import {
  emptyPlanSchedulingFilter,
  filterIncludesSlot,
  nextFilteredDate,
  normalizePlanSchedulingFilter,
  planSchedulingFilterCount,
  projectPlanSchedulingState,
} from '../domain/PlanSchedulingFilterProjection.js';
import {
  PLAN_SCHEDULING_VIEW_MODE,
  groupCanonicalMaintenanceWeeks,
  maintenanceWeekByKey,
  maintenanceWeekForDate,
  maintenanceDatesForFiscalRange,
  maintenanceWeeksForFiscalRange,
  projectDayOverviewGroups,
  projectMaintenanceFiscalRange,
  projectMaintenanceWeeks,
} from '../domain/PlanSchedulingMaintenanceWeekProjection.js';

export class PlanSchedulingController {
  constructor({ root, apiClient, renderer, buildPreview, selectSlotPlans }) {
    this.root = root;
    this.apiClient = apiClient;
    this.renderer = renderer;
    this.buildPreview = buildPreview;
    this.selectSlotPlans = selectSlotPlans;
    this.state = null;
    this.timelineChart = null;
    this.timelineDates = null;
    this.viewState = null;
    this.activeFilter = emptyPlanSchedulingFilter();
    this.viewMode = PLAN_SCHEDULING_VIEW_MODE.DAY;
    this.matrixVisible = true;
    this.timelineFiscalAnchorDate = '';
    this.slotSelectionIntent = 0;
    this.interaction = initialInteractionState();
  }

  async init() {
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('change', (event) => this.handleChange(event));
    this.root.ownerDocument?.addEventListener?.(
      'click',
      (event) => this.handleDocumentClick(event),
    );
    this.root.ownerDocument?.addEventListener?.(
      'keydown',
      (event) => this.handleDocumentKeydown(event),
    );
    this.root.querySelector('[data-role="week-form"]')?.addEventListener(
      'submit',
      (event) => this.handleWeekSubmit(event),
    );
    const today = new Date();
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
    const input = this.root.querySelector('[data-role="target-date"]');
    if (input) input.value = localToday;
    this.renderer.renderFilterState?.(this.activeFilter);
    await this.loadInitial(localToday);
  }

  async loadInitial(targetDate) {
    this.renderer.renderLoading();
    try {
      const [weekState, timelineState] = await Promise.all([
        this.apiClient.fetchWeek(targetDate),
        this.apiClient.fetchTimeline(),
      ]);
      this.timelineChart = timelineState.workloadChart;
      this.timelineDates = timelineState.dates;
      this.timelineFiscalAnchorDate = targetDate;
      this.state = this.withFullTimeline(weekState);
      this.refreshViewState();
      this.renderState();
      this.scrollToRequestedWeekDate(targetDate, weekState);
    } catch (error) {
      this.renderer.renderError(error.message);
    }
  }

  async load(targetDate) {
    const anchor = this.renderer.captureTimelineAnchor?.(this.selection().selectedSlot?.date);
    this.renderer.renderLoading();
    try {
      const weekState = await this.apiClient.fetchWeek(targetDate);
      this.timelineFiscalAnchorDate = targetDate;
      this.state = this.withFullTimeline(weekState);
      this.refreshViewState();
      this.renderState();
      if (!this.scrollToRequestedWeekDate(targetDate, weekState)) {
        this.restoreFilterAnchor(anchor);
      }
    } catch (error) {
      this.renderer.renderError(error.message);
    }
  }

  handleWeekSubmit(event) {
    event.preventDefault();
    const value = this.root.querySelector('[data-role="target-date"]')?.value || '';
    if (this.viewMode === PLAN_SCHEDULING_VIEW_MODE.MAINTENANCE_WEEK) {
      return this.navigateToMaintenanceWeek(value);
    }
    return this.load(value);
  }

  handleClick(event) {
    const viewModeButton = event.target.closest('[data-action="set-view-mode"]');
    if (viewModeButton) {
      return this.changeViewMode(viewModeButton.dataset.viewMode);
    }

    const drilldownButton = event.target.closest('[data-action="drilldown-week"]');
    if (drilldownButton) {
      return this.drillDownToDay(drilldownButton.dataset.weekKey);
    }

    const filterToggle = event.target.closest('[data-action="toggle-filter"]');
    if (filterToggle) {
      if (this.renderer.isFilterOpen?.()) this.renderer.closeFilterPopover?.();
      else this.renderer.openFilterPopover?.(this.activeFilter);
      return;
    }

    if (event.target.closest('[data-action="close-filter"]')) {
      this.renderer.closeFilterPopover?.();
      return;
    }

    if (event.target.closest('[data-action="clear-filter-draft"]')) {
      this.renderer.clearFilterDraft?.();
      return;
    }

    if (event.target.closest('[data-action="apply-filters"]')) {
      this.applyFilter(this.renderer.readFilterDraft?.() || emptyPlanSchedulingFilter());
      return;
    }

    if (event.target.closest('[data-action="clear-applied-filters"]')) {
      this.applyFilter(emptyPlanSchedulingFilter());
      return;
    }

    if (event.target.closest('[data-action="close-move-success"]')) {
      this.renderer.closeMoveSuccess?.();
      return;
    }

    if (event.target.closest('[data-action="confirm-move"]')) {
      return this.confirmMove();
    }

    const cancelButton = event.target.closest('[data-action="cancel-move"]');
    if (cancelButton) {
      if (this.interaction.isMoveSubmitting) return;
      this.interaction = cancelMove(this.interaction);
      this.renderSelection();
      return;
    }

    const closeButton = event.target.closest('[data-action="close-drawer"]');
    if (closeButton) {
      this.interaction = closeDrawer(this.interaction);
      this.renderSelection();
      return;
    }

    const moveButton = event.target.closest('[data-action="move"]');
    if (moveButton && !moveButton.disabled) {
      const planId = Number(moveButton.dataset.planId);
      const plan = this.state.plans.find((item) => item.planId === planId);
      const sourceSlot = this.state.dates.flatMap((day) => day.slots).find(
        (slot) => slot.key === plan?.current.slotKey,
      );
      this.interaction = beginMove(
        this.interaction,
        planId,
        {
          plan,
          sourceSlot,
          chartDay: this.viewState?.workloadChart?.dates?.find(
            (day) => day.date === sourceSlot?.date,
          ),
          weekLabel: this.state.week?.label || '',
        },
      );
      this.renderSelection();
      return;
    }

    const slotButton = event.target.closest('[data-slot-key]');
    if (slotButton && !slotButton.disabled) {
      if (this.interaction.isMoveSubmitting) return;
      return this.handleSlotClick(slotButton);
    }
  }

  async reconcileAuthoritativeState(targetDate) {
    const [timelineState, weekState] = await Promise.all([
      this.apiClient.fetchTimeline(),
      this.apiClient.fetchWeek(targetDate),
    ]);
    this.timelineChart = timelineState.workloadChart;
    this.timelineDates = timelineState.dates;
    this.timelineFiscalAnchorDate = targetDate;
    this.state = this.withFullTimeline(weekState);
    this.refreshViewState();
    this.renderState();
    this.renderer.scrollTimelineToDate?.(targetDate);
  }

  authoritativePlanLocation(planId, source, destination) {
    const slots = (this.timelineDates || []).flatMap((day) => day.slots || []);
    const containsPlan = (slot, expected) => (
      slot.date === expected.date &&
      slot.team?.id === expected.team.id &&
      (slot.planIds || []).includes(planId)
    );
    if (slots.some((slot) => containsPlan(slot, destination))) return 'destination';
    if (slots.some((slot) => containsPlan(slot, source))) return 'source';
    return 'unknown';
  }

  async confirmMove() {
    const selection = this.selection();
    if (
      this.interaction.isMoveSubmitting ||
      !selection.isMoving ||
      !selection.plan ||
      !selection.source ||
      !selection.destination ||
      !selection.preview
    ) return false;

    const payload = {
      planId: selection.plan.planId,
      expectedSourceDate: selection.source.date,
      expectedSourceAffiliationId: selection.source.team.id,
      destinationDate: selection.destination.date,
      destinationAffiliationId: selection.destination.team.id,
    };
    this.interaction = setMoveSubmitting(this.interaction, true);
    this.renderSelection();

    let receipt;
    try {
      receipt = await this.apiClient.movePlan(payload);
    } catch (error) {
      if (!error?.status) {
        this.interaction = closeDrawer(this.interaction);
        let outcome = 'unknown';
        try {
          await this.reconcileAuthoritativeState(payload.destinationDate);
          outcome = this.authoritativePlanLocation(
            payload.planId,
            selection.source,
            selection.destination,
          );
        } catch (_refreshError) {
          this.renderState();
        }
        const uncertainMessages = {
          destination: '通信結果を確認できませんでしたが、最新の予定では移動先に反映されています。',
          source: '通信結果を確認できませんでした。最新の予定では移動は反映されていません。',
          unknown: '通信結果を確認できません。最新の予定位置を確認してから再操作してください。',
        };
        this.renderer.renderInteractionError?.(uncertainMessages[outcome]);
        return false;
      }
      const shouldReload = [400, 404, 409].includes(error?.status);
      if (shouldReload) {
        this.interaction = closeDrawer(this.interaction);
        try {
          await this.reconcileAuthoritativeState(payload.expectedSourceDate);
        } catch (_refreshError) {
          this.renderState();
        }
      } else {
        this.interaction = setMoveSubmitting(this.interaction, false);
        this.renderSelection();
      }
      const messages = {
        STALE_SOURCE: '予定が更新されています。最新の状態を読み込みました。',
        PLAN_NOT_WAITING: 'この予定は配布待ちではないため移動できません。',
        PLAN_TIME_CONFLICT: '配布待ち予定に時刻が設定されているため移動できません。',
        INVALID_SLOT: '移動元または移動先を利用できません。最新の状態を確認してください。',
        MOVE_NOT_FOUND: '予定が見つからないか、アクセスできません。',
      };
      this.renderer.renderInteractionError?.(
        messages[error?.code] || error?.message || '予定を移動できませんでした。',
      );
      return false;
    }

    this.interaction = closeDrawer(this.interaction);
    let refreshWarning = '';
    try {
      await this.reconcileAuthoritativeState(receipt.destination.date);
    } catch (_error) {
      refreshWarning = '最新の予定表示を更新できませんでした。ページを再読み込みしてください。';
      this.renderState();
      this.renderer.renderInteractionError?.(refreshWarning);
    }
    this.renderer.showMoveSuccess?.(receipt, { refreshWarning });
    return true;
  }

  handleChange(event) {
    const matrixToggle = event.target.closest?.('[data-action="toggle-matrix"]');
    if (matrixToggle) this.setMatrixVisible(matrixToggle.checked);
  }

  async handleSlotClick(slotButton) {
    const slotKey = slotButton.dataset.slotKey;
    const slotDate = slotButton.dataset.slotDate;
    const intent = ++this.slotSelectionIntent;
    let selectedSlot = this.findWeekSlot(slotKey);
    let hydrated = false;

    if (!selectedSlot && slotDate) {
      this.renderer.renderSlotHydrationPending?.();
      try {
        const weekState = await this.apiClient.fetchWeek(slotDate);
        if (intent !== this.slotSelectionIntent) return;
        this.state = this.withFullTimeline(weekState);
        this.refreshViewState();
        selectedSlot = this.findWeekSlot(slotKey);
        hydrated = true;
      } catch (error) {
        if (intent === this.slotSelectionIntent) {
          this.renderSelection();
          this.renderer.renderInteractionError?.(error.message);
        }
        return;
      }
    }

    if (intent !== this.slotSelectionIntent) return;
    if (!selectedSlot) {
      this.renderSelection();
      this.renderer.renderInteractionError?.('選択した勤務スロットを読み込めませんでした。');
      return;
    }
    this.selectSlot(selectedSlot);
    if (hydrated) {
      this.renderState();
    } else {
      this.renderSelection();
    }
  }

  findWeekSlot(slotKey) {
    return this.state?.dates.flatMap((day) => day.slots).find(
      (slot) => slot.key === slotKey,
    );
  }

  selectSlot(selectedSlot) {
    this.interaction = selectMatrixSlot(
      this.interaction,
      selectedSlot.key,
      {
        slot: selectedSlot,
        slotPlans: this.selectSlotPlans(this.state.plans, selectedSlot),
      },
    );
  }

  withFullTimeline(weekState) {
    return {
      ...weekState,
      timelineDates: this.timelineDates || weekState.dates,
      workloadChart: this.timelineChart || weekState.workloadChart,
    };
  }

  refreshViewState() {
    const anchorDate = this.timelineFiscalAnchorDate || this.state?.week?.startDate;
    let projection;
    if (this.viewMode === PLAN_SCHEDULING_VIEW_MODE.MAINTENANCE_WEEK) {
      projection = projectMaintenanceWeeks(
        this.state,
        this.activeFilter,
        anchorDate,
      );
    } else {
      const fiscalProjection = projectMaintenanceFiscalRange(this.state, anchorDate);
      const dayProjection = projectPlanSchedulingState(
        fiscalProjection,
        this.activeFilter,
      );
      projection = {
        ...dayProjection,
        dayOverviewGroups: projectDayOverviewGroups(
          dayProjection.timelineDates,
          fiscalProjection.timelineDates,
        ),
        viewMode: PLAN_SCHEDULING_VIEW_MODE.DAY,
      };
    }
    this.viewState = { ...projection, matrixVisible: this.matrixVisible };
    return this.viewState;
  }

  renderState(options = {}) {
    this.renderer.renderState(this.viewState || this.state, this.selection(), options);
    this.renderer.renderFilterState?.(this.activeFilter);
    const noMatches = planSchedulingFilterCount(this.activeFilter) > 0 && (
      !this.viewState?.timelineDates?.length ||
      !this.viewState.timelineDates.some((day) => day.slots.length)
    );
    this.renderer.renderFilterEmptyState?.(noMatches);
  }

  setMatrixVisible(nextVisible) {
    const matrixVisible = Boolean(nextVisible);
    if (matrixVisible === this.matrixVisible) {
      this.renderer.renderMatrixVisibility?.(this.matrixVisible);
      return false;
    }
    if (!matrixVisible && this.interaction.mode === PlanSchedulingMode.MOVING) {
      this.renderer.renderMatrixVisibility?.(true);
      this.renderer.renderInteractionError?.('移動中はマトリクスを非表示にできません');
      return false;
    }

    const selection = this.selection();
    const timelineAnchor = this.renderer.captureTimelineAnchor?.(
      selection.selectedSlot?.date,
    );
    if (!matrixVisible) {
      this.slotSelectionIntent += 1;
      this.interaction = closeDrawer(this.interaction);
    }
    this.matrixVisible = matrixVisible;
    this.refreshViewState();
    this.renderState({ timelineAnchor, layoutGeometryChanges: true });
    this.renderer.focusMatrixVisibilityToggle?.();
    return true;
  }

  applyFilter(filter) {
    if (this.interaction.mode === PlanSchedulingMode.MOVING) {
      this.renderer.renderInteractionError?.('移動中はフィルターを変更できません');
      return false;
    }
    const selection = this.selection();
    const anchor = this.renderer.captureTimelineAnchor?.(selection.selectedSlot?.date);
    this.activeFilter = normalizePlanSchedulingFilter(filter);
    this.refreshViewState();
    if (selection.selectedSlot && !filterIncludesSlot(this.activeFilter, selection.selectedSlot)) {
      this.interaction = closeDrawer(this.interaction);
    }
    this.restoreFilterAnchorDate(anchor);
    this.renderState();
    this.renderer.closeFilterPopover?.();
    this.restoreFilterAnchor(anchor);
    return true;
  }

  restoreFilterAnchorDate(anchor) {
    if (!anchor?.date || this.viewState.timelineDates.some((day) => day.date === anchor.date)) {
      return;
    }
    const sourceDates = this.viewMode === PLAN_SCHEDULING_VIEW_MODE.MAINTENANCE_WEEK
      ? maintenanceWeeksForFiscalRange(
        groupCanonicalMaintenanceWeeks(this.state.timelineDates),
        this.timelineFiscalAnchorDate || this.state?.week?.startDate,
      )
      : maintenanceDatesForFiscalRange(
        this.state.timelineDates,
        this.timelineFiscalAnchorDate || this.state?.week?.startDate,
      );
    anchor.date = nextFilteredDate(
      sourceDates,
      this.viewState.timelineDates,
      anchor.date,
    );
  }

  restoreFilterAnchor(anchor) {
    if (!anchor?.date) return;
    this.renderer.restoreTimelineAnchorAfterRender?.(anchor);
  }

  scrollToRequestedWeekDate(targetDate, weekState) {
    if (planSchedulingFilterCount(this.activeFilter) === 0) {
      return this.renderer.scrollTimelineToDate?.(targetDate) !== false;
    }
    const visibleDates = new Set(this.viewState?.timelineDates?.map((day) => day.date) || []);
    if (visibleDates.has(targetDate)) {
      return this.renderer.scrollTimelineToDate?.(targetDate) !== false;
    }
    const requestedWeekDates = (weekState?.dates || [])
      .map((day) => day.date)
      .filter((date) => visibleDates.has(date));
    if (requestedWeekDates.length) {
      return this.renderer.scrollTimelineToDate?.(requestedWeekDates[0]) !== false;
    }
    if (planSchedulingFilterCount(this.activeFilter) > 0) {
      this.renderer.renderInteractionError?.('この週には条件に一致する日付がありません');
    }
    return false;
  }

  changeViewMode(nextMode) {
    if (!this.state) return false;
    if (!Object.values(PLAN_SCHEDULING_VIEW_MODE).includes(nextMode) || nextMode === this.viewMode) {
      return false;
    }
    if (this.interaction.mode === PlanSchedulingMode.MOVING) {
      this.renderer.renderInteractionError?.('移動中は表示を切り替えられません');
      return false;
    }
    const anchor = this.renderer.captureTimelineAnchor?.(
      this.viewMode === PLAN_SCHEDULING_VIEW_MODE.DAY
        ? this.selection().selectedSlot?.date
        : undefined,
    );
    let targetDate = anchor?.date || this.state?.week?.startDate || '';
    if (nextMode === PLAN_SCHEDULING_VIEW_MODE.MAINTENANCE_WEEK) {
      this.slotSelectionIntent += 1;
      this.interaction = closeDrawer(this.interaction);
      this.timelineFiscalAnchorDate = targetDate;
    } else {
      const currentWeek = maintenanceWeekByKey(this.viewState?.timelineDates, targetDate);
      targetDate = currentWeek?.firstVisibleDate || '';
    }
    this.viewMode = nextMode;
    this.refreshViewState();
    if (nextMode === PLAN_SCHEDULING_VIEW_MODE.MAINTENANCE_WEEK) {
      targetDate = maintenanceWeekForDate(this.viewState.timelineDates, targetDate)?.key ||
        this.viewState.timelineDates[0]?.key || '';
    }
    this.renderState();
    if (targetDate) {
      this.restoreFilterAnchor({
        ...anchor,
        date: targetDate,
        viewportPosition: anchor?.viewportPosition ?? 0,
      });
    }
    return true;
  }

  navigateToMaintenanceWeek(targetDate) {
    if (!this.state) return false;
    const canonicalWeeks = groupCanonicalMaintenanceWeeks(this.state?.timelineDates || []);
    const targetWeek = maintenanceWeekForDate(canonicalWeeks, targetDate);
    const projectedState = projectMaintenanceWeeks(this.state, this.activeFilter, targetDate);
    const visibleWeek = maintenanceWeekByKey(projectedState?.timelineDates, targetWeek?.key);
    if (!visibleWeek) {
      this.renderer.renderInteractionError?.('この保全週には条件に一致する日付がありません');
      return false;
    }
    this.timelineFiscalAnchorDate = targetDate;
    this.viewState = { ...projectedState, matrixVisible: this.matrixVisible };
    this.renderState();
    return this.renderer.scrollTimelineToDate?.(visibleWeek.key) !== false;
  }

  drillDownToDay(weekKey) {
    if (this.interaction.mode === PlanSchedulingMode.MOVING) {
      this.renderer.renderInteractionError?.('移動中は表示を切り替えられません');
      return false;
    }
    const week = maintenanceWeekByKey(this.viewState?.timelineDates, weekKey);
    if (!week?.firstVisibleDate) return false;
    this.viewMode = PLAN_SCHEDULING_VIEW_MODE.DAY;
    this.interaction = closeDrawer(this.interaction);
    this.slotSelectionIntent += 1;
    return this.load(week.firstVisibleDate);
  }

  handleDocumentClick(event) {
    if (!this.renderer.isFilterOpen?.()) return;
    const control = this.root.querySelector('[data-role="filter-control"]');
    if (!control?.contains?.(event.target)) this.renderer.closeFilterPopover?.();
  }

  handleDocumentKeydown(event) {
    if (event.key === 'Escape' && this.renderer.isFilterOpen?.()) {
      this.renderer.closeFilterPopover?.();
    }
  }

  renderSelection() {
    this.renderer.renderSelection(this.viewState || this.state, this.selection());
  }

  selection() {
    const moveContext = this.interaction.moveContext;
    const plan = this.state?.plans.find(
      (item) => item.planId === this.interaction.movingPlanId,
    ) || moveContext?.plan;
    const slots = this.state?.dates.flatMap((item) => item.slots) || [];
    const source = slots.find((item) => item.key === plan?.current.slotKey) ||
      moveContext?.sourceSlot;
    const liveSelectedSlot = slots.find(
      (item) => item.key === this.interaction.selectedSlotKey,
    );
    const selectedSlot = liveSelectedSlot ||
      (this.interaction.mode === PlanSchedulingMode.MOVING ? source : undefined) ||
      this.interaction.selectedSlotContext?.slot;
    const destination = slots.find(
      (item) => item.key === this.interaction.destinationSlotKey,
    );
    return {
      plan,
      mode: this.interaction.mode,
      isMoving: this.interaction.mode === PlanSchedulingMode.MOVING,
      moveContext,
      selectedSlot,
      source,
      slotPlans: liveSelectedSlot
        ? this.selectSlotPlans(this.state.plans, liveSelectedSlot)
        : this.interaction.selectedSlotContext?.slotPlans || [],
      destination,
      preview: this.buildPreview(plan, destination, source),
      isMoveSubmitting: Boolean(this.interaction.isMoveSubmitting),
    };
  }
}
