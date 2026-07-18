// static/js/home/ui/HomeAssignModalRenderer.js
import {
    renderDateTimeFieldHTML,
} from '../../ui/componets/fields/DateTimeField.js';


import {
    executeScheduleEventMove,
    fetchHomeAssignMemberOptions,
} from '../../api/fetchers.js';


import {
    CustomDropdown,
} from '../../ui/componets/customDropdown/index.js';


import {
    dispatchHomeAssignCompletedEvent,
} from './HomeAssignEvents.js';


let modalElement = null;
let currentItem = null;
let isEscapeEventBound = false;
let holderDropdown = null;
let holderMemberById = new Map();


export function openHomeAssignModal(item) {
    currentItem = item || null;

    const modal = ensureHomeAssignModal();

    renderHomeAssignModalContent(currentItem);

    modal.classList.remove('is-hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('home-assign-modal-open');

    bindEscapeEvent();
    loadHomeAssignMemberOptions();

    const closeButton = modal.querySelector('[data-home-assign-close]');
    closeButton?.focus();
}


function ensureHomeAssignModal() {
    if (modalElement) {
        return modalElement;
    }

    modalElement = document.createElement('div');
    modalElement.className = 'home-assign-modal is-hidden';
    modalElement.setAttribute('role', 'dialog');
    modalElement.setAttribute('aria-modal', 'true');
    modalElement.setAttribute('aria-hidden', 'true');
    modalElement.setAttribute('aria-labelledby', 'homeAssignModalTitle');

    modalElement.innerHTML = `
        <div class="home-assign-modal__backdrop" data-home-assign-close></div>

        <section class="home-assign-modal__dialog">
            <header class="home-assign-modal__header">
                <div>
                    <p class="home-assign-modal__eyebrow">作業登録</p>
                    <div
                        id="homeAssignModalTitle"
                        class="home-assign-summary__title home-assign-summary__title--modal"
                        data-home-assign-title
                    ></div>
                </div>

                <button
                    type="button"
                    class="home-assign-modal__close"
                    data-home-assign-close
                    aria-label="閉じる"
                >
                    ×
                </button>
            </header>

            <div class="home-assign-modal__body" data-home-assign-body></div>

            <footer class="home-assign-modal__footer">
                <button
                    type="button"
                    class="home-assign-modal__button home-assign-modal__button--sub"
                    data-home-assign-close
                >
                    閉じる
                </button>

                <button
                    type="button"
                    class="home-assign-modal__button home-assign-modal__button--main"
                    data-home-assign-submit
                    disabled
                >
                    登録
                </button>
            </footer>
        </section>
    `;

    modalElement.addEventListener('click', handleModalClick);
    modalElement.addEventListener('input', handleHomeAssignFormChange);
    modalElement.addEventListener('change', handleHomeAssignFormChange);
    modalElement.addEventListener('ui:dropdown-change', handleHomeAssignFormChange);

    document.body.appendChild(modalElement);

    return modalElement;
}

function handleModalClick(event) {
    const submitButton = event.target.closest('[data-home-assign-submit]');

    if (submitButton) {
        event.preventDefault();
        handleHomeAssignSubmit();
        return;
    }

    const closeButton = event.target.closest('[data-home-assign-close]');

    if (!closeButton) {
        return;
    }

    event.preventDefault();
    closeHomeAssignModal();
}

async function handleHomeAssignSubmit() {
    const formValue = readHomeAssignFormValue();

    if (!isHomeAssignFormReady()) {
        console.warn('[home assign] required fields are missing:', formValue);
        updateHomeAssignSubmitButtonState();
        return;
    }

    setHomeAssignSubmitting(true);

    try {
        const response = await executeScheduleEventMove({
            planId: formValue.planId,
            holderId: formValue.holderId,
            planTime: formValue.planTime,
            assignedAffiliationId: formValue.assignedAffiliationId,
        });

        console.log('[home assign] assigned:', response);

        dispatchHomeAssignCompletedEvent({
            formValue,
            response,
        });

        closeHomeAssignModal();
    } catch (error) {
        console.error('[home assign] assign failed:', error);
        alert('作業登録に失敗しました。時間をおいて再度お試しください。');
    } finally {
        setHomeAssignSubmitting(false);
    }
}


function setHomeAssignSubmitting(isSubmitting) {
    const submitButton = modalElement?.querySelector('[data-home-assign-submit]');

    if (!submitButton) {
        return;
    }

    submitButton.disabled = Boolean(isSubmitting);

    if (isSubmitting) {
        submitButton.dataset.originalText = submitButton.textContent;
        submitButton.textContent = '登録中...';
        submitButton.classList.add('is-submitting');
        submitButton.setAttribute('aria-busy', 'true');
        return;
    }

    submitButton.textContent = submitButton.dataset.originalText || '登録';
    submitButton.classList.remove('is-submitting');
    submitButton.setAttribute('aria-busy', 'false');

    updateHomeAssignSubmitButtonState();
}


function handleHomeAssignFormChange() {
    updateHomeAssignSubmitButtonState();
}

function updateHomeAssignSubmitButtonState() {
    const submitButton = modalElement?.querySelector('[data-home-assign-submit]');

    if (!submitButton) {
        return;
    }

    const isReady = isHomeAssignFormReady();

    submitButton.disabled = !isReady;
    submitButton.classList.toggle('is-disabled', !isReady);
    submitButton.setAttribute('aria-disabled', isReady ? 'false' : 'true');
}

function isHomeAssignFormReady() {
    const formValue = readHomeAssignFormValue();

    return Boolean(
        formValue.planId
        && formValue.workDate
        && formValue.startTime
        && formValue.holderId
        && formValue.planTime
    );
}


function readHomeAssignFormValue() {
    const workDate = getInputValue('[data-home-assign-work-date]');
    const startTime = getInputValue('[data-home-assign-start-time]');
    const holderId = getInputValue('[data-home-assign-holder-id]');

    return {
        planId: currentItem?.planId ?? '',
        workDate,
        startTime,
        holderId,
        planTime: buildPlanTimeValue({
            workDate,
            startTime,
        }),
        assignedAffiliationId: getSelectedHolderAffiliationId(holderId),
    };
}


function buildPlanTimeValue({ workDate, startTime }) {
    if (!workDate || !startTime) {
        return '';
    }

    return `${workDate}T${startTime}`;
}

function getSelectedHolderAffiliationId(holderId) {
    if (!holderId) {
        return '';
    }

    const selectedMember = holderMemberById.get(String(holderId));

    return selectedMember?.affiliationId || '';
}


function getInputValue(selector) {
    return modalElement
        ?.querySelector(selector)
        ?.value
        ?.trim() || '';
}

function bindEscapeEvent() {
    if (isEscapeEventBound) {
        return;
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }

        if (!modalElement || modalElement.classList.contains('is-hidden')) {
            return;
        }

        closeHomeAssignModal();
    });

    isEscapeEventBound = true;
}


function renderHomeAssignModalContent(item) {
    updateHomeAssignModalTitle(item);

    const body = modalElement?.querySelector('[data-home-assign-body]');

    if (!body) {
        return;
    }

    if (!item) {
        body.replaceChildren(createEmptyMessage());
        updateHomeAssignSubmitButtonState();
        return;
    }

    body.replaceChildren(
        createTaskSummary(item),
        createAssignForm()
    );

    updateHomeAssignSubmitButtonState();
}


function updateHomeAssignModalTitle(item) {
    const title = modalElement?.querySelector('[data-home-assign-title]');

    if (!title) {
        return;
    }

    title.replaceChildren(createSummaryTitleText(item));
}

function createSummaryTitleText(item) {
    const main = document.createElement('p');
    main.className = 'home-assign-summary__main';
    main.textContent = formatTaskTitle(item);

    return main;
}


function createAssignForm() {
    const form = document.createElement('div');
    form.className = 'home-assign-form';
    form.dataset.homeAssignForm = 'true';

    form.appendChild(createAssignFormHeader());

    form.appendChild(createHomeAssignDateTimeField());

    form.appendChild(createField({
        label: '作業者',
        input: createHolderDropdownRoot(),
    }));

    return form;
}

function createAssignFormHeader() {
    const header = document.createElement('div');
    header.className = 'home-assign-form__header';

    const title = document.createElement('p');
    title.className = 'home-assign-form__title';
    title.textContent = '登録内容';

    const description = document.createElement('p');
    description.className = 'home-assign-form__description';
    description.textContent = '作業日・開始時刻・作業者を指定してください。';

    header.append(title, description);

    return header;
}


function createHomeAssignDateTimeField() {
    return createElementFromHTML(renderDateTimeFieldHTML({
        mode: 'split',
        layout: 'stack',
        dateLabel: '作業日',
        timeLabel: '開始時刻',
        dateValue: getTodayDateValue(),
        timeValue: getCurrentTimeValue(),
        dateRole: 'home-assign-work-date',
        timeRole: 'home-assign-start-time',
        groupClassName: 'home-assign-form__datetime',
        fieldClassName: 'home-assign-form__field',
        labelClassName: 'home-assign-form__label',
        dateAttrs: {
            'data-home-assign-work-date': 'true',
        },
        timeAttrs: {
            'data-home-assign-start-time': 'true',
            step: '60',
        },
    }));
}


function createField({ label, input }) {
    const field = document.createElement('div');
    field.className = 'home-assign-form__field';

    const labelElement = document.createElement('span');
    labelElement.className = 'home-assign-form__label';
    labelElement.textContent = label;

    field.append(labelElement, input);

    return field;
}


function createHolderDropdownRoot() {
    const root = document.createElement('div');
    root.className = 'custom-dropdown home-assign-member-dropdown';
    root.dataset.homeAssignHolderDropdown = 'true';

    root.innerHTML = `
        <button
            type="button"
            class="custom-dropdown__trigger"
            data-role="dropdown-trigger"
        >
            <span
                class="custom-dropdown__triggerText"
                data-role="dropdown-trigger-text"
            >
                作業者を取得中...
            </span>
        </button>

        <div
            class="custom-dropdown__panel"
            data-role="dropdown-panel"
        >
            <div
                class="custom-dropdown__list"
                data-role="dropdown-list"
            ></div>
        </div>

        <input
            type="hidden"
            data-role="dropdown-input"
            data-home-assign-holder-id="true"
            value=""
        >
    `;

    return root;
}


function initializeHolderDropdown(root, {
    items = [],
    placeholder = '作業者を選択',
    disabled = false,
} = {}) {
    destroyHolderDropdown();

    holderDropdown = new CustomDropdown(root, {
        items,
        value: '',
        searchable: false,
        placeholder,
        emptyText: '候補がありません',
        autoSelectFirst: false,
    });

    holderDropdown.setDisabled(disabled);
}


function createTaskSummary(item) {
    const summary = document.createElement('div');
    summary.className = 'home-assign-summary';

    const list = document.createElement('dl');
    list.className = 'home-assign-summary__list';

    appendSummaryRow(list, '点検No', item?.inspectionNo || '未設定');
    appendSummaryRow(list, '計画日', formatPlanDate(item));
    appendSummaryRow(list, '工数', formatManHours(item?.manHours));

    summary.appendChild(list);

    return summary;
}


function appendSummaryRow(list, labelText, valueText) {
    const label = document.createElement('dt');
    label.textContent = labelText;

    const value = document.createElement('dd');
    value.textContent = valueText || '未設定';

    list.append(label, value);
}

function createEmptyMessage() {
    const message = document.createElement('p');
    message.className = 'home-assign-modal__empty';
    message.textContent = '作業情報を取得できませんでした。';

    return message;
}

function formatTaskTitle(item) {
    return [
        item?.equipmentName || '',
        item?.workName || '',
    ].filter(Boolean).join('_') || '作業名なし';
}

function formatPlanDate(item) {
    return [
        item?.planDateLabel || '',
        item?.planDateAlias || '',
    ].filter(Boolean).join(' ') || '日付なし';
}

function formatManHours(manHours) {
    if (manHours === '' || manHours == null) {
        return '未設定';
    }

    return `${manHours}分`;
}

function getTodayDateValue(date = new Date()) {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());

    return `${year}-${month}-${day}`;
}

function getCurrentTimeValue(date = new Date()) {
    const hour = pad2(date.getHours());
    const minute = pad2(date.getMinutes());

    return `${hour}:${minute}`;
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

async function loadHomeAssignMemberOptions() {
    const root = modalElement?.querySelector('[data-home-assign-holder-dropdown]');

    if (!root) {
        return;
    }

    initializeHolderDropdown(root, {
        items: [],
        placeholder: '作業者を取得中...',
        disabled: true,
    });

    try {
        const response = await fetchHomeAssignMemberOptions();
        const members = response?.data?.members;
        const safeMembers = Array.isArray(members) ? members : [];
        const items = mapMembersToDropdownItems(safeMembers);
        
        holderMemberById = buildHolderMemberMap(safeMembers);
        
        initializeHolderDropdown(root, {
            items,
            placeholder: items.length
                ? '作業者を選択'
                : '作業者候補がありません',
            disabled: !items.length,
        });
        
        updateHomeAssignSubmitButtonState();
    } catch (error) {
        holderMemberById = new Map();

        initializeHolderDropdown(root, {
            items: [],
            placeholder: '作業者候補の取得に失敗しました',
            disabled: true,
        });

        updateHomeAssignSubmitButtonState();
    }
}


function buildHolderMemberMap(members) {
    return new Map(
        members
            .filter((member) => member?.id)
            .map((member) => [String(member.id), member])
    );
}


function mapMembersToDropdownItems(members) {
    return members
        .filter((member) => member?.id && member?.name)
        .map((member) => ({
            value: member.id,
            label: member.name,
            member,
        }));
}


function createElementFromHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '').trim();

    return template.content.firstElementChild;
}


function closeHomeAssignModal() {
    if (!modalElement) {
        return;
    }

    destroyHolderDropdown();
    holderMemberById = new Map();
    currentItem = null;

    modalElement.classList.add('is-hidden');
    modalElement.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('home-assign-modal-open');
}


function destroyHolderDropdown() {
    if (!holderDropdown) {
        return;
    }

    holderDropdown.destroy();
    holderDropdown = null;
}