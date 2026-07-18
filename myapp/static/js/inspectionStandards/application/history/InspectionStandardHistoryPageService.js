// static/js/inspectionStandards/application/history/InspectionStandardHistoryPageService.js

import {
  fetchInspectionStandardHistoryList,
} from '../../../api/fetchers.js';

import {
  INSPECTION_STANDARD_DRAWER_ACTIONS,
} from '../../domain/InspectionStandardActions.js';

import { UIManger } from '../../../manager/UIManger.js';

import {
  formatJapaneseDateLabel,
} from '../../../utils/dateTime.js';

const HISTORY_PAGE_SIZE = 7;

export class InspectionStandardHistoryPageService {
  constructor({
    rootEl,
    spinnerId = 'inspectionStandardHistorySpinner',
  } = {}) {
    this.rootEl = rootEl;
    this.spinnerId = spinnerId;

    this.pageEl = null;
    this.titleEl = null;
    this.emptyEl = null;
    this.tableScrollEl = null;
    this.tbodyEl = null;
    this.paginationEl = null;
    
    this.histories = [];
    this.currentFilters = {
      machine: '',
      controlNo: '',
    };
    this.currentPage = 1;
    this.pageSize = HISTORY_PAGE_SIZE;
    
    this.reqSeq = 0;
  }

  init() {
    this.pageEl = this.rootEl?.querySelector(
      '[data-role="inspection-standard-history-page"]'
    );

    this.titleEl = this.rootEl?.querySelector(
      '[data-role="inspection-standard-history-title"]'
    );

    this.emptyEl = this.rootEl?.querySelector(
      '[data-role="inspection-standard-history-empty"]'
    );
    
    this.tableScrollEl = this.rootEl?.querySelector(
      '[data-role="inspection-standard-history-table-scroll"]'
    );
    
    this.tbodyEl = this.rootEl?.querySelector(
      '[data-role="inspection-standard-history-tbody"]'
    );
    
    this.paginationEl = this.rootEl?.querySelector(
      '[data-role="inspection-standard-history-pagination"]'
    );
    
    this.paginationEl?.addEventListener('click', (event) => {
      this._handlePaginationClick(event);
    });

    if (
      !this.pageEl ||
      !this.titleEl ||
      !this.emptyEl ||
      !this.tableScrollEl ||
      !this.tbodyEl ||
      !this.paginationEl
    ) {
      console.warn('[InspectionStandardHistoryPageService] required elements not found');
    }
  }

  async load({
    filters = {},
  } = {}) {
    const normalizedFilters = this._normalizeFilters(filters);

    this.reqSeq += 1;
    const currentSeq = this.reqSeq;

    this._showLoading({
      filters: normalizedFilters,
    });

    try {
      const response = await fetchInspectionStandardHistoryList({
        machine: normalizedFilters.machine,
        controlNo: normalizedFilters.controlNo,
      });

      if (currentSeq !== this.reqSeq) return;

      const histories = Array.isArray(response?.histories)
        ? response.histories
        : [];

      this.histories = histories;
      this.currentFilters = normalizedFilters;
      this.currentPage = 1;
      
      this._renderCurrentPage();
    } catch (error) {
      console.error('[InspectionStandardHistoryPageService] load failed:', error);

      if (currentSeq !== this.reqSeq) return;

      this._showError();
    } finally {
      if (currentSeq === this.reqSeq) {
        this._hideSpinner();
      }
    }
  }

  async reload({
    filters = {},
  } = {}) {
    await this.load({
      filters,
    });
  }

  clear() {
    this.histories = [];
    this.currentFilters = {
      machine: '',
      controlNo: '',
    };
    this.currentPage = 1;
  
    if (this.tbodyEl) {
      this.tbodyEl.innerHTML = '';
    }
  
    if (this.paginationEl) {
      this.paginationEl.hidden = true;
      this.paginationEl.innerHTML = '';
    }
  
    this._showEmpty('履歴確認を押すと変更履歴を表示します。');
  
    if (this.titleEl) {
      this.titleEl.textContent = '変更履歴';
    }
  }

  _renderCurrentPage() {
    const totalCount = this.histories.length;
  
    if (!totalCount) {
      this._setSummary({
        filters: this.currentFilters,
        totalCount: 0,
        startNo: 0,
        endNo: 0,
      });
  
      this._showEmpty('変更履歴がありません。');
      this._renderPagination();
      return;
    }
  
    const pageCount = this._getPageCount();
    this.currentPage = Math.min(
      Math.max(this.currentPage, 1),
      pageCount
    );
  
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, totalCount);
    const pageHistories = this.histories.slice(startIndex, endIndex);
  
    this._setSummary({
      filters: this.currentFilters,
      totalCount,
      startNo: startIndex + 1,
      endNo: endIndex,
    });
  
    if (this.emptyEl) {
      this.emptyEl.hidden = true;
    }
  
    if (this.tableScrollEl) {
      this.tableScrollEl.hidden = false;
    }
  
    if (this.tbodyEl) {
      this.tbodyEl.innerHTML = pageHistories
        .map((history) => this._renderRow(history))
        .join('');
    }
  
    this._renderPagination();
  }

  _getPageCount() {
    return Math.max(
      1,
      Math.ceil(this.histories.length / this.pageSize)
    );
  }

  _renderPagination() {
    if (!this.paginationEl) return;
  
    const totalCount = this.histories.length;
    const pageCount = this._getPageCount();
  
    if (totalCount <= this.pageSize) {
      this.paginationEl.hidden = true;
      this.paginationEl.innerHTML = '';
      return;
    }
  
    this.paginationEl.hidden = false;
  
    this.paginationEl.innerHTML = `
      <button
        type="button"
        class="inspection-standard-history-pagination__button"
        data-history-page="${this.currentPage - 1}"
        ${this.currentPage <= 1 ? 'disabled aria-disabled="true"' : ''}
      >
        前へ
      </button>
  
      <div class="inspection-standard-history-pagination__pages">
        ${this._buildPaginationPageNumbers(pageCount)}
      </div>
  
      <button
        type="button"
        class="inspection-standard-history-pagination__button"
        data-history-page="${this.currentPage + 1}"
        ${this.currentPage >= pageCount ? 'disabled aria-disabled="true"' : ''}
      >
        次へ
      </button>
    `;
  }

  _buildPaginationPageNumbers(pageCount) {
    return Array.from({ length: pageCount }, (_, index) => {
      const page = index + 1;
      const isActive = page === this.currentPage;
  
      return `
        <button
          type="button"
          class="inspection-standard-history-pagination__page${isActive ? ' is-active' : ''}"
          data-history-page="${this._escape(page)}"
          ${isActive ? 'aria-current="page"' : ''}
        >
          ${this._escape(page)}
        </button>
      `;
    }).join('');
  }

  _handlePaginationClick(event) {
    const buttonEl = event.target?.closest?.('[data-history-page]');
  
    if (!buttonEl || buttonEl.disabled) return;
  
    const nextPage = Number(buttonEl.dataset.historyPage);
  
    if (!Number.isFinite(nextPage)) return;
  
    const pageCount = this._getPageCount();
  
    this.currentPage = Math.min(
      Math.max(nextPage, 1),
      pageCount
    );
  
    this._renderCurrentPage();
  
    this.tableScrollEl?.scrollTo?.({
      top: 0,
      behavior: 'smooth',
    });
  }

  _renderRow(history = {}) {
    const row = this._buildRow(history);
  
    const payload = {
      historyId: row.historyId,
    };
  
    const rowClassName = [
      'inspection-standard-history-table__row',
      row.cancelled
        ? 'inspection-standard-history-table__row--cancelled'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  
    const cancellationMeta = [
      row.cancelledByName
        ? `取消者: ${row.cancelledByName}`
        : '',
      row.cancelledAtText
        ? `取消日時: ${row.cancelledAtText}`
        : '',
    ]
      .filter(Boolean)
      .join(' / ');
  
    const cancellationLabel = cancellationMeta
      ? `取消済み（${cancellationMeta}）`
      : '取消済みの変更履歴です。';
  
    const interactionAttributes = row.cancelled
      ? `
          data-cancelled="true"
          aria-disabled="true"
          aria-label="${this._escape(cancellationLabel)}"
          title="${this._escape(cancellationLabel)}"
        `
      : `
          data-cancelled="false"
          data-ui-action="${this._escape(
            INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_HISTORY_DETAIL
          )}"
          data-ui-payload="${this._escape(JSON.stringify(payload))}"
          tabindex="0"
          role="button"
          aria-label="変更履歴の詳細を表示"
        `;
  
    return `
      <tr
        class="${this._escape(rowClassName)}"
        data-history-id="${this._escape(row.historyId)}"
        ${interactionAttributes}
      >
        <td>${this._escape(row.historyId)}</td>
        <td>${this._escape(row.operatedAtText)}</td>
        <td>${this._escape(row.machine)}</td>
        <td>${this._escape(row.inspectionNo)}</td>
  
        <td>
          <div class="inspection-standard-history-table__summaryCell">
            ${row.cancelled
              ? `
                <span class="inspection-standard-history-table__cancelledBadge">
                  取消済み
                </span>
              `
              : ''
            }
          
            <span class="inspection-standard-history-table__summaryText">
              ${this._escape(row.summary)}
            </span>
          </div>
        </td>
  
        <td>${this._escape(row.operatedByName)}</td>
        <td>${this._escape(row.teamLeaderApprovalName)}</td>
        <td>${this._escape(row.leaderApprovalName)}</td>
        <td>${this._escape(row.foremanApprovalName)}</td>
      </tr>
    `;
  }

  _buildRow(history = {}) {
    return {
      historyId: this._pickText(
        history.id,
        history.historyId,
        history.history_id
      ),
      operatedAtText: this._formatOperatedAtText(
        this._pickText(
          history.operatedAtText,
          history.operated_at_text,
          history.operatedAt,
          history.operated_at
        )
      ),
      
      machine: this._pickText(
        history.machine,
        history.machineSnapshot,
        history.machine_snapshot,
        history.control?.machine
      ),
      controlNo: this._pickText(
        history.controlNo,
        history.control_no,
        history.controlNoSnapshot,
        history.control_no_snapshot,
        history.control?.controlNo,
        history.control?.control_no
      ),
      inspectionNo: this._pickText(
        history.inspectionNo,
        history.inspection_no,
        history.inspectionNoSnapshot,
        history.inspection_no_snapshot
      ),
      summary: this._pickText(
        history.summary,
        history.description,
        history.message,
        history.targetSummary,
        history.target_summary
      ),
      operatedByName: this._pickText(
        history.operatedByName,
        history.operated_by_name,
        history.operatedBy,
        history.operated_by
      ),
      teamLeaderApprovalName: this._formatApprovalName(
        history.teamLeaderApproval ?? history.team_leader_approval,
        history.teamLeaderApprovedByName,
        history.team_leader_approved_by_name
      ),
      leaderApprovalName: this._formatApprovalName(
        history.leaderApproval ?? history.leader_approval,
        history.leaderApprovedByName,
        history.leader_approved_by_name
      ),
      foremanApprovalName: this._formatApprovalName(
        history.foremanApproval ?? history.foreman_approval,
        history.foremanApprovedByName,
        history.foreman_approved_by_name
      ),
      cancelled: this._isCancelledHistory(history),

      cancelledByName: this._pickText(
        history.cancelledByName,
        history.cancelled_by_name
      ),
      
      cancelledAtText: this._formatOperatedAtText(
        this._pickText(
          history.cancelledAtText,
          history.cancelled_at_text,
          history.cancelledAt,
          history.cancelled_at
        )
      ),
    };
  }

  _showLoading({
    filters = {},
  } = {}) {
    this._setSummary({
      filters,
      loading: true,
    });

    if (this.emptyEl) {
      this.emptyEl.hidden = false;
      this.emptyEl.textContent = '変更履歴を読み込んでいます…';
    }

    if (this.tableScrollEl) {
      this.tableScrollEl.hidden = true;
    }

    if (this.tbodyEl) {
      this.tbodyEl.innerHTML = '';
    }

    UIManger.showSpinner?.({
      container: this.pageEl,
      id: this.spinnerId,
      size: 'lg',
      title: '変更履歴を取得中…',
      sub: 'データを読み込んでいます',
      delayMs: 300,
    });
  }

  _showError() {
    this._showEmpty('変更履歴の取得に失敗しました。');
  }

  _showEmpty(message) {
    if (this.emptyEl) {
      this.emptyEl.hidden = false;
      this.emptyEl.textContent = message;
    }

    if (this.tableScrollEl) {
      this.tableScrollEl.hidden = true;
    }

    if (this.tbodyEl) {
      this.tbodyEl.innerHTML = '';
    }
  }

  _setSummary({
    totalCount = null,
    startNo = null,
    endNo = null,
    loading = false,
  } = {}) {
    if (!this.titleEl) return;
  
    if (loading) {
      this.titleEl.textContent = '変更履歴（読み込み中…）';
      return;
    }
  
    if (!totalCount) {
      this.titleEl.textContent = '変更履歴（0件）';
      return;
    }
  
    this.titleEl.textContent = `変更履歴（${startNo}～${endNo}件）`;
  }

  _normalizeFilters(filters = {}) {
    return {
      machine: String(filters?.machine ?? '').trim(),
      controlNo: String(
        filters?.controlNo ??
        filters?.control_no ??
        ''
      ).trim(),
    };
  }

  _formatOperatedAtText(value) {
    const formatted = formatJapaneseDateLabel(value);
  
    if (formatted) {
      return formatted;
    }
  
    return String(value ?? '').trim();
  }

  _isCancelledHistory(history = {}) {
    const explicitValue =
      history.cancelled ??
      history.isCancelled ??
      history.is_cancelled;
  
    if (typeof explicitValue === 'boolean') {
      return explicitValue;
    }
  
    const normalizedValue = String(
      explicitValue ?? ''
    ).trim().toLowerCase();
  
    if (normalizedValue === 'true' || normalizedValue === '1') {
      return true;
    }
  
    if (normalizedValue === 'false' || normalizedValue === '0') {
      return false;
    }
  
    return Boolean(
      this._pickText(
        history.cancelledAt,
        history.cancelled_at,
        history.cancelledAtText,
        history.cancelled_at_text
      )
    );
  }

  _formatApprovalName(approval, ...fallbackNames) {
    const approvedByName = this._pickText(
      approval?.approvedByName,
      approval?.approved_by_name,
      ...fallbackNames
    );

    if (approvedByName) {
      return approvedByName;
    }

    return '未承認';
  }

  _pickText(...values) {
    const foundValue = values.find((value) => {
      const text = String(value ?? '').trim();
      return text;
    });

    return String(foundValue ?? '').trim();
  }

  _escape(value) {
    return UIManger.escapeHtml(String(value ?? ''));
  }

  _hideSpinner() {
    UIManger.hideSpinner?.({
      id: this.spinnerId,
    });
  }
}