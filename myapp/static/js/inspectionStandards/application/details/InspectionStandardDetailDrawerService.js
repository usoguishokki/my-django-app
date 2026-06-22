// static/js/inspectionStandards/application/details/InspectionStandardDetailDrawerService.js

import { panelBinder } from '../../../ui/bindings/panelBinder.js';

import {
  fetchInspectionCardDetail,
  fetchInspectionPlansHistory,
  fetchPlanDetail,
} from '../../../api/fetchers.js';

import {
  buildPlanDetailCardsVM,
  buildExtraDetailVM,
} from '../../../presenters/planDetailPresenter.js';

import { buildWorkHistoryTableVM } from '../../../presenters/workHistoryTablePresenter.js';

import { renderGenericTableHTML } from '../../../ui/renderers/genericTableRenderer.js';

import {
  renderPlanDetailCardsHTML,
  renderExtraDetailHTML,
} from '../../../ui/renderers/planDetailCardsRenderer.js';

export class InspectionStandardDetailDrawerService {
  constructor({
    getDrawers,
    setActiveDetailVM,
  } = {}) {
    this.getDrawers = getDrawers;
    this.setActiveDetailVM = setActiveDetailVM;
  }

  async loadInspectionCardDetail({ inspectionNo, cellTitle }) {
    const cell = this._panel('cell');

    if (!cell) return;

    try {
      const res = await fetchInspectionCardDetail({ inspectionNo });

      const inspectionManHour = res?.plan?.check?.man_hours ?? '';
      const title = `${cellTitle} ${inspectionManHour}分`;

      const vm = buildPlanDetailCardsVM(res, { title });
      const html = renderPlanDetailCardsHTML(vm);

      this.setActiveDetailVM?.(vm);

      cell.showBody?.();

      panelBinder.setTitle(cell.titleEl, vm.title);
      panelBinder.setBodyHTML(cell.bodyEl, html);
    } catch (error) {
      console.error(error);
      panelBinder.showError(cell.titleEl, cell.bodyEl);
    }
  }

  async loadInspectionHistory({ inspectionNo }) {
    const plan = this._panel('plan');

    if (!plan) return;

    plan.setTitle?.(`履歴: ${inspectionNo}（読み込み中…）`);
    plan.showEmpty?.('データを読み込んでいます…');

    plan.showTable?.();
    plan.clearTable?.();
    plan.clearBody?.();

    try {
      const res = await fetchInspectionPlansHistory({ inspectionNo });
      const vm = buildWorkHistoryTableVM(res, { title: '作業履歴' });
      const html = renderGenericTableHTML(vm);

      plan.setTitle?.(vm.title);
      plan.showTable?.();
      plan.setTableHtml?.(html);
    } catch (error) {
      console.error(error);

      plan.setTitle?.(`履歴: ${inspectionNo}（エラー）`);
      plan.showEmpty?.('読み込みに失敗しました');
    }
  }

  async openExtraFromHistoryRow({ planId }) {
    const drawers = this._drawers();
    const extra = this._panel('extra');

    if (!drawers || !extra) return;

    drawers.openToLevel(3);

    extra.setTitle?.('点検結果（読み込み中…）');
    extra.showBody?.();
    extra.setBodyHtml?.(
      '<p class="drawer__placeholder">データを読み込んでいます…</p>'
    );

    try {
      const res = await fetchPlanDetail({ planId });

      const title = `plan_id: ${planId}`;
      const vm = buildExtraDetailVM(res, { title });
      const html = renderExtraDetailHTML(vm);

      extra.showBody?.();

      panelBinder.setTitle(extra.titleEl, '点検結果');
      panelBinder.setBodyHTML(extra.bodyEl, html);
    } catch (error) {
      console.error(error);

      extra.showBody?.();
      panelBinder.showError(extra.titleEl, extra.bodyEl);
    }
  }

  _drawers() {
    return this.getDrawers?.() ?? null;
  }

  _panel(panelName) {
    return this._drawers()?.panel(panelName);
  }
}