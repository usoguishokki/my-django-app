// static/js/inspectionStandards/application/edit/InspectionStandardEditSubmitService.js
import { ModalManger } from '../../../manager/ModalManger.js';
import {
  executeInspectionStandardDetailUpdate,
  executeInspectionStandardDetailCreate,
  executeInspectionStandardDetailDelete,
  executeInspectionStandardCommonItemsUpdate,
  fetchInspectionStandardCommonItemsPlanPreview,
  executeInspectionStandardCardAbolish,
} from '../../../api/fetchers.js';
import {
  buildInspectionStandardDetailUpdateValues,
  buildInspectionStandardDetailCreateValues,
  applyInspectionStandardEditedSectionToDetailVM,
  hasInspectionStandardDetailEditChanges,
  buildInspectionStandardCommonItemUpdateValues,
  hasInspectionStandardCommonItemChanges,
  buildInspectionStandardCommonItemChangeEntries,
  hasInspectionStandardPlanScheduleChangeEntries,
  applyInspectionStandardEditedCommonItemsToDetailVM,
} from '../../domain/InspectionStandardEditMapper.js';
import {
  renderInspectionStandardCommonItemConfirmHTML,
} from '../../ui/InspectionStandardCommonItemConfirmRenderer.js';
import {
  collectInspectionStandardEditFormValues,
  collectInspectionStandardCommonItemFormValues,
  setInspectionStandardEditSaveButtonState,
} from './InspectionStandardEditFormDomService.js';

import {
  validateInspectionStandardCommonItemForm,
} from './InspectionStandardCommonItemValidationService.js';

import {
  validateInspectionStandardAddItemRequiredFields,
  validateInspectionStandardDetailItemFields,
} from './InspectionStandardRequiredFieldValidationService.js';

import {
  collectInspectionStandardChangeReason,
  validateInspectionStandardChangeReason,
} from '../shared/InspectionStandardChangeReasonService.js';

export class InspectionStandardEditSubmitService {
  constructor({
    sectionEditSession,
    editPanelService,
    getActiveInspectionContext,
    getActiveDetailVM,
    setActiveDetailVM,
    getDrawers,
  } = {}) {
    this.sectionEditSession = sectionEditSession;
    this.editPanelService = editPanelService;
    this.getActiveInspectionContext = getActiveInspectionContext;
    this.getActiveDetailVM = getActiveDetailVM;
    this.setActiveDetailVM = setActiveDetailVM;
    this.getDrawers = getDrawers;
  }

  async saveSelectedEditSection({ element } = {}) {
    const formEl = element?.closest('[data-role="inspection-standard-edit-form"]');
  
    if (!formEl) return;
  
    const selectedSection = this.sectionEditSession?.getSelectedSection();
  
    if (!selectedSection) {
      this._showMessageModal({
        type: 'error',
        title: '変更対象が選択されていません',
        message: '左側のsectionを選択してから確定してください。',
      });
      return;
    }
  
    const inspectionNo = this._resolveInspectionNo();
    const detailId = selectedSection.id;
  
    if (!inspectionNo || !detailId) {
      this._showMessageModal({
        type: 'error',
        title: '保存できません',
        message: '保存に必要な情報が不足しています。',
      });
      return;
    }
  
    const values = collectInspectionStandardEditFormValues({ formEl });

    const validation = validateInspectionStandardDetailItemFields({
      formEl,
    });

    if (!validation.isValid) {
      this._showMessageModal({
        type: 'error',
        title: '入力内容を確認してください',
        message: String(validation.message ?? '').replaceAll('\n', '<br>'),
      });

      validation.firstInvalidControlEl?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });

      validation.firstInvalidControlEl?.focus?.();
      return;
    }
  
    const hasChanges = hasInspectionStandardDetailEditChanges({
      before: selectedSection,
      after: values,
    });
  
    if (!hasChanges) {
      this._showMessageModal({
        type: 'info',
        title: '変更はありません',
        message: '変更がないため保存しませんでした。',
      });
      return;
    }
    
    const changeReason = this._collectValidChangeReasonOrShow({
      formEl,
    });
    
    if (changeReason === null) return;
  
    setInspectionStandardEditSaveButtonState({
      button: element,
      isSaving: true,
    });
  
    this._showSavingModal();
  
    try {
      const response = await executeInspectionStandardDetailUpdate({
        inspectionNo,
        detailId,
        values: buildInspectionStandardDetailUpdateValues(values),
        changeReason,
      });
  
      if (response?.success === false) {
        throw new Error(response?.message || '保存に失敗しました。');
      }
  
      const savedDetail = response?.detail ?? {};
  
      const nextApplicableDevice =
        savedDetail?.applicable_device ?? values.applicableDevice;
  
      const nextSection = this.sectionEditSession.updateSelectedSection({
        applicableDevice: nextApplicableDevice,
        contents: savedDetail?.contents ?? values.contents,
        method: savedDetail?.method ?? values.method,
        standard: savedDetail?.standard ?? values.standard,
        inspectionManHours:
          savedDetail?.inspection_man_hours ?? values.inspectionManHours,
        status: savedDetail?.status ?? values.status ?? '',
        title: nextApplicableDevice || selectedSection.title,
      });
  
      if (nextSection) {
        const nextVM = applyInspectionStandardEditedSectionToDetailVM({
          vm: this.getActiveDetailVM?.(),
          section: nextSection,
        });
  
        this.setActiveDetailVM?.(nextVM);
  
        this.editPanelService?.renderEditSelectableDetailCards();
        this.editPanelService?.renderSelectedEditSectionForm({
          title: '項目変更',
          section: nextSection,
        });
      }
  
      ModalManger.closeModal();
  
      this._showMessageModal({
        type: 'success',
        title: '保存しました',
        message: '変更内容を保存しました。',
        onClose: () => {
          this._resetRightDrawerToEditOperationMenu();
        },
      });
    } catch (error) {
      console.error('[InspectionStandardEditSubmitService] update failed:', error);
  
      ModalManger.closeModal();
  
      this._showMessageModal({
        type: 'error',
        title: '保存に失敗しました',
        message: this._resolveErrorMessage({
          error,
          fallbackMessage: '時間をおいて再度実行してください。',
        }),
      });
    } finally {
      setInspectionStandardEditSaveButtonState({
        button: element,
        isSaving: false,
      });
    }
  }


  async saveAddItem({ element } = {}) {
    const formEl = element?.closest('[data-role="inspection-standard-edit-form"]');
  
    if (!formEl) return;
  
    const inspectionNo = this._resolveInspectionNo();
  
    if (!inspectionNo) {
      this._showMessageModal({
        type: 'error',
        title: '保存できません',
        message: '保存に必要な点検番号が不足しています。',
      });
      return;
    }
  
    const values = collectInspectionStandardEditFormValues({ formEl });

    const validation = validateInspectionStandardAddItemRequiredFields({
      formEl,
    });

    if (!validation.isValid) {
      this._showMessageModal({
        type: 'error',
        title: '入力内容を確認してください',
        message: String(validation.message ?? '').replaceAll('\n', '<br>'),
      });
    
      validation.firstInvalidControlEl?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
    
      validation.firstInvalidControlEl?.focus?.();
      return;
    }
    
    const changeReason = this._collectValidChangeReasonOrShow({
      formEl,
    });
    
    if (changeReason === null) return;
    
    setInspectionStandardEditSaveButtonState({
      button: element,
      isSaving: true,
    });
  
    this._showSavingModal();
  
    try {
      const response = await executeInspectionStandardDetailCreate({
        inspectionNo,
        values: buildInspectionStandardDetailCreateValues(values),
        changeReason,
      });
  
      if (response?.success === false) {
        throw new Error(response?.message || '追加に失敗しました。');
      }
  
      const savedDetail = response?.detail ?? {};
  
      const createdSection = this._buildSectionFromSavedDetail({
        savedDetail,
        fallbackValues: values,
      });
  
      const nextVM = this._appendInspectionStandardDetailSectionToVM({
        vm: this.getActiveDetailVM?.(),
        section: createdSection,
      });
  
      this.setActiveDetailVM?.(nextVM);
  
      ModalManger.closeModal();
  
      this._showMessageModal({
        type: 'success',
        title: '追加しました',
        message: '新しい項目を追加しました。',
        onClose: () => {
          this._resetRightDrawerToEditOperationMenu();
        },
      });
    } catch (error) {
      console.error('[InspectionStandardEditSubmitService] create failed:', error);
  
      ModalManger.closeModal();
  
      this._showMessageModal({
        type: 'error',
        title: '追加に失敗しました',
        message: this._resolveErrorMessage({
          error,
          fallbackMessage: '時間をおいて再度実行してください。',
        }),
      });
    } finally {
      setInspectionStandardEditSaveButtonState({
        button: element,
        isSaving: false,
      });
    }
  }


  async saveDeleteItem({ element } = {}) {
    const formEl = element?.closest('[data-role="inspection-standard-delete-form"]');
  
    if (!formEl) return;
  
    const selectedSection = this.sectionEditSession?.getSelectedSection();
    const inspectionNo = this._resolveInspectionNo();
    const detailId = formEl.dataset.sectionId || selectedSection?.id || '';
  
    if (!inspectionNo || !detailId) {
      this._showMessageModal({
        type: 'error',
        title: '削除できません',
        message: '削除に必要な情報が不足しています。',
      });
      return;
    }
    
    const changeReason = this._collectValidChangeReasonOrShow({
      formEl,
    });
    
    if (changeReason === null) return;
    
    const confirmed = await this._confirmDeleteItem({
      section: selectedSection,
    });
  
    setInspectionStandardEditSaveButtonState({
      button: element,
      isSaving: true,
    });
  
    this._showSavingModal();
  
    try {
      const response = await executeInspectionStandardDetailDelete({
        inspectionNo,
        detailId,
        changeReason,
      });
  
      if (response?.success === false) {
        throw new Error(response?.message || '削除に失敗しました。');
      }
  
      const deletedDetail = response?.detail ?? {};
      const deletedSectionId = String(deletedDetail?.id ?? detailId);
  
      const nextVM = this._removeInspectionStandardDetailSectionFromVM({
        vm: this.getActiveDetailVM?.(),
        sectionId: deletedSectionId,
      });
  
      this.setActiveDetailVM?.(nextVM);
      this.sectionEditSession?.reset?.();
  
      ModalManger.closeModal();
  
      this._showMessageModal({
        type: 'success',
        title: '削除しました',
        message: '選択した項目を削除しました。',
        onClose: () => {
          this._resetRightDrawerToEditOperationMenu();
        },
      });
    } catch (error) {
      console.error('[InspectionStandardEditSubmitService] delete failed:', error);
  
      ModalManger.closeModal();
  
      this._showMessageModal({
        type: 'error',
        title: '削除に失敗しました',
        message: '時間をおいて再度実行してください。',
      });
    } finally {
      setInspectionStandardEditSaveButtonState({
        button: element,
        isSaving: false,
      });
    }
  }

  async saveAbolishCard({ element } = {}) {
    const formEl = element?.closest(
      '[data-role="inspection-standard-card-abolish-form"]'
    );
  
    if (!formEl) {
      this._showMessageModal({
        type: 'error',
        title: '削除できません',
        message: '削除対象のカード情報が見つかりません。',
      });
      return;
    }
  
    const checkId = formEl.dataset.checkId;
    const inspectionNo = formEl.dataset.inspectionNo;
  
    if (!checkId || !inspectionNo) {
      this._showMessageModal({
        type: 'error',
        title: '削除できません',
        message: '削除に必要な情報が不足しています。',
      });
      return;
    }
    
    const changeReason = this._collectValidChangeReasonOrShow({
      formEl,
    });
    
    if (changeReason === null) return;
    
    const confirmed = await this._confirmAbolishCard({
      inspectionNo,
    });
  
    if (!confirmed) return;
  
    this._setSubmitButtonSaving({
      button: element,
      isSaving: true,
      savingLabel: '削除中...',
    });
  
    try {
      const response = await executeInspectionStandardCardAbolish({
        checkId,
        inspectionNo,
        changeReason,
      });
  
      if (response?.success === false) {
        throw new Error(response?.message || '点検カードの削除に失敗しました。');
      }
  
      this._showMessageModal({
        type: 'success',
        title: '削除が完了しました',
        message: this._buildAbolishCardSuccessMessage({
          card: response?.card,
        }),
      });
    } catch (error) {
      console.error('[InspectionStandardEditSubmitService] abolish card failed:', error);
  
      this._showMessageModal({
        type: 'error',
        title: '削除に失敗しました',
        message: this._resolveErrorMessage?.({
          error,
          fallbackMessage: '点検カードの削除に失敗しました。',
        }) ?? '点検カードの削除に失敗しました。',
      });
    } finally {
      this._setSubmitButtonSaving({
        button: element,
        isSaving: false,
      });
    }
  }

  
  async saveCommonItems({ element } = {}) {
    const formEl = element?.closest(
      '[data-role="inspection-standard-common-item-edit-form"]'
    );
  
    if (!formEl) return;
  
    const checkId = String(formEl.dataset.checkId ?? '').trim();
    const inspectionNo = String(formEl.dataset.inspectionNo ?? '').trim();
  
    if (!checkId || !inspectionNo) {
      this._showMessageModal({
        type: 'error',
        title: '保存できません',
        message: '保存に必要な情報が不足しています。',
      });
      return;
    }
  
    const values = collectInspectionStandardCommonItemFormValues({ formEl });
  
    const beforeCommonItems = this.getActiveDetailVM?.()?.commonItems ?? {};
  
    const hasChanges = hasInspectionStandardCommonItemChanges({
      before: beforeCommonItems,
      after: values,
    });

    if (!hasChanges) {
      this._showMessageModal({
        type: 'info',
        title: '変更はありません',
        message: '変更がないため保存しませんでした。',
      });
      return;
    }
    
    const validation = validateInspectionStandardCommonItemForm({
      formEl,
    });
    
    if (!validation.isValid) {
      this._showMessageModal({
        type: 'error',
        title: '入力内容を確認してください',
        message: validation.message,
      });
      return;
    }
    
    const changeReason = this._collectValidChangeReasonOrShow({
      formEl,
    });
    
    if (changeReason === null) return;
    
    const changeEntries = buildInspectionStandardCommonItemChangeEntries({
      before: beforeCommonItems,
      after: values,
    });
    
    const hasPlanScheduleChanges =
      hasInspectionStandardPlanScheduleChangeEntries(changeEntries);
    
    const planPreview = hasPlanScheduleChanges
      ? await this._fetchCommonItemPlanPreview({
          checkId,
          inspectionNo,
          values,
          changeReason,
        })
      : null;
    
    if (hasPlanScheduleChanges && !planPreview) {
      return;
    }
    
    const confirmed = await this._confirmCommonItemChanges({
      formEl,
      beforeCommonItems,
      afterValues: values,
      changeEntries,
      planPreview,
    });
    
    if (!confirmed) {
      return;
    }
    
    setInspectionStandardEditSaveButtonState({
      button: element,
      isSaving: true,
    });
  
    this._showSavingModal();
    try {
      const response = await executeInspectionStandardCommonItemsUpdate({
        checkId,
        inspectionNo,
        values: buildInspectionStandardCommonItemUpdateValues(values),
        changeReason,
      });
    
      if (response?.success === false) {
        throw new Error(response?.message || '保存に失敗しました。');
      }
    
      const savedCommonItems = response?.commonItems ?? values;
    
      const nextVM = applyInspectionStandardEditedCommonItemsToDetailVM({
        vm: this.getActiveDetailVM?.(),
        commonItems: savedCommonItems,
      });
    
      this.setActiveDetailVM?.(nextVM);
    
      ModalManger.closeModal();
    
      this._showMessageModal({
        type: 'success',
        title: '保存しました',
        message: '共通項目の変更内容を保存しました。',
        onClose: () => {
          this._resetRightDrawerToEditOperationMenu();
        },
      });
    } catch (error) {
      console.error('[InspectionStandardEditSubmitService] common items update failed:', error);
    
      ModalManger.closeModal();
    
      this._showMessageModal({
        type: 'error',
        title: '保存に失敗しました',
        message: '時間をおいて再度実行してください。',
      });
    } finally {
      setInspectionStandardEditSaveButtonState({
        button: element,
        isSaving: false,
      });
    }
  }

  async _confirmAbolishCard({ inspectionNo } = {}) {
    if (typeof ModalManger?.confirm === 'function') {
      return ModalManger.confirm({
        title: 'カード削除の確認',
        message: `点検番号「${inspectionNo}」のカードを削除します。よろしいですか？`,
        confirmLabel: '削除',
        cancelLabel: 'キャンセル',
        type: 'danger',
      });
    }
  
    return window.confirm(
      `点検番号「${inspectionNo}」のカードを削除します。よろしいですか？`
    );
  }
  
  _buildAbolishCardSuccessMessage({ card } = {}) {
    const inspectionNo = card?.inspectionNo ?? '';
    const abolishedDetailCount = card?.abolishedDetailCount ?? 0;
    const deletedPlanCount = card?.deletedPlanCount ?? 0;
  
    return [
      inspectionNo ? `点検番号: ${inspectionNo}` : '',
      `廃止した点検項目: ${abolishedDetailCount}件`,
      `削除した未完了計画: ${deletedPlanCount}件`,
      '完了済みの計画は履歴として残しています。',
    ]
      .filter(Boolean)
      .join('<br>');
  }
  
  _setSubmitButtonSaving({
    button,
    isSaving,
    savingLabel = '処理中...',
  } = {}) {
    if (!button) return;
  
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent?.trim() || '確定';
    }
  
    button.disabled = Boolean(isSaving);
    button.classList.toggle('is-saving', Boolean(isSaving));
    button.textContent = isSaving
      ? savingLabel
      : button.dataset.defaultLabel;
  }

  async _confirmCommonItemChanges({
    formEl,
    beforeCommonItems = {},
    afterValues = {},
    changeEntries = [],
    planPreview = null,
  } = {}) {
    if (!Array.isArray(changeEntries) || changeEntries.length === 0) {
      return false;
    }
  
    const message = renderInspectionStandardCommonItemConfirmHTML({
      formEl,
      beforeCommonItems,
      afterValues,
      changeEntries,
      planPreview,
    });
  
    return ModalManger.showConfirmModal({
      message,
      color: 'default',
      confirmText: '確定',
      cancelText: 'キャンセル',
    });
  }


  async _fetchCommonItemPlanPreview({
    checkId,
    inspectionNo,
    values,
    changeReason,
  } = {}) {
    try {
      const response = await fetchInspectionStandardCommonItemsPlanPreview({
        checkId,
        inspectionNo,
        values: buildInspectionStandardCommonItemUpdateValues(values),
        changeReason,
      });
  
      if (response?.success === false) {
        throw new Error(response?.message || '計画日の取得に失敗しました。');
      }
  
      return response?.planPreview ?? null;
    } catch (error) {
      console.error(
        '[InspectionStandardEditSubmitService] plan preview failed:',
        error
      );
  
      this._showMessageModal({
        type: 'error',
        title: '計画日の取得に失敗しました',
        message: '周期変更後の計画日を確認できないため、保存を中止しました。',
      });
  
      return null;
    }
  }


  _buildSectionFromSavedDetail({
    savedDetail = {},
    fallbackValues = {},
  } = {}) {
    const applicableDevice =
      savedDetail?.applicable_device ?? fallbackValues.applicableDevice ?? '';
  
    return {
      id: String(savedDetail?.id ?? ''),
      title: applicableDevice || '新規項目',
      applicableDevice,
      contents: savedDetail?.contents ?? fallbackValues.contents ?? '',
      method: savedDetail?.method ?? fallbackValues.method ?? '',
      standard: savedDetail?.standard ?? fallbackValues.standard ?? '',
      inspectionManHours:
        savedDetail?.inspection_man_hours ?? fallbackValues.inspectionManHours ?? '',
      status: savedDetail?.status ?? fallbackValues.status ?? '通常',
    };
  }


  async _confirmDeleteItem({
    section,
  } = {}) {
    const title = section?.applicableDevice || section?.title || '選択した項目';
  
    return ModalManger.showConfirmModal({
      message: `
        <div class="inspection-standard-message-modal inspection-standard-message-modal--warning">
          <div class="inspection-standard-message-modal__content">
            <div class="inspection-standard-message-modal__title">
              項目を削除します
            </div>
            <div class="inspection-standard-message-modal__text">
              「${title}」を削除します。削除すると元に戻せません。よろしいですか？
            </div>
          </div>
        </div>
      `,
      color: 'danger',
      confirmText: '削除',
      cancelText: 'キャンセル',
    });
  }
  
  _removeInspectionStandardDetailSectionFromVM({
    vm,
    sectionId,
  } = {}) {
    if (!vm || !sectionId) return vm;
  
    const targetId = String(sectionId);
  
    const currentSections = Array.isArray(vm.sections)
      ? vm.sections
      : [];
  
    return {
      ...vm,
      sections: currentSections.filter((section) => (
        String(section?.id ?? '') !== targetId
      )),
    };
  }
  
  
  _appendInspectionStandardDetailSectionToVM({
    vm,
    section,
  } = {}) {
    if (!vm || !section?.id) return vm;
  
    const currentSections = Array.isArray(vm.sections)
      ? vm.sections
      : [];
  
    return {
      ...vm,
      sections: [
        ...currentSections,
        section,
      ],
    };
  }

  _resolveInspectionNo() {
    const context = this.sectionEditSession?.getContext?.() ?? {};
    const activeContext = this.getActiveInspectionContext?.() ?? {};

    return context?.inspectionNo || activeContext?.inspectionNo || '';
  }

  _collectValidChangeReasonOrShow({
    formEl,
  } = {}) {
    const validation = validateInspectionStandardChangeReason({
      rootEl: formEl,
    });
  
    if (!validation.isValid) {
      this._showMessageModal({
        type: 'error',
        title: '変更理由を入力してください',
        message: String(validation.message ?? '').replaceAll('\n', '<br>'),
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

  _resolveErrorMessage({
    error,
    fallbackMessage = '処理に失敗しました。',
  } = {}) {
    return String(
      error?.data?.detail ||
      error?.data?.message ||
      error?.response?.detail ||
      error?.response?.message ||
      error?.detail ||
      error?.message ||
      fallbackMessage
    );
  }

  _showSavingModal() {
    ModalManger.showModal(
      `
        <div class="inspection-standard-message-modal inspection-standard-message-modal--loading">
          <div class="inspection-standard-message-modal__spinner" aria-hidden="true"></div>
  
          <div class="inspection-standard-message-modal__content">
            <div class="inspection-standard-message-modal__title">
              変更内容を保存しています
            </div>
            <div class="inspection-standard-message-modal__text">
              更新が完了するまでお待ちください。
            </div>
          </div>
        </div>
      `,
      'default',
      false
    );
  }

  _resetRightDrawerToEditOperationMenu() {
    this.editPanelService?.renderDetailCardsEditStandbyMode?.();
    this.editPanelService?.renderEditOperationMenuPanel?.();
  }
  
  _showMessageModal({
    type = 'info',
    title = '',
    message = '',
    onClose = () => {},
  } = {}) {
    ModalManger.showModal(
      `
        <div class="inspection-standard-message-modal inspection-standard-message-modal--${type}">
          <div class="inspection-standard-message-modal__icon" aria-hidden="true"></div>
  
          <div class="inspection-standard-message-modal__content">
            <div class="inspection-standard-message-modal__title">
              ${title}
            </div>
            <div class="inspection-standard-message-modal__text">
              ${message}
            </div>
          </div>
        </div>
      `,
      'default',
      false,
      onClose
    );
  }
}