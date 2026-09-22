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

export const formatMaintenanceWeekLabel = (label) =>
  String(label ?? '').replace(/^(\d{1,2}月\d+週)目$/, '$1');

export const TEAM_COLORS = Object.freeze({
  'A班': '#1C55C8',
  'B班': '#00D614',
  'C班': '#FFC715',
});

export const SHIFT_COLORS = Object.freeze({
  '1直': 'rgba(45, 120, 218, 0.8)',
  '2直': 'rgba(52, 236, 123, 0.8)',
  '3直': 'rgba(255, 105, 105, 0.8)',
  '休日': 'rgba(112, 112, 112, 0.8)',
});

const chartColorDeclaration = (shiftName) =>
  `--plan-scheduling-chart-color:${SHIFT_COLORS[shiftName]}`;

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
  const shiftWorkloads = (day.shiftWorkloads || []).filter((item) =>
    Object.hasOwn(SHIFT_COLORS, item.shiftName));
  const hasInvalidEffort = shiftWorkloads.some((item) => item.hasInvalidEffort);
  const totalWorkloadMinutes = hasInvalidEffort
    ? null
    : shiftWorkloads.reduce((sum, item) => sum + (item.workloadMinutes ?? 0), 0);
  return {
    ...day,
    shiftWorkloads,
    totalWorkloadMinutes,
    totalWorkloadLabel: formatMinutes(totalWorkloadMinutes),
  };
};

const chartPreviewFromSelection = (selection) => {
  const { plan, destination, preview } = selection || {};
  const source = plan?.current;
  if (!source || !destination || !preview) return null;
  const sourceShift = source.shift?.name;
  const destinationShift = destination.shift?.name;
  if (!source.date || !sourceShift || !destination.date || !destinationShift) return null;
  return {
    source: {
      date: source.date,
      shiftName: sourceShift,
      before: preview.sourceBefore,
      after: preview.sourceAfter,
    },
    destination: {
      date: destination.date,
      shiftName: destinationShift,
      before: preview.destinationBefore,
      after: preview.destinationAfter,
    },
  };
};

const matchingChartChange = (projection, date, shiftName, workloadMinutes) => {
  if (!projection) return null;
  const matches = [
    { ...projection.source, kind: 'source' },
    { ...projection.destination, kind: 'destination' },
  ].filter((change) => change.date === date && change.shiftName === shiftName);
  if (!matches.length || !Number.isInteger(workloadMinutes)) return null;
  const delta = matches.reduce(
    (total, change) => total + (change.after - change.before),
    0,
  );
  if (delta === 0) return null;
  return {
    kind: delta < 0 ? 'source' : 'destination',
    before: workloadMinutes,
    after: workloadMinutes + delta,
  };
};

export const buildChartPresentation = (chart, selection = {}) => {
  const projection = chartPreviewFromSelection(selection);
  const dates = chart.dates.map(approvedChartDay).map((day) => {
    const shiftWorkloads = day.shiftWorkloads.map((item) => {
      const change = matchingChartChange(
        projection,
        day.date,
        item.shiftName,
        item.workloadMinutes,
      );
      const projectedWorkloadMinutes = change && Number.isInteger(change.after)
        ? change.after
        : item.workloadMinutes;
      return { ...item, change, projectedWorkloadMinutes };
    });
    const hasInvalidEffort = shiftWorkloads.some((item) => item.hasInvalidEffort);
    const projectedTotalWorkloadMinutes = hasInvalidEffort
      ? null
      : shiftWorkloads.reduce(
        (sum, item) => sum + (item.projectedWorkloadMinutes ?? 0),
        0,
      );
    return { ...day, shiftWorkloads, projectedTotalWorkloadMinutes };
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
  return `<span class="${classes}" data-chart-date="${escapeHtml(day.date)}" data-chart-shift="${escapeHtml(item.shiftName)}" style="${chartColorDeclaration(item.shiftName)};height:${height}%" aria-hidden="true">${portions}</span>`;
};

const tooltipWorkloadTemplate = (item) => {
  if (!item.change) return `<strong>${escapeHtml(item.workloadLabel)}</strong>`;
  return `<span class="plan-scheduling__tooltipPreview"><span>${formatMinutes(item.change.before)} → ${formatMinutes(item.change.after)}</span><strong>${formatDelta(item.change.before, item.change.after)}</strong></span>`;
};

const japaneseDateLabel = (isoDate, fallback, openParenthesis, closeParenthesis) => {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return fallback;
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${month}月${day}日${openParenthesis}${weekdays[weekday]}${closeParenthesis}`;
};

const tooltipDateLabel = (isoDate, fallback) =>
  japaneseDateLabel(isoDate, fallback, '（', '）');

const overviewDateLabel = (isoDate) => japaneseDateLabel(isoDate, isoDate, '(', ')');

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
    const chartBarRect = chartBar.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const detailBoundary = matrix.hidden
      ? {
        top: clamp(
          chartBarRect.bottom + 8,
          bounds.top + 8,
          bounds.bottom - tooltipRect.height - 8,
        ),
      }
      : matrix.getBoundingClientRect();
    const placement = placeChartTooltip({
      horizontalAnchorRect: chartBarRect,
      matrixRect: detailBoundary,
      tooltipRect,
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

  renderState(state, selection, { timelineAnchor = null, layoutGeometryChanges = false } = {}) {
    this.feedback.classList.remove('is-error');
    this.feedback.textContent = state.dataQuality.hasErrors
      ? `データ確認事項が${state.dataQuality.issueCount}件あります。`
      : '';
    const isMaintenanceWeek = state.viewMode === 'maintenanceWeek';
    const matrixVisible = state.matrixVisible !== false;
    const isMaintenanceWeekOverview = isMaintenanceWeek && !matrixVisible;
    this.planningCanvas?.classList.toggle('is-maintenance-week-view', isMaintenanceWeek);
    this.planningCanvas?.classList.toggle('is-chart-overview', !matrixVisible);
    this.planningLayout?.classList?.toggle?.('is-chart-overview', !matrixVisible);
    const displayDates = isMaintenanceWeek
      ? state.timelineDates
      : this.matrixDates(state, selection);
    if (this.matrix) this.matrix.hidden = !matrixVisible;
    this.dateGrid.innerHTML = matrixVisible
      ? displayDates.map((day) => isMaintenanceWeek
        ? this.maintenanceWeekColumnTemplate(day)
        : this.dateTemplate(day)).join('')
      : '';
    if (this.chartLegend) {
      this.chartLegend.innerHTML = this.chartLegendTemplate(state.workloadChart);
    }
    if (this.maintenanceWeek) {
      this.maintenanceWeek.hidden = isMaintenanceWeek && matrixVisible;
      this.maintenanceWeek.classList?.toggle?.(
        'is-week-overview-labels',
        isMaintenanceWeekOverview,
      );
      this.maintenanceWeek.classList?.toggle?.(
        'is-day-overview-groups',
        !isMaintenanceWeek && !matrixVisible,
      );
      this.maintenanceWeek.innerHTML = isMaintenanceWeekOverview
        ? this.maintenanceWeekOverviewTemplate(state.timelineDates)
        : isMaintenanceWeek
          ? ''
        : !matrixVisible
          ? this.dayOverviewGroupsTemplate(state.dayOverviewGroups)
          : this.maintenanceWeekTemplate(
            null,
            this.chartWithPinnedMoveSource(state.workloadChart, selection).dates,
          );
    }
    this.renderMatrixVisibility(matrixVisible);
    this.renderViewMode(state.viewMode || 'day');
    this.workspace.setAttribute?.('aria-busy', 'false');
    if (this.loadingSkeleton) this.loadingSkeleton.hidden = true;
    if (this.planningLayout) this.planningLayout.hidden = false;
    this.workspace.hidden = false;
    this.renderSelection(state, selection, { timelineAnchor, layoutGeometryChanges });
  }

  renderSelection(state, selection, { timelineAnchor = null, layoutGeometryChanges = false } = {}) {
    const drawerWillOpen = Boolean(selection.selectedSlot);
    const drawerIsOpen = Boolean(this.drawer && !this.drawer.hidden);
    const drawerGeometryChanges = drawerIsOpen !== drawerWillOpen;
    const geometryChanges = drawerGeometryChanges || layoutGeometryChanges;
    const resolvedTimelineAnchor = timelineAnchor || (geometryChanges
      ? this.captureTimelineAnchor(selection.selectedSlot?.date)
      : null);
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
      deferPin: geometryChanges,
    });
    if (geometryChanges) {
      this.restoreTimelineAnchorAfterLayout(resolvedTimelineAnchor, layoutRevision);
    }
  }

  renderMatrixVisibility(matrixVisible) {
    if (this.matrixVisibilityToggle) {
      this.matrixVisibilityToggle.checked = matrixVisible;
      this.matrixVisibilityToggle.setAttribute('aria-checked', matrixVisible ? 'true' : 'false');
    }
    if (this.matrixVisibilityState) {
      this.matrixVisibilityState.textContent = matrixVisible ? 'ON' : 'OFF';
    }
  }

  focusMatrixVisibilityToggle() {
    this.matrixVisibilityToggle?.focus?.();
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
    const selectedShift = selectedSlot?.shift?.name;
    const hasSelection = Boolean(selectedDate && selectedShift);
    this.workloadChart.classList.toggle('has-chart-selection', hasSelection);
    this.root.querySelectorAll('[data-chart-date][data-chart-shift]').forEach((segment) => {
      const isSelected = hasSelection &&
        segment.dataset.chartDate === selectedDate &&
        segment.dataset.chartShift === selectedShift;
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
      <footer class="plan-scheduling__planCardActions"><button type="button" class="ui-btn plan-scheduling__controlButton plan-scheduling__controlButton--primary plan-scheduling__moveButton" data-action="move" data-plan-id="${plan.planId}" ${plan.isPreviewable ? '' : 'disabled'}>移動</button></footer>
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
      const segments = day.shiftWorkloads.map((item) => {
        const isSelected = day.date === selectedSlot?.date &&
          item.shiftName === selectedSlot?.shift?.name;
        return chartSegmentTemplate({ item, day, maxTotal, isSelected });
      }).join('');
      const tooltipId = `plan-workload-tooltip-${dayIndex}`;
      const rows = day.shiftWorkloads.map((item) => `
        <div class="plan-scheduling__tooltipRow${item.change ? ` is-preview-${item.change.kind}` : ''}"><span><i style="${chartColorDeclaration(item.shiftName)}"></i>${escapeHtml(item.shiftName)}</span>${tooltipWorkloadTemplate(item)}</div>`).join('');
      const totalMinutes = projection
        ? day.projectedTotalWorkloadMinutes
        : day.totalWorkloadMinutes;
      const totalLabel = formatMinutes(totalMinutes);
      const affectedDescriptions = day.shiftWorkloads.filter((item) => item.change).map((item) => {
        const delta = item.change.after - item.change.before;
        return `${item.shiftName} 移動プレビュー後 ${formatMinutes(item.change.after)}、${formatMinutes(Math.abs(delta))}${delta < 0 ? '減少' : '増加'}`;
      });
      const chartIdentityLabel = day.isMaintenanceWeek
        ? formatMaintenanceWeekLabel(day.label)
        : day.label;
      const tooltipIdentityLabel = day.isMaintenanceWeek
        ? chartIdentityLabel
        : tooltipDateLabel(day.date, day.label);
      const ariaLabel = [
        `${chartIdentityLabel}の直別工数`,
        ...day.shiftWorkloads.map((item) => `${item.shiftName} ${item.workloadLabel}`),
        `合計 ${totalLabel}`,
        ...affectedDescriptions,
      ].join('。');
      const moveSourceLabel = day.isPinnedMoveSource
        ? '<b class="plan-scheduling__moveSourceLabel">移動元</b>'
        : '';
      return `<div class="plan-scheduling__chartColumn${day.isPinnedMoveSource ? ' is-pinned-move-source' : ''}" data-plan-date="${escapeHtml(day.date)}"><strong>${escapeHtml(totalLabel)}${moveSourceLabel}</strong><button type="button" class="plan-scheduling__chartBar" aria-label="${escapeHtml(ariaLabel)}" aria-describedby="${tooltipId}">${segments}</button><div class="plan-scheduling__chartTooltip" id="${tooltipId}" role="tooltip"><strong class="plan-scheduling__tooltipDate">${escapeHtml(tooltipIdentityLabel)}</strong>${rows}<div class="plan-scheduling__tooltipTotal"><span>合計</span><strong>${escapeHtml(totalLabel)}</strong></div></div></div>`;
    }).join('');
    return `<div class="plan-scheduling__chartPlot${projection ? ' has-chart-preview' : ''}"><div class="plan-scheduling__chartColumns">${bars}</div></div>`;
  }

  chartWithPinnedMoveSource(chart, selection) {
    const sourceDay = selection?.isMoving && selection.moveContext?.chartDay;
    if (!sourceDay || !hasPinnedMoveSource(chart.dates, selection)) return chart;
    return { ...chart, dates: [{ ...sourceDay, isPinnedMoveSource: true }, ...chart.dates] };
  }

  chartLegendTemplate(chart = {}) {
    const configuredShifts = (chart.shiftNames || [])
      .filter((shiftName) => Object.hasOwn(SHIFT_COLORS, shiftName));
    const shiftNames = configuredShifts.length ? configuredShifts : Object.keys(SHIFT_COLORS);
    const items = shiftNames.map((shiftName) =>
      `<li class="plan-scheduling__chartLegendItem"><i class="plan-scheduling__chartLegendSwatch" style="${chartColorDeclaration(shiftName)}"></i>${escapeHtml(shiftName)}</li>`
    ).join('');
    return `<ul class="plan-scheduling__chartLegend" aria-label="直別">${items}</ul>`;
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

  renderViewMode(viewMode) {
    this.viewModeButtons.forEach((button) => {
      const isActive = button.dataset.viewMode === viewMode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    if (this.weekButton) {
      this.weekButton.textContent = viewMode === 'maintenanceWeek'
        ? '保全週を表示'
        : '週を表示';
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
      `<span class="plan-scheduling__maintenanceWeekCell${day.isPinnedMoveSource ? ' is-pinned-move-source' : ''}" data-plan-date="${escapeHtml(day.date)}">${escapeHtml(formatMaintenanceWeekLabel(day.maintenanceWeekLabel || week?.label || ''))}</span>`
    ).join('');
    return cells;
  }

  maintenanceWeekOverviewTemplate(weeks = []) {
    const labels = weeks.map((week) => (
      `<span class="plan-scheduling__weekOverviewLabel" data-plan-date="${escapeHtml(week.key || week.date)}">${escapeHtml(formatMaintenanceWeekLabel(week.label || week.maintenanceWeekLabel || ''))}</span>`
    )).join('');
    return `<div class="plan-scheduling__weekOverviewLabels" aria-label="保全週">${labels}</div>`;
  }

  dayOverviewGroupsTemplate(groups = []) {
    const groupCells = (className, labelForGroup) => groups.map((group) => {
      const label = labelForGroup(group);
      const spanLength = Math.max(1, Number(group.spanLength) || 1);
      return `<span class="${className}" style="--plan-overview-group-span:${spanLength}">${escapeHtml(label)}</span>`;
    }).join('');
    const ranges = groupCells(
      'plan-scheduling__overviewRangeCell',
      (group) => `${overviewDateLabel(group.firstVisibleDate)}～${overviewDateLabel(group.lastVisibleDate)}`,
    );
    const labels = groupCells(
      'plan-scheduling__overviewGroupCell',
      (group) => formatMaintenanceWeekLabel(group.label),
    );
    return `<div class="plan-scheduling__dayOverviewGroups">
      <div class="plan-scheduling__overviewGroupRow plan-scheduling__overviewGroupRow--range" aria-label="表示日付範囲">${ranges}</div>
      <div class="plan-scheduling__overviewGroupRow plan-scheduling__overviewGroupRow--label" aria-label="保全カレンダーグループ">${labels}</div>
    </div>`;
  }

  maintenanceWeekColumnTemplate(week) {
    const slots = week.slots.map((slot) => {
      const issue = slot.hasInvalidEffort
        ? '<small>工数データに不備があります。</small>'
        : '';
      const team = slot.isHolidayAggregate
        ? ''
        : `<span class="plan-scheduling__weeklyTeam">${escapeHtml(slot.teamName)}</span>`;
      return `<div class="plan-scheduling__slot plan-scheduling__weeklySlot${slot.isHolidayAggregate ? ' is-holiday' : ''}${slot.hasInvalidEffort ? ' is-invalid' : ''}"><span class="plan-scheduling__weeklyShift">${escapeHtml(slot.shiftName)}</span>${team}<strong>${escapeHtml(slot.workloadLabel)}</strong>${issue}</div>`;
    }).join('');
    const displayLabel = formatMaintenanceWeekLabel(week.label);
    return `<article class="plan-scheduling__dateColumn plan-scheduling__maintenanceWeekColumn" data-plan-date="${escapeHtml(week.key)}">
      <header><h3>${escapeHtml(displayLabel)}</h3><button type="button" class="plan-scheduling__weekDrilldown" data-action="drilldown-week" data-week-key="${escapeHtml(week.key)}" aria-label="${escapeHtml(displayLabel)}を日表示で開く">日表示へ</button></header>
      ${slots ? `<div class="plan-scheduling__slotList">${slots}</div>` : '<p class="plan-scheduling__empty">勤務スロットなし</p>'}
    </article>`;
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
  get planningCanvas() { return this.root.querySelector('[data-role="planning-canvas"]'); }
  get matrix() { return this.root.querySelector('.plan-scheduling__matrix'); }
  get maintenanceWeek() { return this.root.querySelector('[data-role="maintenance-week"]'); }
  get chartLegend() { return this.root.querySelector('[data-role="chart-legend"]'); }
  get matrixVisibilityToggle() { return this.root.querySelector('[data-action="toggle-matrix"]'); }
  get matrixVisibilityState() { return this.root.querySelector('[data-role="matrix-visibility-state"]'); }
  get dateGrid() { return this.root.querySelector('[data-role="date-grid"]'); }
  get workloadChart() { return this.root.querySelector('[data-role="workload-chart"]'); }
  get filterButton() { return this.root.querySelector('[data-action="toggle-filter"]'); }
  get filterBadge() { return this.root.querySelector('[data-role="filter-count"]'); }
  get filterPopover() { return this.root.querySelector('[data-role="filter-popover"]'); }
  get filterEmptyState() { return this.root.querySelector('[data-role="filter-empty"]'); }
  get filterInputs() { return [...(this.root.querySelectorAll?.('[data-filter-category]') || [])]; }
  get viewModeButtons() { return [...(this.root.querySelectorAll?.('[data-action="set-view-mode"]') || [])]; }
  get weekButton() { return this.root.querySelector('.plan-scheduling__weekButton'); }
}
