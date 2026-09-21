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
import { labelForAttrValue } from '../../ui/formatters/labelFormatters.js';
import { renderDetailItemsHTML } from '../../ui/renderers/detailItemsRenderer.js';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const TEAM_COLORS = Object.freeze({
  'A班': '#1C55C8',
  'B班': '#00D614',
  'C班': '#FFC715',
});

const teamColorDeclaration = (teamName) =>
  `--plan-scheduling-team-color:${TEAM_COLORS[teamName]}`;

const hasPinnedMoveSource = (dates, selection) => {
  const sourceDate = selection?.isMoving && selection.moveContext?.sourceSlot?.date;
  return Boolean(sourceDate && !dates.some((day) => day.date === sourceDate));
};

const formatPlanCardTitle = (plan) => [
  plan.machineName || plan.equipmentName,
  plan.workName,
].filter(Boolean).join('_');

const formatPlanCardSubtitle = (plan) => [
  Number.isFinite(plan.manHours) ? `${plan.manHours}分` : '',
  plan.dayOfWeek !== '' && plan.dayOfWeek != null
    ? labelForAttrValue('data-plan-week-of-day', plan.dayOfWeek)
    : '',
  plan.interval != null && plan.interval !== '' && plan.unit
    ? `${plan.interval}/${plan.unit}`
    : '',
].filter(Boolean).join('　');

const detailItemsTemplate = (detailItems) => renderDetailItemsHTML(detailItems) ||
  '<p class="detail-card__emptyMessage">点検内容はありません。</p>';

const formatDelta = (before, after) => {
  if (!Number.isInteger(before) || !Number.isInteger(after)) return '—';
  const delta = after - before;
  return `${delta >= 0 ? '+' : ''}${formatMinutes(delta)}`;
};

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

const chartPreviewFromSelection = (selection) => {
  const { plan, destination, preview } = selection || {};
  const source = plan?.current;
  if (!source || !destination || !preview) return null;
  const sourceTeam = source.team?.name;
  const destinationTeam = destination.team?.name;
  if (!source.date || !sourceTeam || !destination.date || !destinationTeam) return null;
  if (source.date === destination.date && sourceTeam === destinationTeam) return null;
  return {
    source: {
      date: source.date,
      teamName: sourceTeam,
      before: preview.sourceBefore,
      after: preview.sourceAfter,
    },
    destination: {
      date: destination.date,
      teamName: destinationTeam,
      before: preview.destinationBefore,
      after: preview.destinationAfter,
    },
  };
};

const matchingChartChange = (projection, date, teamName) => {
  if (!projection) return null;
  if (projection.source.date === date && projection.source.teamName === teamName) {
    return { ...projection.source, kind: 'source' };
  }
  if (projection.destination.date === date && projection.destination.teamName === teamName) {
    return { ...projection.destination, kind: 'destination' };
  }
  return null;
};

export const buildChartPresentation = (chart, selection = {}) => {
  const projection = chartPreviewFromSelection(selection);
  const dates = chart.dates.map(approvedChartDay).map((day) => {
    const teamWorkloads = day.teamWorkloads.map((item) => {
      const change = matchingChartChange(projection, day.date, item.teamName);
      const projectedWorkloadMinutes = change && Number.isInteger(change.after)
        ? change.after
        : item.workloadMinutes;
      return { ...item, change, projectedWorkloadMinutes };
    });
    const hasInvalidEffort = teamWorkloads.some((item) => item.hasInvalidEffort);
    const projectedTotalWorkloadMinutes = hasInvalidEffort
      ? null
      : teamWorkloads.reduce(
        (sum, item) => sum + (item.projectedWorkloadMinutes ?? 0),
        0,
      );
    return { ...day, teamWorkloads, projectedTotalWorkloadMinutes };
  });
  const totals = dates.flatMap((day) => [
    day.totalWorkloadMinutes,
    day.projectedTotalWorkloadMinutes,
  ]).filter(Number.isInteger);
  return {
    dates,
    projection,
    maxTotal: Math.max(1, ...totals),
  };
};

const chartSegmentTemplate = ({ item, day, maxTotal, isSelected }) => {
  const current = item.workloadMinutes;
  const projected = item.projectedWorkloadMinutes;
  const change = item.change;
  const segmentValue = change?.kind === 'source' ? current : projected;
  const height = Number.isInteger(segmentValue) ? (segmentValue / maxTotal) * 100 : 0;
  const classes = [
    'plan-scheduling__chartSegment',
    isSelected ? 'is-selected-chart-segment' : '',
    change ? `is-preview-${change.kind}` : '',
  ].filter(Boolean).join(' ');
  let portions = '';
  if (change?.kind === 'source' && current > 0) {
    const remaining = Math.max(0, Math.min(100, (projected / current) * 100));
    portions = `<span class="plan-scheduling__chartPortion is-preview-remaining" style="height:${remaining}%"></span><span class="plan-scheduling__chartPortion is-preview-removed" style="height:${100 - remaining}%"></span>`;
  } else if (change?.kind === 'destination' && projected > 0) {
    const existing = Math.max(0, Math.min(100, (current / projected) * 100));
    portions = `<span class="plan-scheduling__chartPortion is-preview-existing" style="height:${existing}%"></span><span class="plan-scheduling__chartPortion is-preview-added" style="height:${100 - existing}%"></span>`;
  }
  return `<span class="${classes}" data-chart-date="${escapeHtml(day.date)}" data-chart-team="${escapeHtml(item.teamName)}" style="${teamColorDeclaration(item.teamName)};height:${height}%" aria-hidden="true">${portions}</span>`;
};

const tooltipWorkloadTemplate = (item) => {
  if (!item.change) return `<strong>${escapeHtml(item.workloadLabel)}</strong>`;
  return `<span class="plan-scheduling__tooltipPreview"><span>${formatMinutes(item.change.before)} → ${formatMinutes(item.change.after)}</span><strong>${formatDelta(item.change.before, item.change.after)}</strong></span>`;
};

const tooltipDateLabel = (isoDate, fallback) => {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return fallback;
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${month}月${day}日（${weekdays[weekday]}）`;
};

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

export const deriveSelectedDatePinSide = ({
  trackStart,
  trackWidth,
  scrollLeft,
  viewportWidth,
}) => {
  const trackEnd = trackStart + trackWidth;
  const viewportEnd = scrollLeft + viewportWidth;
  if (trackStart <= scrollLeft) return 'left';
  if (trackEnd >= viewportEnd) return 'right';
  return 'normal';
};

export const calculateTimelineAnchorScrollLeft = ({
  trackStart,
  trackWidth,
  viewportWidth,
  viewportPosition,
  scrollWidth,
}) => clamp(
  trackStart + (trackWidth / 2) - (viewportWidth * viewportPosition),
  0,
  Math.max(0, scrollWidth - viewportWidth),
);

export const calculateSelectedDatePinOffset = ({
  side,
  trackStart,
  trackWidth,
  scrollLeft,
  viewportWidth,
}) => {
  if (side === 'left') {
    return scrollLeft - trackStart;
  }
  if (side === 'right') {
    return scrollLeft + viewportWidth - trackStart - trackWidth;
  }
  return 0;
};

export const deriveTimelineTrackGeometry = ({
  trackRect,
  viewportRect,
  scrollLeft,
  currentOffset = 0,
  fallbackWidth = 0,
}) => ({
  trackStart: scrollLeft + trackRect.left - currentOffset - viewportRect.left,
  trackWidth: trackRect.width || fallbackWidth,
});

export const placeChartTooltip = ({ horizontalAnchorRect, matrixRect, tooltipRect, boundsRect, safeMargin = 8 }) => {
  const minimumLeft = boundsRect.left + safeMargin;
  const maximumLeft = Math.max(minimumLeft, boundsRect.right - tooltipRect.width - safeMargin);
  const placement = 'below';
  const preferredLeft = horizontalAnchorRect.left + (horizontalAnchorRect.width - tooltipRect.width) / 2;
  const top = matrixRect.top;
  return {
    left: clamp(preferredLeft, minimumLeft, maximumLeft),
    top,
    placement,
  };
};

export class PlanSchedulingRenderer {
  constructor(root) {
    this.root = root;
    this.activeChartBar = null;
    this.wasMoving = false;
    this.planListScrollTop = 0;
    this.timelineLayoutRevision = 0;
    this.timelineScrollFramePending = false;
    this.selectedDateTracks = [];
    this.selectedDateGeometry = null;
    this.root?.addEventListener?.('pointerover', (event) => this.showChartTooltip(event));
    this.root?.addEventListener?.('pointerout', (event) => this.hideChartTooltip(event));
    this.root?.addEventListener?.('focusin', (event) => this.showChartTooltip(event));
    this.root?.addEventListener?.('focusout', (event) => this.hideChartTooltip(event));
    this.root?.addEventListener?.('scroll', (event) => {
      if (event.target === this.planningMain) {
        this.scheduleTimelineScrollPresentation();
      } else {
        this.positionActiveChartTooltip();
      }
    }, true);
  }

  scheduleTimelineScrollPresentation() {
    if (this.timelineScrollFramePending) return;
    this.timelineScrollFramePending = true;
    const view = this.root?.ownerDocument?.defaultView;
    const requestFrame = view?.requestAnimationFrame?.bind(view) ||
      globalThis.requestAnimationFrame?.bind(globalThis);
    const update = () => {
      this.timelineScrollFramePending = false;
      this.positionActiveChartTooltip();
      this.updateSelectedDatePin();
    };
    if (requestFrame) requestFrame(update);
    else update();
  }

  showChartTooltip(event) {
    const chartBar = event.target?.closest?.('.plan-scheduling__chartBar');
    if (!chartBar) return;
    this.activeChartBar = chartBar;
    this.positionActiveChartTooltip();
  }

  hideChartTooltip(event) {
    const chartBar = event.target?.closest?.('.plan-scheduling__chartBar');
    if (!chartBar || chartBar !== this.activeChartBar) return;
    if (event.relatedTarget?.closest?.('.plan-scheduling__chartBar') === chartBar) return;
    this.activeChartBar = null;
  }

  positionActiveChartTooltip() {
    const chartBar = this.activeChartBar;
    if (!chartBar?.isConnected) return;
    const column = chartBar.closest('.plan-scheduling__chartColumn');
    const matrix = this.matrix;
    const tooltip = column?.querySelector('.plan-scheduling__chartTooltip');
    const bounds = this.planningMain?.getBoundingClientRect?.();
    if (!tooltip || !bounds || !matrix) return;
    const placement = placeChartTooltip({
      horizontalAnchorRect: chartBar.getBoundingClientRect(),
      matrixRect: matrix.getBoundingClientRect(),
      tooltipRect: tooltip.getBoundingClientRect(),
      boundsRect: bounds,
    });
    tooltip.style.left = `${placement.left}px`;
    tooltip.style.top = `${placement.top}px`;
    tooltip.dataset.placement = placement.placement;
    tooltip.classList.add('is-positioned');
  }

  renderLoading() {
    this.feedback.classList.remove('is-error');
    this.feedback.textContent = '';
    this.workspace.hidden = false;
    this.workspace.setAttribute?.('aria-busy', 'true');
    if (this.loadingSkeleton) this.loadingSkeleton.hidden = false;
    if (this.planningLayout) this.planningLayout.hidden = true;
  }

  renderError(message) {
    this.feedback.textContent = message;
    this.feedback.classList.add('is-error');
    if (this.loadingSkeleton) this.loadingSkeleton.hidden = true;
    this.workspace.hidden = true;
  }

  renderInteractionError(message) {
    this.feedback.textContent = message;
    this.feedback.classList.add('is-error');
  }

  renderSlotHydrationPending() {
    if (this.drawer.hidden) return;
    this.drawer.setAttribute?.('aria-busy', 'true');
    this.root.querySelector('[data-role="drawer-date"]').textContent = '読み込み中';
    this.root.querySelector('[data-role="drawer-slot"]').textContent = '';
    this.root.querySelector('[data-role="drawer-summary"]').textContent = '';
    this.movePreview.hidden = true;
    this.planList.hidden = false;
    this.planList.innerHTML = '<p class="plan-scheduling__empty">選択した週を読み込んでいます。</p>';
  }

  renderState(state, selection) {
    this.feedback.classList.remove('is-error');
    this.feedback.textContent = state.dataQuality.hasErrors
      ? `データ確認事項が${state.dataQuality.issueCount}件あります。`
      : '';
    const displayDates = this.matrixDates(state, selection);
    this.dateGrid.innerHTML = displayDates
      .map((day) => this.dateTemplate(day)).join('');
    if (this.chartLegend) {
      this.chartLegend.innerHTML = this.chartLegendTemplate(state.workloadChart);
    }
    if (this.maintenanceWeek) {
      const chartDates = this.chartWithPinnedMoveSource(
        state.workloadChart,
        selection,
      ).dates;
      this.maintenanceWeek.innerHTML = this.maintenanceWeekTemplate(null, chartDates);
    }
    this.workspace.setAttribute?.('aria-busy', 'false');
    if (this.loadingSkeleton) this.loadingSkeleton.hidden = true;
    if (this.planningLayout) this.planningLayout.hidden = false;
    this.workspace.hidden = false;
    this.renderSelection(state, selection);
  }

  renderSelection(state, selection) {
    const drawerWillOpen = Boolean(selection.selectedSlot);
    const drawerIsOpen = Boolean(this.drawer && !this.drawer.hidden);
    const drawerGeometryChanges = drawerIsOpen !== drawerWillOpen;
    const timelineAnchor = drawerGeometryChanges
      ? this.captureTimelineAnchor(selection.selectedSlot?.date)
      : null;
    const layoutRevision = ++this.timelineLayoutRevision;
    this.planningLayout.classList.toggle(
      'has-pinned-move-source',
      hasPinnedMoveSource(state.dates, selection),
    );
    this.workloadChart.innerHTML = this.workloadChartTemplate(
      state.workloadChart,
      selection,
    );
    this.renderChartSelection(selection.selectedSlot);
    this.renderDrawer(selection);
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
    this.renderSelectedDateTracks(selection.selectedSlot?.date, {
      deferPin: drawerGeometryChanges,
    });
    if (drawerGeometryChanges) {
      this.restoreTimelineAnchorAfterLayout(timelineAnchor, layoutRevision);
    }
  }

  renderSelectedDateTracks(selectedDate, { deferPin = false } = {}) {
    this.selectedDateTracks = [];
    (this.root.querySelectorAll?.(
      '.plan-scheduling__chartColumn[data-plan-date], ' +
      '.plan-scheduling__maintenanceWeekCell[data-plan-date], ' +
      '.plan-scheduling__dateColumn[data-plan-date]',
    ) || []).forEach((track) => {
      const isSelected = Boolean(selectedDate && track.dataset.planDate === selectedDate);
      track.classList.toggle('is-selected-date', isSelected);
      if (isSelected) {
        this.selectedDateTracks.push(track);
      } else {
        track.classList.remove('is-date-pinned-left', 'is-date-pinned-right');
        track.style?.removeProperty('--plan-selected-date-offset');
      }
    });
    this.selectedDateGeometry = null;
    if (!deferPin) {
      this.refreshSelectedDateGeometry();
      this.updateSelectedDatePin();
    }
  }

  captureTimelineAnchor(preferredDate) {
    const viewport = this.planningMain;
    const viewportRect = viewport?.getBoundingClientRect?.();
    const tracks = [...(this.root.querySelectorAll?.(
      '.plan-scheduling__chartColumn[data-plan-date]',
    ) || [])];
    if (!viewport || !viewportRect || !tracks.length) return null;
    const preferredTrack = preferredDate
      ? tracks.find((track) => track.dataset.planDate === preferredDate)
      : null;
    const selectedTrack = preferredTrack || tracks.find(
      (track) => track.classList.contains('is-selected-date'),
    );
    const visibleTrack = selectedTrack || tracks.find((track) => {
      const rect = track.getBoundingClientRect();
      return rect.right >= viewportRect.left && rect.left <= viewportRect.right;
    });
    if (!visibleTrack || viewportRect.width <= 0) return null;
    const trackRect = visibleTrack.getBoundingClientRect();
    return {
      date: visibleTrack.dataset.planDate,
      viewportPosition: clamp(
        (trackRect.left + (trackRect.width / 2) - viewportRect.left) /
          viewportRect.width,
        0,
        1,
      ),
    };
  }

  restoreTimelineAnchor(anchor) {
    const viewport = this.planningMain;
    if (!viewport || !anchor?.date) return false;
    const target = [...viewport.querySelectorAll(
      '.plan-scheduling__chartColumn[data-plan-date]',
    )].find((column) => column.dataset.planDate === anchor.date);
    if (!target) return false;
    const geometry = this.timelineTrackGeometry(target, viewport);
    if (!geometry) return false;
    const left = calculateTimelineAnchorScrollLeft({
      trackStart: geometry.trackStart,
      trackWidth: geometry.trackWidth,
      viewportWidth: viewport.clientWidth,
      viewportPosition: anchor.viewportPosition,
      scrollWidth: viewport.scrollWidth,
    });
    viewport.scrollTo({ left, behavior: 'auto' });
    return true;
  }

  timelineTrackGeometry(track, viewport = this.planningMain) {
    const trackRect = track?.getBoundingClientRect?.();
    const viewportRect = viewport?.getBoundingClientRect?.();
    if (!trackRect || !viewportRect) return null;
    const currentOffset = Number.parseFloat(
      track.style?.getPropertyValue?.('--plan-selected-date-offset'),
    ) || 0;
    return deriveTimelineTrackGeometry({
      trackRect,
      viewportRect,
      scrollLeft: viewport.scrollLeft,
      currentOffset,
      fallbackWidth: track.offsetWidth,
    });
  }

  refreshSelectedDateGeometry() {
    const selectedChartTrack = this.root.querySelector(
      '.plan-scheduling__chartColumn.is-selected-date[data-plan-date]',
    );
    this.selectedDateGeometry = selectedChartTrack
      ? this.timelineTrackGeometry(selectedChartTrack)
      : null;
    return this.selectedDateGeometry;
  }

  restoreTimelineAnchorAfterLayout(anchor, layoutRevision) {
    const view = this.root?.ownerDocument?.defaultView;
    const requestFrame = view?.requestAnimationFrame?.bind(view) ||
      globalThis.requestAnimationFrame?.bind(globalThis);
    const restore = () => {
      if (layoutRevision !== this.timelineLayoutRevision) return;
      this.restoreTimelineAnchor(anchor);
      this.refreshSelectedDateGeometry();
      this.updateSelectedDatePin();
    };
    if (requestFrame) requestFrame(restore);
    else restore();
  }

  restoreTimelineAnchorAfterRender(anchor) {
    this.restoreTimelineAnchorAfterLayout(anchor, this.timelineLayoutRevision);
  }

  updateSelectedDatePin() {
    const viewport = this.planningMain;
    const geometry = this.selectedDateGeometry;
    if (!viewport || !geometry) return 'normal';
    const scrollLeft = viewport.scrollLeft;
    const viewportWidth = viewport.clientWidth;
    const side = deriveSelectedDatePinSide({
      trackStart: geometry.trackStart,
      trackWidth: geometry.trackWidth,
      scrollLeft,
      viewportWidth,
    });
    const offset = calculateSelectedDatePinOffset({
      side,
      trackStart: geometry.trackStart,
      trackWidth: geometry.trackWidth,
      scrollLeft,
      viewportWidth,
    });
    this.selectedDateTracks.forEach((track) => {
      track.classList.toggle('is-date-pinned-left', side === 'left');
      track.classList.toggle('is-date-pinned-right', side === 'right');
      track.style?.setProperty('--plan-selected-date-offset', `${offset}px`);
    });
    return side;
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

  scrollTimelineToDate(isoDate) {
    const viewport = this.planningMain;
    if (!viewport || !isoDate) return false;
    const target = [...viewport.querySelectorAll(
      '.plan-scheduling__chartColumn[data-plan-date]',
    )].find((column) => column.dataset.planDate === isoDate);
    if (!target) return false;
    const geometry = this.timelineTrackGeometry(target, viewport);
    const targetStart = geometry?.trackStart ?? target.offsetLeft;
    viewport.scrollTo({ left: Math.max(0, targetStart - 10), behavior: 'auto' });
    this.updateSelectedDatePin();
    return true;
  }

  renderDrawer(selection) {
    const slot = selection.selectedSlot;
    this.drawer.setAttribute?.('aria-busy', 'false');
    this.drawer.hidden = !slot;
    this.planningLayout.classList.toggle('has-drawer', Boolean(slot));
    if (!slot) {
      this.planList.innerHTML = '';
      this.movePreview.innerHTML = '';
      this.movePreview.hidden = true;
      this.wasMoving = false;
      return;
    }
    this.root.querySelector('[data-role="drawer-date"]').textContent =
      tooltipDateLabel(slot.date, slot.dateLabel);
    this.root.querySelector('[data-role="drawer-slot"]').textContent =
      `${slot.shift.name}${slot.team.name}`;
    this.root.querySelector('[data-role="drawer-summary"]').textContent =
      `${slot.workloadLabel} / ${slot.planCount}件`;
    if (selection.isMoving && !this.wasMoving) this.planListScrollTop = this.planList.scrollTop;
    this.movePreview.hidden = !selection.isMoving;
    this.planList.hidden = selection.isMoving;
    this.movePreview.innerHTML = selection.isMoving
      ? this.moveContextTemplate(selection)
      : '';
    const plans = selection.slotPlans.length
      ? selection.slotPlans.map((plan) => this.planTemplate(plan, selection.plan?.planId)).join('')
      : '<p class="plan-scheduling__empty">このスロットに配布待ち計画はありません。</p>';
    if (!selection.isMoving) {
      this.planList.innerHTML = plans;
      if (this.wasMoving) this.planList.scrollTop = this.planListScrollTop;
    }
    this.wasMoving = selection.isMoving;
  }

  planTemplate(plan, selectedPlanId = null) {
    const issues = (plan.dataQualityIssues || [])
      .map((issue) => `<span class="plan-scheduling__quality">${escapeHtml(issue.message)}</span>`)
      .join('');
    const selected = plan.planId === selectedPlanId ? ' is-selected-plan' : '';
    return `<article class="detail-card plan-scheduling__planCard${selected}" data-plan-card-id="${plan.planId}" data-plan-id="${plan.planId}">
      <header class="detail-card__header plan-scheduling__planCardHeader">
        <div class="detail-card__title">
          <div class="detail-card__titleLine">${escapeHtml(formatPlanCardTitle(plan))}</div>
          <div class="detail-card__titleSub">${escapeHtml(formatPlanCardSubtitle(plan))}</div>
        </div>
      </header>
      <div class="detail-card__body">${detailItemsTemplate(plan.detailItems)}${issues ? `<div class="plan-scheduling__qualityGroup"><strong>データ確認</strong>${issues}</div>` : ''}</div>
      <footer class="plan-scheduling__planCardActions"><button type="button" class="ui-btn ui-btn--sm ui-btn--outline plan-scheduling__moveButton" data-action="move" data-plan-id="${plan.planId}" ${plan.isPreviewable ? '' : 'disabled'}>移動</button></footer>
    </article>`;
  }

  workloadChartTemplate(chart, selection = {}) {
    const isSelectionModel = selection && (
      Object.hasOwn(selection, 'selectedSlot') || Object.hasOwn(selection, 'preview')
    );
    const selectedSlot = isSelectionModel ? selection.selectedSlot : selection;
    const displayChart = this.chartWithPinnedMoveSource(chart, selection);
    const { dates: chartDays, maxTotal, projection } = buildChartPresentation(
      displayChart,
      isSelectionModel ? selection : { selectedSlot },
    );
    const bars = chartDays.map((day, dayIndex) => {
      const segments = day.teamWorkloads.map((item) => {
        const isSelected = day.date === selectedSlot?.date &&
          item.teamName === selectedSlot?.team?.name;
        return chartSegmentTemplate({ item, day, maxTotal, isSelected });
      }).join('');
      const tooltipId = `plan-workload-tooltip-${dayIndex}`;
      const rows = day.teamWorkloads.map((item) => `
        <div class="plan-scheduling__tooltipRow${item.change ? ` is-preview-${item.change.kind}` : ''}"><span><i style="${teamColorDeclaration(item.teamName)}"></i>${escapeHtml(item.teamName)}</span>${tooltipWorkloadTemplate(item)}</div>`).join('');
      const totalMinutes = projection
        ? day.projectedTotalWorkloadMinutes
        : day.totalWorkloadMinutes;
      const totalLabel = formatMinutes(totalMinutes);
      const affectedDescriptions = day.teamWorkloads.filter((item) => item.change).map((item) => {
        const delta = item.change.after - item.change.before;
        return `${item.teamName} 移動プレビュー後 ${formatMinutes(item.change.after)}、${formatMinutes(Math.abs(delta))}${delta < 0 ? '減少' : '増加'}`;
      });
      const ariaLabel = [
        `${day.label}の工数詳細`,
        ...affectedDescriptions,
      ].join('。');
      const moveSourceLabel = day.isPinnedMoveSource
        ? '<b class="plan-scheduling__moveSourceLabel">移動元</b>'
        : '';
      return `<div class="plan-scheduling__chartColumn${day.isPinnedMoveSource ? ' is-pinned-move-source' : ''}" data-plan-date="${escapeHtml(day.date)}"><strong>${escapeHtml(totalLabel)}${moveSourceLabel}</strong><button type="button" class="plan-scheduling__chartBar" aria-label="${escapeHtml(ariaLabel)}" aria-describedby="${tooltipId}">${segments}</button><div class="plan-scheduling__chartTooltip" id="${tooltipId}" role="tooltip"><strong class="plan-scheduling__tooltipDate">${escapeHtml(tooltipDateLabel(day.date, day.label))}</strong>${rows}<div class="plan-scheduling__tooltipTotal"><span>合計</span><strong>${escapeHtml(totalLabel)}</strong></div></div></div>`;
    }).join('');
    return `<div class="plan-scheduling__chartPlot${projection ? ' has-chart-preview' : ''}"><div class="plan-scheduling__chartColumns">${bars}</div></div>`;
  }

  chartWithPinnedMoveSource(chart, selection) {
    const sourceDay = selection?.isMoving && selection.moveContext?.chartDay;
    if (!sourceDay || !hasPinnedMoveSource(chart.dates, selection)) return chart;
    return { ...chart, dates: [{ ...sourceDay, isPinnedMoveSource: true }, ...chart.dates] };
  }

  chartLegendTemplate(chart = {}) {
    const configuredTeams = (chart.teams || [])
      .map((team) => team.name)
      .filter((teamName) => Object.hasOwn(TEAM_COLORS, teamName));
    const teamNames = configuredTeams.length ? configuredTeams : Object.keys(TEAM_COLORS);
    const items = teamNames.map((teamName) =>
      `<li class="plan-scheduling__chartLegendItem"><i class="plan-scheduling__chartLegendSwatch" style="${teamColorDeclaration(teamName)}"></i>${escapeHtml(teamName)}</li>`
    ).join('');
    return `<ul class="plan-scheduling__chartLegend" aria-label="班別">${items}</ul>`;
  }

  renderFilterState(filter = {}) {
    const count = ['weekdays', 'shifts', 'teams'].reduce(
      (total, category) => total + (filter[category]?.length || 0),
      0,
    );
    if (this.filterButton) {
      this.filterButton.classList.toggle('is-active', count > 0);
      this.filterButton.setAttribute('aria-label', count
        ? `フィルター、${count}件の条件を適用中`
        : 'フィルター');
    }
    if (this.filterBadge) {
      this.filterBadge.textContent = String(count);
      this.filterBadge.hidden = count === 0;
    }
  }

  openFilterPopover(filter = {}) {
    const selectedByCategory = new Map(
      ['weekdays', 'shifts', 'teams'].map((category) => [
        category,
        new Set(filter[category] || []),
      ]),
    );
    this.filterInputs.forEach((input) => {
      input.checked = selectedByCategory.get(input.dataset.filterCategory)?.has(input.value) || false;
    });
    this.filterPopover.hidden = false;
    this.filterButton?.setAttribute('aria-expanded', 'true');
  }

  closeFilterPopover() {
    if (this.filterPopover) this.filterPopover.hidden = true;
    this.filterButton?.setAttribute('aria-expanded', 'false');
  }

  isFilterOpen() {
    return Boolean(this.filterPopover && !this.filterPopover.hidden);
  }

  readFilterDraft() {
    const filter = { weekdays: [], shifts: [], teams: [] };
    this.filterInputs.forEach((input) => {
      if (input.checked && filter[input.dataset.filterCategory]) {
        filter[input.dataset.filterCategory].push(input.value);
      }
    });
    return filter;
  }

  clearFilterDraft() {
    this.filterInputs.forEach((input) => { input.checked = false; });
  }

  renderFilterEmptyState(isVisible) {
    if (this.filterEmptyState) this.filterEmptyState.hidden = !isVisible;
  }

  maintenanceWeekTemplate(week, dates) {
    const cells = (dates || []).map((day) =>
      `<span class="plan-scheduling__maintenanceWeekCell${day.isPinnedMoveSource ? ' is-pinned-move-source' : ''}" data-plan-date="${escapeHtml(day.date)}">${escapeHtml(day.maintenanceWeekLabel || week?.label || '')}</span>`
    ).join('');
    return cells;
  }

  matrixDates(state, selection = {}) {
    const shiftNames = new Set(state.workloadChart.shiftNames);
    const teamNames = new Set(Object.keys(TEAM_COLORS));
    const weekDates = new Map(state.dates.map((day) => [day.date, day]));
    // The Chart is the authoritative full-date coordinate sequence.  Matrix
    // summaries add slots to those same tracks; the selected week only adds
    // interaction detail to its dates.
    const timelineDates = new Map(
      (state.timelineDates || []).map((day) => [day.date, day]),
    );
    const chartDates = state.workloadChart.dates?.length
      ? state.workloadChart.dates
      : (state.timelineDates || state.dates);
    const sourceDate = selection?.isMoving && selection.moveContext?.sourceSlot?.date;
    const dates = chartDates.map((chartDay) => {
      const timelineDay = timelineDates.get(chartDay.date);
      const weekDay = weekDates.get(chartDay.date);
      const day = weekDay || timelineDay || { ...chartDay, slots: [] };
      return {
        ...day,
        isPinnedMoveSource: Boolean(sourceDate && day.date === sourceDate),
        slots: day.slots.filter((slot) => (
          shiftNames.has(slot.shift.name) && teamNames.has(slot.team.name)
        )).map((slot) => ({ ...slot, requiresWeekHydration: !weekDay })),
      };
    });
    const source = selection.isMoving && selection.moveContext;
    if (!hasPinnedMoveSource(dates, selection)) return dates;
    return [{
      date: source.sourceSlot.date,
      label: source.sourceSlot.dateLabel || source.plan?.current?.dateLabel || sourceDate,
      isReserveWeek: false,
      isPinnedMoveSource: true,
      maintenanceWeekLabel: source.weekLabel,
      slots: [source.sourceSlot],
    }, ...dates];
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
    return `<article class="plan-scheduling__dateColumn${day.isPinnedMoveSource ? ' is-pinned-move-source' : ''}" data-plan-date="${escapeHtml(day.date)}">
      <header>${day.isPinnedMoveSource ? '<span class="plan-scheduling__moveSourceLabel">移動元</span>' : ''}<h3>${escapeHtml(day.label)}</h3>${day.isReserveWeek ? '<span>予備週</span>' : ''}</header>
      ${shifts || '<p class="plan-scheduling__empty">勤務スロットなし</p>'}
    </article>`;
  }

  slotTemplate(slot) {
    const disabled = !slot.isValid;
    const issue = slot.dataQualityIssues[0]?.message ||
      (slot.hasInvalidEffort ? '工数データに不備があります。' : '');
    return `<button type="button" class="plan-scheduling__slot${!slot.isValid ? ' is-invalid' : ''}"
      data-slot-key="${escapeHtml(slot.key)}" data-slot-date="${escapeHtml(slot.date)}" data-slot-selectable="${disabled ? 'false' : 'true'}"
      data-requires-week-hydration="${slot.requiresWeekHydration ? 'true' : 'false'}"
      data-preview-selectable="${!disabled && Number.isInteger(slot.workloadMinutes) ? 'true' : 'false'}" aria-pressed="false" ${disabled ? 'disabled' : ''}>
      <span>${escapeHtml(slot.team.name)}</span><strong>${escapeHtml(slot.workloadLabel)}</strong>
      ${issue ? `<small>${escapeHtml(issue)}</small>` : ''}
    </button>`;
  }

  moveContextTemplate({ plan, destination, preview }) {
    if (!preview) return this.moveSelectingContextTemplate(plan);
    const current = plan.current;
    return `<section class="plan-scheduling__moveContext">
      <header class="plan-scheduling__moveContextHeader"><span class="plan-scheduling__moveState">移動プレビュー</span><h2>${escapeHtml(formatPlanCardTitle(plan))}</h2><p>${escapeHtml(plan.inspectionNo)} / ${formatMinutes(plan.workMinutes)}</p></header>
      <div class="plan-scheduling__moveSummary">
        <div><span>現在</span><strong>${escapeHtml(current.dateLabel)}</strong><small>${escapeHtml(current.shift.name)} / ${escapeHtml(current.team.name)}</small></div>
        <span class="plan-scheduling__arrow" aria-hidden="true">→</span>
        <div><span>移動先</span><strong>${escapeHtml(destination.dateLabel)}</strong><small>${escapeHtml(destination.shift.name)} / ${escapeHtml(destination.team.name)}</small></div>
      </div>
      <section class="plan-scheduling__moveImpact" aria-label="工数への影響"><h3>工数への影響</h3><table class="plan-scheduling__arithmetic">
        <thead><tr><th scope="col"></th><th scope="col">移動前</th><th scope="col">移動後</th><th scope="col">増減</th></tr></thead>
        <tbody><tr><th scope="row">移動元</th><td>${formatMinutes(preview.sourceBefore)}</td><td>${formatMinutes(preview.sourceAfter)}</td><td><strong class="is-decrease">${formatDelta(preview.sourceBefore, preview.sourceAfter)}</strong></td></tr>
        <tr><th scope="row">移動先</th><td>${formatMinutes(preview.destinationBefore)}</td><td>${formatMinutes(preview.destinationAfter)}</td><td><strong class="is-increase">${formatDelta(preview.destinationBefore, preview.destinationAfter)}</strong></td></tr></tbody>
      </table></section>
      <p class="plan-scheduling__readOnly">プレビューのみ。保存・更新は行われません。</p>
      <footer class="plan-scheduling__moveActions"><button type="button" class="ui-btn ui-btn--sm ui-btn--ghost plan-scheduling__cancelMove plan-scheduling__cancelButton" data-action="cancel-move">キャンセル</button></footer>
      </section>`;
  }

  moveSelectingContextTemplate(plan) {
    return `<section class="plan-scheduling__moveContext">
      <header class="plan-scheduling__moveContextHeader"><span class="plan-scheduling__moveState">移動プレビュー</span><h2>${escapeHtml(formatPlanCardTitle(plan))}</h2><p>${escapeHtml(plan.inspectionNo)} / ${formatMinutes(plan.workMinutes)}</p></header>
      <div class="plan-scheduling__moveSummary plan-scheduling__moveSummary--selecting">
        <div><span>現在</span><strong>${escapeHtml(plan.current.dateLabel)}</strong><small>${escapeHtml(plan.current.shift.name)} / ${escapeHtml(plan.current.team.name)}</small></div>
        <div><span>移動先</span><strong class="plan-scheduling__moveGuidance">マトリクスから移動先を選択してください</strong></div>
      </div>
      <footer class="plan-scheduling__moveActions"><button type="button" class="ui-btn ui-btn--sm ui-btn--ghost plan-scheduling__cancelMove plan-scheduling__cancelButton" data-action="cancel-move">キャンセル</button></footer>
    </section>`;
  }

  get feedback() { return this.root.querySelector('[data-role="feedback"]'); }
  get workspace() { return this.root.querySelector('[data-role="workspace"]'); }
  get loadingSkeleton() { return this.root.querySelector('[data-role="loading-skeleton"]'); }
  get planList() { return this.root.querySelector('[data-role="plan-list"]'); }
  get movePreview() { return this.root.querySelector('[data-role="move-preview"]'); }
  get drawer() { return this.root.querySelector('[data-role="slot-drawer"]'); }
  get planningLayout() { return this.root.querySelector('[data-role="planning-layout"]'); }
  get planningMain() { return this.root.querySelector('.plan-scheduling__planningMain'); }
  get matrix() { return this.root.querySelector('.plan-scheduling__matrix'); }
  get maintenanceWeek() { return this.root.querySelector('[data-role="maintenance-week"]'); }
  get chartLegend() { return this.root.querySelector('[data-role="chart-legend"]'); }
  get dateGrid() { return this.root.querySelector('[data-role="date-grid"]'); }
  get workloadChart() { return this.root.querySelector('[data-role="workload-chart"]'); }
  get filterButton() { return this.root.querySelector('[data-action="toggle-filter"]'); }
  get filterBadge() { return this.root.querySelector('[data-role="filter-count"]'); }
  get filterPopover() { return this.root.querySelector('[data-role="filter-popover"]'); }
  get filterEmptyState() { return this.root.querySelector('[data-role="filter-empty"]'); }
  get filterInputs() { return [...(this.root.querySelectorAll?.('[data-filter-category]') || [])]; }
}
