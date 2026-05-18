import { DrawerStack } from '../../../ui/componets/drawer/DrawerStack.js';

import {
  buildPlanDetailCardsVM,
} from '../../../presenters/planDetailPresenter.js';

import {
  buildRegistrationDrawerTableVM,
} from '../../../presenters/registrationDrawerPresenter.js';

import {
  renderPlanDetailCardsHTML,
} from '../../../ui/renderers/planDetailCardsRenderer.js';

import {
  renderGenericTableHTML,
} from '../../../ui/renderers/genericTableRenderer.js';

import {
  renderRegistrationDrawerTop,
} from '../../../ui/renderers/registrationDrawerTopRenderer.js';

export class ScheduleDetailDrawerService {
  constructor({ elements, dataService }) {
    this.elements = elements;
    this.dataService = dataService;
    this.detailDrawerStack = null;
  }

  initializeStack() {
    const stackEl = this.elements.drawerStackRoot;
    const rootEl = this.elements.root;

    if (!stackEl || !rootEl) {
      return;
    }

    this.detailDrawerStack = new DrawerStack({
      stackEl,
      rootEl,
      rootClassBase: 'page',
      side: 'right',
      order: ['cell', 'detail'],
      enableEscapeClose: true,
    });
  }

  getStack() {
    return this.detailDrawerStack;
  }

  async openInspectionCardDetail(inspectionNo) {
    const detailStack = this.getStack();
    const detailPanel = detailStack?.panel('detail');

    if (!detailPanel || !inspectionNo) {
      return;
    }

    detailStack.openPanels(['detail']);
    detailPanel.setTitle('作業詳細');
    detailPanel.setBodyHtml('<p>読み込み中...</p>');
    detailPanel.showBody();

    try {
      const response = await this.dataService.fetchInspectionCardDetail({
        inspectionNo,
      });

      const workName = response?.plan?.check?.work_name ?? '';
      const title = `${workName}(${inspectionNo})`;
      const cardsVm = buildPlanDetailCardsVM(response, { title });

      const bodyHtml = `
        ${renderPlanDetailCardsHTML(cardsVm)}
      `;

      detailPanel.setTitle(title);
      detailPanel.setBodyHtml(bodyHtml);
      detailPanel.showBody();
    } catch (error) {
      console.error('[openInspectionCardDetail] failed:', error);

      detailPanel.setTitle('作業詳細');
      detailPanel.setBodyHtml('<p>詳細情報の取得に失敗しました。</p>');
      detailPanel.showBody();
    }
  }

  openBulkRegistrationDrawer({ items = [] } = {}) {
    const detailStack = this.getStack();
    const cellPanel = detailStack?.panel('cell');
  
    if (!detailStack || !cellPanel) {
      return;
    }
  
    const rows = this.buildBulkRegistrationRows(items);
  
    cellPanel.setWide?.(true);
    detailStack.openPanels(['cell']);
  
    cellPanel.setTitle('一括登録');
    cellPanel.hideEmpty?.();
    cellPanel.clearTable?.();
    cellPanel.clearTableTop?.();
    cellPanel.hideTableTop?.();
  
    if (!rows.length) {
      cellPanel.showEmpty?.('一括登録できるカードがありません。');
      cellPanel.clearTable?.();
      cellPanel.clearTableTop?.();
      cellPanel.hideTableTop?.();
      return;
    }
  
    const topHtml = renderRegistrationDrawerTop({
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
    });
  
    const vm = buildRegistrationDrawerTableVM(rows, {
      title: '一括登録',
    });
  
    const tableHtml = renderGenericTableHTML(vm, {
      emptyText: '該当するデータがありません。',
    });
  
    cellPanel.setTitle(vm.title);
    cellPanel.setTableTopHtml(topHtml);
    cellPanel.showTableTop?.();
  
    cellPanel.setTableHtml(tableHtml);
    cellPanel.showTable?.();
  }

  createBulkRegistrationPreviewHtml(items) {
    if (!items.length) {
      return `
        <div class="schedule-page__bulkRegistration">
          <p>一括登録できるカードがありません。</p>
          <p>フィルター条件を変更して、対象カードを表示してください。</p>
        </div>
      `;
    }

    return `
      <div class="schedule-page__bulkRegistration">
        <p>現在表示中のカードを一括登録します。</p>

        <div class="schedule-page__bulkRegistrationSummary">
          対象件数: <strong>${items.length}</strong> 件
        </div>

        <button
          type="button"
          class="ui-btn ui-btn--primary ui-btn--sm"
          data-ui-action="schedule:execute-bulk-registration"
        >
          一括登録する
        </button>
      </div>
    `;
  }

  buildBulkRegistrationRows(items = []) {
    if (!Array.isArray(items)) {
      return [];
    }
  
    return items.map((item) => ({
      planId: item.planId ?? '',
      planInspectionNo:
        item.inspectionNo
        ?? item.planInspectionNo
        ?? '',
  
      controlName:
        item.machineName
        ?? item.controlName
        ?? '',
  
      workName:
        item.workName
        ?? '',
  
      manHour:
        item.manHours
        ?? item.manHour
        ?? '',
  
      period:
        item.period
        ?? item.dayOfWeek
        ?? item.planDate
        ?? '',
    }));
  }
}