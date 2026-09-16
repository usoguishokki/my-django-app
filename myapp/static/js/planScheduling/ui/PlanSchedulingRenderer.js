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

export const TEAM_COLORS = Object.freeze({
  'A班': '#0072B2',
  'B班': '#009E73',
  'C班': '#D55E00',
});

const teamColorDeclaration = (teamName) =>
  `--plan-scheduling-team-color:${TEAM_COLORS[teamName]}`;

const approvedChartDay = (day) => {
  const teamWorkloads = day.teamWorkloads.filter((item) =>
    Object.hasOwn(TEAM_COLORS, item.teamName));
  const hasInvalidEffort = teamWorkloads.some((item) => item.hasInvalidEffort);
  const totalWorkloadMinutes = hasInvalidEffort
    ? null
    : teamWorkloads.reduce((sum, item) => sum + (item.workloadMinutes ?? 0), 0);
  return {
    ...day,
    teamWorkloads,
    totalWorkloadMinutes,
    totalWorkloadLabel: formatMinutes(totalWorkloadMinutes),
  };
};

const tooltipDateLabel = (isoDate, fallback) => {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return fallback;
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${month}月${day}日（${weekdays[weekday]}）`;
};

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
    this.workloadChart.innerHTML = this.workloadChartTemplate(
      state.workloadChart,
      selection.selectedSlot,
    );
    this.dateGrid.innerHTML = this.matrixDates(state)
      .map((day) => this.dateTemplate(day)).join('');
    this.workspace.hidden = false;
    this.renderSelection(state, selection);
  }

  renderSelection(_state, selection) {
    this.renderDrawer(selection);
    this.renderChartSelection(selection.selectedSlot);
    const selectingDestination = selection.isMoving;
    this.root.querySelectorAll('[data-slot-key]').forEach((button) => {
      const isCurrent = button.dataset.slotKey === selection.plan?.current.slotKey;
      const isSelectedSlot = button.dataset.slotKey === selection.selectedSlot?.key;
      button.classList.toggle(
        'is-selected-destination',
        button.dataset.slotKey === selection.destination?.key,
      );
      button.classList.toggle('is-current-slot', isCurrent);
      button.classList.toggle('is-selected-slot', isSelectedSlot);
      button.setAttribute('aria-pressed', isSelectedSlot ? 'true' : 'false');
      button.disabled = button.dataset.slotSelectable !== 'true' || (
        selectingDestination && (
          isCurrent || button.dataset.previewSelectable !== 'true'
        )
      );
    });
  }

  renderChartSelection(selectedSlot) {
    const selectedDate = selectedSlot?.date;
    const selectedTeam = selectedSlot?.team?.name;
    const hasSelection = Boolean(selectedDate && selectedTeam);
    this.workloadChart.classList.toggle('has-chart-selection', hasSelection);
    this.root.querySelectorAll('[data-chart-date][data-chart-team]').forEach((segment) => {
      const isSelected = hasSelection &&
        segment.dataset.chartDate === selectedDate &&
        segment.dataset.chartTeam === selectedTeam;
      segment.classList.toggle('is-selected-chart-segment', isSelected);
    });
  }

  renderDrawer(selection) {
    const slot = selection.selectedSlot;
    this.drawer.hidden = !slot;
    this.planningLayout.classList.toggle('has-drawer', Boolean(slot));
    if (!slot) {
      this.planList.innerHTML = '';
      return;
    }
    this.root.querySelector('[data-role="drawer-date"]').textContent =
      tooltipDateLabel(slot.date, slot.dateLabel);
    this.root.querySelector('[data-role="drawer-slot"]').textContent =
      `${slot.shift.name}${slot.team.name}`;
    this.root.querySelector('[data-role="drawer-summary"]').textContent =
      `${slot.workloadLabel} / ${slot.planCount}件`;
    const moveContext = selection.isMoving
      ? this.moveContextTemplate(selection)
      : '';
    const plans = selection.slotPlans.length
      ? selection.slotPlans.map((plan) => this.planTemplate(plan, selection.plan?.planId)).join('')
      : '<p class="plan-scheduling__empty">このスロットに配布待ち計画はありません。</p>';
    this.planList.innerHTML = `${moveContext}${plans}`;
  }

  planTemplate(plan, selectedPlanId = null) {
    const issues = plan.dataQualityIssues
      .map((issue) => `<span class="plan-scheduling__quality">${escapeHtml(issue.message)}</span>`)
      .join('');
    const selected = plan.planId === selectedPlanId ? ' is-selected-plan' : '';
    return `<article class="plan-scheduling__planCard${selected}" data-plan-card-id="${plan.planId}">
      <div class="plan-scheduling__planCardHeader"><div><span class="plan-scheduling__equipment">${escapeHtml(plan.equipmentName || '設備名なし')}</span><strong class="plan-scheduling__planPrimary">${escapeHtml(plan.inspectionNo)} · ${escapeHtml(plan.workName)}</strong></div><button type="button" class="ui-btn ui-btn--outline" data-action="move" data-plan-id="${plan.planId}" ${plan.isPreviewable ? '' : 'disabled'}>移動</button></div>
      <dl class="plan-scheduling__planFacts">
        <div><dt>基本工数</dt><dd>${escapeHtml(plan.baseWorkMinutesLabel)}</dd></div>
        <div><dt>必要人数</dt><dd>${Number.isInteger(plan.requiredPersonCount) ? `${plan.requiredPersonCount}人` : 'データ不備'}</dd></div>
        <div><dt>計算工数</dt><dd>${escapeHtml(plan.workMinutesLabel)}</dd></div>
      </dl>${issues ? `<div class="plan-scheduling__qualityGroup"><strong>データ確認</strong>${issues}</div>` : ''}
    </article>`;
  }

  workloadChartTemplate(chart, selectedSlot = null) {
    const chartDays = chart.dates.map(approvedChartDay);
    const maxTotal = Math.max(1, ...chartDays.map((day) =>
      day.totalWorkloadMinutes ?? day.teamWorkloads.reduce(
        (sum, item) => sum + (item.workloadMinutes ?? 0), 0,
      )));
    const bars = chartDays.map((day, dayIndex) => {
      const segments = day.teamWorkloads.map((item) => {
        const height = Number.isInteger(item.workloadMinutes)
          ? (item.workloadMinutes / maxTotal) * 100 : 0;
        const isSelected = day.date === selectedSlot?.date &&
          item.teamName === selectedSlot?.team?.name;
        return `<span class="plan-scheduling__chartSegment${isSelected ? ' is-selected-chart-segment' : ''}" data-chart-date="${escapeHtml(day.date)}" data-chart-team="${escapeHtml(item.teamName)}" style="${teamColorDeclaration(item.teamName)};height:${height}%" aria-hidden="true"></span>`;
      }).join('');
      const tooltipId = `plan-workload-tooltip-${dayIndex}`;
      const rows = day.teamWorkloads.map((item) => `
        <div class="plan-scheduling__tooltipRow"><span><i style="${teamColorDeclaration(item.teamName)}"></i>${escapeHtml(item.teamName)}</span><strong>${escapeHtml(item.workloadLabel)}</strong></div>`).join('');
      return `<div class="plan-scheduling__chartColumn"><strong>${escapeHtml(day.totalWorkloadLabel)}</strong><button type="button" class="plan-scheduling__chartBar" aria-label="${escapeHtml(day.label)}の工数詳細" aria-describedby="${tooltipId}">${segments}</button><span>${escapeHtml(day.label)}</span><div class="plan-scheduling__chartTooltip" id="${tooltipId}" role="tooltip"><strong class="plan-scheduling__tooltipDate">${escapeHtml(tooltipDateLabel(day.date, day.label))}</strong>${rows}<div class="plan-scheduling__tooltipTotal"><span>合計</span><strong>${escapeHtml(day.totalWorkloadLabel)}</strong></div></div></div>`;
    }).join('');
    return `<div class="plan-scheduling__chartPlot"><div class="plan-scheduling__chartColumns">${bars}</div></div>`;
  }

  matrixDates(state) {
    const shiftNames = new Set(state.workloadChart.shiftNames);
    const teamNames = new Set(Object.keys(TEAM_COLORS));
    return state.dates.map((day) => ({
      ...day,
      slots: day.slots.filter((slot) => (
        shiftNames.has(slot.shift.name) && teamNames.has(slot.team.name)
      )),
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
      data-preview-selectable="${!disabled && Number.isInteger(slot.workloadMinutes) ? 'true' : 'false'}" aria-pressed="false" ${disabled ? 'disabled' : ''}>
      <span>${escapeHtml(slot.team.name)}</span><strong>${escapeHtml(slot.workloadLabel)}</strong>
      ${issue ? `<small>${escapeHtml(issue)}</small>` : ''}
    </button>`;
  }

  moveContextTemplate({ plan, destination, preview }) {
    if (!preview) {
      return `<section class="plan-scheduling__moveContext"><strong>移動先を選択中</strong><span>計画マトリクスから別の有効なスロットを選択してください。</span><button type="button" class="ui-btn ui-btn--outline" data-action="cancel-move">キャンセル</button></section>`;
    }
    const current = plan.current;
    return `<section class="plan-scheduling__moveContext"><div class="plan-scheduling__moveContextHeader"><div><p>選択中の計画</p><h2>${escapeHtml(plan.inspectionNo)} · ${escapeHtml(plan.workName)}</h2></div><strong>${formatMinutes(preview.selectedPlan)}</strong></div>
      <div class="plan-scheduling__moveSummary">
        <div><span>現在</span><strong>${escapeHtml(current.dateLabel)} / ${escapeHtml(current.shift.name)} / ${escapeHtml(current.team.name)}</strong></div>
        <span class="plan-scheduling__arrow" aria-hidden="true">→</span>
        <div><span>移動先</span><strong>${escapeHtml(destination.dateLabel)} / ${escapeHtml(destination.shift.name)} / ${escapeHtml(destination.team.name)}</strong></div>
      </div>
      <div class="plan-scheduling__arithmetic">
        <div><span>移動元スロット</span><strong>移動前 ${formatMinutes(preview.sourceBefore)} → 移動後 ${formatMinutes(preview.sourceAfter)}</strong></div>
        <div><span>移動先スロット</span><strong>移動前 ${formatMinutes(preview.destinationBefore)} → 移動後 ${formatMinutes(preview.destinationAfter)}</strong></div>
      </div>
      <div class="plan-scheduling__moveContextFooter"><p class="plan-scheduling__readOnly">プレビューのみ。保存・更新は行われません。</p><button type="button" class="ui-btn ui-btn--outline" data-action="cancel-move">キャンセル</button></div></section>`;
  }

  get feedback() { return this.root.querySelector('[data-role="feedback"]'); }
  get workspace() { return this.root.querySelector('[data-role="workspace"]'); }
  get planList() { return this.root.querySelector('[data-role="plan-list"]'); }
  get drawer() { return this.root.querySelector('[data-role="slot-drawer"]'); }
  get planningLayout() { return this.root.querySelector('[data-role="planning-layout"]'); }
  get dateGrid() { return this.root.querySelector('[data-role="date-grid"]'); }
  get workloadChart() { return this.root.querySelector('[data-role="workload-chart"]'); }
}
