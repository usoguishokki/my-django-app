// static/js/card/work/ui/CardWorkFilterPanelRenderer.js

import {
    CARD_WORK_FILTER_DEFINITIONS,
} from '../domain/CardWorkFilterPolicy.js';

export function createCardWorkFilterPanel({
    activeFilters = {},
    filterOptions = {},
} = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'card-work-filter-backdrop';
    backdrop.dataset.role = 'card-work-filter-backdrop';

    const panel = document.createElement('section');
    panel.className = 'card-work-filter-panel';
    panel.setAttribute('aria-label', 'フィルター');

    const header = createFilterHeader();
    const body = createFilterBody({
        activeFilters,
        filterOptions,
    });
    const actions = createFilterActions();

    panel.append(header, body, actions);
    backdrop.appendChild(panel);

    return backdrop;
}


function createFilterHeader() {
    const header = document.createElement('header');
    header.className = 'card-work-filter-panel__header';

    const title = document.createElement('h3');
    title.className = 'card-work-filter-panel__title';
    title.textContent = 'フィルター';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'card-work-filter-panel__close';
    closeButton.dataset.uiAction = 'close-filter';
    closeButton.setAttribute('aria-label', 'フィルターを閉じる');
    closeButton.textContent = '×';

    header.append(title, closeButton);

    return header;
}


function createFilterBody({
    activeFilters = {},
} = {}) {
    const body = document.createElement('div');
    body.className = 'card-work-filter-panel__body';

    body.append(
        ...CARD_WORK_FILTER_DEFINITIONS.map((definition) =>
            createFilterDropdownField({
                label: definition.label,
                role: definition.role,
                value: activeFilters[definition.key] || '',
            })
        )
    );

    return body;
}


function createFilterDropdownField({
    label,
    role,
    value,
}) {
    const field = document.createElement('div');
    field.className = 'card-work-filter-panel__field';

    const labelText = document.createElement('span');
    labelText.className = 'card-work-filter-panel__label';
    labelText.textContent = label;

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-dropdown card-work-filter-dropdown';
    dropdown.dataset.role = role;
    dropdown.dataset.state = 'closed';

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.dataset.role = 'dropdown-input';
    hiddenInput.value = value || '';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-dropdown__trigger';
    trigger.dataset.role = 'dropdown-trigger';

    const triggerText = document.createElement('span');
    triggerText.className = 'custom-dropdown__triggerText';
    triggerText.dataset.role = 'dropdown-trigger-text';
    triggerText.textContent = 'すべて';

    const triggerIcon = document.createElement('span');
    triggerIcon.className = 'custom-dropdown__triggerIcon';
    triggerIcon.setAttribute('aria-hidden', 'true');

    trigger.append(triggerText, triggerIcon);

    const panel = document.createElement('div');
    panel.className = 'custom-dropdown__panel';
    panel.dataset.role = 'dropdown-panel';
    panel.hidden = true;

    const list = document.createElement('div');
    list.className = 'custom-dropdown__list';
    list.dataset.role = 'dropdown-list';

    panel.appendChild(list);
    dropdown.append(hiddenInput, trigger, panel);
    field.append(labelText, dropdown);

    return field;
}


function createFilterActions() {
    const actions = document.createElement('div');
    actions.className = 'card-work-filter-panel__actions';

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'card-work-filter-panel__button card-work-filter-panel__button--secondary';
    resetButton.dataset.uiAction = 'reset-filter';
    resetButton.textContent = 'リセット';

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'card-work-filter-panel__button card-work-filter-panel__button--primary';
    applyButton.dataset.uiAction = 'apply-filter';
    applyButton.textContent = '適用';

    actions.append(resetButton, applyButton);

    return actions;
}