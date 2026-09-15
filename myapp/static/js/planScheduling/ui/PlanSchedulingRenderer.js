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
    this.root.querySelector('[data-role="week-range"]').textContent =
      `${state.week.startDate} 〜 ${state.week.endDate}`;
    this.workloadChart.innerHTML = this.workloadChartTemplate(state.workloadChart);
    this.dateGrid.innerHTML = this.matrixDates(state)
      .map((day) => this.dateTemplate(day)).join('');
    this.workspace.hidden = false;
    this.renderSelection(state, selection);
  }

  renderSelection(_state, selection) {
    this.renderSlotWorkspace(selection);
    const selectingDestination = Boolean(selection.plan);
    this.root.querySelectorAll('[data-slot-key]').forEach((button) => {
      const isCurrent = button.dataset.slotKey === selection.plan?.current.slotKey;
      const isSelectedSlot = button.dataset.slotKey === selection.selectedSlot?.key;
      button.classList.toggle(
        'is-selected-destination',
        button.dataset.slotKey === selection.destination?.key,
      );
      button.classList.toggle('is-current-slot', isCurrent);
      button.classList.toggle('is-selected-slot', isSelectedSlot);
      button.disabled = button.dataset.slotSelectable !== 'true' || (
        selectingDestination && (
          isCurrent || button.dataset.previewSelectable !== 'true'
        )
      );
    });
    this.preview.innerHTML = selection.preview
      ? this.previewTemplate(selection)
      : selectingDestination
        ? `<div class="plan-scheduling__destinationPrompt"><strong>移動先を選択中</strong><span>計画マトリクスから別の有効なスロットを選択してください。</span><button type="button" class="ui-btn ui-btn--outline" data-action="cancel-move">キャンセル</button></div>`
        : '<p class="plan-scheduling__previewEmpty">計画の「移動」を選ぶと、移動先の工数変化を確認できます。</p>';
  }

  renderSlotWorkspace(selection) {
    const slot = selection.selectedSlot;
    if (!slot) {
      this.root.querySelector('[data-role="selected-slot-label"]').textContent = 'SLOT WORKSPACE';
      this.root.querySelector('[data-role="plan-count"]').textContent = '';
      this.root.querySelector('[data-role="slot-summary"]').innerHTML = '';
      this.planList.innerHTML = '<p class="plan-scheduling__workspaceEmpty">計画マトリクスから班を選択してください</p>';
      return;
    }
    this.root.querySelector('[data-role="selected-slot-label"]').textContent =
      `${slot.dateLabel} / ${slot.shift.name} / ${slot.team.name}`;
    this.root.querySelector('[data-role="plan-count"]').textContent = `${slot.planCount}件`;
    this.root.querySelector('[data-role="slot-summary"]').innerHTML = `
      <span><small>日付</small><strong>${escapeHtml(slot.dateLabel)}</strong></span>
      <span><small>直</small><strong>${escapeHtml(slot.shift.name)}</strong></span>
      <span><small>班</small><strong>${escapeHtml(slot.team.name)}</strong></span>
      <span><small>合計工数</small><strong>${escapeHtml(slot.workloadLabel)}</strong></span>`;
    this.planList.innerHTML = selection.slotPlans.length
      ? selection.slotPlans.map((plan) => this.planTemplate(plan, selection.plan?.planId)).join('')
      : '<p class="plan-scheduling__empty">このスロットに配布待ち計画はありません。</p>';
  }

  planTemplate(plan, selectedPlanId = null) {
    const issues = plan.dataQualityIssues
      .map((issue) => `<span class="plan-scheduling__quality">${escapeHtml(issue.message)}</span>`)
      .join('');
    const selected = plan.planId === selectedPlanId ? ' is-selected-plan' : '';
    return `<article class="plan-scheduling__planCard${selected}" data-plan-card-id="${plan.planId}">
      <div class="plan-scheduling__planCardHeader"><div><span class="plan-scheduling__equipment">${escapeHtml(plan.equipmentName || '設備名なし')}</span><strong class="plan-scheduling__planPrimary">${escapeHtml(plan.inspectionNo)} · ${escapeHtml(plan.workName)}</strong></div><button type="button" class="ui-btn ui-btn--outline" data-action="move" data-plan-id="${plan.planId}" ${plan.isPreviewable ? '' : 'disabled'}>移動</button></div>
      <dl class="plan-scheduling__planFacts">
        <div><dt>計画日</dt><dd>${escapeHtml(plan.current.dateLabel)}</dd></div>
        <div><dt>直 / 班</dt><dd>${escapeHtml(plan.current.shift.name || '直不明')} / ${escapeHtml(plan.current.team.name || '班未設定')}</dd></div>
        <div><dt>基本工数</dt><dd>${escapeHtml(plan.baseWorkMinutesLabel)}</dd></div>
        <div><dt>必要人数</dt><dd>${Number.isInteger(plan.requiredPersonCount) ? `${plan.requiredPersonCount}人` : 'データ不備'}</dd></div>
        <div><dt>計算工数</dt><dd>${escapeHtml(plan.workMinutesLabel)}</dd></div>
      </dl>${issues ? `<div class="plan-scheduling__qualityGroup"><strong>データ確認</strong>${issues}</div>` : ''}
    </article>`;
  }

  workloadChartTemplate(chart) {
    const maxTotal = Math.max(1, ...chart.dates.map((day) =>
      day.totalWorkloadMinutes ?? day.teamWorkloads.reduce(
        (sum, item) => sum + (item.workloadMinutes ?? 0), 0,
      )));
    const teamIndex = new Map(chart.teams.map((team, index) => [team.id, index]));
    const bars = chart.dates.map((day) => {
      const segments = day.teamWorkloads.map((item) => {
        const height = Number.isInteger(item.workloadMinutes)
          ? (item.workloadMinutes / maxTotal) * 100 : 0;
        return `<span class="plan-scheduling__chartSegment team-${teamIndex.get(item.teamId) % 8}" style="height:${height}%" title="${escapeHtml(item.teamName)} ${escapeHtml(item.workloadLabel)}"><span class="sr-only">${escapeHtml(item.teamName)} ${escapeHtml(item.workloadLabel)}</span></span>`;
      }).join('');
      return `<div class="plan-scheduling__chartColumn"><strong>${escapeHtml(day.totalWorkloadLabel)}</strong><div class="plan-scheduling__chartBar" aria-label="${escapeHtml(day.label)} 合計 ${escapeHtml(day.totalWorkloadLabel)}">${segments}</div><span>${escapeHtml(day.label)}</span></div>`;
    }).join('');
    const legend = chart.teams.map((team, index) =>
      `<span><i class="team-${index % 8}"></i>${escapeHtml(team.name)}</span>`).join('');
    return `<div class="plan-scheduling__chartLegend">${legend}</div><div class="plan-scheduling__chartPlot"><span class="plan-scheduling__yAxis">工数（分）</span><div class="plan-scheduling__chartColumns">${bars}</div></div>`;
  }

  matrixDates(state) {
    const shiftNames = new Set(state.workloadChart.shiftNames);
    return state.dates.map((day) => ({
      ...day,
      slots: day.slots.filter((slot) => shiftNames.has(slot.shift.name)),
    }));
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
    const disabled = !slot.isValid;
    const issue = slot.dataQualityIssues[0]?.message ||
      (slot.hasInvalidEffort ? '工数データに不備があります。' : '');
    return `<button type="button" class="plan-scheduling__slot${disabled ? ' is-invalid' : ''}"
      data-slot-key="${escapeHtml(slot.key)}" data-slot-selectable="${disabled ? 'false' : 'true'}"
      data-preview-selectable="${!disabled && Number.isInteger(slot.workloadMinutes) ? 'true' : 'false'}" ${disabled ? 'disabled' : ''}>
      <span>${escapeHtml(slot.team.name)}</span><strong>${escapeHtml(slot.workloadLabel)}</strong>
      ${issue ? `<small>${escapeHtml(issue)}</small>` : ''}
    </button>`;
  }

  previewTemplate({ plan, destination, preview }) {
    const current = plan.current;
    return `<div class="plan-scheduling__previewHeader"><div><p>選択中の計画</p><h2>${escapeHtml(plan.inspectionNo)} · ${escapeHtml(plan.workName)}</h2></div><strong>${formatMinutes(preview.selectedPlan)}</strong></div>
      <div class="plan-scheduling__moveSummary">
        <div><span>現在</span><strong>${escapeHtml(current.dateLabel)} / ${escapeHtml(current.shift.name)} / ${escapeHtml(current.team.name)}</strong></div>
        <span class="plan-scheduling__arrow" aria-hidden="true">→</span>
        <div><span>移動先</span><strong>${escapeHtml(destination.dateLabel)} / ${escapeHtml(destination.shift.name)} / ${escapeHtml(destination.team.name)}</strong></div>
      </div>
      <div class="plan-scheduling__arithmetic">
        <div><span>移動元スロット</span><strong>移動前 ${formatMinutes(preview.sourceBefore)} → 移動後 ${formatMinutes(preview.sourceAfter)}</strong></div>
        <div><span>移動先スロット</span><strong>移動前 ${formatMinutes(preview.destinationBefore)} → 移動後 ${formatMinutes(preview.destinationAfter)}</strong></div>
      </div>
      <div class="plan-scheduling__previewFooter"><p class="plan-scheduling__readOnly">プレビューのみ。保存・更新は行われません。</p><button type="button" class="ui-btn ui-btn--outline" data-action="cancel-move">キャンセル</button></div>`;
  }

  get feedback() { return this.root.querySelector('[data-role="feedback"]'); }
  get workspace() { return this.root.querySelector('[data-role="workspace"]'); }
  get planList() { return this.root.querySelector('[data-role="plan-list"]'); }
  get dateGrid() { return this.root.querySelector('[data-role="date-grid"]'); }
  get workloadChart() { return this.root.querySelector('[data-role="workload-chart"]'); }
  get preview() { return this.root.querySelector('[data-role="preview"]'); }
}
