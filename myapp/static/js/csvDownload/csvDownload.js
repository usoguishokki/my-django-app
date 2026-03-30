import { initializeLoadingScreen } from '../manager/loadingManager.js';
import { bindUIActions } from '../ui/componets/actions/UIActionDispatcher.js';

import {
    fetchInspectionStandardMachines,
    executeInspectionStandardDownload,
    executeInspectionPlanResultDownload,
} from '../api/fetchers.js';

import {
    CustomDropdown,
    CustomDropdownMappings,
} from '../ui/componets/customDropdown/index.js';

import {
    renderOptionButtonGroupHTML,
    readOptionGroupValue,
    setOptionGroupValue,
} from '../ui/componets/buttons/OptionButtonGroup.js';

import { buildFiscalYearMonthOptions } from '../presenters/fiscalYearMonthOptionsPresenter.js';


class CsvDownloadPage {
    static DOWNLOAD_TYPES = Object.freeze({
        INSPECTION_STANDARD: 'inspection_standard',
        INSPECTION_PLAN_RESULT: 'inspection_plan_result',
    });

    static PLAN_RESULT_OPTION_VALUES = Object.freeze({
        FISCAL_YEAR: 'fiscal_year',
        CUSTOM_RANGE: 'custom_range',
    });

    constructor(root = document) {
        this.root = root;

        this.form = this.root.querySelector('[data-role="csv-download-form"]');
        this.typeInputs = Array.from(
            this.root.querySelectorAll('[data-role="download-type"]')
        );

        this.standardFields = this.root.querySelector('[data-role="inspection-standard-fields"]');
        this.planResultFields = this.root.querySelector('[data-role="inspection-plan-result-fields"]');
        this.guide = this.root.querySelector('[data-role="download-type-guide"]');

        this.planResultOptionArea = this.root.querySelector(
            '[data-role="inspection-plan-result-option-area"]'
        );

        this.planResultDateRange = this.root.querySelector(
            '[data-role="inspection-plan-result-date-range"]'
        );

        this.planResultHelp = this.planResultFields?.querySelector('.csv-download__help') ?? null;

        this.submitButton = this.root.querySelector('.csv-download__submit');

        this.unbindUIActions = null;
        this.isSubmitting = false;
        this.isLoadingMachineOptions = false;
        this.hasLoadedMachineOptions = false;

        this.machineCombobox = null;
        this.machineComboboxRoot = null;
        this.machineComboboxHidden = null;
        this.machineComboboxTrigger = null;
        this.machineComboboxTriggerText = null;
        this.machineComboboxPanel = null;
        this.machineComboboxList = null;

        this.startMonthCombobox = null;
        this.endMonthCombobox = null;

        this.setupMachineCombobox();
        this.setupPlanResultMonthComboboxRefs();
    }

    setupMachineCombobox() {
        this.machineComboboxRoot = this.root.querySelector(
            '[data-role="combobox"][data-combobox-key="machine"]'
        );
        if (!this.machineComboboxRoot) return;

        this.machineComboboxHidden =
            this.machineComboboxRoot.querySelector('[data-role="combobox-hidden"]');

        this.machineComboboxTrigger =
            this.machineComboboxRoot.querySelector('[data-role="combobox-trigger"]');

        this.machineComboboxTriggerText =
            this.machineComboboxRoot.querySelector('[data-role="combobox-trigger-text"]');

        this.machineComboboxPanel =
            this.machineComboboxRoot.querySelector('[data-role="combobox-panel"]');

        this.machineComboboxList =
            this.machineComboboxRoot.querySelector('[data-role="combobox-list"]');

        const machineDropdownMapping = CustomDropdownMappings.machineName;

        this.machineCombobox = this.createCombobox({
            rootEl: this.machineComboboxRoot,
            hiddenInputEl: this.machineComboboxHidden,
            triggerEl: this.machineComboboxTrigger,
            triggerTextEl: this.machineComboboxTriggerText,
            panelEl: this.machineComboboxPanel,
            listEl: this.machineComboboxList,
            placeholder: machineDropdownMapping.placeholder,
            allValue: 'all',
        });
    }

    setupPlanResultMonthComboboxRefs() {
        this.startMonthComboboxRoot = this.root.querySelector(
            '[data-role="combobox"][data-combobox-key="start-month"]'
        );
        this.endMonthComboboxRoot = this.root.querySelector(
            '[data-role="combobox"][data-combobox-key="end-month"]'
        );
    }

    createCombobox({
        rootEl,
        hiddenInputEl,
        triggerEl,
        triggerTextEl,
        panelEl,
        listEl,
        placeholder,
        allValue = '',
    }) {
        if (!rootEl || !hiddenInputEl || !triggerEl || !triggerTextEl || !panelEl || !listEl) {
            return null;
        }

        return new CustomDropdown({
            rootEl,
            hiddenInputEl,
            triggerEl,
            triggerTextEl,
            panelEl,
            listEl,
            placeholder,
            allValue,
        });
    }

    setupPlanResultMonthComboboxes() {
        if (this.startMonthCombobox || this.endMonthCombobox) {
            return;
        }

        const startHiddenInput = this.startMonthComboboxRoot?.querySelector('[data-role="combobox-hidden"]');
        const startTrigger = this.startMonthComboboxRoot?.querySelector('[data-role="combobox-trigger"]');
        const startTriggerText = this.startMonthComboboxRoot?.querySelector('[data-role="combobox-trigger-text"]');
        const startPanel = this.startMonthComboboxRoot?.querySelector('[data-role="combobox-panel"]');
        const startList = this.startMonthComboboxRoot?.querySelector('[data-role="combobox-list"]');

        const endHiddenInput = this.endMonthComboboxRoot?.querySelector('[data-role="combobox-hidden"]');
        const endTrigger = this.endMonthComboboxRoot?.querySelector('[data-role="combobox-trigger"]');
        const endTriggerText = this.endMonthComboboxRoot?.querySelector('[data-role="combobox-trigger-text"]');
        const endPanel = this.endMonthComboboxRoot?.querySelector('[data-role="combobox-panel"]');
        const endList = this.endMonthComboboxRoot?.querySelector('[data-role="combobox-list"]');

        this.startMonthCombobox = this.createCombobox({
            rootEl: this.startMonthComboboxRoot,
            hiddenInputEl: startHiddenInput,
            triggerEl: startTrigger,
            triggerTextEl: startTriggerText,
            panelEl: startPanel,
            listEl: startList,
            placeholder: '開始月を選択してください',
            allValue: '',
        });

        this.endMonthCombobox = this.createCombobox({
            rootEl: this.endMonthComboboxRoot,
            hiddenInputEl: endHiddenInput,
            triggerEl: endTrigger,
            triggerTextEl: endTriggerText,
            panelEl: endPanel,
            listEl: endList,
            placeholder: '終了月を選択してください',
            allValue: '',
        });

        this.startMonthCombobox?.init();
        this.endMonthCombobox?.init();

        const monthItems = buildFiscalYearMonthOptions();
        this.startMonthCombobox?.setItems(monthItems);
        this.endMonthCombobox?.setItems(monthItems);

        this.startMonthCombobox?.setDisabled(true);
        this.endMonthCombobox?.setDisabled(true);

        this.startMonthComboboxRoot?.addEventListener(
            'ui:dropdown-change',
            this.handleUpdateDownloadConditions
        );
        this.endMonthComboboxRoot?.addEventListener(
            'ui:dropdown-change',
            this.handleUpdateDownloadConditions
        );
    }


    init() {
        if (!this.form) return;

        this.machineCombobox?.init();
        this.machineCombobox?.setDisabled(true);

        this.setupPlanResultMonthComboboxes();
        this.renderPlanResultOptionButtons();
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        this.unbindUIActions = bindUIActions(this.form, {
            selectDownloadType: this.handleSelectDownloadType,
            updateDownloadConditions: this.handleUpdateDownloadConditions,
            submitCsvDownload: this.handleSubmit,
            selectPlanResultOption: this.handleSelectPlanResultOption,
        });
    }

    handleUpdateDownloadConditions = () => {
        this.updateSubmitButtonState();
    };

    updateSubmitButtonState() {
        if (!this.submitButton) return;

        const selectedType = this.getSelectedDownloadType();
        let canSubmit = false;

        if (selectedType === CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_STANDARD) {
            const controlNo = this.machineComboboxHidden?.value?.trim() ?? '';
            canSubmit = !!controlNo && controlNo !== 'all';
        }

        if (selectedType === CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_PLAN_RESULT) {
            const selectedOption = this.getSelectedPlanResultOption();

            if (selectedOption === CsvDownloadPage.PLAN_RESULT_OPTION_VALUES.FISCAL_YEAR) {
                canSubmit = true;
            }

            if (selectedOption === CsvDownloadPage.PLAN_RESULT_OPTION_VALUES.CUSTOM_RANGE) {
                const startMonth = this.getStartMonthValue();
                const endMonth = this.getEndMonthValue();

                canSubmit = !!startMonth && !!endMonth && startMonth <= endMonth;
            }
        }

        this.submitButton.disabled = !canSubmit;
    }

    handleSubmit = async ({ event }) => {
        event.preventDefault();
    
        if (this.isSubmitting) return;
        this.isSubmitting = true;
    
        if (this.submitButton) {
            this.submitButton.disabled = true;
        }
    
        try {
            const selectedType = this.getSelectedDownloadType();
            const handlers = this.getSubmitHandlers();
            const handler = handlers[selectedType];
    
            if (!handler) {
                alert('ダウンロード種別を選択してください。');
                return;
            }
    
            await handler();
        } catch (error) {
            console.error('[CsvDownloadPage] CSV download failed:', error);
            alert(error?.message || 'CSVのダウンロードに失敗しました。');
        } finally {
            this.isSubmitting = false;
            this.updateSubmitButtonState();
        }
    };

    getSubmitHandlers() {
        return {
            [CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_STANDARD]:
                this.handleInspectionStandardDownload.bind(this),

            [CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_PLAN_RESULT]:
                this.handleInspectionPlanResultDownload.bind(this),
        };
    }

    async handleInspectionStandardDownload() {
        const errors = this.validateInspectionStandard();
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }
    
        const controlNo = this.machineComboboxHidden?.value?.trim();
        if (!controlNo) {
            alert('設備名を選択してください。');
            return;
        }
    
        await executeInspectionStandardDownload({
            controlNo,
        });
    
        this.scheduleResetAfterSubmit();
    }

    async handleInspectionPlanResultDownload() {
        const errors = this.validateInspectionPlanResult();
        if (errors.length > 0) {
            alert(errors.join('\n'));
            return;
        }
    
        await executeInspectionPlanResultDownload({
            planResultOption: this.getSelectedPlanResultOption(),
            startMonth: this.getStartMonthValue(),
            endMonth: this.getEndMonthValue(),
        });
    
        this.scheduleResetAfterSubmit();
    }

    validateInspectionStandard() {
        const errors = [];
        const controlNo = this.machineComboboxHidden?.value?.trim() ?? '';

        if (!controlNo || controlNo === 'all') {
            errors.push('設備名を選択してください。');
        }

        return errors;
    }

    validateInspectionPlanResult() {
        const errors = [];
        const selectedOption = this.getSelectedPlanResultOption();

        if (!this.isValidPlanResultOption(selectedOption)) {
            errors.push('オプションを選択してください。');
            return errors;
        }

        if (selectedOption === CsvDownloadPage.PLAN_RESULT_OPTION_VALUES.CUSTOM_RANGE) {
            const startMonth = this.getStartMonthValue();
            const endMonth = this.getEndMonthValue();

            if (!startMonth) {
                errors.push('開始月を選択してください。');
            }

            if (!endMonth) {
                errors.push('終了月を選択してください。');
            }

            if (startMonth && endMonth && startMonth > endMonth) {
                errors.push('終了月は開始月以降を選択してください。');
            }
        }

        return errors;
    }

    handleSelectDownloadType = async () => {
        const selectedType = this.getSelectedDownloadType();

        this.resetInactiveInputsByType(selectedType);
        this.render();

        if (selectedType !== CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_STANDARD) return;
        await this.ensureMachineOptionsLoaded();
    };

    resetInactiveInputsByType(selectedType) {
        const isInspectionStandard =
            selectedType === CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_STANDARD;
        const isInspectionPlanResult =
            selectedType === CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_PLAN_RESULT;

        if (!isInspectionStandard) {
            this.machineCombobox?.setValue('');
        }

        if (!isInspectionPlanResult) {
            this.renderPlanResultOptionButtons();
            this.clearMonthDropdownValues();
        }
    }

    async ensureMachineOptionsLoaded() {
        if (this.hasLoadedMachineOptions || this.isLoadingMachineOptions) return;
        if (!this.machineCombobox) return;

        this.isLoadingMachineOptions = true;

        try {
            const response = await fetchInspectionStandardMachines();
            const items = Array.isArray(response?.items) ? response.items : [];
            this.setMachineOptions(items);
            this.hasLoadedMachineOptions = true;
        } catch (error) {
            console.error('[CsvDownloadPage] failed to load machine options:', error);
        } finally {
            this.isLoadingMachineOptions = false;
        }
    }

    setMachineOptions(items = []) {
        const mapping = CustomDropdownMappings.machineName;
        const mappedItems = mapping.mapItems(items);
        this.machineCombobox?.setItems(mappedItems);
    }

    getSelectedDownloadType() {
        const checkedInput = this.typeInputs.find((input) => input.checked);
        return checkedInput ? checkedInput.value : '';
    }

    isValidPlanResultOption(value) {
        return Object.values(CsvDownloadPage.PLAN_RESULT_OPTION_VALUES).includes(value);
    }

    getSelectedPlanResultOption() {
        return readOptionGroupValue(this.root, 'planResultOption');
    }

    getStartMonthValue() {
        return this.startMonthCombobox?.getValue()?.trim() ?? '';
    }

    getEndMonthValue() {
        return this.endMonthCombobox?.getValue()?.trim() ?? '';
    }

    clearMonthDropdownValues() {
        this.startMonthCombobox?.setValue('');
        this.endMonthCombobox?.setValue('');
    }

    handleSelectPlanResultOption = ({ payload }) => {
        const value = String(payload?.value ?? '');

        if (!this.isValidPlanResultOption(value)) return;

        setOptionGroupValue(this.root, 'planResultOption', value);

        if (value !== CsvDownloadPage.PLAN_RESULT_OPTION_VALUES.CUSTOM_RANGE) {
            this.clearMonthDropdownValues();
        }

        this.render();
    };

    render() {
        const selectedType = this.getSelectedDownloadType();

        const isInspectionStandard =
            selectedType === CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_STANDARD;
        const isInspectionPlanResult =
            selectedType === CsvDownloadPage.DOWNLOAD_TYPES.INSPECTION_PLAN_RESULT;

        this.updateVisibility({ isInspectionStandard, isInspectionPlanResult });
        this.updateInputStates({ isInspectionStandard, isInspectionPlanResult });
        this.updateSubmitButtonState();
    }

    updateVisibility({ isInspectionStandard, isInspectionPlanResult }) {
        const selectedOption = this.getSelectedPlanResultOption();
        const isCustomRange =
            selectedOption === CsvDownloadPage.PLAN_RESULT_OPTION_VALUES.CUSTOM_RANGE;
        const hasSelectedPlanResultOption = this.isValidPlanResultOption(selectedOption);

        this.setHidden(this.standardFields, !isInspectionStandard);
        this.setHidden(this.planResultFields, !isInspectionPlanResult);
        this.setHidden(this.guide, isInspectionStandard || isInspectionPlanResult);

        this.setHidden(this.planResultOptionArea, !isInspectionPlanResult);
        this.setHidden(this.planResultDateRange, !(isInspectionPlanResult && isCustomRange));
        this.setHidden(this.planResultHelp, !isInspectionPlanResult || hasSelectedPlanResultOption);
    }

    updateInputStates({ isInspectionStandard, isInspectionPlanResult }) {
        const selectedOption = this.getSelectedPlanResultOption();
        const enableMonthRange =
            isInspectionPlanResult &&
            selectedOption === CsvDownloadPage.PLAN_RESULT_OPTION_VALUES.CUSTOM_RANGE;

        this.machineCombobox?.setDisabled(!isInspectionStandard);
        this.startMonthCombobox?.setDisabled(!enableMonthRange);
        this.endMonthCombobox?.setDisabled(!enableMonthRange);
    }

    renderPlanResultOptionButtons() {
        if (!this.planResultOptionArea) return;

        this.planResultOptionArea.innerHTML = renderOptionButtonGroupHTML({
            name: 'planResultOption',
            selectedValue: this.getSelectedPlanResultOption(),
            action: 'selectPlanResultOption',
            className: 'csv-download__optionButtons',
            buttonClassName: 'csv-download__optionButton',
            options: [
                {
                    value: CsvDownloadPage.PLAN_RESULT_OPTION_VALUES.FISCAL_YEAR,
                    label: '今年度',
                },
                {
                    value: CsvDownloadPage.PLAN_RESULT_OPTION_VALUES.CUSTOM_RANGE,
                    label: '期間指定',
                },
            ],
        });
    }

    setHidden(element, shouldHide) {
        if (!element) return;
        element.hidden = shouldHide;
    }

    resetDownloadForm() {
        this.typeInputs.forEach((input) => {
            input.checked = false;
        });

        this.machineCombobox?.setValue('');
        this.machineCombobox?.setDisabled(true);

        this.renderPlanResultOptionButtons();
        this.clearMonthDropdownValues();

        this.startMonthCombobox?.setDisabled(true);
        this.endMonthCombobox?.setDisabled(true);

        this.render();
    }

    scheduleResetAfterSubmit() {
        window.setTimeout(() => {
            this.resetDownloadForm();
        }, 0);
    }

    destroy() {
        this.machineCombobox?.destroy();
        this.startMonthCombobox?.destroy();
        this.endMonthCombobox?.destroy();

        if (typeof this.unbindUIActions === 'function') {
            this.unbindUIActions();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen();

    const pageRoot = document.querySelector('[data-page="csv-download"]');
    if (!pageRoot) return;

    const app = new CsvDownloadPage(pageRoot);
    app.init();
});