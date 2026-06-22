import { ModalManger } from '../manager/ModalManger.js';
import { UIManger } from '../manager/UIManger.js';
import { initializeLoadingScreen } from '../manager/loadingManager.js';

import { inspectionStandardManager } from './inspectionStandardsMappingConfig.js';


import { DrawerStack } from '../ui/componets/drawer/DrawerStack.js';
import { bindUIActions } from '../ui/componets/actions/UIActionDispatcher.js';
import { SectionEditSession } from '../ui/componets/sectionEdit/SectionEditSession.js';

import { INSPECTION_STANDARD_DRAWER_ACTIONS } from './domain/InspectionStandardActions.js';
import { INSPECTION_STANDARD_DRAWER_MODES } from './domain/InspectionStandardDrawerModes.js';
import {
  renderInspectionStandardCardAddDetailItemHTML,
} from './ui/InspectionStandardEditFormRenderer.js';
import {
  renderInspectionStandardCardAddConfirmHTML,
} from './ui/InspectionStandardCardAddRenderer.js';
import { InspectionStandardCardAddSubmitService } from './application/add/InspectionStandardCardAddSubmitService.js';
import { InspectionStandardEditPanelService } from './application/edit/InspectionStandardEditPanelService.js';
import { InspectionStandardEditSubmitService } from './application/edit/InspectionStandardEditSubmitService.js';
import { bindInspectionStandardIntegerInputRestrictions } from './application/edit/InspectionStandardIntegerInputRestrictionService.js';
import { InspectionStandardEditFlowService } from './application/edit/InspectionStandardEditFlowService.js';
import { validateInspectionStandardCardAddRequiredFields } from './application/edit/InspectionStandardRequiredFieldValidationService.js';
import { InspectionStandardTableService } from './application/table/InspectionStandardTableService.js';
import { InspectionStandardCardAddDrawerService } from './application/add/InspectionStandardCardAddDrawerService.js';
import { InspectionStandardDetailDrawerService } from './application/details/InspectionStandardDetailDrawerService.js';
import { InspectionStandardFilterService } from './application/filters/InspectionStandardFilterService.js';
import { InspectionStandardDrawerHeaderService } from './application/drawers/InspectionStandardDrawerHeaderService.js';
import { InspectionStandardHistoryPageService } from './application/history/InspectionStandardHistoryPageService.js';

import { InspectionStandardHistoryDetailDrawerService } from './application/history/InspectionStandardHistoryDetailDrawerService.js';

const INSPECTION_STANDARD_PAGE_MODES = Object.freeze({
  STANDARD: 'standard',
  HISTORY: 'history',
});

class inspectionStandards {
  constructor() {
    this.inspectionStandardManager = new inspectionStandardManager();
    this.table = document.getElementById('myTable');
    this.drawers = null;
    this._inited = false;
    this.addCardButton = null;
    this.canAddCard = false;
    this.cardAddContext = null;
    this.spinnerId = 'inspectionStandardsSpinner';

    this.pageMode = INSPECTION_STANDARD_PAGE_MODES.STANDARD;
  
    this.activeInspectionContext = null;
    this.activeInspectionDetailVM = null;
    this.sectionEditSession = new SectionEditSession();
    
    this.editPanelService = new InspectionStandardEditPanelService({
      getDrawers: () => this.drawers,
      getActiveDetailVM: () => this.activeInspectionDetailVM,
      getSelectedSectionId: () => this.sectionEditSession.getSelectedSectionId(),
    });
    
    this.editSubmitService = new InspectionStandardEditSubmitService({
      sectionEditSession: this.sectionEditSession,
      editPanelService: this.editPanelService,
      getActiveInspectionContext: () => this.activeInspectionContext,
      getActiveDetailVM: () => this.activeInspectionDetailVM,
      setActiveDetailVM: (vm) => {
        this.activeInspectionDetailVM = vm;
      },
      getDrawers: () => this.drawers,
    });

    this.detailDrawerService = new InspectionStandardDetailDrawerService({
      getDrawers: () => this.drawers,
      setActiveDetailVM: (vm) => {
        this.activeInspectionDetailVM = vm;
      },
    });

    this.historyDetailDrawerService = new InspectionStandardHistoryDetailDrawerService({
      getDrawers: () => this.drawers,
      onApproved: async () => {
        await this.historyPageService?.reload({
          filters: this.historyPageService?.currentFilters ?? {},
        });
      },
    });
    
    this.drawerHeaderService = new InspectionStandardDrawerHeaderService({
      getDrawers: () => this.drawers,
    });

    this.editFlowService = new InspectionStandardEditFlowService({
      sectionEditSession: this.sectionEditSession,
      editPanelService: this.editPanelService,
      drawerHeaderService: this.drawerHeaderService,
      getDrawers: () => this.drawers,
      getActiveDetailVM: () => this.activeInspectionDetailVM,
      getActiveInspectionContext: () => this.activeInspectionContext,
    });

    this.cardAddDrawerService = new InspectionStandardCardAddDrawerService({
      getDrawers: () => this.drawers,
    });

    this.cardAddSubmitService = new InspectionStandardCardAddSubmitService();
    
    this.tableService = null;
    this.filterService = null;
    this.standardPageEl = null;
    this.historyPageEl = null;
    this.historyPageService = null;
    
    this.unbindUIActions = null;
    this.unbindIntegerInputRestrictions = null;
  }

  async init() {
      if (this._inited) return;
      if (!this.table) {
          console.warn('[InspectionStandards] #myTable not found at init');
          return;
      }
      this.parentArea = document.getElementById('parentFilterArea');

      this.standardPageEl = this.parentArea?.querySelector(
        '[data-role="inspection-standard-standard-page"]'
      );
      
      this.historyPageEl = this.parentArea?.querySelector(
        '[data-role="inspection-standard-history-page"]'
      );
      
      this.addCardButton = this.parentArea?.querySelector(
        '[data-role="inspection-standard-add-card-button"]'
      );
      
      this.historyPageService = new InspectionStandardHistoryPageService({
        rootEl: this.parentArea,
      });
      
      this.historyPageService.init();
      
      this._setAddCardButtonEnabled(false);

      this.setupDrawers();
      this.tableService = new InspectionStandardTableService({
        table: this.table,
        manager: this.inspectionStandardManager,
        onRowClick: (row) => this._openPlanDetailFromRow(row),
      });
      
      this.tableService.init();

      this.filterService = new InspectionStandardFilterService({
        parentArea: this.parentArea,
        tableService: this.tableService,
        spinnerId: this.spinnerId,
      
        shouldFetchDetails: () => this._isStandardMode(),
      
        onFiltersChanged: ({ filters }) => {
          this._handleFiltersChanged({
            filters,
          });
        },
      
        onDetailsLoadStart: () => {
          this.cardAddContext = null;
          this._setAddCardButtonEnabled(false);
        },
      
        onDetailsLoaded: ({ filters, details }) => {
          const machine = String(filters?.machine ?? '').trim();
          const controlNo = String(filters?.control_no ?? filters?.controlNo ?? '').trim();
      
          this.cardAddContext = {
            machine,
            controlNo,
            detailCount: Array.isArray(details) ? details.length : 0,
          };
      
          this._setAddCardButtonEnabled(
            Boolean(machine || controlNo)
          );
        },
      
        onDetailsCleared: () => {
          this.cardAddContext = null;
          this._setAddCardButtonEnabled(false);
        },
      
        onDetailsLoadFailed: () => {
          this.cardAddContext = null;
          this._setAddCardButtonEnabled(false);
        },
      });
      
      this.filterService.init();
      
      this._inited = true;
  }

  setupDrawers() {
    // root は data-ui-root="drawer" を優先
    this.$root =
      document.querySelector('[data-ui-root="drawer"]') ||
      document.getElementById('parentFilterArea');
  
    if (!this.$root) {
      console.warn('[InspectionStandards] root not found');
      return;
    }
  
    const stackEl = this.$root.querySelector('[data-drawer-stack]');
    if (!stackEl) {
      console.warn('[InspectionStandards] drawer stack not found: [data-drawer-stack]');
      return;
    }
  
    this.drawers = new DrawerStack({
      stackEl,
      rootEl: this.$root,
      rootClassBase: 'page',
      order: ['cell', 'plan', 'extra'],
      enableEscapeClose: true,
      side: 'right',
      actionsByPanel: {
        plan: {
          'open-plan-extra': ({ payload, type}) => {
            if (type !== 'click') return;
    
            const planId = Number(payload?.planId ?? 0);
            if (!Number.isFinite(planId) || planId <= 0) return;
    
            this.detailDrawerService.openExtraFromHistoryRow({ planId }).catch(console.error);
          },
        },
      },
    });
    
    this.bindUIActions();
    this.bindIntegerInputRestrictions();
  }

  bindUIActions() {
    if (!this.$root) return;
  
    this.unbindUIActions?.();
  
    this.unbindUIActions = bindUIActions(
      this.$root,
      this.buildUIActionHandlers()
    );
  }

  bindIntegerInputRestrictions() {
    if (!this.$root) return;
  
    this.unbindIntegerInputRestrictions?.();
  
    this.unbindIntegerInputRestrictions =
      bindInspectionStandardIntegerInputRestrictions({
        rootEl: this.$root,
      });
  }
  
  buildUIActionHandlers() {
    return {
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_HISTORY_DETAIL]: async ({ payload }) => {
        await this.historyDetailDrawerService.open({
          historyId: payload?.historyId,
        });
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.CHANGE_HISTORY_APPROVAL_CONFIRM]: ({ element }) => {
        this.historyDetailDrawerService.handleApprovalConfirmChange({
          element,
        });
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.APPROVE_HISTORY]: async ({ element, payload }) => {
        await this.historyDetailDrawerService.approve({
          element,
          payload,
        });
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_HISTORY_LIST]: async () => {
        await this._openHistoryListPage();
      },
  
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_STANDARD_LIST]: () => {
        this._openStandardListPage();
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_ADD_CARD]: () => {
        this._openAddCardDrawer();
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.ADD_CARD_DETAIL_ITEM]: () => {
        this._appendAddCardDetailItem();
      },
  
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_ADD_CARD_DETAIL_STEP]: ({ element }) => {
        this._switchAddCardStep({
          element,
          step: 'detail',
        });
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_ADD_CARD_COMMON_STEP]: ({ element }) => {
        this._switchAddCardStep({
          element,
          step: 'common',
        });
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_HISTORY]: async ({ element }) => {
        const inspectionNo = this._resolveInspectionNoFromActionElement(element);
  
        if (!inspectionNo) return;
  
        await this._showHistoryDrawerPanel({ inspectionNo });
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_EDIT]: ({ element }) => {
        const inspectionNo = this._resolveInspectionNoFromActionElement(element);
  
        if (!inspectionNo) return;
  
        this.editFlowService.enterEditMode({ inspectionNo });
      },
  
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SELECT_EDIT_SECTION]: ({ element }) => {
        const sectionId = element?.dataset?.sectionId || '';
  
        if (!sectionId) return;
  
        this.editFlowService.selectSection({ sectionId });
      },
  
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_EDIT_SECTION]: async ({ element }) => {
        await this.editSubmitService.saveSelectedEditSection({ element });
      },
      
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_ADD_ITEM]: async ({ element }) => {
        await this.editSubmitService.saveAddItem({ element });
      },
      
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_DELETE_ITEM]: async ({ element }) => {
        await this.editSubmitService.saveDeleteItem({ element });
      },
      
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_ABOLISH_CARD]: async ({ element }) => {
        await this.editSubmitService.saveAbolishCard({ element });
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_COMMON_ITEMS]: async ({ element }) => {
        await this.editSubmitService.saveCommonItems({ element });
      },
  
      [INSPECTION_STANDARD_DRAWER_ACTIONS.SELECT_EDIT_OPERATION]: ({ element, payload }) => {
        this.editFlowService.selectOperationFromAction({
          element,
          payload,
        });
      },

      [INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_ADD_CARD]: async ({ element }) => {
        await this._submitAddCard({ element });
      },
    };
  }

  async _openHistoryListPage() {
    this._setPageMode(INSPECTION_STANDARD_PAGE_MODES.HISTORY);
  
    this.filterService?.clearFilters({
      resetTable: true,
      notify: false,
    });
  
    this._setAddCardButtonEnabled(false);
    this._showHistoryPage();
  
    await this.historyPageService?.load({
      filters: {},
    });
  }

  _openStandardListPage() {
    this._setPageMode(INSPECTION_STANDARD_PAGE_MODES.STANDARD);

    this.filterService?.clearFilters({
      resetTable: true,
      notify: false,
    });

    this.historyPageService?.clear?.();

    this._setAddCardButtonEnabled(false);
    this._showStandardPage();
  }

  _showHistoryPage() {
    if (this.standardPageEl) {
      this.standardPageEl.hidden = true;
    }
  
    if (this.historyPageEl) {
      this.historyPageEl.hidden = false;
    }
  }
  
  _showStandardPage() {
    if (this.standardPageEl) {
      this.standardPageEl.hidden = false;
    }
  
    if (this.historyPageEl) {
      this.historyPageEl.hidden = true;
    }
  }

  async _showHistoryDrawerPanel({ inspectionNo }) {
    if (!inspectionNo) return;
  
    this._resetDrawerPanelWidths();
  
    this.drawers?.openToLevel(2);
  
    this.sectionEditSession.reset();
  
    this.drawerHeaderService.setCellDrawerActionActive(
      INSPECTION_STANDARD_DRAWER_MODES.HISTORY
    );
  
    this.editPanelService.renderDetailCardsViewMode();
  
    await this.detailDrawerService.loadInspectionHistory({ inspectionNo });
  }

  _openAddCardDrawer() {
    if (!this.canAddCard) return;
  
    if (!this.drawers) {
      console.warn('[InspectionStandards] drawers not initialized');
      return;
    }
  
    this.sectionEditSession?.reset?.();
  
    this.activeInspectionContext = null;
    this.activeInspectionDetailVM = null;
  
    this.cardAddDrawerService.open({
      context: this.cardAddContext ?? {},
    }).catch((error) => {
      console.error('[InspectionStandards] add card drawer failed:', error);
    });
  }

  _resetDrawerPanelWidths() {
    ['cell', 'plan', 'extra'].forEach((panelKey) => {
      this.drawers?.panel(panelKey)?.setWide?.(false);
    });
  }

  _resolveInspectionNoFromActionElement(element) {
    return (
      element?.dataset?.inspectionNo ||
      this.activeInspectionContext?.inspectionNo ||
      ''
    );
  }

  _isStandardMode() {
    return this.pageMode === INSPECTION_STANDARD_PAGE_MODES.STANDARD;
  }

  _isHistoryMode() {
    return this.pageMode === INSPECTION_STANDARD_PAGE_MODES.HISTORY;
  }

  _setPageMode(pageMode) {
    this.pageMode = pageMode;
  }

  _handleFiltersChanged({
    filters = {},
  } = {}) {
    if (!this._isHistoryMode()) return;
  
    this.historyPageService?.reload({
      filters,
    });
  }

  _openPlanDetailFromRow(row) {
    if (isTruthyAttributeValue(row?.getAttribute?.('data-is_check_abolished'))) {
      return;
    }
  
    if (!this.drawers) {
      console.warn('[InspectionStandards] drawers not initialized');
      return;
    }
  
    this._resetDrawerPanelWidths();
  
    // まずは2枚だけ開く（cell + plan）
    this.drawers.openToLevel(2);
  
    // タイトルだけ仮で入れておく（あとでデータ連動）
    const inspectionNo = row.getAttribute('data-inspection_no') || '';
    const workName = row.getAttribute('data-wark_name') || '';
    const cellTitle = `${inspectionNo} / ${workName}`;
    this.activeInspectionContext = {
      inspectionNo,
      workName,
      cellTitle,
    };
    
    this.activeInspectionDetailVM = null;
    this.sectionEditSession.reset();
    const cell = this.drawers.panel('cell');
    const plan = this.drawers.panel('plan');
    cell?.setTitle('読み込み中');
    plan?.setTitle('読み込み中');
    
    this.drawerHeaderService.renderCellDrawerActions({
      inspectionNo,
      activeMode: INSPECTION_STANDARD_DRAWER_MODES.HISTORY,
    });
    
    this.detailDrawerService
      .loadInspectionCardDetail({ inspectionNo, cellTitle })
      .catch((error) => {
        console.error(error);
        cell?.setTitle?.(`カードNo: ${inspectionNo}（エラー）`);
        cell?.setBodyHtml?.(
          '<p class="drawer__placeholder">読み込みに失敗しました</p>'
        );
      });
    
    this.detailDrawerService
      .loadInspectionHistory({ inspectionNo })
      .catch((error) => {
        console.error(error);
        plan?.setTitle?.(`履歴（エラー）: ${inspectionNo}`);
        plan?.setBodyHtml?.(
          '<p class="drawer__placeholder">読み込みに失敗しました</p>'
        );
      });
  }

  _setAddCardButtonEnabled(enabled) {
    this.canAddCard = Boolean(enabled);
  
    if (!this.addCardButton) return;
  
    this.addCardButton.disabled = !this.canAddCard;
    this.addCardButton.setAttribute(
      'aria-disabled',
      this.canAddCard ? 'false' : 'true'
    );
  }

  _switchAddCardStep({
    element,
    step,
  } = {}) {
    const formEl = element?.closest(
      '[data-role="inspection-standard-card-add-form"]'
    );
  
    if (!formEl) return;
  
    formEl.dataset.step = step;
  
    formEl
      .querySelectorAll('[data-role="inspection-standard-card-add-step"]')
      .forEach((stepEl) => {
        const isActive = stepEl.dataset.step === step;
  
        stepEl.hidden = !isActive;
        stepEl.classList.toggle('is-hidden', !isActive);
      });
  
    const stepperEl = formEl.querySelector(
      '[data-role="inspection-standard-card-add-stepper"]'
    );
  
    stepperEl?.setAttribute('data-current-step', step);
  
    formEl
      .querySelectorAll('[data-step-control]')
      .forEach((controlEl) => {
        const isActive = controlEl.dataset.stepControl === step;
  
        controlEl.classList.toggle('is-active', isActive);
  
        if (isActive) {
          controlEl.setAttribute('aria-current', 'step');
        } else {
          controlEl.removeAttribute('aria-current');
        }
      });
  
    this._updateAddCardDrawerTitleByStep({ step });
  }

  _updateAddCardDrawerTitleByStep({ step } = {}) {
    const stepLabelMap = {
      common: '共通項目',
      detail: '点検項目',
    };
  
    const stepLabel = stepLabelMap[step] ?? '';
  
    const context = this.cardAddContext ?? {};
    const machine = String(context.machine ?? '').trim();
    const controlNo = String(context.controlNo ?? '').trim();
  
    const detailLabels = [
      machine ? `設備名: ${machine}` : '',
      controlNo ? `管理番号: ${controlNo}` : '',
    ].filter(Boolean);
  
    const baseTitle = stepLabel
      ? `カードの追加 / ${stepLabel}`
      : 'カードの追加';
  
    const title = detailLabels.length
      ? `${baseTitle}（${detailLabels.join('　')}）`
      : baseTitle;
  
    this.drawers?.panel('cell')?.setTitle?.(title);
  }

  _appendAddCardDetailItem() {
    const formEl = this.$root?.querySelector(
      '[data-role="inspection-standard-card-add-form"]'
    );
  
    const listEl = formEl?.querySelector(
      '[data-role="inspection-standard-card-add-detail-items"]'
    );
  
    if (!listEl) return;
  
    const nextIndex = listEl.querySelectorAll(
      '[data-role="inspection-standard-card-add-detail-item"]'
    ).length;
  
    listEl.insertAdjacentHTML(
      'beforeend',
      renderInspectionStandardCardAddDetailItemHTML({
        section: {},
        index: nextIndex,
        excludeKeys: ['status'],
      })
    );
  
    const addedItemEl = listEl.lastElementChild;
  
    // status など customDropdown がある場合に備えて、次ステップで初期化処理をここに入れる
    // this.editPanelService.initializeDetailItemDropdowns?.({ rootEl: addedItemEl });
  
    addedItemEl?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }

  async _submitAddCard({ element } = {}) {
    const formEl = element?.closest(
      '[data-role="inspection-standard-card-add-form"]'
    );
  
    if (!formEl) return;
  
    const context = this.cardAddContext ?? {};
  
    const validation = validateInspectionStandardCardAddRequiredFields({
      formEl,
    });
  
    if (!validation.isValid) {
      this._moveToAddCardStepByControl({
        controlEl: validation.firstInvalidControlEl,
      });
  
      this._showAddCardValidationError({
        message: validation.message,
      });
  
      validation.firstInvalidControlEl?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'center',
      });
  
      return;
    }
  
    const commonEntries = this._collectAddCardCommonEntries({ formEl });
    const detailItems = this._collectAddCardDetailItems({ formEl });
  
    const shouldRequireScroll = detailItems.length > 1;
  
    const confirmed = await ModalManger.showConfirmModal({
      message: renderInspectionStandardCardAddConfirmHTML({
        context,
        commonEntries,
        detailItems,
      }),
      color: 'default',
      confirmText: '登録',
      cancelText: 'キャンセル',
      confirmDisabled: shouldRequireScroll,
      onOpen: ({ modalEl, confirmButtonEl }) => {
        if (!shouldRequireScroll) return;
  
        this._setupAddCardConfirmScrollGate({
          modalEl,
          confirmButtonEl,
        });
      },
    });
  
    if (!confirmed) return;
  
    const response = await this.cardAddSubmitService.create({
      button: element,
      formEl,
      context,
      commonEntries,
      detailItems,
    });
  
    if (!response?.success) return;
  
    this._setAddCardButtonEnabled(false);
  
    this.drawers?.panel('cell')?.setBodyHtml?.(`
      <div class="drawer__placeholder">
        カードを追加しました。設備を再選択すると一覧に反映されます。
      </div>
    `);
  }

  _moveToAddCardStepByControl({ controlEl } = {}) {
    const stepEl = controlEl?.closest(
      '[data-role="inspection-standard-card-add-step"]'
    );
  
    const step = stepEl?.dataset?.step;
  
    if (!step) return;
  
    this._switchAddCardStep({
      element: controlEl,
      step,
    });
  }
  
  _showAddCardValidationError({ message } = {}) {
    const safeMessage = UIManger
      .escapeHtml(String(message ?? ''))
      .replaceAll('\n', '<br>');
  
    ModalManger.showModal(
      `
        <div class="inspection-standard-message-modal inspection-standard-message-modal--error">
          <div class="inspection-standard-message-modal__icon" aria-hidden="true"></div>
  
          <div class="inspection-standard-message-modal__content">
            <div class="inspection-standard-message-modal__title">
              入力内容を確認してください
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


  _setupAddCardConfirmScrollGate({
    modalEl,
    confirmButtonEl,
  } = {}) {
    const detailListEl = modalEl?.querySelector(
      '[data-role="inspection-standard-card-add-confirm-detail-list"][data-require-scroll="true"]'
    );
  
    if (!detailListEl || !confirmButtonEl) return;
  
    const noticeEl = modalEl.querySelector(
      '[data-role="inspection-standard-card-add-confirm-scroll-notice"]'
    );
  
    const enableConfirm = () => {
      confirmButtonEl.disabled = false;
      confirmButtonEl.setAttribute('aria-disabled', 'false');
  
      if (noticeEl) {
        noticeEl.classList.add('is-completed');
        noticeEl.textContent = '点検項目を確認しました。登録できます。';
      }
    };
  
    const isScrolledToBottom = () => {
      const threshold = 4;
  
      return (
        detailListEl.scrollTop + detailListEl.clientHeight >=
        detailListEl.scrollHeight - threshold
      );
    };
  
    const updateState = () => {
      if (!isScrolledToBottom()) return;
  
      enableConfirm();
      detailListEl.removeEventListener('scroll', updateState);
    };
  
    detailListEl.addEventListener('scroll', updateState);
    requestAnimationFrame(updateState);
  }
  

  _collectAddCardCommonEntries({ formEl } = {}) {
    const commonStepEl = formEl?.querySelector(
      '[data-role="inspection-standard-card-add-step"][data-step="common"]'
    );
  
    if (!commonStepEl) return [];
  
    return Array.from(
      commonStepEl.querySelectorAll('[data-common-edit-field]')
    ).map((controlEl) => this._buildAddCardFormEntry({
      controlEl,
      fieldAttributeName: 'commonEditField',
    }));
  }
  
  _collectAddCardDetailItems({ formEl } = {}) {
    const detailItemEls = formEl?.querySelectorAll(
      '[data-role="inspection-standard-card-add-detail-item"]'
    );
  
    return Array.from(detailItemEls ?? []).map((itemEl, index) => {
      const entries = Array.from(
        itemEl.querySelectorAll('[data-section-edit-field]')
      ).map((controlEl) => this._buildAddCardFormEntry({
        controlEl,
        fieldAttributeName: 'sectionEditField',
      }));
  
      return {
        index,
        entries,
      };
    });
  }
  
  _buildAddCardFormEntry({
    controlEl,
    fieldAttributeName,
  } = {}) {
    const key = controlEl?.dataset?.[fieldAttributeName] ?? '';
  
    const fieldEl = controlEl?.closest('.inspection-standard-edit-form__field');
    const label = fieldEl
      ?.querySelector('.inspection-standard-edit-form__label')
      ?.textContent
      ?.trim() || key;
  
    return {
      key,
      label,
      value: this._getAddCardControlValue(controlEl),
      displayValue: this._getAddCardControlDisplayValue(controlEl),
    };
  }
  
  _getAddCardControlValue(controlEl) {
    return String(controlEl?.value ?? '').trim();
  }
  
  _getAddCardControlDisplayValue(controlEl) {
    const dropdownEl = controlEl?.closest('.custom-dropdown');
  
    if (dropdownEl) {
      const triggerText = dropdownEl
        .querySelector('[data-role="dropdown-trigger-text"]')
        ?.textContent
        ?.trim();
  
      if (triggerText) return triggerText;
    }
  
    return String(controlEl?.value ?? '').trim();
  }
}

function isTruthyAttributeValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();

  return normalized === 'true' || normalized === '1';
}

document.addEventListener('DOMContentLoaded', async() => {
  initializeLoadingScreen();
  const app = new inspectionStandards();
  await app.init();

});
