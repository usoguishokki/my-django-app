/**
 * @file PlanSchedulingRenderer.js
 * @module planScheduling/ui/PlanSchedulingRenderer
 * @summary 計画調整ページ状態をDOMへ描画する
 * @responsibility (SRP)
 * - Plan一覧、日付・直・班階層、プレビューを描画する
 * - 選択状態とデータ品質状態を視覚化する
 * @not_responsible
 * - API通信、業務計算、永続化
 * @inputs
 * - backend page stateと選択ViewModel
 * @outputs
 * - DOM表示
 * @side_effects
 * - root配下のDOM更新
 */

import { formatMinutes } from '../domain/PlanSchedulingPreviewPolicy.js';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export class PlanSchedulingRenderer {
  constructor(root) {
    this.root = root;
  }

  renderLoading() {
    this.feedback.textContent = '読み込み中…';
    this.workspace.hidden = true;
  }

  renderError(message) {
    this.feedback.textContent = message;
    this.feedback.classList.add('is-error');
    this.workspace.hidden = true;
  }

  renderState(state, selection) {
    this.feedback.classList.remove('is-error');
    this.feedback.textContent = state.dataQuality.hasErrors
      ? `データ確認事項が${state.dataQuality.issueCount}件あります。`
      : '';
    this.root.querySelector('[data-role="week-label"]').textContent = state.week.label;
    this.root.querySelector('[data-role="week-range"]').textContent =
      `${state.week.startDate} 〜 ${state.week.endDate}`;
    this.root.querySelector('[data-role="plan-count"]').textContent = `${state.plans.length}件`;
    this.renderPlanList(state.plans);
    this.dateGrid.innerHTML = state.dates.map((day) => this.dateTemplate(day)).join('');
    this.workspace.hidden = false;
    this.renderSelection(state, selection);
  }

  renderPlanList(plans, selectedPlanId = null) {
    this.planList.innerHTML = plans.length
      ? plans.map((plan) => this.planTemplate(plan)).join('')
      : '<p class="plan-scheduling__empty">該当する配布待ち計画はありません。</p>';
    this.planList.querySelectorAll('[data-plan-id]').forEach((button) => {
      button.classList.toggle(
        'is-selected-plan',
        Number(button.dataset.planId) === selectedPlanId,
      );
    });
  }

  renderSelection(_state, selection) {
    this.root.querySelectorAll('[data-plan-id]').forEach((button) => {
      button.classList.toggle(
        'is-selected-plan',
        Number(button.dataset.planId) === selection.plan?.planId,
      );
    });
    this.root.querySelectorAll('[data-slot-key]').forEach((button) => {
      const isCurrent = button.dataset.slotKey === selection.plan?.current.slotKey;
      button.classList.toggle(
        'is-selected-destination',
        button.dataset.slotKey === selection.destination?.key,
      );
      button.classList.toggle('is-current-slot', isCurrent);
      button.disabled = button.dataset.slotSelectable !== 'true' || isCurrent;
    });
    this.preview.innerHTML = selection.preview
      ? this.previewTemplate(selection)
      : '<p class="plan-scheduling__previewEmpty">計画と移動先候補を選ぶと、工数の変化を確認できます。</p>';
  }

  planTemplate(plan) {
    const issues = plan.dataQualityIssues
      .map((issue) => `<span class="plan-scheduling__quality">${escapeHtml(issue.message)}</span>`)
      .join('');
    return `<button type="button" class="plan-scheduling__planCard" data-plan-id="${plan.planId}" ${plan.isPreviewable ? '' : 'disabled'}>
      <span class="plan-scheduling__planPrimary">${escapeHtml(plan.inspectionNo)} · ${escapeHtml(plan.workName)}</span>
      <span>${escapeHtml(plan.equipmentName || '設備名なし')}</span>
      <span>${escapeHtml(plan.current.dateLabel)} / ${escapeHtml(plan.current.shift.name || '直不明')} / ${escapeHtml(plan.current.team.name || '班未設定')}</span>
      <strong>${escapeHtml(plan.workMinutesLabel)}</strong>${issues}
    </button>`;
  }

  dateTemplate(day) {
    const grouped = day.slots.reduce((map, slot) => {
        const key = slot.shift.name || '直不明';
        map.set(key, [...(map.get(key) || []), slot]);
        return map;
      }, new Map());
    const shifts = [...grouped.entries()].map(([shiftName, slots]) => `
      <section class="plan-scheduling__shiftGroup">
        <h4>${escapeHtml(shiftName)}</h4>
        <div class="plan-scheduling__slotList">${slots.map((slot) => this.slotTemplate(slot)).join('')}</div>
      </section>`).join('');
    return `<article class="plan-scheduling__dateColumn">
      <header><h3>${escapeHtml(day.label)}</h3>${day.isReserveWeek ? '<span>予備週</span>' : ''}</header>
      ${shifts || '<p class="plan-scheduling__empty">勤務スロットなし</p>'}
    </article>`;
  }

  slotTemplate(slot) {
    const disabled = !slot.isValid || slot.hasInvalidEffort;
    const issue = slot.dataQualityIssues[0]?.message ||
      (slot.hasInvalidEffort ? '工数データに不備があります。' : '');
    return `<button type="button" class="plan-scheduling__slot${disabled ? ' is-invalid' : ''}"
      data-slot-key="${escapeHtml(slot.key)}" data-slot-selectable="${disabled ? 'false' : 'true'}" ${disabled ? 'disabled' : ''}>
      <span>${escapeHtml(slot.team.name)}</span><strong>${escapeHtml(slot.workloadLabel)}</strong>
      ${issue ? `<small>${escapeHtml(issue)}</small>` : ''}
    </button>`;
  }

  previewTemplate({ plan, destination, preview }) {
    const current = plan.current;
    return `<div class="plan-scheduling__previewHeader"><div><p>選択中</p><h2>${escapeHtml(plan.inspectionNo)} · ${escapeHtml(plan.workName)}</h2></div><strong>${formatMinutes(preview.selectedPlan)}</strong></div>
      <div class="plan-scheduling__moveSummary">
        <div><span>現在</span><strong>${escapeHtml(current.dateLabel)} / ${escapeHtml(current.shift.name)} / ${escapeHtml(current.team.name)}</strong></div>
        <span class="plan-scheduling__arrow" aria-hidden="true">→</span>
        <div><span>プレビュー</span><strong>${escapeHtml(destination.dateLabel)} / ${escapeHtml(destination.shift.name)} / ${escapeHtml(destination.team.name)}</strong></div>
      </div>
      <div class="plan-scheduling__arithmetic">
        <div><span>移動先 現在</span><strong>${formatMinutes(preview.destinationBefore)}</strong></div>
        <div><span>選択計画</span><strong>+ ${formatMinutes(preview.selectedPlan)}</strong></div>
        <div class="is-result"><span>移動後</span><strong>${formatMinutes(preview.destinationAfter)}</strong></div>
        <div><span>移動元 現在 → 移動後</span><strong>${formatMinutes(preview.sourceBefore)} → ${formatMinutes(preview.sourceAfter)}</strong></div>
      </div>
      <p class="plan-scheduling__readOnly">プレビューのみ。保存・更新は行われません。</p>`;
  }

  get feedback() { return this.root.querySelector('[data-role="feedback"]'); }
  get workspace() { return this.root.querySelector('[data-role="workspace"]'); }
  get planList() { return this.root.querySelector('[data-role="plan-list"]'); }
  get dateGrid() { return this.root.querySelector('[data-role="date-grid"]'); }
  get preview() { return this.root.querySelector('[data-role="preview"]'); }
}
