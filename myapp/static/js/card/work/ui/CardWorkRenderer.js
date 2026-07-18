// static/js/card/work/ui/CardWorkRenderer.js

import {
    createCardWorkInputPanel,
} from './CardWorkInputPanelRenderer.js';

import {
    createCardWorkPlanCard,
} from './CardWorkPlanCardRenderer.js';

import {
    createCardWorkFilterPanel,
} from './CardWorkFilterPanelRenderer.js';

import {
    formatTargetDateLabel,
} from '../domain/CardWorkDisplayPolicy.js';

import {
    CARD_WORK_FILTER_DEFINITIONS,
} from '../domain/CardWorkFilterPolicy.js';

export function renderCardWorkPage({
    root,
    state,
    currentIndex = 0,
    inputState = {},
    validationErrors = [],
    isFilterOpen = false,
}) {
    if (!root) {
        return;
    }

    if (state?.status === 'error') {
        root.replaceChildren(
            createCardWorkMessage({
                title: '対象カードを取得できませんでした',
                message: state.message || '条件を確認してください。',
            })
        );
        return;
    }

    const plans = Array.isArray(state?.plans)
        ? state.plans
        : [];
    
    if (plans.length === 0) {
        if (shouldShowFilteredEmptyState(state)) {
            const children = [
                createCardWorkSummary(state),
                createCardWorkFilteredEmptyState(),
            ];
    
            if (isFilterOpen) {
                children.push(
                    createCardWorkFilterPanel({
                        activeFilters: state?.activeFilters || {},
                        filterOptions: state?.filterOptions || {},
                    })
                );
            }
    
            root.replaceChildren(...children);
            return;
        }
    
        root.replaceChildren(
            createCardWorkMessage({
                title: '対象カードはありません',
                message: 'この条件で作業できる点検カードはありません。',
            })
        );
        return;
    }

    const children = [
        createCardWorkSummary(state),
        createCardWorkActivePlanView({
            plans,
            currentIndex,
            inputState,
            validationErrors,
        }),
    ];
    
    if (isFilterOpen) {
        children.push(
            createCardWorkFilterPanel({
                activeFilters: state?.activeFilters || {},
                filterOptions: state?.filterOptions || {},
            })
        );
    }
    
    root.replaceChildren(...children);
}


function createCardWorkSummary(state) {
    const section = document.createElement('section');
    section.className = 'card-work-summary';

    const dateLabel = formatTargetDateLabel(state?.date);

    const title = document.createElement('h2');
    title.className = 'card-work-summary__title';
    title.textContent = `${dateLabel || '選択日'}の対象カード`;

    const actions = document.createElement('div');
    actions.className = 'card-work-summary__actions';

    const count = document.createElement('p');
    count.className = 'card-work-summary__description';
    count.textContent = `${state?.summaryCount ?? state?.count ?? 0}件`;

    const filterButton = createCardWorkFilterButton();

    actions.append(count, filterButton);
    section.append(title, actions);

    return section;
}


function shouldShowFilteredEmptyState(state = {}) {
    const summaryCount = Number(state?.summaryCount ?? state?.count ?? 0);

    return (
        summaryCount > 0 &&
        hasActiveCardWorkFilters(state?.activeFilters)
    );
}


function hasActiveCardWorkFilters(activeFilters = {}) {
    return CARD_WORK_FILTER_DEFINITIONS.some(
        (definition) => Boolean(activeFilters[definition.key])
    );
}


function createCardWorkFilterButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-work-filter-button';
    button.dataset.uiAction = 'open-filter';
    button.setAttribute('aria-label', 'フィルターを開く');

    const label = document.createElement('span');
    label.className = 'card-work-filter-button__label';
    label.textContent = 'フィルター';

    button.appendChild(label);

    return button;
}


function createCardWorkMessage({
    title,
    message,
}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-work-empty';

    const titleElement = document.createElement('h2');
    titleElement.textContent = title;

    const messageElement = document.createElement('p');
    messageElement.textContent = message;

    wrapper.append(titleElement, messageElement);

    return wrapper;
}


function createCardWorkFilteredEmptyState() {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-work-empty card-work-empty--filtered';

    const title = document.createElement('h2');
    title.textContent = 'フィルター条件に一致するカードはありません';

    const message = document.createElement('p');
    message.textContent = '条件をリセットすると、対象日のカードをすべて表示できます。';

    const actions = document.createElement('div');
    actions.className = 'card-work-empty__actions';

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.className = 'card-work-empty__button card-work-empty__button--primary';
    resetButton.dataset.uiAction = 'reset-filter';
    resetButton.textContent = 'フィルター条件をリセットして全て表示する';

    actions.appendChild(resetButton);
    wrapper.append(title, message, actions);

    return wrapper;
}


function clampIndex(index, total) {
    if (total <= 0) {
        return 0;
    }

    const numericIndex = Number(index);

    if (!Number.isFinite(numericIndex)) {
        return 0;
    }

    return Math.min(
        Math.max(Math.trunc(numericIndex), 0),
        total - 1
    );
}


function createCardWorkActivePlanView({
    plans,
    currentIndex,
    inputState = {},
    validationErrors = [],
}) {
    const section = document.createElement('section');
    section.className = 'card-work-active';
    
    if (inputState.isOpen) {
        section.classList.add('card-work-active--input-open');
    }

    const total = plans.length;
    const safeIndex = clampIndex(currentIndex, total);
    const plan = plans[safeIndex];

    const sidePager = createCardWorkSidePager({
        currentIndex: safeIndex,
        total,
    });

    const card = createCardWorkPlanCard({
        plan,
        index: safeIndex,
        total,
    });

    const navigation = createCardWorkNavigation({
        plan,
        inputState,
        validationErrors,
    });

    section.append(sidePager, card, navigation);

    return section;
}

function createCardWorkNavigation({
    plan = {},
    inputState = {},
    validationErrors = [],
} = {}) {
    const nav = document.createElement('div');
    nav.className = 'card-work-navigation';
    
    if (inputState.isOpen) {
        nav.classList.add('card-work-navigation--input-open');
    }

    if (inputState.isOpen) {
        nav.appendChild(createCardWorkInputPanel({
            plan,
            inputState,
            validationErrors,
        }));
        return nav;
    }

    const inputButton = document.createElement('button');
    inputButton.type = 'button';
    inputButton.className = 'card-work-navigation__button card-work-navigation__button--primary card-work-navigation__button--input';
    inputButton.dataset.uiAction = 'open-input';
    inputButton.textContent = '実績入力';

    nav.append(inputButton);

    return nav;
}


function createCardWorkSidePager({
    currentIndex,
    total,
}) {
    const pager = document.createElement('div');
    pager.className = 'card-work-side-pager';
    pager.setAttribute('aria-label', 'カード移動');

    const previousButton = document.createElement('button');
    previousButton.type = 'button';
    previousButton.className = 'card-work-side-pager__button card-work-side-pager__button--previous';
    previousButton.dataset.uiAction = 'previous';
    previousButton.disabled = currentIndex <= 0;
    previousButton.setAttribute('aria-label', '前のカードへ');

    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'card-work-side-pager__button card-work-side-pager__button--next';
    nextButton.dataset.uiAction = 'next';
    nextButton.disabled = currentIndex >= total - 1;
    nextButton.setAttribute('aria-label', '次のカードへ');

    pager.append(previousButton, nextButton);

    return pager;
}