import { DrawerStack } from '../../../ui/componets/drawer/DrawerStack.js';

import {
  buildPlanDetailCardsVM,
  buildExtraDetailVM,
} from '../../../presenters/planDetailPresenter.js';

import {
  renderPlanDetailCardsHTML,
} from '../../../ui/renderers/planDetailCardsRenderer.js';

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
}