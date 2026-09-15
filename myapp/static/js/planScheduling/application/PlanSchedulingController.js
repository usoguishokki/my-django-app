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
    await this.load(localToday);
  }

  async load(targetDate) {
    this.renderer.renderLoading();
    try {
      this.state = await this.apiClient.fetchWeek(targetDate);
      this.interaction = initialInteractionState();
      this.renderer.renderState(this.state, this.selection());
    } catch (error) {
      this.renderer.renderError(error.message);
    }
  }

  handleWeekSubmit(event) {
    event.preventDefault();
    const value = this.root.querySelector('[data-role="target-date"]')?.value || '';
    this.load(value);
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
      this.interaction = beginMove(
        this.interaction,
        Number(moveButton.dataset.planId),
      );
      this.renderSelection();
      return;
    }

    const slotButton = event.target.closest('[data-slot-key]');
    if (slotButton && !slotButton.disabled) {
      this.interaction = selectMatrixSlot(
        this.interaction,
        slotButton.dataset.slotKey,
      );
      this.renderSelection();
    }
  }

  renderSelection() {
    this.renderer.renderSelection(this.state, this.selection());
  }

  selection() {
    const plan = this.state?.plans.find(
      (item) => item.planId === this.interaction.movingPlanId,
    );
    const slots = this.state?.dates.flatMap((item) => item.slots) || [];
    const selectedSlot = slots.find(
      (item) => item.key === this.interaction.selectedSlotKey,
    );
    const destination = slots.find(
      (item) => item.key === this.interaction.destinationSlotKey,
    );
    const source = slots.find((item) => item.key === plan?.current.slotKey);
    return {
      plan,
      mode: this.interaction.mode,
      isMoving: this.interaction.mode === PlanSchedulingMode.MOVING,
      selectedSlot,
      slotPlans: selectedSlot
        ? this.selectSlotPlans(this.state.plans, selectedSlot)
        : [],
      destination,
      preview: this.buildPreview(plan, destination, source),
    };
  }
}
