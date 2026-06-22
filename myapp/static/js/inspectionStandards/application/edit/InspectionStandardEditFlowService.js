// static/js/inspectionStandards/application/edit/InspectionStandardEditFlowService.js
import { fetchInspectionStandardCommonItemOptions } from '../../../api/fetchers.js';

import { INSPECTION_STANDARD_DRAWER_MODES } from '../../domain/InspectionStandardDrawerModes.js';
import { INSPECTION_STANDARD_EDIT_OPERATIONS } from '../../domain/InspectionStandardEditOperations.js';

import {
  buildInspectionStandardEditSectionsFromDetailVM,
  buildInspectionStandardCommonItemFormVM,
  buildEmptyInspectionStandardEditSection,
} from '../../domain/InspectionStandardEditMapper.js';

export class InspectionStandardEditFlowService {
  constructor({
    sectionEditSession,
    editPanelService,
    drawerHeaderService,
    getDrawers,
    getActiveDetailVM,
    getActiveInspectionContext,
  } = {}) {
    this.sectionEditSession = sectionEditSession;
    this.editPanelService = editPanelService;
    this.drawerHeaderService = drawerHeaderService;
    this.getDrawers = getDrawers;
    this.getActiveDetailVM = getActiveDetailVM;
    this.getActiveInspectionContext = getActiveInspectionContext;
  }

  enterEditMode({ inspectionNo } = {}) {
    if (!inspectionNo) return;

    const vm = this._activeDetailVM();

    this._drawers()?.openToLevel(2);

    this.drawerHeaderService?.setCellDrawerActionActive(
      INSPECTION_STANDARD_DRAWER_MODES.EDIT
    );

    if (!vm) {
      this.editPanelService?.renderEditEmptyPanel({
        message: '詳細データの読み込み後に変更できます。',
      });
      return;
    }

    this.sectionEditSession?.reset();

    this.editPanelService?.renderDetailCardsEditStandbyMode();
    this.editPanelService?.renderEditOperationMenuPanel();
  }

  selectOperationFromAction({ element, payload } = {}) {
    const operation = this._resolveEditOperationFromAction({
      element,
      payload,
    });

    if (!operation) return;

    this.selectOperation({ operation });
  }

  selectOperation({ operation } = {}) {
    switch (operation) {
      case INSPECTION_STANDARD_EDIT_OPERATIONS.CHANGE_COMMON_ITEMS:
        this.startCommonItemChangeFlow();
        return;
  
      case INSPECTION_STANDARD_EDIT_OPERATIONS.ADD_ITEM:
        this.startAddItemFlow();
        return;
  
      case INSPECTION_STANDARD_EDIT_OPERATIONS.CHANGE_ITEM:
        this.startSectionChangeFlow();
        return;
  
      case INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE_ITEM:
        this.startSectionDeleteFlow();
        return;
  
      case INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE:
        this.startCardAbolishFlow();
        return;
  
      default:
        this.editPanelService?.renderEditOperationMenuPanel();
    }
  }

  async startCommonItemChangeFlow() {
    const vm = this._activeDetailVM();
  
    if (!vm?.commonItems) {
      this.editPanelService?.renderEditEmptyPanel({
        title: '共通項目変更',
        message: '共通項目データの読み込み後に変更できます。',
      });
      return;
    }
  
    this.sectionEditSession?.reset();
  
    this.editPanelService?.renderDetailCardsEditStandbyMode();
    this.editPanelService?.renderEditEmptyPanel({
      title: '共通項目変更',
      message: '選択肢を読み込んでいます...',
    });
  
    try {
      const optionsResponse = await fetchInspectionStandardCommonItemOptions();
  
      const formVM = buildInspectionStandardCommonItemFormVM({
        detailVM: vm,
        optionsResponse,
      });
  
      this.editPanelService?.renderCommonItemEditForm({
        title: '共通項目変更',
        vm: formVM,
      });
    } catch (error) {
      console.error(
        '[InspectionStandardEditFlowService] common item options failed:',
        error
      );
  
      this.editPanelService?.renderEditEmptyPanel({
        title: '共通項目変更',
        message: '選択肢の取得に失敗しました。',
      });
    }
  }

  startSectionChangeFlow() {
    const vm = this._activeDetailVM();
    const inspectionNo =
      this._activeInspectionContext()?.inspectionNo ||
      this.sectionEditSession?.getContext?.()?.inspectionNo ||
      '';

    if (!vm) {
      this.editPanelService?.renderEditEmptyPanel({
        message: '詳細データの読み込み後に変更できます。',
      });
      return;
    }

    this.sectionEditSession?.start({
      context: {
        inspectionNo,
        title: vm.title,
        operation: INSPECTION_STANDARD_EDIT_OPERATIONS.CHANGE_ITEM,
      },
      sections: buildInspectionStandardEditSectionsFromDetailVM(vm),
    });

    this.editPanelService?.renderEditSelectableDetailCards();

    this.editPanelService?.renderEditEmptyPanel({
      title: '項目変更',
      message: '左側のsectionを選択してください。',
    });
  }

  startSectionDeleteFlow() {
    const vm = this._activeDetailVM();
    const inspectionNo =
      this._activeInspectionContext()?.inspectionNo ||
      this.sectionEditSession?.getContext?.()?.inspectionNo ||
      '';
  
    if (!vm) {
      this.editPanelService?.renderEditEmptyPanel({
        title: '項目削除',
        message: '詳細データの読み込み後に削除できます。',
      });
      return;
    }
  
    this.sectionEditSession?.start({
      context: {
        inspectionNo,
        title: vm.title,
        operation: INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE_ITEM,
      },
      sections: buildInspectionStandardEditSectionsFromDetailVM(vm),
    });
  
    this.editPanelService?.renderEditSelectableDetailCards();
  
    this.editPanelService?.renderEditEmptyPanel({
      title: '項目削除',
      message: '左側のsectionを選択してください。',
    });
  }

  startAddItemFlow() {
    const vm = this._activeDetailVM();
    const inspectionNo =
      this._activeInspectionContext()?.inspectionNo ||
      this.sectionEditSession?.getContext?.()?.inspectionNo ||
      '';
  
    if (!vm) {
      this.editPanelService?.renderEditEmptyPanel({
        title: '項目追加',
        message: '詳細データの読み込み後に追加できます。',
      });
      return;
    }
  
    const emptySection = buildEmptyInspectionStandardEditSection();
  
    this.sectionEditSession?.start({
      context: {
        inspectionNo,
        title: vm.title,
        operation: INSPECTION_STANDARD_EDIT_OPERATIONS.ADD_ITEM,
      },
      sections: [emptySection],
    });
  
    this.editPanelService?.renderDetailCardsEditStandbyMode();
  
    this.editPanelService?.renderAddItemForm({
      title: '項目追加',
      section: emptySection,
    });
  }

  startCardAbolishFlow() {
    const vm = this._activeDetailVM();
    const inspectionNo =
      vm?.commonItems?.inspectionNo ||
      this._activeInspectionContext()?.inspectionNo ||
      this.sectionEditSession?.getContext?.()?.inspectionNo ||
      '';
  
    if (!vm) {
      this.editPanelService?.renderEditEmptyPanel({
        title: 'カード削除',
        message: '詳細データの読み込み後に削除できます。',
      });
      return;
    }
  
    if (!vm?.commonItems?.checkId || !inspectionNo) {
      this.editPanelService?.renderEditEmptyPanel({
        title: 'カード削除',
        message: 'カード削除に必要な情報が不足しています。',
      });
      return;
    }
  
    this.sectionEditSession?.reset();
  
    this.sectionEditSession?.start({
      context: {
        checkId: vm.commonItems.checkId,
        inspectionNo,
        title: vm.title,
        operation: INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE,
      },
      sections: [],
    });
  
    this.editPanelService?.renderDetailCardsEditStandbyMode();
  
    this.editPanelService?.renderCardAbolishConfirmPanel({
      title: 'カード削除',
      vm,
    });
  }

  selectSection({ sectionId } = {}) {
    const selectedSection = this.sectionEditSession?.select(sectionId);
  
    if (!selectedSection) return;
  
    this.editPanelService?.renderEditSectionSelectionState();
  
    const operation =
      this.sectionEditSession?.getContext?.()?.operation ?? '';
  
    if (operation === INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE_ITEM) {
      this.editPanelService?.renderDeleteItemConfirmPanel({
        title: '項目削除',
        section: selectedSection,
      });
      return;
    }
  
    this.editPanelService?.renderSelectedEditSectionForm({
      title: '項目変更',
      section: selectedSection,
    });
  }

  _resolveEditOperationFromAction({ element, payload } = {}) {
    if (payload?.operation) {
      return String(payload.operation);
    }

    const rawPayload = element?.dataset?.uiPayload;

    if (!rawPayload) return '';

    try {
      const parsedPayload = JSON.parse(rawPayload);
      return String(parsedPayload?.operation ?? '');
    } catch (error) {
      console.warn('[InspectionStandards] invalid edit operation payload:', error);
      return '';
    }
  }

  _drawers() {
    return this.getDrawers?.() ?? null;
  }

  _activeDetailVM() {
    return this.getActiveDetailVM?.() ?? null;
  }

  _activeInspectionContext() {
    return this.getActiveInspectionContext?.() ?? {};
  }
}