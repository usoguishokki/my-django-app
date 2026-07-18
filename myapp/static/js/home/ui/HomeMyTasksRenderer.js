// static/js/home/ui/HomeMyTasksRenderer.js
import {
    isoDateSortKey,
} from '../../ui/sorters/sortKeys.js';


import {
    UIManger,
} from '../../manager/UIManger.js';


import {
    getById,
    setPanelHealth,
    setText,
} from './domHelpers.js';


import {
    createHomeDetailEmptyState,
    createHomeDetailGroupSummaryList,
    createHomeDetailTaskList,
} from './HomeDetailGroupRenderer.js';


import {
    canOpenCardPageFromMyTaskDateGroup,
    shouldPreviewCardListFromMyTaskDateGroup,
} from '../domain/HomeCardNavigationPolicy.js';


import {
    openCardPageFromMyTaskItem,
} from '../navigation/HomeCardPageNavigator.js';


import {
    HOME_MY_TASK_STATUS_ORDER,
    resolveHomeStatusLabel,
} from '../domain/HomeStatusPolicy.js';


const MY_TASK_UNKNOWN_STATUS_KEY = 'unknown';
const MY_TASK_UNKNOWN_STATUS_LABEL = '状態未設定';


const MY_TASK_GROUP_SELECTOR = '[data-my-task-group-key]';
const MY_TASK_CARD_SELECTOR = '.home-task-card[data-plan-id]';

const MY_TASK_HEADER_BACK_BUTTON_ID = 'myTasksHeaderBackButton';

let latestMyTaskStatusGroups = [];
let latestMyTasksTitle = '自分の仕事';
let currentMyTaskStatusGroupKey = '';
let currentMyTaskDateGroupKey = '';
let isMyTasksPanelEventBound = false;


export function renderMyTasks(payload) {
    const scope = payload?.scope || {};
    const groups = Array.isArray(payload?.groups)
        ? payload.groups
        : [];

    latestMyTaskStatusGroups = buildMyTaskStatusDisplayGroups(groups);
    resetMyTasksDrilldownState();

    bindMyTasksPanelEvents();

    const holderName = UIManger.normalizePersonName(scope.holderName);

    latestMyTasksTitle = holderName
        ? `${holderName}の仕事`
        : '自分の仕事';

    setPanelHealth('homeMyTasksPanel', resolveMyTasksHealth(groups));
    setText('myTasksTitle', latestMyTasksTitle);
    setMyTasksHeaderBackButtonVisible(false);

    renderMyTaskStatusSummaryView();
}


function buildMyTaskStatusDisplayGroups(groups) {
    const items = flattenMyTaskDateGroups(groups);
    const statusGroups = groupMyTaskItemsByStatus(items);

    return sortMyTaskStatusGroups(statusGroups).map((statusGroup, index) => ({
        groupKey: buildMyTaskGroupKey(statusGroup.statusKey, index, 'status'),
        groupType: 'status',
        statusKey: statusGroup.statusKey,
        label: statusGroup.statusLabel,
        count: statusGroup.items.length,
        items: statusGroup.items,
        dateGroups: buildMyTaskDateDisplayGroups(statusGroup.items),
    }));
}


function flattenMyTaskDateGroups(groups) {
    return groups.flatMap((group) => {
        const groupDate = group?.date || '';
        const groupDateLabel = group?.dateLabel || '日付なし';
        const groupDateAlias = group?.dateAlias || '';
        const items = Array.isArray(group?.items)
            ? group.items
            : [];

        return items.map((item) => ({
            ...item,
            myTaskDate: item?.myTaskDate || item?.date || groupDate,
            myTaskDateLabel: item?.myTaskDateLabel || item?.dateLabel || groupDateLabel,
            myTaskDateAlias: item?.myTaskDateAlias || item?.dateAlias || groupDateAlias,
        }));
    });
}


function groupMyTaskItemsByStatus(items) {
    const groups = new Map();

    items.forEach((item) => {
        const statusKey = item?.statusKey || MY_TASK_UNKNOWN_STATUS_KEY;
        const statusLabel = resolveHomeStatusLabel(
            statusKey,
            item?.status,
            MY_TASK_UNKNOWN_STATUS_LABEL
        );

        if (!groups.has(statusKey)) {
            groups.set(statusKey, {
                statusKey,
                statusLabel,
                items: [],
            });
        }

        groups.get(statusKey).items.push(item);
    });

    return Array.from(groups.values());
}


function sortMyTaskStatusGroups(groups) {
    return [...groups].sort((a, b) => {
        const aIndex = HOME_MY_TASK_STATUS_ORDER.indexOf(a.statusKey);
        const bIndex = HOME_MY_TASK_STATUS_ORDER.indexOf(b.statusKey);

        const normalizedAIndex = aIndex >= 0 ? aIndex : 999;
        const normalizedBIndex = bIndex >= 0 ? bIndex : 999;

        if (normalizedAIndex !== normalizedBIndex) {
            return normalizedAIndex - normalizedBIndex;
        }

        return String(a.statusLabel || '').localeCompare(
            String(b.statusLabel || ''),
            'ja'
        );
    });
}


function buildMyTaskDateDisplayGroups(items) {
    const groups = new Map();

    items.forEach((item) => {
        const date = item?.myTaskDate || '';
        const label = item?.myTaskDateLabel || '日付なし';
        const dateAlias = item?.myTaskDateAlias || '';
        const groupKey = date || label;

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                date,
                label,
                dateAlias,
                items: [],
            });
        }

        const group = groups.get(groupKey);

        if (!group.dateAlias && dateAlias) {
            group.dateAlias = dateAlias;
        }

        group.items.push(item);
    });

    return Array.from(groups.values())
    .sort(compareMyTaskDateGroups)
    .map((group, index) => ({
        groupKey: buildMyTaskGroupKey(group.date || group.label, index, 'date'),
        groupType: 'date',
        date: group.date,
        label: group.label,
        dateAlias: group.dateAlias,
        count: group.items.length,
        items: group.items,
    }));
}


function compareMyTaskDateGroups(a, b) {
    const aSortKey = isoDateSortKey(a?.date);
    const bSortKey = isoDateSortKey(b?.date);

    if (aSortKey !== bSortKey) {
        return aSortKey.localeCompare(bSortKey);
    }

    return String(a?.label || '').localeCompare(
        String(b?.label || ''),
        'ja'
    );
}


function findMyTaskStatusGroup(groupKey) {
    return latestMyTaskStatusGroups.find((group) => {
        return group.groupKey === groupKey;
    }) || null;
}


function findMyTaskDateGroup({
    statusGroup,
    dateGroupKey,
}) {
    const dateGroups = Array.isArray(statusGroup?.dateGroups)
        ? statusGroup.dateGroups
        : [];

    return dateGroups.find((group) => {
        return group.groupKey === dateGroupKey;
    }) || null;
}


export function renderMyTasksError() {
    latestMyTaskStatusGroups = [];
    latestMyTasksTitle = '自分の仕事';
    resetMyTasksDrilldownState();
    setMyTaskCurrentStatusKey('');

    setPanelHealth('homeMyTasksPanel', 'danger');
    setText('myTasksTitle', latestMyTasksTitle);

    const container = getById('myTaskGroups');
    if (!container) return;

    container.replaceChildren(createMessageState(
        '個別進捗の取得に失敗しました。'
    ));

    setMyTasksHeaderBackButtonVisible(false);
}


function bindMyTasksPanelEvents() {
    if (isMyTasksPanelEventBound) {
        return;
    }

    const panel = getById('homeMyTasksPanel');

    if (!panel) {
        return;
    }

    panel.addEventListener('click', handleMyTasksPanelClick);

    isMyTasksPanelEventBound = true;
}


function handleMyTasksPanelClick(event) {
    const backButton = event.target.closest(`#${MY_TASK_HEADER_BACK_BUTTON_ID}`);

    if (backButton) {
        event.preventDefault();
        handleMyTasksBackButtonClick();
        return;
    }

    const taskCard = event.target.closest(MY_TASK_CARD_SELECTOR);

    if (taskCard && handleMyTaskCardClick(taskCard)) {
        event.preventDefault();
        return;
    }

    const groupButton = event.target.closest(MY_TASK_GROUP_SELECTOR);

    if (!groupButton) {
        return;
    }

    event.preventDefault();

    handleMyTaskGroupClick(groupButton.dataset.myTaskGroupKey || '');
}


function handleMyTaskGroupClick(groupKey) {
    if (!groupKey) {
        return;
    }

    if (!currentMyTaskStatusGroupKey) {
        showMyTaskStatusDateSummaryView(groupKey);
        return;
    }

    showMyTaskDateTaskListView(groupKey);
}


function showMyTaskDateTaskListView(dateGroupKey) {
    const container = getById('myTaskGroups');
    const statusGroup = findMyTaskStatusGroup(currentMyTaskStatusGroupKey);
    const dateGroup = findMyTaskDateGroup({
        statusGroup,
        dateGroupKey,
    });

    if (!container || !statusGroup || !dateGroup) {
        return;
    }

    if (shouldPreviewCardListFromMyTaskDateGroup({
        statusKey: statusGroup.statusKey,
        dateGroup,
    })) {
        renderMyTaskCardPreviewView({
            container,
            statusGroup,
            dateGroup,
        });
        return;
    }

    if (canOpenCardPageFromMyTaskDateGroup({
        statusKey: statusGroup.statusKey,
        dateGroup,
    })) {
        openCardPageFromMyTaskDateGroup({
            statusKey: statusGroup.statusKey,
            date: dateGroup.date,
        });
        return;
    }

    currentMyTaskDateGroupKey = dateGroup.groupKey;
    setMyTaskCurrentStatusKey(statusGroup.statusKey);

    setText(
        'myTasksTitle',
        buildMyTaskDateTaskListTitle({
            statusGroup,
            dateGroup,
        })
    );

    setMyTasksHeaderBackButtonVisible(true);

    container.replaceChildren(
        createHomeDetailTaskList(dateGroup.items, {
            className: 'home-task-list',
        })
    );
}


function renderMyTaskCardPreviewView({
    container,
    statusGroup,
    dateGroup,
}) {
    currentMyTaskDateGroupKey = dateGroup.groupKey;
    setMyTaskCurrentStatusKey(statusGroup.statusKey);

    setText(
        'myTasksTitle',
        buildMyTaskDateTaskListTitle({
            statusGroup,
            dateGroup,
        })
    );

    setMyTasksHeaderBackButtonVisible(true);

    container.replaceChildren(
        createMyTaskCardPreviewElement({
            items: sortMyTaskItemsByPlanTimeAsc(dateGroup.items),
        })
    );
}


function createMyTaskCardPreviewElement({
    items = [],
} = {}) {
    const root = document.createElement('div');
    root.className = 'home-my-task-card-preview';

    root.appendChild(createHomeDetailTaskList(items, {
        className: 'home-task-list home-my-task-card-preview__list',
    }));

    return root;
}


function handleMyTaskCardClick(card) {
    const statusGroup = findMyTaskStatusGroup(currentMyTaskStatusGroupKey);
    const dateGroup = findMyTaskDateGroup({
        statusGroup,
        dateGroupKey: currentMyTaskDateGroupKey,
    });

    if (
        !statusGroup ||
        !dateGroup ||
        statusGroup.statusKey !== 'in_progress'
    ) {
        return false;
    }

    const planId = card.dataset.planId || '';

    if (!planId) {
        return false;
    }

    openCardPageFromMyTaskItem({
        statusKey: statusGroup.statusKey,
        date: dateGroup.date,
        planId,
    });

    return true;
}


function sortMyTaskItemsByPlanTimeAsc(items = []) {
    const safeItems = Array.isArray(items)
        ? items
        : [];

    return safeItems
        .map((item, index) => ({
            item,
            index,
            planTimeMinutes: resolveMyTaskPlanTimeMinutes(item),
        }))
        .sort((a, b) => {
            if (a.planTimeMinutes !== b.planTimeMinutes) {
                return a.planTimeMinutes - b.planTimeMinutes;
            }

            return a.index - b.index;
        })
        .map(({ item }) => item);
}


function resolveMyTaskPlanTimeMinutes(item) {
    const candidates = [
        item?.planTime,
        item?.planTimeLabel,
    ];

    for (const candidate of candidates) {
        const minutes = parseMyTaskTimeToMinutes(candidate);

        if (minutes !== null) {
            return minutes;
        }
    }

    return -1;
}


function parseMyTaskTimeToMinutes(value) {
    if (value === '' || value == null) {
        return null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    const text = String(value).trim();
    const match = text.match(/(\d{1,2}):(\d{2})/);

    if (!match) {
        return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes) ||
        hours < 0 ||
        minutes < 0 ||
        minutes >= 60
    ) {
        return null;
    }

    return hours * 60 + minutes;
}


function buildMyTaskDateTaskListTitle({
    statusGroup,
    dateGroup,
}) {
    return [
        dateGroup?.label || '',
        dateGroup?.dateAlias || '',
        `${statusGroup?.label || '対象'}の仕事`,
    ].filter(Boolean).join(' ');
}



function handleMyTasksBackButtonClick() {
    if (currentMyTaskDateGroupKey) {
        showMyTaskStatusDateSummaryView(currentMyTaskStatusGroupKey);
        return;
    }

    if (currentMyTaskStatusGroupKey) {
        renderMyTaskStatusSummaryView();
    }
}


function showMyTaskStatusDateSummaryView(statusGroupKey) {
    const container = getById('myTaskGroups');
    const statusGroup = findMyTaskStatusGroup(statusGroupKey);

    if (!container || !statusGroup) {
        return;
    }

    currentMyTaskStatusGroupKey = statusGroup.groupKey;
    currentMyTaskDateGroupKey = '';
    setMyTaskCurrentStatusKey(statusGroup.statusKey);

    setText(
        'myTasksTitle',
        `${statusGroup.label}の仕事`
    );

    setMyTasksHeaderBackButtonVisible(true);

    if (!statusGroup.dateGroups.length) {
        container.replaceChildren(createMessageState(
            'この状態の仕事はありません。'
        ));
        return;
    }

    container.replaceChildren(
        createHomeDetailGroupSummaryList(statusGroup.dateGroups, {
            listClassName: 'home-task-groups home-my-task-group-list',
            cardClassName: 'home-drilldown-group-card home-my-task-group-card',
            labelClassName: 'home-drilldown-group-card__label home-my-task-group-card__label',
            countClassName: 'home-drilldown-group-card__count home-my-task-group-card__count',
            datasetKey: 'myTaskGroupKey',
        })
    );
}


function renderMyTaskStatusSummaryView() {
    const container = getById('myTaskGroups');
    if (!container) return;

    resetMyTasksDrilldownState();
    setMyTaskCurrentStatusKey('');

    setText('myTasksTitle', latestMyTasksTitle);
    setMyTasksHeaderBackButtonVisible(false);

    if (latestMyTaskStatusGroups.length === 0) {
        container.replaceChildren(createMessageState(
            '未完了の仕事はありません。'
        ));
        return;
    }

    container.replaceChildren(
        createHomeDetailGroupSummaryList(latestMyTaskStatusGroups, {
            listClassName: 'home-task-groups home-my-task-group-list',
            cardClassName: 'home-drilldown-group-card home-my-task-group-card',
            labelClassName: 'home-drilldown-group-card__label home-my-task-group-card__label',
            countClassName: 'home-drilldown-group-card__count home-my-task-group-card__count',
            datasetKey: 'myTaskGroupKey',
        })
    );
}


function buildMyTaskGroupKey(value, index, prefix = 'group') {
    const normalizedValue = String(value ?? '').trim();

    return `${prefix}:${normalizedValue || `empty:${index}`}`;
}


function resetMyTasksDrilldownState() {
    currentMyTaskStatusGroupKey = '';
    currentMyTaskDateGroupKey = '';
}


function setMyTaskCurrentStatusKey(statusKey = '') {
    const container = getById('myTaskGroups');

    if (!container) {
        return;
    }

    if (statusKey) {
        container.dataset.myTaskCurrentStatusKey = statusKey;
        return;
    }

    delete container.dataset.myTaskCurrentStatusKey;
}


function createMessageState(message) {
    return createHomeDetailEmptyState(message);
}


function setMyTasksHeaderBackButtonVisible(isVisible) {
    const button = resolveMyTaskHeaderBackButton();

    if (button) {
        button.classList.toggle('is-hidden', !isVisible);
    }
}


function resolveMyTaskHeaderBackButton() {
    const existingButton = getById(MY_TASK_HEADER_BACK_BUTTON_ID);

    if (existingButton) {
        existingButton.classList.add(
            'home-my-task-detail__back',
            'home-panel-back-button'
        );

        return existingButton;
    }

    const panel = getById('homeMyTasksPanel');
    const header = panel?.querySelector('.home-panel__header');

    if (!header) {
        return null;
    }

    const button = document.createElement('button');
    button.id = MY_TASK_HEADER_BACK_BUTTON_ID;
    button.className = 'home-my-task-detail__back home-panel-back-button is-hidden';
    button.type = 'button';
    button.textContent = '戻る';

    header.appendChild(button);

    return button;
}


function resolveMyTasksHealth(groups) {
    const items = groups.flatMap((group) => (
        Array.isArray(group?.items) ? group.items : []
    ));

    if (items.length === 0) {
        return 'empty';
    }

    if (items.some((item) => item?.statusKey === 'delayed')) {
        return 'danger';
    }

    if (items.some((item) => (
        item?.statusKey === 'approval_waiting' ||
        item?.statusKey === 'sent_back'
    ))) {
        return 'warning';
    }

    return 'normal';
}