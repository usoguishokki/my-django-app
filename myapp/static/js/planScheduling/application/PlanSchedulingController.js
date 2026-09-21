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
} from '../domain/PlanSchedulingPreviewPolicy.js';
import {
  emptyPlanSchedulingFilter,
  filterIncludesSlot,
  nextFilteredDate,
  normalizePlanSchedulingFilter,
  planSchedulingFilterCount,
  projectPlanSchedulingState,
} from '../domain/PlanSchedulingFilterProjection.js';

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
    this.slotSelectionIntent = 0;
    this.interaction = initialInteractionState();
  }

  async init() {
    this.root.addEventListener('click', (event) => this.handleClick(event));
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
    return this.load(value);
  }

  handleClick(event) {
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

    const cancelButton = event.target.closest('[data-action="cancel-move"]');
    if (cancelButton) {
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
          chartDay: this.state.workloadChart?.dates?.find((day) => day.date === sourceSlot?.date),
          weekLabel: this.state.week?.label || '',
        },
      );
      this.renderSelection();
      return;
    }

    const slotButton = event.target.closest('[data-slot-key]');
    if (slotButton && !slotButton.disabled) {
      return this.handleSlotClick(slotButton);
    }
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
    this.viewState = projectPlanSchedulingState(this.state, this.activeFilter);
    return this.viewState;
  }

  renderState() {
    this.renderer.renderState(this.viewState || this.state, this.selection());
    this.renderer.renderFilterState?.(this.activeFilter);
    const noMatches = planSchedulingFilterCount(this.activeFilter) > 0 && (
      !this.viewState?.timelineDates?.length ||
      !this.viewState.timelineDates.some((day) => day.slots.length)
    );
    this.renderer.renderFilterEmptyState?.(noMatches);
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
    anchor.date = nextFilteredDate(
      this.state.timelineDates,
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
    };
  }
}
