import { initializeLoadingScreen } from '../manager/loadingManager.js';
import { UIManger } from '../manager/UIManger.js';
import { TableManager } from '../manager/TableManger.js'
import { fetchKpiMatrix, fetchKpiCellDetail, fetchPlanDetail } from "../api/fetchers.js";

import { buildPlanDetailCardsVM, buildExtraDetailVM } from '../presenters/planDetailPresenter.js';
import { renderPlanDetailCardsHTML, renderExtraDetailHTML } from '../ui/renderers/planDetailCardsRenderer.js';
import { panelBinder } from '../ui/bindings/panelBinder.js';

import { DrawerStack } from '../ui/componets/drawer/DrawerStack.js';


function getRowDefs(metrics = []) {
  const pct = (v) => (v == null ? '' : `${Math.round(v * 1000) / 10}%`);

  const DEF = {
    plan:     { key: 'plan',     label: '計画', unit: '件', clickable: true },
    actual:   { key: 'actual',   label: '実績', unit: '件', clickable: true },
    actual_outside: { key: 'actual_outside', label: '実績(計画外)', unit: '件', clickable: true },

    rate: { key: 'rate', label: '実施率', unit: '%', clickable: false, formatter: pct },

    delay:    { key: 'delay',    label: '遅れ', unit: '件', clickable: true },
    recovery: { key: 'recovery', label: '挽回', unit: '件', clickable: true },
    advance:  { key: 'advance',  label: '前倒し', unit: '件', clickable: true, sectionEnd: true },

    // --- 工数 ---
    plan_mh:   { key: 'plan_mh',   label: '計画', unit: '工数', clickable: false, sectionStart: true },
    actual_mh: { key: 'actual_mh', label: '実績', unit: '工数', clickable: false },
    actual_outside_mh: { key: 'actual_outside_mh', label: '実績(計画外)', unit: '工数', clickable: false },

    mh_rate: { key: 'mh_rate', label: '実施率(工数)', unit: '%', clickable: false, formatter: pct },

    delay_mh:    { key: 'delay_mh',    label: '遅れ', unit: '工数', clickable: false },
    recovery_mh: { key: 'recovery_mh', label: '挽回', unit: '工数', clickable: false },
    advance_mh:  { key: 'advance_mh',  label: '前倒し', unit: '工数', clickable: false },
  };

  const ORDER = [
    'plan','actual','actual_outside','rate','delay','recovery','advance',
    'plan_mh','actual_mh','actual_outside_mh','mh_rate','delay_mh','recovery_mh','advance_mh',
  ];

  const list = (metrics && metrics.length) ? metrics : ORDER;

  const sorted = [
    ...ORDER.filter(k => list.includes(k)),
    ...list.filter(k => !ORDER.includes(k)),
  ];

  return sorted.map((m) => DEF[m] ?? { key: m, label: m, unit: '', clickable: false });
}

function getTeamDefs() {
  return [
    { key: 'A',   label: 'A班' },
    { key: 'B',   label: 'B班' },
    { key: 'C',   label: 'C班' },
    { key: 'all', label: '全体' },
  ];
}

class plannedMaintenance {
  constructor() {
    this.state = {
      periodView: 'day',
      targetView: 'team',
      graphType: 'weekly-manhours',
      baseDate: new Date(),
      matrixData: null,
      chartData: null,
      isDirty: false,
      activeCell: null,
    };

    this.table = null;
    this.tableManager = new TableManager();

    this.$root = null;
    this.$matrixWrapper = null;
    this.$updateBtn = null;

    // ★DrawerStack（サブビュー管理）
    this.drawers = null;
  }

  async init() {
    this.cacheDom();
    this.setupDrawers();   // ★追加
    this.bindEvents();

    this.updateButtonsUI();

    await this.reloadMatrix();
    requestAnimationFrame(() => this.scrollToCurrentPeriod());
  }

  cacheDom() {
    // root は新HTMLで .page を付けた前提（付けてないなら .planned-maintenance-container でもOK）
    this.$root = document.querySelector('[data-page="planned-maintenance"]') 
              || document.querySelector('.page')
              || document.querySelector('.planned-maintenance-container');

    this.$matrixWrapper = document.getElementById('kpiMatrixWrapper');
    this.table = document.getElementById('kpiMatrixTable');
    this.$updateBtn = document.querySelector('.kpi-top-controls__update .kpi-btn--primary');
  }

  setupDrawers() {
    if (!this.$root) return;

    const stackEl = this.$root.querySelector('[data-drawer-stack]');
    if (!stackEl) {
      console.warn('[plannedMaintenance] drawer stack not found: [data-drawer-stack]');
      return;
    }

    this.drawers = new DrawerStack({
      stackEl,
      rootEl: this.$root,
      rootClassBase: 'page', // SCSSが page--drawer-open 等に反応
      order: ['cell', 'plan', 'extra'],
      enableEscapeClose: true,
      side: 'right',
    });
  }

  bindEvents() {
    // 期間ボタン
    document
      .querySelectorAll('.kpi-top-controls__group--period .kpi-btn')
      .forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          if (this.state.periodView === view) return;
          this.state.periodView = view;
          this.state.isDirty = true;
          this.updateButtonsUI();
        });
      });

    // 対象ボタン
    document
      .querySelectorAll('.kpi-top-controls__group--target .kpi-btn')
      .forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          if (this.state.targetView === view) return;
          this.state.targetView = view;
          this.state.isDirty = true;
          this.updateButtonsUI();
        });
      });

    // 更新ボタン
    if (this.$updateBtn) {
      this.$updateBtn.addEventListener('click', async () => {
        const btn = this.$updateBtn;
        try {
          btn.disabled = true;
          await this.reloadMatrix();
          this.state.isDirty = false;
          this.updateButtonsUI();
          requestAnimationFrame(() => this.scrollToCurrentPeriod());
        } finally {
          btn.disabled = false;
        }
      });
    }

    // KPIマトリクス セルクリック
    if (this.table) {
      this.table.addEventListener('click', (e) => {
        const td = e.target.closest('td.kpi-matrix__cell--clickable');
        if (!td || !this.table.contains(td)) return;

        const { type, periodKey, team } = td.dataset;
        const periodView = this.state.periodView;

        const periodLabel = (() => {
          if (periodView === 'month') return `${periodKey}月`;
          if (periodView === 'week') {
            const [m, w] = periodKey.split('-');
            return `${m}月${w}週目`;
          }
          return periodKey;
        })();

        const metricLabelMap = { plan: '計画', actual: '実績', delay: '遅れ', recovery: '挽回' };
        const teamLabelMap = { A: 'A班', B: 'B班', C: 'C班', all: '全体' };

        const label = `${periodLabel} / ${teamLabelMap[team] ?? team} / ${metricLabelMap[type] ?? type}`;
        this.onMatrixCellClick(td, { type, periodKey, team, label });
      });
    }

    // ★セル詳細テーブル行クリック（Drawer内の table をイベント委譲で拾う）
    if (this.drawers) {
      const cellPanel = this.drawers.panel('cell');
      const tableEl = cellPanel?.tableEl;

      if (tableEl) {
        tableEl.addEventListener('click', (e) => {
          const tr = e.target.closest('tbody tr');
          if (!tr || !tableEl.contains(tr)) return;

          const planId = tr.dataset.planId;
          if (!planId) return;

          this.onCellDetailRowClick({ planId, tr });
        });
      }
    }
  }

  onMatrixCellClick(td, { type, periodKey, team, label }) {
    this.table
      ?.querySelectorAll('tbody td.kpi-matrix__cell--selected')
      .forEach(cell => cell.classList.remove('kpi-matrix__cell--selected'));

    td.classList.add('kpi-matrix__cell--selected');

    const value = td.dataset.value ?? '';
    this.state.activeCell = { type, periodKey, team, value, label };

    // ★cellだけ開いて skeleton
    this.openCellSkeleton(label);

    this.loadCellDetail(this.state.activeCell).catch(console.error);
  }

  openCellSkeleton(label = '') {
    if (!this.drawers) return;


    const cell = this.drawers.panel('cell');
    if (!cell) return;

    cell.setWide(true);
    this.drawers.openToLevel(1);


    cell.setTitle(`${label}（読み込み中…）`);
    cell.showEmpty('データを読み込んでいます…');
    cell.clearTable();
  }

  async loadCellDetail({ type, periodKey, team, label }) {
    const { periodView } = this.state;

    const cell = this.drawers?.panel('cell');
    
    if (!cell) return;

    try {
      const res = await fetchKpiCellDetail({
        periodView,
        periodKey,
        team,
        metric: type,
      });

      const rows = res.rows || [];

      // タイトル（件数付き）
      const countLabel = rows.length ? `(${rows.length}件)` : '(0件)';
      cell.setTitle(`${label}${countLabel}`);

      // empty制御
      if (rows.length === 0) {
        cell.showEmpty('該当するデータがありません。');
      } else {
        cell.hideEmpty();
      }

      // テーブル描画（Drawer内tableに描く）
      cell.showTable?.();
      this.tableManager.renderKpiCellDetail(cell.tableEl, rows);
      this.tableManager.applyRowParityClasses(cell.tableEl);

    } catch (e) {
      console.error('loadCellDetail error:', e);
      cell.setTitle('読み込みエラー');
      cell.showEmpty('データの読み込みに失敗しました。');
      cell.clearTable();
    }
  }

  async onCellDetailRowClick({ planId, tr }) {
    const cell = this.drawers?.panel('cell');
    const plan = this.drawers?.panel('plan');
    const extra = this.drawers?.panel('extra');
    if (!cell || !plan || !extra) return;

    const cardNo = tr.dataset.cardNo || '';
    const workName = tr.dataset.workName || '';

    // 行の選択見た目（drawer内tableで）
    cell.tableEl
      ?.querySelectorAll('tbody tr.is-selected')
      .forEach(r => r.classList.remove('is-selected'));
    tr.classList.add('is-selected');


    // ★②③を開く
    this.drawers.openToLevel(3);

    const title = `${cardNo} / ${workName}`;

    // panelBinder は「要素」を受け取るので、DrawerPanelの参照を使う
    panelBinder.showLoading(
      plan.titleEl,
      plan.bodyEl,
      `${title}（読み込み中…）`
    );

    panelBinder.showLoading(
      extra.titleEl,
      extra.bodyEl,
      `点検結果（読み込み中…）`
    );

    try {
      const res = await fetchPlanDetail({ planId });

      const vm2 = buildPlanDetailCardsVM(res, { title });
      const html2 = renderPlanDetailCardsHTML(vm2);

      plan.showBody();
      panelBinder.setTitle(plan.titleEl, vm2.title);
      panelBinder.setBodyHTML(plan.bodyEl, html2);

      const vm3 = buildExtraDetailVM(res, { title });
      const html3 = renderExtraDetailHTML(vm3);

      extra.showBody();
      panelBinder.setTitle(extra.titleEl, '点検結果');
      panelBinder.setBodyHTML(extra.bodyEl, html3);

    } catch (e) {
      console.error(e);
      panelBinder.showError(plan.titleEl, plan.bodyEl);
    }
  }

  updateUpdateButtonState() {
    const btn = this.$updateBtn;
    if (!btn) return;

    const shouldEnable = this.state.isDirty;

    btn.disabled = !shouldEnable;
    btn.classList.toggle('kpi-btn--disabled', !shouldEnable);
    btn.setAttribute('aria-disabled', (!shouldEnable).toString());
  }

  updateButtonsUI() {
    document
      .querySelectorAll('.kpi-top-controls__group--period .kpi-btn')
      .forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.view === this.state.periodView);
      });

    document
      .querySelectorAll('.kpi-top-controls__group--target .kpi-btn')
      .forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.view === this.state.targetView);
      });

    this.updateUpdateButtonState();
  }

  async reloadMatrix() {
    if (!this.$matrixWrapper) {
      console.warn('[reloadMatrix] kpiMatrixWrapper not found');
      return;
    }

    const matrix = this.$matrixWrapper.closest('.kpi-matrix');

    UIManger.showSpinner?.({
      container: matrix,
      id: 'kpiMatrixSpinner',
      size: 'lg',
      title: 'KPIマトリクスを更新中…',
      sub: '集計データを読み込んでいます',
      delayMs: 150,
    });

    try {
      await this.loadMatrixData();
      if (this.table) this.table.innerHTML = '';
      this.buildKpiMatrixTable();
      this.renderMatrix();
    } finally {
      UIManger.hideSpinner?.({ id: 'kpiMatrixSpinner' });
    }
  }

  buildKpiMatrixTable() {
    if (!this.table) return;
    const { matrixData, periodView } = this.state;
    if (!matrixData || !periodView) return;

    const rowDefs = getRowDefs(matrixData.metrics);
    const teamDefs = getTeamDefs();
    const periods = matrixData.periods;

    this.tableManager.buildKpiMatrixTable(this.table, {
      rowDefs,
      teamDefs,
      periods,
      periodView,
    });
  }

  async loadMatrixData() {
    const { periodView, targetView, baseDate } = this.state;

    const res = await fetchKpiMatrix({
      periodView,
      targetView,
      baseDate,
    });

    if (res && res.status === "success") {
      this.state.matrixData = res.matrix || null;
    } else {
      this.state.matrixData = null;
    }
  }

  scrollToCurrentPeriod() {
    if (!this.table) return;
    const wrapper = this.$matrixWrapper || this.table.closest('#kpiMatrixWrapper');
    if (!wrapper) return;

    const target =
      this.table.querySelector('tbody .kpi-matrix__cell--current-period') ||
      this.table.querySelector('thead .kpi-matrix__header--current-period');

    if (!target) return;

    const wRect = wrapper.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();

    const targetCenter = (tRect.left - wRect.left) + (tRect.width / 2);
    const next = wrapper.scrollLeft + targetCenter - (wrapper.clientWidth / 2);

    wrapper.scrollLeft = Math.max(0, Math.min(next, wrapper.scrollWidth - wrapper.clientWidth));
  }

  renderMatrix() {
    if (!this.table) return;
    const { matrixData } = this.state;
    if (!matrixData) return;

    const rowDefs = getRowDefs(matrixData.metrics);
    this.tableManager.renderKpiMatrix(this.table, matrixData, { rowDefs });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initializeLoadingScreen();

  const app = new plannedMaintenance();
  await app.init();

  window.dispatchEvent(new Event('app:ready'));
});
