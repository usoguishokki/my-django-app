// static/js/inspectionStandards/application/filters/InspectionStandardFilterService.js

import { asynchronousCommunication } from '../../../asyncCommunicator/asyncCommunicator.js';
import { UIManger } from '../../../manager/UIManger.js';
import { CustomDropdown } from '../../../ui/componets/customDropdown/CustomDropdown.js';

const CONTROLS_DATA_SCRIPT_ID = 'inspectionStandardControlsData';

export class InspectionStandardFilterService {
  constructor({
    parentArea,
    tableService,
    spinnerId = 'inspectionStandardsSpinner',
    onDetailsLoadStart = null,
    onDetailsLoaded = null,
    onDetailsCleared = null,
    onDetailsLoadFailed = null,
    onFiltersChanged = null,
    shouldFetchDetails = null,
  } = {}) {
    this.parentArea = parentArea;
    this.tableService = tableService;
    this.spinnerId = spinnerId;

    this.onDetailsLoadStart = onDetailsLoadStart;
    this.onDetailsLoaded = onDetailsLoaded;
    this.onDetailsCleared = onDetailsCleared;
    this.onDetailsLoadFailed = onDetailsLoadFailed;
    this.onFiltersChanged = onFiltersChanged;
    this.shouldFetchDetails = shouldFetchDetails;

    this.controlNameDropdownRoot = null;
    this.controlNoDropdownRoot = null;

    this.controlNameDropdown = null;
    this.controlNoDropdown = null;

    this.controlItems = [];
    this.currentFilters = {
      machine: '',
      controlNo: '',
    };
    
    this.syncingSelect = false;
    this.reqSeq = 0;
  }

  init() {
    this.controlNameDropdownRoot = document.getElementById('controlNameDropdown');
    this.controlNoDropdownRoot = document.getElementById('controlNoDropdown');

    if (!this.controlNameDropdownRoot || !this.controlNoDropdownRoot) {
      console.warn('[InspectionStandardFilterService] control dropdowns not found');
      return;
    }

    this.controlItems = this._readControlItems();

    this.controlNameDropdown = new CustomDropdown(this.controlNameDropdownRoot, {
      items: this._buildMachineItems(this.controlItems),
      value: '',
      placeholder: '選択してください',
      emptyText: '候補がありません',
      autoSelectFirst: false,
      onChange: async ({ item }) => {
        await this._handleChange('name', this._buildFiltersFromItem(item));
      },
    });

    this.controlNoDropdown = new CustomDropdown(this.controlNoDropdownRoot, {
      items: this._buildControlNoItems(this.controlItems),
      value: '',
      placeholder: '選択してください',
      emptyText: '候補がありません',
      autoSelectFirst: false,
      onChange: async ({ item }) => {
        await this._handleChange('no', this._buildFiltersFromItem(item));
      },
    });
  }

  destroy() {
    this.controlNameDropdown?.destroy?.();
    this.controlNoDropdown?.destroy?.();

    this.controlNameDropdown = null;
    this.controlNoDropdown = null;
  }

  getCurrentFilters() {
    return {
      machine: this.currentFilters.machine,
      controlNo: this.currentFilters.controlNo,
    };
  }

  clearFilters({
    resetTable = true,
    notify = false,
  } = {}) {
    this.currentFilters = {
      machine: '',
      controlNo: '',
    };
  
    this.syncingSelect = true;
  
    try {
      this.controlNameDropdown?.setValue('');
      this.controlNoDropdown?.setValue('');
    } finally {
      this.syncingSelect = false;
    }
  
    if (resetTable) {
      this.tableService?.resetToInitial?.();
      this.onDetailsCleared?.();
      this._hideSpinner();
    }
  
    if (notify) {
      this._notifyFiltersChanged({
        source: 'clear',
      });
    }
  }

  async _handleChange(source, { machine, controlNo }) {
    if (this.syncingSelect) return;

    this.syncingSelect = true;

    try {
      if (source === 'name') {
        this.controlNoDropdown?.setValue(controlNo);
      }

      if (source === 'no') {
        // 設備名ドロップダウンの value は controlNo を使っている
        this.controlNameDropdown?.setValue(controlNo);
      }
    } finally {
      this.syncingSelect = false;
    }

    await this._nextFrame();

    await this._applyFiltersAndFetch({
      machine,
      control_no: controlNo,
    });
  }

  async _applyFiltersAndFetch(filters) {
    const normalizedFilters = this._normalizeFilters(filters);
    const hasAny = Boolean(
      normalizedFilters.machine || normalizedFilters.controlNo
    );
  
    this.currentFilters = normalizedFilters;
  
    this._notifyFiltersChanged({
      source: 'dropdown',
    });
  
    if (!this._canFetchDetails({
      filters: normalizedFilters,
    })) {
      this._hideSpinner();
      return;
    }
  
    if (!hasAny) {
      this.tableService?.resetToInitial?.();
      this.onDetailsCleared?.();
      this._hideSpinner();
      return;
    }
  
    await this._fetchDetails({
      machine: normalizedFilters.machine,
      control_no: normalizedFilters.controlNo,
    });
  }

  async _fetchDetails(filters) {
    this._showSpinner();

    const tbody = this.tableService?.getTbody();
  
    if (!tbody) {
      this._hideSpinner();
      return;
    }

    this.reqSeq += 1;
    const currentSeq = this.reqSeq;

    try {
      this.onDetailsLoadStart?.({ filters });
    
      this.tableService.clearRows();
    
      tbody.classList.remove('fade-enter-active');
      tbody.classList.add('fade-enter');
    
      const data = await asynchronousCommunication({
        url: '/inspectionStadards/',
        method: 'POST',
        data: {
          action: 'get_details',
          data: filters,
        },
      });
    
      if (currentSeq !== this.reqSeq) return;
    
      const details = data?.details || [];
    
      this.tableService.renderRows(details);
    
      this.onDetailsLoaded?.({
        filters,
        details,
      });
    
      await this._nextFrame();
    
      this.tableService.removeDuplicateBorders();

      requestAnimationFrame(() => {
        tbody.classList.add('fade-enter-active');

        const onEnd = (event) => {
          if (event.target !== tbody) return;

          tbody.classList.remove('fade-enter', 'fade-enter-active');
          tbody.removeEventListener('transitionend', onEnd);
        };

        tbody.addEventListener('transitionend', onEnd);
      });
    } catch (error) {
      console.error('[InspectionStandardFilterService] fetch failed:', error);
    
      this.onDetailsLoadFailed?.({
        filters,
        error,
      });
    
      tbody.classList.remove('fade-enter', 'fade-enter-active');
    } finally {
      if (currentSeq === this.reqSeq) {
        this._hideSpinner();
      }
    }
  }

  _readControlItems() {
    const scriptEl = document.getElementById(CONTROLS_DATA_SCRIPT_ID);

    if (!scriptEl) return [];

    try {
      const parsed = JSON.parse(scriptEl.textContent || '[]');

      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((item) => ({
          machine: String(item?.machine ?? '').trim(),
          controlNo: String(item?.controlNo ?? '').trim(),
        }))
        .filter((item) => item.machine || item.controlNo);
    } catch (error) {
      console.error('[InspectionStandardFilterService] controls json parse failed:', error);
      return [];
    }
  }

  _buildMachineItems(items = []) {
    return items.map((item) => ({
      value: item.controlNo,
      label: item.machine || item.controlNo,
      meta: {
        machine: item.machine,
        controlNo: item.controlNo,
      },
    }));
  }

  _buildControlNoItems(items = []) {
    return items.map((item) => ({
      value: item.controlNo,
      label: item.controlNo || item.machine,
      meta: {
        machine: item.machine,
        controlNo: item.controlNo,
      },
    }));
  }

  _buildFiltersFromItem(item = {}) {
    return {
      machine: String(item?.meta?.machine ?? '').trim(),
      controlNo: String(item?.meta?.controlNo ?? item?.value ?? '').trim(),
    };
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

  _notifyFiltersChanged({
    source = '',
  } = {}) {
    if (typeof this.onFiltersChanged !== 'function') return;
  
    this.onFiltersChanged({
      source,
      filters: this.getCurrentFilters(),
    });
  }

  _canFetchDetails({
    filters = {},
  } = {}) {
    if (typeof this.shouldFetchDetails !== 'function') {
      return true;
    }
  
    return this.shouldFetchDetails({
      filters: this._normalizeFilters(filters),
    }) !== false;
  }

  _showSpinner() {
    UIManger.showSpinner?.({
      container: this.parentArea,
      id: this.spinnerId,
      size: 'lg',
      title: '点検基準書を取得中…',
      sub: 'データを読み込んでいます',
      delayMs: 300,
    });
  }

  _hideSpinner() {
    UIManger.hideSpinner?.({
      id: this.spinnerId,
    });
  }

  _nextFrame() {
    return new Promise(requestAnimationFrame);
  }
}