// static/js/inspectionStandards/application/add/InspectionStandardCardAddSubmitService.js

import { ModalManger } from '../../../manager/ModalManger.js';
import { UIManger } from '../../../manager/UIManger.js';

import {
  executeInspectionStandardCardCreate,
} from '../../../api/fetchers.js';

import {
  buildInspectionStandardCardAddCommonValues,
  buildInspectionStandardCardAddDetailValues,
} from '../../domain/InspectionStandardEditMapper.js';

import {
  collectInspectionStandardChangeReason,
  validateInspectionStandardChangeReason,
} from '../shared/InspectionStandardChangeReasonService.js';

export class InspectionStandardCardAddSubmitService {
  async create({
    button,
    formEl,
    context = {},
    commonEntries = [],
    detailItems = [],
  } = {}) {
    const changeReason = this._collectValidChangeReasonOrShow({
      formEl,
    });
    
    if (changeReason === null) return null;
    
    const payload = this._buildPayload({
      context,
      commonEntries,
      detailItems,
      changeReason,
    });

    this._setSubmitButtonSaving({
      button,
      isSaving: true,
    });

    try {
      const response = await executeInspectionStandardCardCreate(payload);

      if (response?.success === false) {
        throw new Error(response?.message || '点検カードの追加に失敗しました。');
      }

      this._showSuccessModal({
        card: response?.card,
      });

      return response;
    } catch (error) {
      console.error('[InspectionStandardCardAddSubmitService] create failed:', error);

      this._showErrorModal({ error });

      return null;
    } finally {
      this._setSubmitButtonSaving({
        button,
        isSaving: false,
      });
    }
  }

  _buildPayload({
    context = {},
    commonEntries = [],
    detailItems = [],
    changeReason = '',
  } = {}) {
    const commonValues = this._entriesToFormValues(commonEntries);

    return {
      controlNo: String(context.controlNo ?? '').trim(),
      commonValues: buildInspectionStandardCardAddCommonValues(commonValues),
      detailItems: detailItems.map((item) => ({
        values: buildInspectionStandardCardAddDetailValues(
          this._entriesToFormValues(item.entries ?? [])
        ),
      })),
      changeReason,
    };
  }

  _entriesToFormValues(entries = []) {
    return entries.reduce((values, entry) => {
      const key = String(entry?.key ?? '').trim();

      if (!key) return values;

      values[key] = String(entry?.value ?? '').trim();

      return values;
    }, {});
  }

  _collectValidChangeReasonOrShow({
    formEl,
  } = {}) {
    const validation = validateInspectionStandardChangeReason({
      rootEl: formEl,
    });
  
    if (!validation.isValid) {
      this._showErrorModal({
        error: new Error(validation.message || '追加理由を入力してください。'),
      });
  
      validation.firstInvalidControlEl?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
  
      validation.firstInvalidControlEl?.focus?.();
  
      return null;
    }
  
    return collectInspectionStandardChangeReason({
      rootEl: formEl,
    });
  }

  _setSubmitButtonSaving({
    button,
    isSaving,
  } = {}) {
    if (!button) return;

    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent?.trim() || '確定';
    }

    button.disabled = Boolean(isSaving);
    button.classList.toggle('is-saving', Boolean(isSaving));
    button.textContent = isSaving
      ? '登録中...'
      : button.dataset.defaultLabel;
  }

  _showSuccessModal({ card } = {}) {
    const inspectionNo = UIManger.escapeHtml(
      String(card?.inspectionNo ?? '')
    );

    const message = inspectionNo
      ? `点検カードを追加しました。<br>点検番号: ${inspectionNo}`
      : '点検カードを追加しました。';

    ModalManger.showModal(
      `
        <div class="inspection-standard-message-modal inspection-standard-message-modal--success">
          <div class="inspection-standard-message-modal__icon" aria-hidden="true"></div>

          <div class="inspection-standard-message-modal__content">
            <div class="inspection-standard-message-modal__title">
              登録が完了しました
            </div>

            <div class="inspection-standard-message-modal__text">
              ${message}
            </div>
          </div>
        </div>
      `,
      'default',
      false
    );
  }

  _showErrorModal({ error } = {}) {
    const safeMessage = UIManger
      .escapeHtml(this._resolveErrorMessage({ error }))
      .replaceAll('\n', '<br>');

    ModalManger.showModal(
      `
        <div class="inspection-standard-message-modal inspection-standard-message-modal--error">
          <div class="inspection-standard-message-modal__icon" aria-hidden="true"></div>

          <div class="inspection-standard-message-modal__content">
            <div class="inspection-standard-message-modal__title">
              登録に失敗しました
            </div>

            <div class="inspection-standard-message-modal__text">
              ${safeMessage}
            </div>
          </div>
        </div>
      `,
      'default',
      false
    );
  }

  _resolveErrorMessage({ error } = {}) {
    return String(
      error?.data?.detail ||
      error?.data?.message ||
      error?.response?.detail ||
      error?.response?.message ||
      error?.message ||
      '点検カードの追加に失敗しました。'
    );
  }
}