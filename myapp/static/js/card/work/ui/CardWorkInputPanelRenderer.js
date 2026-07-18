// static/js/card/work/ui/CardWorkInputPanelRenderer.js

import {
    buildImplementationDateTimeValue,
} from '../domain/CardWorkInputStatePolicy.js';

import {
    formatPractitionerTriggerText,
} from '../domain/CardWorkPractitionerPolicy.js';

import {
    CARD_WORK_RESULT_OPTIONS,
    formatManHoursLabel,
} from '../domain/CardWorkDisplayPolicy.js';

import {
    renderDateTimeFieldHTML,
} from '../../../ui/componets/fields/DateTimeField.js';

import {
    renderOptionButtonGroupHTML,
} from '../../../ui/componets/buttons/OptionButtonGroup.js';


export function createCardWorkInputPanel({
    plan = {},
    inputState = {},
    validationErrors = [],
} = {}) {
    const panel = document.createElement('section');
    panel.className = 'card-work-input-panel';

    const header = createInputPanelHeader();
    const body = createInputPanelBody({
        plan,
        inputState,
        validationErrors,
    });
    const actions = createInputPanelActions();

    panel.append(header, body, actions);

    return panel;
}


function createInputPanelHeader() {
    const header = document.createElement('header');
    header.className = 'card-work-input-panel__header';

    const title = document.createElement('h3');
    title.className = 'card-work-input-panel__title';
    title.textContent = '実績入力';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'card-work-input-panel__close-button';
    closeButton.dataset.uiAction = 'close-input';
    closeButton.setAttribute('aria-label', '実績入力を閉じる');
    closeButton.textContent = '×';

    header.append(title, closeButton);

    return header;
}


function createInputPanelBody({
    plan = {},
    inputState = {},
    validationErrors = [],
} = {}) {
    const body = document.createElement('div');
    body.className = 'card-work-input-panel__body';

    const form = document.createElement('div');
    form.className = 'card-work-input-panel__form';

    form.append(
        createImplementationDateTimeField({
            inputState,
            validationErrors,
        }),
        createResultField({
            inputState,
            validationErrors,
        }),
        createImplementationContentField(inputState),
        createPractitionerField({
            inputState,
            validationErrors,
        }),
        createManHoursField({
            plan,
            inputState,
            validationErrors,
        }),
        createCommentField(inputState)
    );

    body.appendChild(form);

    return body;
}


function createInputPanelActions() {
    const actions = document.createElement('div');
    actions.className = 'card-work-input-panel__actions';

    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'card-work-navigation__button card-work-navigation__button--primary card-work-input-panel__submit';
    submitButton.dataset.uiAction = 'submit-result';
    submitButton.textContent = '登録';

    actions.appendChild(submitButton);

    return actions;
}


function createImplementationDateTimeField({
    inputState = {},
    validationErrors = [],
} = {}) {
    const fieldName = 'implementationDatetime';

    const wrapper = document.createElement('div');
    wrapper.className = 'card-work-input-panel__field card-work-input-panel__field--implementation-datetime';
    wrapper.dataset.cardWorkField = fieldName;

    wrapper.innerHTML = renderDateTimeFieldHTML({
        mode: 'datetime-local',
        label: '実施日時',
        role: 'implementation-datetime',
        value: buildImplementationDateTimeValue(inputState),
        className: 'card-work-input-panel__datetime',
        attrs: {
            required: true,
        },
    });

    applyValidationError({
        wrapper,
        fieldName,
        validationErrors,
        controlSelector: '[data-role="implementation-datetime"]',
    });

    return wrapper;
}


function createResultField({
    inputState = {},
    validationErrors = [],
} = {}) {
    const fieldName = 'result';

    const wrapper = document.createElement('div');
    wrapper.className = 'card-work-input-panel__field card-work-input-panel__field--result';
    wrapper.dataset.cardWorkField = fieldName;

    const label = document.createElement('span');
    label.className = 'ui-field__label card-work-input-panel__label';
    label.textContent = '結果';

    const fieldBody = document.createElement('div');
    fieldBody.className = 'card-work-input-panel__result';

    fieldBody.innerHTML = renderOptionButtonGroupHTML({
        name: 'card-work-result',
        action: 'select-card-work-result',
        selectedValue: inputState.result || '',
        className: 'card-work-result-options',
        buttonClassName: 'card-work-result-options__button',
        options: CARD_WORK_RESULT_OPTIONS,
    });

    wrapper.append(label, fieldBody);

    applyValidationError({
        wrapper,
        fieldName,
        validationErrors,
    });

    return wrapper;
}


function createImplementationContentField(inputState = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-work-input-panel__field card-work-input-panel__field--content';

    const label = document.createElement('label');
    label.className = 'ui-field card-work-input-panel__content-field';

    const labelText = document.createElement('span');
    labelText.className = 'ui-field__label card-work-input-panel__label';
    labelText.textContent = '実施内容';

    const textarea = document.createElement('textarea');
    textarea.className = 'ui-input card-work-input-panel__textarea';
    textarea.dataset.role = 'implementation-content';
    textarea.value = inputState.implementationContent || '';
    textarea.rows = 3;
    textarea.maxLength = 500;
    textarea.placeholder = '実施した内容を入力してください';

    label.append(labelText, textarea);
    wrapper.appendChild(label);

    return wrapper;
}


function createPractitionerField({
    inputState = {},
    validationErrors = [],
} = {}) {
    const fieldName = 'practitionerIds';

    const wrapper = document.createElement('div');
    wrapper.className = 'card-work-input-panel__field card-work-input-panel__field--practitioner';
    wrapper.dataset.cardWorkField = fieldName;

    const label = document.createElement('span');
    label.className = 'ui-field__label card-work-input-panel__label';
    label.textContent = '実施者';

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-dropdown card-work-input-panel__practitioner-dropdown';
    dropdown.dataset.role = 'card-work-practitioner-dropdown';
    dropdown.dataset.state = 'closed';

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.dataset.role = 'dropdown-input';
    hiddenInput.value = JSON.stringify(inputState.practitionerIds || []);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-dropdown__trigger';
    trigger.dataset.role = 'dropdown-trigger';

    const triggerText = document.createElement('span');
    triggerText.className = 'custom-dropdown__triggerText';
    triggerText.dataset.role = 'dropdown-trigger-text';
    triggerText.textContent = formatPractitionerTriggerText(inputState);

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

    const footer = document.createElement('div');
    footer.className = 'card-work-practitioner-dropdown__footer';

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'card-work-practitioner-dropdown__confirm';
    confirmButton.dataset.uiAction = 'confirm-practitioner-dropdown';
    confirmButton.textContent = 'OK';

    footer.appendChild(confirmButton);
    panel.append(list, footer);
    dropdown.append(hiddenInput, trigger, panel);

    wrapper.append(label, dropdown);

    applyValidationError({
        wrapper,
        fieldName,
        validationErrors,
        controlSelector: '[data-role="dropdown-trigger"]',
    });

    return wrapper;
}


function createManHoursField({
    plan = {},
    inputState = {},
    validationErrors = [],
} = {}) {
    const fieldName = 'actualManHours';

    const wrapper = document.createElement('div');
    wrapper.className = 'card-work-input-panel__field card-work-input-panel__field--man-hours';
    wrapper.dataset.cardWorkField = fieldName;

    const label = document.createElement('label');
    label.className = 'ui-field card-work-input-panel__man-hours-field';

    const labelText = document.createElement('span');
    labelText.className = 'ui-field__label card-work-input-panel__label';
    labelText.textContent = '工数';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ui-input card-work-input-panel__number';
    input.dataset.role = 'actual-man-hours';
    input.value = resolveActualManHoursValue(inputState);
    input.inputMode = 'numeric';
    input.placeholder = formatBaselineManHoursPlaceholder(plan);
    input.autocomplete = 'off';

    const unit = document.createElement('span');
    unit.className = 'card-work-input-panel__unit';
    unit.textContent = '分';

    label.append(labelText, input, unit);
    wrapper.appendChild(label);

    applyValidationError({
        wrapper,
        fieldName,
        validationErrors,
        controlSelector: '[data-role="actual-man-hours"]',
    });

    return wrapper;
}


function createCommentField(inputState = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-work-input-panel__field card-work-input-panel__field--comment';

    const label = document.createElement('label');
    label.className = 'ui-field card-work-input-panel__comment-field';

    const labelText = document.createElement('span');
    labelText.className = 'ui-field__label card-work-input-panel__label';
    labelText.textContent = 'コメント';

    const textarea = document.createElement('textarea');
    textarea.className = 'ui-input card-work-input-panel__textarea';
    textarea.dataset.role = 'comment';
    textarea.value = inputState.comment || '';
    textarea.rows = 2;
    textarea.maxLength = 500;
    textarea.placeholder = 'コメントを入力してください';

    label.append(labelText, textarea);
    wrapper.appendChild(label);

    return wrapper;
}


function resolveActualManHoursValue(inputState = {}) {
    if (inputState.actualManHours === null || inputState.actualManHours === undefined) {
        return '';
    }

    return inputState.actualManHours;
}


function formatBaselineManHoursPlaceholder(plan = {}) {
    const manHoursLabel = formatManHoursLabel(plan?.manHours);

    if (manHoursLabel === '-') {
        return '工数を入力';
    }

    return `基準工数: ${manHoursLabel}`;
}


function applyValidationError({
    wrapper,
    fieldName,
    validationErrors = [],
    controlSelector = '',
}) {
    const message = findValidationErrorMessage({
        fieldName,
        validationErrors,
    });

    if (!message) {
        return;
    }

    wrapper.classList.add('is-invalid');

    const control = controlSelector
        ? wrapper.querySelector(controlSelector)
        : null;

    control?.setAttribute('aria-invalid', 'true');

    const error = document.createElement('p');
    error.className = 'card-work-input-panel__error';
    error.dataset.cardWorkErrorFor = fieldName;
    error.textContent = message;

    wrapper.appendChild(error);
}

function findValidationErrorMessage({
    fieldName,
    validationErrors = [],
}) {
    const error = validationErrors.find(
        (item) => item?.field === fieldName
    );

    return error?.message || '';
}