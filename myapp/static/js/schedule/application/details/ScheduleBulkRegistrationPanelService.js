import {
    buildRegistrationDrawerTableVM,
} from '../../../presenters/registrationDrawerPresenter.js';

import {
  renderGenericTableHTML,
} from '../../../ui/renderers/genericTableRenderer.js';

import {
  renderRegistrationDrawerTop,
} from '../../../ui/renderers/registrationDrawerTopRenderer.js';

export class ScheduleBulkRegistrationPanelService {
  constructor({ elements, filterService }) {
    this.elements = elements;
    this.filterService = filterService;
  }

  render({
    items = [],
    memberId = '',
    memberName = '',
    startDate = '',
    startTime = '',
    endDate = '',
    endTime = '',
  } = {}) {
    this.renderTitle(items);

    const container = this.elements.testCardsPanelBody;

    if (!container) {
      return;
    }

    const rows = this.buildBulkRegistrationRows(items);

    if (!rows.length) {
      container.innerHTML = this.createEmptyHtml();
      return;
    }

    const topHtml = renderRegistrationDrawerTop({
      startDate,
      startTime,
      endDate,
      endTime,
      memberId,
      memberName,
      arrowIconUrl: this.elements.arrowIconUrl,
    });

    const vm = buildRegistrationDrawerTableVM(rows, {
      title: '一括登録',
    });

    const tableHtml = this.renderBulkRegistrationTableHtml(vm);

    container.innerHTML = `
    <div class="schedule-page__bulkRegistrationPanel">
      <div class="schedule-page__bulkRegistrationPanelTop">
        ${topHtml}
      </div>
  
      <div class="schedule-page__bulkRegistrationPanelTable">
        ${tableHtml}
      </div>
    </div>
  `;
  }

  renderBulkRegistrationTableHtml(vm) {
    const tableInnerHtml = renderGenericTableHTML(vm, {
      emptyText: '該当するデータがありません。',
    });
  
    return `
      <table class="drawer__table drawer__table--no-rowclick">
        ${tableInnerHtml}
      </table>
    `;
  }

  renderTitle(items = []) {
    const titleElement = this.elements.testCardsPanelTitle;
  
    if (!titleElement) {
      return;
    }
  
    const metaText =
      this.filterService?.getDrawerPanelMeta?.({
        count: items.length,
      }) ?? `対象 ${items.length} 件 / フィルターなし`;
  
    titleElement.replaceChildren(
      this.createTitleMain(),
      this.createTitleMeta(metaText)
    );
  }

  createTitleMain() {
    const element = document.createElement('span');
    element.className = 'schedule-page__drawerPanelTitleMain';
    element.textContent = '一括登録';

    return element;
  }

  createTitleMeta(metaText = '') {
    const element = document.createElement('span');
    element.className = 'schedule-page__drawerPanelTitleMeta';
    element.textContent = metaText || '対象 0 件 / フィルターなし';
  
    return element;
  }

  createEmptyHtml() {
    return `
      <div class="schedule-page__bulkRegistrationPanel">
        <div class="ui-empty-message">
          一括登録できるカードがありません。
        </div>
      </div>
    `;
  }

  formatCycleLabel(item = {}) {
    const interval = item.interval ?? '';
    const unit = String(item.unit ?? '').trim().toUpperCase();
  
    if (!interval && !unit) {
      return '';
    }
  
    if (!interval) {
      return unit;
    }
  
    if (!unit) {
      return String(interval);
    }
  
    return `${interval}/${unit}`;
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

        period: this.formatCycleLabel(item),
    }));
  }

  renderPullback({
    items = [],
    memberId = '',
    memberName = '',
    dayKey = '',
    dayLabel = '',
  } = {}) {
    this.renderPullbackTitle({
      items,
      memberName,
      dayLabel,
    });
  
    const container = this.elements.testCardsPanelBody;
  
    if (!container) {
      return;
    }
  
    const rows = this.buildBulkPullbackRows(items);
  
    if (!rows.length) {
      container.innerHTML = this.createPullbackEmptyHtml({
        memberName,
        dayLabel,
      });
      return;
    }
  
    const vm = this.buildBulkPullbackTableVM(rows);
    const tableHtml = this.renderBulkRegistrationTableHtml(vm);
  
    container.innerHTML = `
      <div
        class="schedule-page__bulkRegistrationPanel"
        data-mode="bulk-pullback"
        data-member-id="${memberId}"
        data-member-name="${memberName}"
        data-day-key="${dayKey}"
        data-day-label="${dayLabel}"
      >
        <div class="schedule-page__bulkRegistrationPanelTable">
          ${tableHtml}
        </div>
  
        <div class="schedule-page__bulkRegistrationPanelActions">
          <button
            type="button"
            class="ui-btn ui-btn--primary ui-btn--sm"
            data-ui-action="schedule:execute-bulk-pullback"
          >
            確定
          </button>
        </div>
      </div>
    `;
  }

  renderPullbackTitle({ items = [], memberName = '', dayLabel = '' } = {}) {
    const titleElement = this.elements.testCardsPanelTitle;
  
    if (!titleElement) {
      return;
    }
  
    const count = Array.isArray(items) ? items.length : 0;
  
    const targetText = [
      memberName,
      dayLabel,
    ].filter(Boolean).join(' / ');
  
    const metaText = targetText
      ? `${targetText} / 対象 ${count} 件`
      : `対象 ${count} 件`;
  
    titleElement.replaceChildren(
      this.createPullbackTitleMain(),
      this.createTitleMeta(metaText)
    );
  }
  
  createPullbackTitleMain() {
    const element = document.createElement('span');
    element.className = 'schedule-page__drawerPanelTitleMain';
    element.textContent = '一括引き戻し';
  
    return element;
  }
  
  createPullbackEmptyHtml({ memberName = '', dayLabel = '' } = {}) {
    const targetText = [
      memberName ? `${memberName}さん` : '',
      dayLabel,
    ].filter(Boolean).join(' / ');
  
    const messagePrefix = targetText ? `${targetText}の` : '';
  
    return `
      <div
        class="schedule-page__bulkRegistrationPanel"
        data-mode="bulk-pullback"
      >
        <div class="ui-empty-message">
          ${messagePrefix}引き戻し対象の予定はありません。
        </div>
      </div>
    `;
  }
  
  buildBulkPullbackRows(items = []) {
    if (!Array.isArray(items)) {
      return [];
    }
  
    return items.map((item) => ({
      planId: item.planId ?? '',
      planInspectionNo: item.inspectionNo ?? '',
      timeRange: `${item.startTime ?? ''} - ${item.endTime ?? ''}`,
      workName: item.workName ?? '',
      status: item.planStatus || item.status || '',
    }));
  }
  
  buildBulkPullbackTableVM(rows = []) {
    return {
      title: '一括引き戻し',
      columns: [
        { key: 'timeRange', label: '時間', type: 'text', widthPx: 80 },
        { key: 'workName', label: '作業', type: 'text', widthPx: 160 },
        { key: 'status', label: '状態', type: 'text', widthPx: 70 },
        {
          key: 'toggle',
          label: '対象',
          type: 'slot',
          resolve: (row) => ({
            kind: 'toggle',
            textOn: 'ON',
            textOff: 'OFF',
            checked: true,
            action: 'toggle-register',
            payload: { rowId: row.rowId },
            disabled: false,
          }),
          widthPx: 50,
        },
      ],
      rows: rows.map((row, index) => ({
        rowId: String(index),
        timeRange: row.timeRange ?? '',
        workName: row.workName ?? '',
        status: row.status ?? '',
        enabled: true,
        disabled: false,
  
        dataset: {
          planId: row.planId,
          planInspectionNo: row.planInspectionNo ?? '',
        },
  
        uiAction: 'open-plan-detail',
        uiPayload: {
          inspectionNo: row.planInspectionNo ?? '',
          workName: row.workName ?? '',
        },
      })),
    };
  }
}