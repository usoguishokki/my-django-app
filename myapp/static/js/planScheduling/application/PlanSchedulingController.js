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

export class PlanSchedulingController {
  constructor({ root, apiClient, renderer, buildPreview, filterPlans }) {
    this.root = root;
    this.apiClient = apiClient;
    this.renderer = renderer;
    this.buildPreview = buildPreview;
    this.filterPlans = filterPlans;
    this.state = null;
    this.selectedPlanId = null;
    this.selectedSlotKey = '';
  }

  async init() {
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.querySelector('[data-role="week-form"]')?.addEventListener(
      'submit',
      (event) => this.handleWeekSubmit(event),
    );
    this.root.querySelector('[data-role="plan-filter"]')?.addEventListener(
      'input',
      (event) => this.handlePlanFilter(event.target.value),
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
      this.selectedPlanId = null;
      this.selectedSlotKey = '';
      const filterInput = this.root.querySelector('[data-role="plan-filter"]');
      if (filterInput) filterInput.value = '';
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
    const planButton = event.target.closest('[data-plan-id]');
    if (planButton && !planButton.disabled) {
      this.selectedPlanId = Number(planButton.dataset.planId);
      const selectedPlan = this.state?.plans.find(
        (item) => item.planId === this.selectedPlanId,
      );
      if (selectedPlan?.current.slotKey === this.selectedSlotKey) {
        this.selectedSlotKey = '';
      }
      this.renderSelection();
      return;
    }
    const slotButton = event.target.closest('[data-slot-key]');
    if (slotButton && !slotButton.disabled) {
      this.selectedSlotKey = slotButton.dataset.slotKey;
      this.renderSelection();
    }
  }

  handlePlanFilter(query) {
    if (!this.state) return;
    const plans = this.filterPlans(this.state.plans, query);
    this.renderer.renderPlanList(plans, this.selectedPlanId);
  }

  renderSelection() {
    this.renderer.renderSelection(this.state, this.selection());
  }

  selection() {
    const plan = this.state?.plans.find((item) => item.planId === this.selectedPlanId);
    const slots = this.state?.dates.flatMap((item) => item.slots) || [];
    const destination = slots.find((item) => item.key === this.selectedSlotKey);
    const source = slots.find((item) => item.key === plan?.current.slotKey);
    return {
      plan,
      destination,
      preview: this.buildPreview(plan, destination, source),
    };
  }
}
