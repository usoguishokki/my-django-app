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
    this.slotSelectionIntent = 0;
    this.interaction = initialInteractionState();
  }

  async init() {
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.querySelector('[data-role="week-form"]')?.addEventListener(
      'submit',
      (event) => this.handleWeekSubmit(event),
    );
    const today = new Date();
    const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 10);
    const input = this.root.querySelector('[data-role="target-date"]');
    if (input) input.value = localToday;
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
      this.renderer.renderState(this.state, this.selection());
      this.renderer.scrollTimelineToDate(targetDate);
    } catch (error) {
      this.renderer.renderError(error.message);
    }
  }

  async load(targetDate) {
    this.renderer.renderLoading();
    try {
      const weekState = await this.apiClient.fetchWeek(targetDate);
      this.state = this.withFullTimeline(weekState);
      this.renderer.renderState(this.state, this.selection());
      this.renderer.scrollTimelineToDate?.(targetDate);
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
      try {
        const weekState = await this.apiClient.fetchWeek(slotDate);
        if (intent !== this.slotSelectionIntent) return;
        this.state = this.withFullTimeline(weekState);
        selectedSlot = this.findWeekSlot(slotKey);
        hydrated = true;
      } catch (error) {
        if (intent === this.slotSelectionIntent) {
          this.renderer.renderInteractionError?.(error.message);
        }
        return;
      }
    }

    if (intent !== this.slotSelectionIntent || !selectedSlot) return;
    this.selectSlot(selectedSlot);
    if (hydrated) {
      this.renderer.renderState(this.state, this.selection());
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

  renderSelection() {
    this.renderer.renderSelection(this.state, this.selection());
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
