// static/js/inspectionStandards/application/edit/InspectionStandardEditPanelService.js

import { panelBinder } from '../../../ui/bindings/panelBinder.js';
import { renderPlanDetailCardsHTML } from '../../../ui/renderers/planDetailCardsRenderer.js';
import { INSPECTION_STANDARD_DRAWER_ACTIONS } from '../../domain/InspectionStandardActions.js';
import { renderInspectionStandardEditOperationMenuHTML } from '../../ui/InspectionStandardEditMenuRenderer.js';
import {
  renderInspectionStandardSelectedEditSectionFormHTML,
  renderInspectionStandardEditEmptyPanelHTML,
  renderInspectionStandardCommonItemEditFormHTML,
  renderInspectionStandardDeleteItemConfirmHTML,
  renderInspectionStandardCardAbolishConfirmHTML,
} from '../../ui/InspectionStandardEditFormRenderer.js';
import {
  initializeInspectionStandardCommonItemDropdowns,
  destroyInspectionStandardCommonItemDropdowns,
} from './InspectionStandardCommonItemDropdownService.js';
import {
  initializeInspectionStandardDetailEditDropdowns,
  destroyInspectionStandardDetailEditDropdowns,
} from './InspectionStandardDetailEditDropdownService.js';

export class InspectionStandardEditPanelService {
  constructor({
    getDrawers,
    getActiveDetailVM,
    getSelectedSectionId,
  } = {}) {
    this.getDrawers = getDrawers;
    this.getActiveDetailVM = getActiveDetailVM;
    this.getSelectedSectionId = getSelectedSectionId;
  }

  renderDetailCardsEditStandbyMode() {
    const cell = this._panel('cell');
    const vm = this._activeDetailVM();

    if (!cell || !vm) return;

    cell.showBody?.();

    panelBinder.setTitle(cell.titleEl, `${vm.title} / 変更モード`);
    panelBinder.setBodyHTML(
      cell.bodyEl,
      renderPlanDetailCardsHTML(vm)
    );
  }

  renderEditOperationMenuPanel() {
    const plan = this._panel('plan');

    if (!plan) return;

    plan.showBody?.();
    plan.clearTable?.();

    panelBinder.setTitle(plan.titleEl, '内容変更');
    panelBinder.setBodyHTML(
      plan.bodyEl,
      renderInspectionStandardEditOperationMenuHTML()
    );
  }

  renderDetailCardsViewMode() {
    const cell = this._panel('cell');
    const vm = this._activeDetailVM();

    if (!cell || !vm) return;

    cell.showBody?.();

    panelBinder.setTitle(cell.titleEl, vm.title);
    panelBinder.setBodyHTML(
      cell.bodyEl,
      renderPlanDetailCardsHTML(vm)
    );
  }

  renderEditSelectableDetailCards() {
    const cell = this._panel('cell');
    const vm = this._activeDetailVM();

    if (!cell || !vm) return;

    const selectedSectionId = this.getSelectedSectionId?.() ?? '';

    const html = renderPlanDetailCardsHTML(vm, {
      mode: 'edit',
      selectable: true,
      selectAction: INSPECTION_STANDARD_DRAWER_ACTIONS.SELECT_EDIT_SECTION,
      selectedSectionId,
    });

    cell.showBody?.();

    panelBinder.setTitle(cell.titleEl, `${vm.title} / 変更モード`);
    panelBinder.setBodyHTML(cell.bodyEl, html);
  }

  renderEditEmptyPanel({
    title = '変更後',
    message,
  } = {}) {
    const plan = this._panel('plan');
  
    if (!plan) return;
  
    plan.showBody?.();
    plan.clearTable?.();
  
    panelBinder.setTitle(plan.titleEl, title);
    panelBinder.setBodyHTML(
      plan.bodyEl,
      renderInspectionStandardEditEmptyPanelHTML({ message })
    );
  }

  renderEditSectionSelectionState() {
    const cell = this._panel('cell');
    const bodyEl = cell?.bodyEl;

    if (!bodyEl) return;

    const selectedSectionId = this.getSelectedSectionId?.() ?? '';

    bodyEl
      .querySelectorAll('[data-role="inspection-standard-edit-section"]')
      .forEach((sectionEl) => {
        const isSelected = sectionEl.dataset.sectionId === selectedSectionId;

        sectionEl.classList.toggle('is-selected', isSelected);
        sectionEl.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
  }

  renderSelectedEditSectionForm({
    title = '変更後',
    section,
    mode = 'edit',
    saveAction = INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_EDIT_SECTION,
    saveLabel = '確定',
  } = {}) {
    const plan = this._panel('plan');
  
    if (!plan) return;
  
    this._drawers()?.openToLevel(2);
  
    plan.showBody?.();
    plan.clearTable?.();
  
    destroyInspectionStandardDetailEditDropdowns({
      rootEl: plan.bodyEl,
    });
    
    panelBinder.setTitle(plan.titleEl, title);
    panelBinder.setBodyHTML(
      plan.bodyEl,
      renderInspectionStandardSelectedEditSectionFormHTML({
        section,
        mode,
        saveAction,
        saveLabel,
      })
    );
    
    initializeInspectionStandardDetailEditDropdowns({
      rootEl: plan.bodyEl,
    });
  }

  renderDeleteItemConfirmPanel({
    title = '項目削除',
    section,
  } = {}) {
    const plan = this._panel('plan');
  
    if (!plan) return;
  
    this._drawers()?.openToLevel(2);
  
    plan.showBody?.();
    plan.clearTable?.();
  
    panelBinder.setTitle(plan.titleEl, title);
    panelBinder.setBodyHTML(
      plan.bodyEl,
      renderInspectionStandardDeleteItemConfirmHTML({ section })
    );
  }

  renderCardAbolishConfirmPanel({
    title = 'カード削除',
    vm,
  } = {}) {
    const plan = this._panel('plan');
  
    if (!plan) return;
  
    this._drawers()?.openToLevel(2);
  
    plan.showBody?.();
    plan.clearTable?.();
  
    panelBinder.setTitle(plan.titleEl, title);
    panelBinder.setBodyHTML(
      plan.bodyEl,
      renderInspectionStandardCardAbolishConfirmHTML({ vm })
    );
  }

  renderAddItemForm({
    title = '項目追加',
    section,
  } = {}) {
    this.renderSelectedEditSectionForm({
      title,
      section,
      mode: 'add',
      saveAction: INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_ADD_ITEM,
      saveLabel: '項目追加',
    });
  }

  _drawers() {
    return this.getDrawers?.() ?? null;
  }

  _panel(panelName) {
    return this._drawers()?.panel(panelName);
  }

  _activeDetailVM() {
    return this.getActiveDetailVM?.() ?? null;
  }

  renderCommonItemEditForm({
    title = '共通項目変更',
    vm,
  } = {}) {
    const plan = this._panel('plan');
  
    if (!plan) return;
  
    this._drawers()?.openToLevel(2);
  
    plan.showBody?.();
    plan.clearTable?.();
  
    destroyInspectionStandardCommonItemDropdowns({
      rootEl: plan.bodyEl,
    });
  
    panelBinder.setTitle(plan.titleEl, title);
    panelBinder.setBodyHTML(
      plan.bodyEl,
      renderInspectionStandardCommonItemEditFormHTML({ vm })
    );
  
    initializeInspectionStandardCommonItemDropdowns({
      rootEl: plan.bodyEl,
      vm,
    });
  }
}