// static/js/card/work/application/CardWorkPageService.js
import {
    executeCardWorkResultRegister,
} from '../../../api/fetchers.js';

import {
    createDefaultCardWorkInputState,
    splitImplementationDateTimeValue,
} from '../domain/CardWorkInputStatePolicy.js';

import {
    CARD_WORK_FILTER_DEFINITIONS,
    buildCascadingFilterOptions,
    createDefaultFilterDraft,
    getCardWorkFilterDefinitionByRole,
    normalizeFilterDraft,
    readFilterValuesFromDraft,
} from '../domain/CardWorkFilterPolicy.js';

import {
    buildCardWorkResultPayload,
} from '../domain/CardWorkResultPayloadPolicy.js';

import {
    validateCardWorkResultPayload,
} from '../domain/CardWorkResultValidationPolicy.js';

import {
    normalizePractitionerOptions,
    readPractitionerSelectionFromDropdownDetail,
    resolveDefaultPractitionerIds,
} from '../domain/CardWorkPractitionerPolicy.js';


import {
    renderCardWorkPage,
} from '../ui/CardWorkRenderer.js';


import {
    CustomDropdown,
} from '../../../ui/componets/customDropdown/CustomDropdown.js';


import {
    bindUIActions,
} from '../../../ui/componets/actions/UIActionDispatcher.js';


import {
    CardWorkSwipeController,
} from './CardWorkSwipeController.js';

const CARD_WORK_HOME_DASHBOARD_URL = '/home-dashboard/';

const CARD_WORK_PAGE_ACTION_HANDLERS = Object.freeze({
    previous: (service) => service.showPreviousCard(),
    next: (service) => service.showNextCard(),
    'open-input': (service) => service.openInputPanel(),
    'close-input': (service) => service.closeInputPanel(),
    'open-filter': (service) => service.openFilterPanel(),
    'close-filter': (service) => service.closeFilterPanel(),
    'reset-filter': (service) => service.resetFilter(),
    'apply-filter': (service) => service.applyFilter(),
    'confirm-practitioner-dropdown': (service) => service.confirmPractitionerDropdown(),
    'submit-result': (service) => {
        void service.submitResult();
    },
});


const CARD_WORK_INPUT_HANDLERS = Object.freeze({
    'implementation-datetime': (service, element) => {
        const {
            date,
            time,
        } = splitImplementationDateTimeValue(element.value);

        service.updateInputState({
            implementationDate: date,
            implementationTime: time,
        });

        service.clearValidationError('implementationDatetime');
    },
    'implementation-content': (service, element) => {
        service.updateInputState({
            implementationContent: element.value || '',
        });
    },
    'actual-man-hours': (service, element) => {
        service.updateInputState({
            actualManHours: element.value || '',
        });

        service.clearValidationError('actualManHours');
    },
    comment: (service, element) => {
        service.updateInputState({
            comment: element.value || '',
        });
    },
});


export class CardWorkPageService {
    constructor({
        root,
        initialState,
    }) {
        this.root = root;
        this.initialState = initialState || {};
        this.validationErrors = [];
        this.filterDraft = createDefaultFilterDraft(
            this.initialState?.activeFilters || {}
        );
        this.filterDropdowns = new Map();
        this.plans = Array.isArray(this.initialState?.plans)
        ? this.initialState.plans
        : [];
    
        this.initialPlanId = readInitialCardWorkPlanIdFromUrl();
        this.currentIndex = resolveInitialCardWorkIndex({
            plans: this.plans,
            planId: this.initialPlanId,
        });

        this.swipeController = new CardWorkSwipeController({
            root: this.root,
            onSwipeLeft: () => this.showNextCard(),
            onSwipeRight: () => this.showPreviousCard(),
        });
        this.draftsByPlanId = new Map();
        this.isFilterOpen = false;
        this.isSubmitting = false;
        this.practitionerOptions = normalizePractitionerOptions(this.initialState);
        this.disposeUIActions = null;
        this.defaultPractitionerIds = resolveDefaultPractitionerIds({
            initialState: this.initialState,
            practitionerOptions: this.practitionerOptions,
        });
        
        this.inputState = createDefaultCardWorkInputState({
            practitionerIds: this.defaultPractitionerIds,
        });
        
        this.practitionerDropdown = null;
        this.handleDropdownChange = this.handleDropdownChange.bind(this);

        this.handleClick = this.handleClick.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    async init() {
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        this.disposeUIActions = bindUIActions(
            this.root,
            this.createUIActionHandlers()
        );
    
        this.root?.addEventListener('click', this.handleClick);
        this.root?.addEventListener('input', this.handleInput);
        this.root?.addEventListener('change', this.handleInput);
        this.root?.addEventListener('ui:dropdown-change', this.handleDropdownChange);
    
        document.addEventListener('keydown', this.handleKeyDown);

        this.swipeController.bind();
    }


    destroy() {
        this.disposeUIActions?.();
        this.disposeUIActions = null;
    
        this.root?.removeEventListener('click', this.handleClick);
        this.root?.removeEventListener('input', this.handleInput);
        this.root?.removeEventListener('change', this.handleInput);
        this.root?.removeEventListener('ui:dropdown-change', this.handleDropdownChange);
    
        document.removeEventListener('keydown', this.handleKeyDown);
    
        this.swipeController?.destroy();
    
        this.destroyPractitionerDropdown();
        this.destroyFilterDropdowns();
    }


    createUIActionHandlers() {
        const pageActionHandlers = Object.keys(CARD_WORK_PAGE_ACTION_HANDLERS)
            .reduce((handlers, action) => ({
                ...handlers,
                [action]: this.createPageActionHandler(action),
            }), {});
    
        return {
            ...pageActionHandlers,
            'select-card-work-result': ({
                event,
                payload,
            } = {}) => {
                event?.preventDefault();
                this.selectCardWorkResult(payload);
            },
        };
    }
    
    
    createPageActionHandler(action) {
        return ({
            event,
        } = {}) => {
            event?.preventDefault();
            this.dispatchPageAction(action);
        };
    }


    handleClick(event) {
        if (event.target?.dataset?.role !== 'card-work-filter-backdrop') {
            return;
        }

        event.preventDefault();
        this.closeFilterPanel();
    }


    handleInput(event) {
        const role = event.target?.dataset?.role;
        const handler = CARD_WORK_INPUT_HANDLERS[role];
    
        if (!handler) {
            return;
        }
    
        handler(this, event.target);
    }


    handleDropdownChange(event) {
        if (this.handlePractitionerDropdownChange(event)) {
            return;
        }

        this.handleFilterDropdownChangeEvent(event);
    }


    handlePractitionerDropdownChange(event) {
        const dropdownRoot = event.target?.closest(
            '[data-role="card-work-practitioner-dropdown"]'
        );
    
        if (!dropdownRoot) {
            return false;
        }
    
        this.updateInputState(
            readPractitionerSelectionFromDropdownDetail(event.detail || {})
        );
    
        this.clearValidationError('practitionerIds');
    
        return true;
    }


    handleFilterDropdownChangeEvent(event) {
        const dropdownRoot = event.target?.closest('.card-work-filter-dropdown');
    
        if (!dropdownRoot) {
            return false;
        }
    
        this.handleFilterDropdownChange({
            role: dropdownRoot.dataset.role,
            detail: event.detail || {},
        });
    
        return true;
    }


    handleFilterDropdownChange({
        role,
        detail,
    } = {}) {
        const definition = getCardWorkFilterDefinitionByRole(role);
    
        if (!definition) {
            return;
        }
    
        this.filterDraft = {
            ...this.filterDraft,
            [definition.key]: String(detail?.value ?? ''),
        };
    
        this.refreshFilterDropdownOptions();
    }
    
    
    refreshFilterDropdownOptions() {
        const filterRows = this.getFilterRows();
    
        this.filterDraft = normalizeFilterDraft({
            draft: this.filterDraft,
            filterRows,
        });
    
        const options = buildCascadingFilterOptions({
            filterRows,
            draft: this.filterDraft,
        });
    
        CARD_WORK_FILTER_DEFINITIONS.forEach((definition) => {
            this.updateFilterDropdown({
                role: definition.role,
                items: withAllOption(options[definition.optionKey]),
                value: this.filterDraft[definition.key],
            });
        });
    }
    
    
    updateFilterDropdown({
        role,
        items,
        value,
    }) {
        const dropdown = this.filterDropdowns.get(role);
    
        if (!dropdown) {
            return;
        }
    
        dropdown.setItems(items, {
            preserveSelection: false,
        });
    
        dropdown.setValue(value);
    }


    dispatchPageAction(action) {
        const handler = CARD_WORK_PAGE_ACTION_HANDLERS[action];
    
        if (!handler) {
            return false;
        }
    
        handler(this);
        return true;
    }

    confirmPractitionerDropdown() {
        if (!this.practitionerDropdown) {
            return;
        }
    
        this.practitionerDropdown.close();
    
        const trigger = this.root?.querySelector(
            '[data-role="card-work-practitioner-dropdown"] [data-role="dropdown-trigger"]'
        );
    
        trigger?.focus();
    }

    async submitResult() {
        if (this.isSubmitting) {
            return;
        }
    
        const payload = buildCardWorkResultPayload({
            plan: this.getCurrentPlan(),
            inputState: this.inputState,
        });
    
        const validation = validateCardWorkResultPayload(payload);
    
        this.validationErrors = validation.errors;
    
        if (!validation.isValid) {
            this.render();
            this.focusFirstValidationError();
            return;
        }
    
        this.validationErrors = [];
        this.isSubmitting = true;
    
        try {
            const response = await executeCardWorkResultRegister(payload);
    
            if (!response) {
                return;
            }
    
            this.handleResultRegistered({
                planId: payload.planId,
                response,
            });
    
        } catch (error) {
            console.error('[card work result register failed]', error);
            alert(error?.message || '実績登録に失敗しました。');
    
        } finally {
            this.isSubmitting = false;
        }
    }

    handleResultRegistered({
        planId,
        response,
    } = {}) {
        console.log('[card work result registered]', response);
    
        const registeredPlanId = String(planId || '');
    
        if (registeredPlanId) {
            this.draftsByPlanId.delete(registeredPlanId);
        }
    
        this.plans = this.plans.filter(
            (plan) => String(plan?.planId ?? '') !== registeredPlanId
        );
    
        const nextFilterRows = this.removeRegisteredPlanFilterRows(registeredPlanId);
        const nextSummaryCount = Math.max(
            0,
            Number(this.initialState?.summaryCount ?? this.initialState?.count ?? 0) - 1
        );
        
        this.initialState = {
            ...this.initialState,
            plans: this.plans,
            count: this.plans.length,
            summaryCount: nextSummaryCount,
            filterRows: nextFilterRows,
        };

        if (nextSummaryCount <= 0) {
            this.goToHomeDashboard();
            return;
        }
    
        if (this.plans.length === 0) {
            this.currentIndex = 0;
            this.inputState = createDefaultCardWorkInputState({
                practitionerIds: this.defaultPractitionerIds,
            });
            this.validationErrors = [];
            this.render();
            return;
        }
    
        if (this.currentIndex >= this.plans.length) {
            this.currentIndex = this.plans.length - 1;
        }
    
        this.inputState = this.createInputStateForCurrentPlan({
            isOpen: false,
        });
    
        this.validationErrors = [];
        this.render();
        this.resetActiveCardDetailScroll();
    }

    handleKeyDown(event) {
        if (event.key !== 'Escape') {
            return;
        }
    
        if (event.isComposing) {
            return;
        }
    
        if (this.isFilterOpen) {
            event.preventDefault();
            this.closeFilterPanel();
            return;
        }
    
        if (!this.inputState?.isOpen) {
            return;
        }
    
        event.preventDefault();
        this.closeInputPanel();
    }


    selectCardWorkResult(payload = {}) {
        const result = payload.value || '';
    
        this.updateInputState({
            result,
        });
    
        this.applyResultSelection(result);
        this.clearValidationError('result');
    }


    applyResultSelection(selectedValue) {
        const buttons = this.root?.querySelectorAll('.card-work-result-options__button');
    
        if (!buttons) {
            return;
        }
    
        buttons.forEach((button) => {
            const isSelected = button.dataset.optionValue === selectedValue;
    
            button.classList.toggle('is-selected', isSelected);
            button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
            button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    }

    openFilterPanel() {
        this.filterDraft = createDefaultFilterDraft(
            this.initialState?.activeFilters || {}
        );
    
        this.isFilterOpen = true;
        this.render();
    }

    closeFilterPanel() {
        this.isFilterOpen = false;
        this.render();
    }

    goToHomeDashboard() {
        window.location.replace(CARD_WORK_HOME_DASHBOARD_URL);
    }
    
    resetFilter() {
        this.updateUrlWithFilters(createDefaultFilterDraft());
    }
    

    applyFilter() {
        const filterValues = this.readFilterValues();
    
        this.updateUrlWithFilters(filterValues);
    }
    
    
    readFilterValues() {
        return readFilterValuesFromDraft(this.filterDraft);
    }
    
    
    updateUrlWithFilters(filterValues = {}) {
        const url = new URL(window.location.href);

        CARD_WORK_FILTER_DEFINITIONS.forEach((definition) => {
            updateSearchParam(
                url,
                definition.queryKey,
                filterValues[definition.key]
            );
        });

        window.location.assign(url.toString());
    }


    openInputPanel() {
        this.inputState = this.createInputStateForCurrentPlan({
            isOpen: true,
        });
    
        this.render();
    }

    closeInputPanel() {
        this.saveCurrentDraft(this.inputState);
    
        this.inputState = {
            ...this.inputState,
            isOpen: false,
        };
    
        this.render();
    }

    updateInputState(
        patch = {},
        {
            shouldRender = false,
        } = {}
    ) {
        this.inputState = {
            ...this.inputState,
            ...patch,
        };
    
        this.saveCurrentDraft(this.inputState);
    
        if (shouldRender) {
            this.render();
        }
    }

    showPreviousCard() {
        this.moveToCard(this.currentIndex - 1);
    }

    showNextCard() {
        this.moveToCard(this.currentIndex + 1);
    }

    moveToCard(nextIndex) {
        if (!this.canMoveToCard(nextIndex)) {
            return;
        }
    
        const wasInputOpen = Boolean(this.inputState?.isOpen);
    
        this.saveCurrentDraft(this.inputState);
    
        this.currentIndex = nextIndex;
        this.inputState = this.createInputStateForCurrentPlan({
            isOpen: wasInputOpen,
        });
    
        this.render();
        this.resetActiveCardDetailScroll();
    }

    canMoveToCard(index) {
        return (
            index >= 0 &&
            index < this.plans.length
        );
    }

    render() {
        this.destroyPractitionerDropdown();
        this.destroyFilterDropdowns();
    
        renderCardWorkPage({
            root: this.root,
            state: this.initialState,
            currentIndex: this.currentIndex,
            inputState: this.inputState,
            validationErrors: this.validationErrors,
            isFilterOpen: this.isFilterOpen,
        });
    
        this.initializePractitionerDropdown();
        this.initializeFilterDropdowns();
    }

    initializePractitionerDropdown() {
        const dropdownRoot = this.root?.querySelector('[data-role="card-work-practitioner-dropdown"]');
    
        if (!dropdownRoot) {
            return;
        }
    
        const items = this.practitionerOptions;
    
        this.practitionerDropdown = new CustomDropdown(dropdownRoot, {
            items,
            multiple: true,
            values: this.inputState.practitionerIds || [],
            searchable: false,
            placeholder: items.length > 0
                ? '実施者を選択してください'
                : '選択できる実施者がありません',
            emptyText: '選択できる実施者がありません',
            autoSelectFirst: false,
        });
    }


    initializeFilterDropdowns() {
        if (!this.isFilterOpen) {
            return;
        }

        const filterRows = this.getFilterRows();

        this.filterDraft = normalizeFilterDraft({
            draft: this.filterDraft,
            filterRows,
        });

        const options = buildCascadingFilterOptions({
            filterRows,
            draft: this.filterDraft,
        });

        CARD_WORK_FILTER_DEFINITIONS.forEach((definition) => {
            this.createFilterDropdown({
                role: definition.role,
                items: withAllOption(options[definition.optionKey]),
                value: this.filterDraft[definition.key],
                placeholder: 'すべて',
            });
        });
    }
    
    
    createFilterDropdown({
        role,
        items,
        value,
        placeholder,
    }) {
        const dropdownRoot = this.root?.querySelector(`[data-role="${role}"]`);
    
        if (!dropdownRoot) {
            return;
        }
    
        const dropdown = new CustomDropdown(dropdownRoot, {
            items,
            value,
            searchable: false,
            placeholder,
            emptyText: '候補がありません',
            autoSelectFirst: false,
        });
    
        this.filterDropdowns.set(role, dropdown);
    }
    
    
    destroyFilterDropdowns() {
        this.filterDropdowns.forEach((dropdown) => {
            dropdown.destroy();
        });
    
        this.filterDropdowns.clear();
    }
    
    
    getFilterRows() {
        return Array.isArray(this.initialState?.filterRows)
            ? this.initialState.filterRows
            : [];
    }

    removeRegisteredPlanFilterRows(planId) {
        const registeredPlanId = String(planId || '');
    
        if (!registeredPlanId) {
            return this.getFilterRows();
        }
    
        return this.getFilterRows().filter(
            (row) => String(row?.planId ?? '') !== registeredPlanId
        );
    }
    
    destroyPractitionerDropdown() {
        if (!this.practitionerDropdown) {
            return;
        }
    
        this.practitionerDropdown.destroy();
        this.practitionerDropdown = null;
    }
    
    getCurrentPlan() {
        return this.plans[this.currentIndex] || {};
    }

    getCurrentPlanId() {
        const planId = this.getCurrentPlan()?.planId;
    
        if (planId === null || planId === undefined || planId === '') {
            return '';
        }
    
        return String(planId);
    }

    createInputStateForCurrentPlan({
        isOpen = false,
    } = {}) {
        const planId = this.getCurrentPlanId();
        const draft = planId
            ? this.draftsByPlanId.get(planId)
            : null;
    
        return {
            ...createDefaultCardWorkInputState({
                practitionerIds: this.defaultPractitionerIds,
            }),
            ...(draft || {}),
            isOpen,
        };
    }

    saveCurrentDraft(inputState = this.inputState) {
        const planId = this.getCurrentPlanId();
    
        if (!planId) {
            return;
        }
    
        const {
            isOpen,
            ...draft
        } = inputState;
    
        this.draftsByPlanId.set(planId, draft);
    }

    resetActiveCardDetailScroll() {
        window.requestAnimationFrame(() => {
            const details = this.root?.querySelector('.card-work-plan-card__details');
    
            if (!details) {
                return;
            }
    
            details.scrollTop = 0;
        });
    }

    focusFirstValidationError() {
        window.requestAnimationFrame(() => {
            const firstInvalidField = this.root?.querySelector(
                '.card-work-input-panel__field.is-invalid'
            );
    
            if (!firstInvalidField) {
                return;
            }
    
            const focusTarget = firstInvalidField.querySelector(
                'input, textarea, button, [tabindex]:not([tabindex="-1"])'
            );
    
            focusTarget?.focus?.({
                preventScroll: true,
            });
    
            firstInvalidField.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
            });
        });
    }

    clearValidationError(field) {
        if (!field) {
            return;
        }
    
        const hasError = this.validationErrors.some((error) => error.field === field);
    
        if (!hasError) {
            return;
        }
    
        this.validationErrors = this.validationErrors.filter(
            (error) => error.field !== field
        );
    
        const fieldElement = this.root?.querySelector(
            `[data-card-work-field="${field}"]`
        );
    
        if (!fieldElement) {
            return;
        }
    
        fieldElement.classList.remove('is-invalid');
    
        const errorElement = fieldElement.querySelector(
            `[data-card-work-error-for="${field}"]`
        );
    
        errorElement?.remove();
    
        const control = fieldElement.querySelector(
            'input, textarea, button, [tabindex]:not([tabindex="-1"])'
        );
    
        control?.removeAttribute('aria-invalid');
    }
}

function updateSearchParam(url, key, value) {
    const normalizedValue = String(value || '').trim();

    if (normalizedValue) {
        url.searchParams.set(key, normalizedValue);
        return;
    }

    url.searchParams.delete(key);
}

function withAllOption(options = []) {
    return [
        {
            value: '',
            label: 'すべて',
        },
        ...options,
    ];
}

function readInitialCardWorkPlanIdFromUrl() {
    const params = new URLSearchParams(window.location.search);

    return String(params.get('plan_id') || '').trim();
}


function resolveInitialCardWorkIndex({
    plans = [],
    planId = '',
} = {}) {
    const normalizedPlanId = normalizeCardWorkPlanId(planId);

    if (!normalizedPlanId || !Array.isArray(plans) || plans.length === 0) {
        return 0;
    }

    const foundIndex = plans.findIndex((plan) => {
        return resolveCardWorkPlanId(plan) === normalizedPlanId;
    });

    return foundIndex >= 0
        ? foundIndex
        : 0;
}


function resolveCardWorkPlanId(plan = {}) {
    return normalizeCardWorkPlanId(
        plan?.planId ??
        plan?.plan_id ??
        plan?.PLAN_ID ??
        plan?.id ??
        ''
    );
}


function normalizeCardWorkPlanId(value) {
    return String(value ?? '').trim();
}