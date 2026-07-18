// static/js/inspectionStandards/application/history/InspectionStandardHistoryDetailDrawerService.js
import { ModalManger } from '../../../manager/ModalManger.js';

import {
  fetchInspectionStandardHistoryDetail,
  executeInspectionStandardHistoryApproval,
  executeInspectionStandardHistoryNoteUpdate,
  executeInspectionStandardHistoryCancellation,
} from '../../../api/fetchers.js';

import {
  renderInspectionStandardHistoryDetailHTML,
} from '../../ui/InspectionStandardHistoryDetailRenderer.js';

export class InspectionStandardHistoryDetailDrawerService {
  constructor({
    getDrawers,
    panelName = 'cell',
    onApproved = null,
    onNoteUpdated = null,
    onCancelled = null,
  } = {}) {
    this.getDrawers = getDrawers;
    this.panelName = panelName;
  
    this.onApproved = typeof onApproved === 'function'
      ? onApproved
      : null;
  
    this.onNoteUpdated = typeof onNoteUpdated === 'function'
      ? onNoteUpdated
      : null;
  
    this.onCancelled = typeof onCancelled === 'function'
      ? onCancelled
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

      this._renderHistory(history);
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


  startNoteEdit({
    element,
  } = {}) {
    const noteRootEl = this._getNoteRoot(element);
  
    if (!noteRootEl) return;
  
    if (noteRootEl.dataset.noteEditEnabled !== 'true') {
      return;
    }
  
    const textareaEl = noteRootEl.querySelector(
      '[data-role="inspection-standard-history-note-input"]'
    );
  
    if (!textareaEl) return;
  
    textareaEl.value = this._getOriginalNote(noteRootEl);
  
    this._setNoteEditMode({
      noteRootEl,
      editing: true,
    });
  
    this._setNoteMessage(noteRootEl, '');
  
    textareaEl.focus();
  
    const cursorPosition = textareaEl.value.length;
  
    textareaEl.setSelectionRange?.(
      cursorPosition,
      cursorPosition
    );
  }


  cancelNoteEdit({
    element,
  } = {}) {
    const noteRootEl = this._getNoteRoot(element);
  
    if (!noteRootEl) return;
  
    const textareaEl = noteRootEl.querySelector(
      '[data-role="inspection-standard-history-note-input"]'
    );
  
    if (textareaEl) {
      textareaEl.value = this._getOriginalNote(noteRootEl);
    }
  
    this._setNoteEditMode({
      noteRootEl,
      editing: false,
    });
  
    this._setNoteMessage(noteRootEl, '');
  }

  async saveNote({
    element,
    payload = {},
  } = {}) {
    if (!element || element.disabled) return;
  
    const noteRootEl = this._getNoteRoot(element);
  
    if (!noteRootEl) return;
  
    const textareaEl = noteRootEl.querySelector(
      '[data-role="inspection-standard-history-note-input"]'
    );
  
    if (!textareaEl) return;
  
    const historyId = this._pickText(
      payload?.historyId,
      noteRootEl.dataset.historyId
    );
  
    const note = String(
      textareaEl.value ?? ''
    ).trim();
  
    const originalNote = this
      ._getOriginalNote(noteRootEl)
      .trim();
  
    if (!historyId) {
      this._setNoteMessage(
        noteRootEl,
        '更新対象の履歴を特定できませんでした。',
        'error'
      );
      return;
    }
  
    if (!note) {
      this._setNoteMessage(
        noteRootEl,
        '変更理由を入力してください。',
        'error'
      );
      textareaEl.focus();
      return;
    }
  
    if (note.length > 300) {
      this._setNoteMessage(
        noteRootEl,
        '変更理由は300文字以内で入力してください。',
        'error'
      );
      textareaEl.focus();
      return;
    }
  
    if (note === originalNote) {
      this._setNoteEditMode({
        noteRootEl,
        editing: false,
      });
  
      this._setNoteMessage(noteRootEl, '');
      return;
    }
  
    const originalButtonText = element.textContent;
  
    this._setNoteProcessing({
      noteRootEl,
      processing: true,
      saveButtonEl: element,
      saveButtonLabel: '保存中…',
    });
  
    try {
      const response =
        await executeInspectionStandardHistoryNoteUpdate({
          historyId,
          note,
        });
  
      const history = response?.history ?? response ?? {};
  
      this._renderHistory(history);
  
      await this.onNoteUpdated?.({
        history,
      });
    } catch (error) {
      console.error(
        '[InspectionStandardHistoryDetailDrawerService] note update failed:',
        error
      );
  
      this._setNoteMessage(
        noteRootEl,
        this._getErrorMessage(error) ||
          '変更理由の更新に失敗しました。',
        'error'
      );
  
      this._setNoteProcessing({
        noteRootEl,
        processing: false,
        saveButtonEl: element,
        saveButtonLabel: originalButtonText,
      });
    }
  }


  async cancelHistory({
    element,
    payload = {},
  } = {}) {
    if (!element || element.disabled) return;
  
    const historyId = this._pickText(
      payload?.historyId,
      element.dataset.historyId
    );
  
    if (!historyId) {
      this._setCancellationMessage({
        element,
        message: '取消対象の変更履歴を特定できませんでした。',
        type: 'error',
      });
      return;
    }
  
    const confirmed = await ModalManger.showConfirmModal({
      message: `
        <div class="inspection-standard-history-cancel-confirm">
          <p>
            この変更履歴を取り消しますか？
          </p>
          <p>
            点検基準書の変更内容そのものは元に戻りません。
          </p>
          <p>
            取り消し後、この履歴は承認・変更理由編集・詳細操作ができなくなります。
          </p>
        </div>
      `,
      color: 'default',
      confirmText: '取り消す',
      cancelText: '戻る',
    });
  
    if (!confirmed) return;
  
    const originalButtonText = element.textContent;
  
    this._setCancellationProcessing({
      buttonEl: element,
      processing: true,
      label: '取消中…',
    });
  
    try {
      const response =
        await executeInspectionStandardHistoryCancellation({
          historyId,
        });
  
      const history = response?.history ?? response ?? {};
  
      this._closeHistoryDetailDrawer();
  
      try {
        await this.onCancelled?.({
          history,
        });
      } catch (reloadError) {
        console.error(
          '[InspectionStandardHistoryDetailDrawerService] history reload after cancellation failed:',
          reloadError
        );
      }
    } catch (error) {
      console.error(
        '[InspectionStandardHistoryDetailDrawerService] cancellation failed:',
        error
      );
  
      this._setCancellationMessage({
        element,
        message:
          this._getErrorMessage(error) ||
          '変更履歴の取り消しに失敗しました。',
        type: 'error',
      });
  
      this._setCancellationProcessing({
        buttonEl: element,
        processing: false,
        label: originalButtonText,
      });
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

      this._renderHistory(history);

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


  _closeHistoryDetailDrawer() {
    const drawers = this._drawers();
    const panel = this._panel();
  
    if (!drawers || !panel) return;
  
    // 取消処理中に別の詳細取得レスポンスが返ってきても、
    // 閉じたDrawerを再描画しないよう無効化する。
    this.reqSeq += 1;
  
    panel.setWide?.(false);
    panel.clearTableTop?.();
    panel.clearTable?.();
    panel.clearBody?.();
  
    // 現在の詳細パネルと、それ以降のパネルを閉じる。
    drawers.closeFrom?.(this.panelName);
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


  _renderHistory(history = {}) {
    const panel = this._panel();
  
    if (!panel) return;
  
    panel.setTitle?.(this._buildTitle(history));
    panel.showBody?.();
    panel.setBodyHtml?.(
      renderInspectionStandardHistoryDetailHTML({
        history,
        currentUserJobTitle: this._getCurrentUserJobTitle(),
      })
    );
  }


  _getNoteRoot(element) {
    return element?.closest?.(
      '[data-role="inspection-standard-history-note"]'
    ) ?? null;
  }


  _getOriginalNote(noteRootEl) {
    const encodedNote = String(
      noteRootEl?.dataset?.originalNote ?? ''
    );
  
    try {
      return decodeURIComponent(encodedNote);
    } catch {
      return encodedNote;
    }
  }
  
  
  _setNoteEditMode({
    noteRootEl,
    editing,
  } = {}) {
    if (!noteRootEl) return;
  
    const displayEl = noteRootEl.querySelector(
      '[data-role="inspection-standard-history-note-display"]'
    );
  
    const editorEl = noteRootEl.querySelector(
      '[data-role="inspection-standard-history-note-editor"]'
    );
  
    const isEditing = Boolean(editing);
  
    noteRootEl.dataset.editing =
      isEditing ? 'true' : 'false';
  
    if (displayEl) {
      displayEl.hidden = isEditing;
    }
  
    if (editorEl) {
      editorEl.hidden = !isEditing;
    }
  }
  
  
  _setNoteProcessing({
    noteRootEl,
    processing,
    saveButtonEl,
    saveButtonLabel,
  } = {}) {
    if (!noteRootEl) return;
  
    const isProcessing = Boolean(processing);
  
    const textareaEl = noteRootEl.querySelector(
      '[data-role="inspection-standard-history-note-input"]'
    );
  
    if (textareaEl) {
      textareaEl.disabled = isProcessing;
    }
  
    noteRootEl
      .querySelectorAll(
        '[data-role="inspection-standard-history-note-action"]'
      )
      .forEach((buttonEl) => {
        buttonEl.disabled = isProcessing;
        buttonEl.setAttribute(
          'aria-disabled',
          isProcessing ? 'true' : 'false'
        );
      });
  
    if (saveButtonEl && saveButtonLabel) {
      saveButtonEl.textContent = saveButtonLabel;
    }
  }
  
  
  _setNoteMessage(
    noteRootEl,
    message,
    type = 'info'
  ) {
    const messageEl = noteRootEl?.querySelector(
      '[data-role="inspection-standard-history-note-message"]'
    );
  
    if (!messageEl) return;
  
    messageEl.textContent = String(message ?? '').trim();
    messageEl.dataset.type = type;
  }
  

  _setCancellationMessage({
    element,
    message,
    type = 'info',
  } = {}) {
    const rootEl = element?.closest?.(
      '[data-role="inspection-standard-history-cancellation"]'
    );
  
    const messageEl = rootEl?.querySelector(
      '[data-role="inspection-standard-history-cancellation-message"]'
    );
  
    if (!messageEl) return;
  
    messageEl.textContent = String(message ?? '').trim();
    messageEl.dataset.type = type;
  }


  _setCancellationProcessing({
    buttonEl,
    processing,
    label,
  } = {}) {
    if (!buttonEl) return;
  
    const isProcessing = Boolean(processing);
  
    buttonEl.disabled = isProcessing;
    buttonEl.setAttribute(
      'aria-disabled',
      isProcessing ? 'true' : 'false'
    );
  
    if (label) {
      buttonEl.textContent = label;
    }
  }
}