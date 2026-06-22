// static/js/inspectionStandards/application/history/InspectionStandardHistoryDetailDrawerService.js

import {
  fetchInspectionStandardHistoryDetail,
  executeInspectionStandardHistoryApproval,
} from '../../../api/fetchers.js';

import {
  renderInspectionStandardHistoryDetailHTML,
} from '../../ui/InspectionStandardHistoryDetailRenderer.js';

export class InspectionStandardHistoryDetailDrawerService {
  constructor({
    getDrawers,
    panelName = 'cell',
    onApproved = null,
  } = {}) {
    this.getDrawers = getDrawers;
    this.panelName = panelName;
    this.onApproved = typeof onApproved === 'function'
      ? onApproved
      : null;

    this.reqSeq = 0;
  }

  async open({
    historyId,
  } = {}) {
    const normalizedHistoryId = String(historyId ?? '').trim();

    if (!normalizedHistoryId) return;

    const drawers = this._drawers();
    const panel = this._panel();

    if (!drawers || !panel) return;

    this.reqSeq += 1;
    const currentSeq = this.reqSeq;

    this._showLoading({
      historyId: normalizedHistoryId,
    });

    try {
      const response = await fetchInspectionStandardHistoryDetail({
        historyId: normalizedHistoryId,
      });

      if (currentSeq !== this.reqSeq) return;

      const history = response?.history ?? response ?? {};
      const html = renderInspectionStandardHistoryDetailHTML({
        history,
        currentUserJobTitle: this._getCurrentUserJobTitle(),
      });

      panel.setTitle?.(this._buildTitle(history));
      panel.showBody?.();
      panel.setBodyHtml?.(html);
    } catch (error) {
      console.error('[InspectionStandardHistoryDetailDrawerService] load failed:', error);

      if (currentSeq !== this.reqSeq) return;

      panel.setTitle?.('変更履歴詳細（エラー）');
      panel.showBody?.();
      panel.setBodyHtml?.(`
        <p class="drawer__placeholder">
          変更履歴詳細の取得に失敗しました。
        </p>
      `);
    }
  }

  handleApprovalConfirmChange({
    element,
  } = {}) {
    const approvalRootEl = element?.closest?.(
      '[data-role="inspection-standard-history-approval"]'
    );

    if (!approvalRootEl) return;

    const checked = Boolean(element?.checked);

    approvalRootEl
      .querySelectorAll(
        '[data-role="inspection-standard-history-approval-button"][data-approval-enabled="true"]'
      )
      .forEach((buttonEl) => {
        buttonEl.disabled = !checked;
        buttonEl.setAttribute(
          'aria-disabled',
          checked ? 'false' : 'true'
        );
      });
  }

  async approve({
    element,
    payload = {},
  } = {}) {
    if (!element || element.disabled) return;

    const approvalRootEl = element.closest(
      '[data-role="inspection-standard-history-approval"]'
    );

    const confirmEl = approvalRootEl?.querySelector(
      '[data-role="inspection-standard-history-approval-confirm"]'
    );

    if (!confirmEl?.checked) {
      this._setApprovalMessage(
        approvalRootEl,
        '変更内容を確認してから承認してください。'
      );
      return;
    }

    const historyId = String(payload?.historyId ?? '').trim();
    const approvalRole = String(payload?.approvalRole ?? '').trim();

    if (!historyId || !approvalRole) {
      this._setApprovalMessage(
        approvalRootEl,
        '承認対象を特定できませんでした。'
      );
      return;
    }

    const originalText = element.textContent;
    this._setApprovalProcessing({
      approvalRootEl,
      buttonEl: element,
      processing: true,
      label: '承認中…',
    });

    try {
      const response = await executeInspectionStandardHistoryApproval({
        historyId,
        approvalRole,
      });

      const history = response?.history ?? response ?? {};
      const panel = this._panel();

      panel?.setTitle?.(this._buildTitle(history));
      panel?.showBody?.();
      panel?.setBodyHtml?.(
        renderInspectionStandardHistoryDetailHTML({
          history,
          currentUserJobTitle: this._getCurrentUserJobTitle(),
        })
      );

      await this.onApproved?.({
        history,
        approvalRole,
      });
    } catch (error) {
      console.error('[InspectionStandardHistoryDetailDrawerService] approve failed:', error);

      this._setApprovalMessage(
        approvalRootEl,
        this._getErrorMessage(error) || '承認に失敗しました。'
      );

      this._setApprovalProcessing({
        approvalRootEl,
        buttonEl: element,
        processing: false,
        label: originalText,
      });
    }
  }

  _showLoading({
    historyId,
  } = {}) {
    const drawers = this._drawers();
    const panel = this._panel();

    if (!drawers || !panel) return;

    drawers.openToLevel(1);

    panel.setWide?.(true);
    panel.setTitle?.('変更履歴詳細（読み込み中…）');

    panel.clearTableTop?.();
    panel.clearTable?.();
    panel.clearBody?.();

    panel.showBody?.();
    panel.setBodyHtml?.(`
      <p class="drawer__placeholder">
        変更履歴詳細を読み込んでいます…
      </p>
    `);
  }

  _buildTitle(history = {}) {
    const machine = this._pickText(
      history.machine,
      history.machineSnapshot,
      history.machine_snapshot
    );
  
    const inspectionNo = this._pickText(
      history.inspectionNo,
      history.inspection_no,
      history.inspectionNoSnapshot,
      history.inspection_no_snapshot
    );
  
    const sourceLabel = this._pickText(
      history.sourceLabel,
      history.source_label,
      history.operationLabel,
      history.operation_label
    );
  
    const titleParts = [
      machine,
      inspectionNo,
      sourceLabel,
    ].filter(Boolean);
  
    if (titleParts.length) {
      return titleParts.join(' / ');
    }
  
    return '変更履歴詳細';
  }

  _getCurrentUserJobTitle() {
    const employeeEl = document.getElementById('employeeName');

    return this._pickText(
      employeeEl?.dataset?.jobTitle,
      employeeEl?.getAttribute?.('data-job-title')
    );
  }

  _setApprovalProcessing({
    approvalRootEl,
    buttonEl,
    processing,
    label,
  } = {}) {
    const confirmEl = approvalRootEl?.querySelector(
      '[data-role="inspection-standard-history-approval-confirm"]'
    );

    const confirmed = Boolean(confirmEl?.checked);

    approvalRootEl
      ?.querySelectorAll('[data-role="inspection-standard-history-approval-button"]')
      ?.forEach((approvalButtonEl) => {
        const approvalEnabled = approvalButtonEl.dataset.approvalEnabled === 'true';
        const disabled = processing || !approvalEnabled || !confirmed;

        approvalButtonEl.disabled = disabled;
        approvalButtonEl.setAttribute(
          'aria-disabled',
          disabled ? 'true' : 'false'
        );
      });

    if (buttonEl && label) {
      buttonEl.textContent = label;
    }
  }

  _setApprovalMessage(approvalRootEl, message) {
    const messageEl = approvalRootEl?.querySelector(
      '[data-role="inspection-standard-history-approval-message"]'
    );

    if (messageEl) {
      messageEl.textContent = String(message ?? '').trim();
    }
  }

  _getErrorMessage(error) {
    return this._pickText(
      error?.message,
      error?.detail,
      error?.response?.message,
      error?.response?.detail
    );
  }

  _pickText(...values) {
    const foundValue = values.find((value) => {
      const text = String(value ?? '').trim();
      return text;
    });

    return String(foundValue ?? '').trim();
  }

  _drawers() {
    return this.getDrawers?.() ?? null;
  }

  _panel() {
    return this._drawers()?.panel(this.panelName);
  }
}