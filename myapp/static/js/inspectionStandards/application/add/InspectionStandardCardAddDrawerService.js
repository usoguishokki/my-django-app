// static/js/inspectionStandards/application/add/InspectionStandardCardAddDrawerService.js

import { fetchInspectionStandardCommonItemOptions } from '../../../api/fetchers.js';

import {
  buildEmptyInspectionStandardEditSection,
  buildInspectionStandardCardAddCommonItemFormVM,
} from '../../domain/InspectionStandardEditMapper.js';

import {
  renderInspectionStandardCardAddFormHTML,
} from '../../ui/InspectionStandardEditFormRenderer.js';

import {
  initializeInspectionStandardCommonItemDropdowns,
  destroyInspectionStandardCommonItemDropdowns,
} from '../edit/InspectionStandardCommonItemDropdownService.js';

export class InspectionStandardCardAddDrawerService {
  constructor({
    getDrawers,
  } = {}) {
    this.getDrawers = getDrawers;
  }

  async open({
    context = {},
  } = {}) {
    const drawers = this.getDrawers?.();
    const cell = drawers?.panel('cell');

    if (!drawers || !cell) return;

    drawers.openToLevel(1);

    cell.setWide?.(true);
    cell.showBody?.();
    cell.clearTable?.();
    cell.clearTableTop?.();
    cell.setTitle?.(
      buildInspectionStandardCardAddDrawerTitle({
        context,
        stepLabel: '共通項目',
      })
    );

    cell.setBodyHtml?.(`
      <div class="drawer__placeholder">
        入力項目を読み込み中です...
      </div>
    `);

    try {
      const optionsResponse = await fetchInspectionStandardCommonItemOptions();

      const commonItemVM = buildInspectionStandardCardAddCommonItemFormVM({
        optionsResponse,
      });

      const detailSection = buildEmptyInspectionStandardEditSection();

      destroyInspectionStandardCommonItemDropdowns({
        rootEl: cell.bodyEl,
      });

      cell.setBodyHtml?.(
        renderInspectionStandardCardAddFormHTML({
          context,
          commonItemVM,
          detailSection,
        })
      );

      initializeInspectionStandardCommonItemDropdowns({
        rootEl: cell.bodyEl,
        vm: commonItemVM,
      });
    } catch (error) {
      console.error('[InspectionStandardCardAddDrawerService] open failed:', error);

      cell.setBodyHtml?.(`
        <p class="drawer__placeholder">
          カード追加フォームの読み込みに失敗しました。
        </p>
      `);
    }
  }
}


function buildInspectionStandardCardAddDrawerTitle({
  context = {},
  stepLabel = '共通項目',
} = {}) {
  const machine = String(context.machine ?? '').trim();
  const controlNo = String(context.controlNo ?? '').trim();

  const detailLabels = [
    machine ? `設備名: ${machine}` : '',
    controlNo ? `管理番号: ${controlNo}` : '',
  ].filter(Boolean);

  const baseTitle = stepLabel
    ? `カードの追加 / ${stepLabel}`
    : 'カードの追加';

  if (!detailLabels.length) {
    return baseTitle;
  }

  return `${baseTitle}（${detailLabels.join('　')}）`;
}