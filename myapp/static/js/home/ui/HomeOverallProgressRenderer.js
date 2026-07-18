// static/js/home/ui/HomeOverallProgressRenderer.js
import {
    formatCount,
} from '../domain/HomeDashboardNumberFormatPolicy.js';


import {
    getById,
    setPanelHealth,
    setText,
} from './domHelpers.js';


import {
    renderHomeDetailEmpty,
    renderHomeDetailGroupSummary,
    renderHomeDetailTaskList,
} from './HomeDetailListRenderer.js';


import {
    buildAffiliationDetailGroups,
    buildMemberDetailGroups,
    buildTaskDetailGroups,
} from '../domain/HomeTaskDetailGroupingPolicy.js';


import {
    handleHomeAssignButtonClick,
} from './HomeAssignButtonHandler.js';


import {
    resolveHomeStatusLabel,
} from '../domain/HomeStatusPolicy.js';


import {
    buildHomeDetailGroupIdentity,
    buildHomeDetailGroupTitleLabel,
    createHomeDetailDrilldownState,
    findHomeDetailGroupByIdentity,
    findHomeDetailGroupByKey,
    resetHomeDetailDrilldownState,
} from '../domain/HomeDetailGroupPolicy.js';


import {
    addHomeAssignCompletedListener,
} from './HomeAssignEvents.js';


import {
    findHomeTaskByPlanIdFromSources,
} from '../domain/HomeTaskLookupPolicy.js';


import {
    buildHomeDetailAffiliationTitle,
    buildHomeDetailAssigneeTitle,
    buildHomeDetailTitle,
    buildHomeDetailWorkTitle,
} from '../domain/HomeDetailTitlePolicy.js';


import {
    HOME_DETAIL_EMPTY_MESSAGES,
    HOME_DETAIL_GROUP_SUMMARY_OPTIONS,
    HOME_DETAIL_TASK_LIST_OPTIONS,
} from './HomeDetailViewConfig.js';


const OVERALL_COUNT_ELEMENT_IDS = {
    in_progress: 'overallInProgressCount',
    approval_waiting: 'overallApprovalWaitingCount',
    delayed: 'overallDelayedCount',
    sent_back: 'overallSentBackCount',
};

const OVERALL_SUMMARY_BUTTON_SELECTOR = '[data-overall-status-key]';

const OVERALL_DISABLED_CLASS = 'is-disabled';

const OVERALL_GROUP_SELECTOR = '[data-overall-group-key]';

let latestOverallPayload = null;
let latestOverallRefreshRequestHandler = null;
let currentOverallDetailContext = null;

const overallDrilldownState = createHomeDetailDrilldownState({
    withDateGroup: true,
});

let isOverallPanelEventBound = false;

export function renderOverallProgress(payload, options = {}) {
    latestOverallRefreshRequestHandler = typeof options.onRefreshRequest === 'function'
        ? options.onRefreshRequest
        : null;

    applyOverallPayload(payload);

    bindOverallPanelEvents();
    showOverallSummaryView();
}


export function renderOverallError() {
    latestOverallPayload = null;

    setPanelHealth('homeOverallPanel', 'danger');

    renderOverallCountFallback();
    disableAllOverallSummaryButtons();
    
    bindOverallPanelEvents();
    showOverallSummaryView();
}


function bindOverallPanelEvents() {
    if (isOverallPanelEventBound) {
        return;
    }

    const panel = getById('homeOverallPanel');

    if (!panel) {
        return;
    }

    panel.addEventListener('click', handleOverallPanelClick);
    addHomeAssignCompletedListener(handleHomeAssignCompleted);

    isOverallPanelEventBound = true;
}


function handleOverallPanelClick(event) {
    if (handleHomeAssignButtonClick(event, {
        findItemByPlanId: findOverallItemByPlanId,
        logPrefix: '[home overall assign]',
    })) {
        return;
    }

    const backButton = event.target.closest('#overallBackButton');

    if (backButton) {
        event.preventDefault();
        handleOverallBackButtonClick();
        return;
    }

    const groupButton = event.target.closest(OVERALL_GROUP_SELECTOR);

    if (groupButton) {
        event.preventDefault();
        handleOverallGroupClick(groupButton.dataset.overallGroupKey || '');
        return;
    }

    const statusButton = event.target.closest(OVERALL_SUMMARY_BUTTON_SELECTOR);

    if (!statusButton) {
        return;
    }
    
    if (isOverallSummaryButtonDisabled(statusButton)) {
        event.preventDefault();
        return;
    }
    
    event.preventDefault();

    const statusKey = statusButton.dataset.overallStatusKey || '';
    const statusLabel = resolveOverallStatusLabel(
        statusKey,
        statusButton.dataset.overallStatusLabel
    );
    
    showOverallDetailView({
        statusKey,
        statusLabel,
    });
}


function handleOverallGroupClick(groupKey) {
    if (!groupKey) {
        return;
    }

    if (!overallDrilldownState.dateGroupKey) {
        showOverallDateChildSummaryView(groupKey);
        return;
    }

    if (
        shouldShowOverallAffiliationLayer()
        && !overallDrilldownState.affiliationGroupKey
    ) {
        showOverallAffiliationMemberSummaryView(groupKey);
        return;
    }

    showOverallMemberTaskListView(groupKey);
}


function showOverallAffiliationMemberSummaryView(groupKey) {
    const detailGroups = getById('overallDetailGroups');
    const affiliationGroup = findCurrentOverallAffiliationGroup(groupKey);

    if (!affiliationGroup) {
        return;
    }

    enterOverallAffiliationGroup(affiliationGroup);

    setText('overallTitle', buildOverallAffiliationMemberTitle(affiliationGroup));

    renderOverallGroupSummary(
        detailGroups,
        overallDrilldownState.memberGroups
    );
}

async function handleHomeAssignCompleted() {
    const snapshot = buildOverallAssignRefreshSnapshot();

    if (!snapshot.statusKey || !latestOverallRefreshRequestHandler) {
        return;
    }

    try {
        const payload = await latestOverallRefreshRequestHandler({
            render: false,
        });

        if (!payload) {
            throw new Error('overall payload is empty');
        }

        applyOverallPayload(payload);
        rebuildCurrentOverallDetailContext({
            statusKey: snapshot.statusKey,
            statusLabel: snapshot.statusLabel,
        });

        renderOverallAfterAssignRefresh(snapshot);
    } catch (error) {
        console.error('[home overall] refresh after assign failed:', error);
    }
}

function renderOverallAfterAssignRefresh(snapshot) {
    if (snapshot.memberGroupKey) {
        renderOverallMemberTaskListAfterRefresh({
            dateGroupKey: snapshot.dateGroupKey,
            affiliationGroupKey: snapshot.affiliationGroupKey,
            memberGroupKey: snapshot.memberGroupKey,
            memberGroupIdentity: snapshot.memberGroupIdentity,
            fallbackTitle: snapshot.fallbackTitle,
        });
        return;
    }

    if (snapshot.affiliationGroupKey) {
        renderOverallAffiliationMemberSummaryAfterRefresh({
            dateGroupKey: snapshot.dateGroupKey,
            affiliationGroupKey: snapshot.affiliationGroupKey,
            fallbackTitle: snapshot.fallbackTitle,
        });
        return;
    }

    if (snapshot.dateGroupKey) {
        renderOverallDateChildSummaryAfterRefresh({
            dateGroupKey: snapshot.dateGroupKey,
            fallbackTitle: snapshot.fallbackTitle,
        });
        return;
    }

    showOverallGroupSummaryView();
}


function buildOverallAssignRefreshSnapshot() {
    return {
        statusKey: currentOverallDetailContext?.statusKey || '',
        statusLabel: currentOverallDetailContext?.statusLabel || '',
        dateGroupKey: overallDrilldownState.dateGroupKey,
        affiliationGroupKey: overallDrilldownState.affiliationGroupKey,
        memberGroupKey: overallDrilldownState.memberGroupKey,
        memberGroupIdentity: overallDrilldownState.memberGroupIdentity,
        fallbackTitle: resolveCurrentOverallGroupTitle(),
    };
}


function rebuildCurrentOverallDetailContext({
    statusKey,
    statusLabel,
}) {
    const items = resolveOverallStatusItems(statusKey);
    const groups = buildOverallDisplayGroups(items);

    currentOverallDetailContext = {
        statusKey,
        statusLabel,
        groups,
    };
    
    setOverallCurrentStatusKey(statusKey);
}


function applyOverallPayload(payload) {
    latestOverallPayload = payload;

    const overall = payload?.overall || {};
    const summary = overall.summary || {};
    const counts = summary.counts || {};
    const health = summary.health || 'normal';

    setPanelHealth('homeOverallPanel', health);

    renderOverallCounts(counts);
    updateOverallSummaryButtonStates(counts);
}


function handleOverallBackButtonClick() {
    if (overallDrilldownState.memberGroupKey) {
        if (shouldShowOverallAffiliationLayer()) {
            showOverallAffiliationMemberSummaryView(
                overallDrilldownState.affiliationGroupKey
            );
            return;
        }

        showOverallDateChildSummaryView(overallDrilldownState.dateGroupKey);
        return;
    }

    if (overallDrilldownState.affiliationGroupKey) {
        showOverallDateChildSummaryView(overallDrilldownState.dateGroupKey);
        return;
    }

    if (overallDrilldownState.dateGroupKey) {
        showOverallGroupSummaryView();
        return;
    }

    showOverallSummaryView();
}


function resetOverallDrilldownState() {
    resetHomeDetailDrilldownState(
        overallDrilldownState,
        {
            withDateGroup: true,
        }
    );
}


function setOverallCurrentStatusKey(statusKey = '') {
    const container = getById('overallDetailGroups');

    if (!container) {
        return;
    }

    if (statusKey) {
        container.dataset.overallCurrentStatusKey = statusKey;
        return;
    }

    delete container.dataset.overallCurrentStatusKey;
}


function enterOverallDateGroup(dateGroup) {
    overallDrilldownState.dateGroupKey = dateGroup?.groupKey || '';
    overallDrilldownState.affiliationGroupKey = '';
    overallDrilldownState.memberGroupKey = '';
    overallDrilldownState.memberGroupIdentity = null;
    overallDrilldownState.affiliationGroups = [];
    overallDrilldownState.memberGroups = [];
}


function enterOverallAffiliationGroup(affiliationGroup) {
    overallDrilldownState.affiliationGroupKey = affiliationGroup?.groupKey || '';
    overallDrilldownState.memberGroupKey = '';
    overallDrilldownState.memberGroupIdentity = null;
    overallDrilldownState.memberGroups = buildMemberDetailGroups({
        items: affiliationGroup?.items,
    });
}


function enterOverallMemberGroup(memberGroup) {
    overallDrilldownState.memberGroupKey = memberGroup?.groupKey || '';
    overallDrilldownState.memberGroupIdentity = buildHomeDetailGroupIdentity(memberGroup);
}


function clearOverallMemberGroupState() {
    overallDrilldownState.memberGroupKey = '';
    overallDrilldownState.memberGroupIdentity = null;
}


function setOverallAffiliationGroups(groups) {
    overallDrilldownState.affiliationGroups = Array.isArray(groups)
        ? groups
        : [];
}


function setOverallMemberGroups(groups) {
    overallDrilldownState.memberGroups = Array.isArray(groups)
        ? groups
        : [];
}


function showOverallGroupSummaryView() {
    const detailGroups = getById('overallDetailGroups');

    resetOverallDrilldownState();

    setText(
        'overallTitle',
        buildOverallDetailTitle(currentOverallDetailContext?.statusLabel)
    );

    renderOverallGroupSummary(
        detailGroups,
        currentOverallDetailContext?.groups || []
    );
}


function setOverallViewMode(mode) {
    const isDetailMode = mode === 'detail';

    const summaryView = getById('overallSummaryView');
    const detailView = getById('overallDetailView');
    const backButton = getById('overallBackButton');

    summaryView?.classList.toggle('is-hidden', isDetailMode);
    detailView?.classList.toggle('is-hidden', !isDetailMode);
    backButton?.classList.toggle('is-hidden', !isDetailMode);
}


function showOverallSummaryView() {
    currentOverallDetailContext = null;
    resetOverallDrilldownState();
    setOverallCurrentStatusKey('');
    
    setOverallViewMode('summary');
    setText('overallTitle', resolveOverallTitle());
}


function showOverallDetailView({
    statusKey,
    statusLabel,
}) {
    const detailGroups = getById('overallDetailGroups');
    const items = resolveOverallStatusItems(statusKey);
    const groups = buildOverallDisplayGroups(items);

    currentOverallDetailContext = {
        statusKey,
        statusLabel,
        groups,
    };
    
    resetOverallDrilldownState();
    setOverallCurrentStatusKey(statusKey);
    
    setOverallViewMode('detail');
    setText('overallTitle', buildOverallDetailTitle(statusLabel));

    renderOverallGroupSummary(detailGroups, groups);
}


function buildOverallDisplayGroups(items) {
    return buildTaskDetailGroups({
        items,
    });
}


function resolveOverallStatusItems(statusKey) {
    const itemsByStatus = latestOverallPayload?.itemsByStatus
        || latestOverallPayload?.overall?.itemsByStatus
        || {};
    const items = itemsByStatus[statusKey];

    return Array.isArray(items) ? items : [];
}


function resolveOverallTitle(payload = latestOverallPayload) {
    return payload?.overall?.title || '全体進捗';
}


function renderOverallCounts(counts = {}) {
    Object.entries(OVERALL_COUNT_ELEMENT_IDS).forEach(([statusKey, elementId]) => {
        setText(elementId, formatCount(counts[statusKey]));
    });
}


function renderOverallCountFallback(value = '--') {
    Object.values(OVERALL_COUNT_ELEMENT_IDS).forEach((elementId) => {
        setText(elementId, value);
    });
}


function resolveOverallStatusLabel(statusKey, fallbackLabel = '') {
    return resolveHomeStatusLabel(
        statusKey,
        fallbackLabel,
        '仕事'
    );
}


function buildOverallDetailTitle(statusLabel) {
    return buildHomeDetailWorkTitle(statusLabel);
}


function updateOverallSummaryButtonStates(counts = {}) {
    const buttons = document.querySelectorAll(OVERALL_SUMMARY_BUTTON_SELECTOR);

    buttons.forEach((button) => {
        const statusKey = button.dataset.overallStatusKey || '';
        const count = normalizeOverallCount(counts[statusKey]);
        const shouldDisable = count <= 0;

        setOverallSummaryButtonDisabled(button, shouldDisable);
    });
}


function disableAllOverallSummaryButtons() {
    const buttons = document.querySelectorAll(OVERALL_SUMMARY_BUTTON_SELECTOR);

    buttons.forEach((button) => {
        setOverallSummaryButtonDisabled(button, true);
    });
}


function setOverallSummaryButtonDisabled(button, shouldDisable) {
    button.classList.toggle(OVERALL_DISABLED_CLASS, shouldDisable);
    button.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');

    if ('disabled' in button) {
        button.disabled = shouldDisable;
    }
}


function isOverallSummaryButtonDisabled(button) {
    return button.disabled
        || button.getAttribute('aria-disabled') === 'true'
        || button.classList.contains(OVERALL_DISABLED_CLASS);
}


function normalizeOverallCount(value) {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : 0;
}


function renderOverallGroupSummary(detailGroups, groups) {
    renderHomeDetailGroupSummary(detailGroups, groups, {
        emptyMessage: HOME_DETAIL_EMPTY_MESSAGES.DEFAULT,
        ...HOME_DETAIL_GROUP_SUMMARY_OPTIONS.OVERALL,
    });
}


function showOverallDateChildSummaryView(groupKey) {
    const detailGroups = getById('overallDetailGroups');
    const dateGroup = findCurrentOverallDateGroup(groupKey);

    if (!dateGroup) {
        return;
    }

    enterOverallDateGroup(dateGroup);

    if (shouldShowOverallAffiliationLayer()) {
        const affiliationGroups = buildAffiliationDetailGroups({
            items: dateGroup.items,
        });

        setOverallAffiliationGroups(affiliationGroups);

        setText('overallTitle', buildOverallDateAffiliationTitle(dateGroup));

        renderOverallGroupSummary(
            detailGroups,
            overallDrilldownState.affiliationGroups
        );
        return;
    }

    const memberGroups = buildMemberDetailGroups({
        items: dateGroup.items,
    });

    setOverallMemberGroups(memberGroups);

    setText('overallTitle', buildOverallDateMemberTitle(dateGroup));

    renderOverallGroupSummary(
        detailGroups,
        overallDrilldownState.memberGroups
    );
}


function showOverallMemberTaskListView(groupKey) {
    const detailGroups = getById('overallDetailGroups');
    const memberGroup = findCurrentOverallMemberGroup(groupKey);

    if (!memberGroup) {
        return;
    }

    enterOverallMemberGroup(memberGroup);

    setText('overallTitle', buildOverallMemberTaskTitle(memberGroup));

    renderHomeDetailTaskList(
        detailGroups,
        memberGroup.items,
        HOME_DETAIL_TASK_LIST_OPTIONS.OVERALL
    );
}


function renderOverallDateChildSummaryAfterRefresh({
    dateGroupKey,
    fallbackTitle,
}) {
    const detailGroups = getById('overallDetailGroups');
    const dateGroup = findCurrentOverallDateGroup(dateGroupKey);

    resetOverallDrilldownState();

    if (!dateGroup) {
        overallDrilldownState.dateGroupKey = dateGroupKey;
    
        setText('overallTitle', fallbackTitle || buildOverallDetailTitle(
            currentOverallDetailContext?.statusLabel
        ));
    
        renderHomeDetailEmpty(
            detailGroups,
            HOME_DETAIL_EMPTY_MESSAGES.EMPTY_AFTER_ASSIGN
        );
        return;
    }
    
    showOverallDateChildSummaryView(dateGroup.groupKey);
}


function renderOverallAffiliationMemberSummaryAfterRefresh({
    dateGroupKey,
    affiliationGroupKey,
    fallbackTitle,
}) {
    const detailGroups = getById('overallDetailGroups');
    const dateGroup = findCurrentOverallDateGroup(dateGroupKey);

    resetOverallDrilldownState();
    overallDrilldownState.dateGroupKey = dateGroupKey;
    overallDrilldownState.affiliationGroupKey = affiliationGroupKey;

    if (!dateGroup) {
        setText('overallTitle', fallbackTitle || buildOverallDetailTitle(
            currentOverallDetailContext?.statusLabel
        ));

        renderHomeDetailEmpty(
            detailGroups,
            HOME_DETAIL_EMPTY_MESSAGES.EMPTY_AFTER_ASSIGN
        );
        return;
    }

    setOverallAffiliationGroups(
        buildAffiliationDetailGroups({
            items: dateGroup.items,
        })
    );

    const affiliationGroup = findCurrentOverallAffiliationGroup(affiliationGroupKey);

    if (!affiliationGroup) {
        overallDrilldownState.affiliationGroupKey = '';
        clearOverallMemberGroupState();

        setText('overallTitle', buildOverallDateAffiliationTitle(dateGroup));

        renderOverallGroupSummary(
            detailGroups,
            overallDrilldownState.affiliationGroups
        );
        return;
    }

    showOverallAffiliationMemberSummaryView(affiliationGroup.groupKey);
}


function renderOverallMemberTaskListAfterRefresh({
    dateGroupKey,
    affiliationGroupKey = '',
    memberGroupKey,
    memberGroupIdentity = null,
    fallbackTitle,
}) {
    const detailGroups = getById('overallDetailGroups');
    const dateGroup = findCurrentOverallDateGroup(dateGroupKey);

    resetOverallDrilldownState();
    overallDrilldownState.dateGroupKey = dateGroupKey;
    overallDrilldownState.affiliationGroupKey = affiliationGroupKey || '';

    if (!dateGroup) {
        setText('overallTitle', fallbackTitle || buildOverallDetailTitle(
            currentOverallDetailContext?.statusLabel
        ));

        renderHomeDetailEmpty(
            detailGroups,
            HOME_DETAIL_EMPTY_MESSAGES.EMPTY_AFTER_ASSIGN
        );
        return;
    }

    const sourceItems = resolveCurrentMemberSourceItems(dateGroup);

    setOverallMemberGroups(
        buildMemberDetailGroups({
            items: sourceItems,
        })
    );

    const memberGroup = findCurrentOverallMemberGroupByIdentity({
        groupKey: memberGroupKey,
        identity: memberGroupIdentity,
    });

    if (!memberGroup) {
        clearOverallMemberGroupState();
    
        setText('overallTitle', fallbackTitle || buildOverallDetailTitle(
            currentOverallDetailContext?.statusLabel
        ));
    
        renderHomeDetailEmpty(
            detailGroups,
            HOME_DETAIL_EMPTY_MESSAGES.EMPTY_AFTER_ASSIGN
        );
        return;
    }

    enterOverallMemberGroup(memberGroup);

    setText('overallTitle', buildOverallMemberTaskTitle(memberGroup));

    renderHomeDetailTaskList(
        detailGroups,
        memberGroup.items,
        HOME_DETAIL_TASK_LIST_OPTIONS.OVERALL
    );
}


function findCurrentOverallDateGroup(groupKey) {
    return findHomeDetailGroupByKey(
        currentOverallDetailContext?.groups,
        groupKey
    );
}


function findCurrentOverallAffiliationGroup(groupKey) {
    return findHomeDetailGroupByKey(
        overallDrilldownState.affiliationGroups,
        groupKey
    );
}


function findCurrentOverallMemberGroup(groupKey) {
    return findHomeDetailGroupByKey(
        overallDrilldownState.memberGroups,
        groupKey
    );
}


function findCurrentOverallMemberGroupByIdentity({
    groupKey,
    identity,
}) {
    return findHomeDetailGroupByIdentity(
        overallDrilldownState.memberGroups,
        {
            groupKey,
            identity,
        }
    );
}


function resolveCurrentMemberSourceItems(dateGroup) {
    if (
        shouldShowOverallAffiliationLayer()
        && overallDrilldownState.affiliationGroupKey
    ) {
        setOverallAffiliationGroups(
            buildAffiliationDetailGroups({
                items: dateGroup.items,
            })
        );
        const affiliationGroup = findCurrentOverallAffiliationGroup(
            overallDrilldownState.affiliationGroupKey
        );

        return Array.isArray(affiliationGroup?.items)
            ? affiliationGroup.items
            : [];
    }

    return Array.isArray(dateGroup?.items)
        ? dateGroup.items
        : [];
}


function shouldShowOverallAffiliationLayer() {
    return Boolean(latestOverallPayload?.scope?.showAffiliationLayer);
}


function resolveCurrentOverallGroupTitle() {
    if (overallDrilldownState.memberGroupKey) {
        const memberGroup = findCurrentOverallMemberGroup(
            overallDrilldownState.memberGroupKey
        );

        if (memberGroup) {
            return buildOverallMemberTaskTitle(memberGroup);
        }
    }

    if (overallDrilldownState.affiliationGroupKey) {
        const affiliationGroup = findCurrentOverallAffiliationGroup(
            overallDrilldownState.affiliationGroupKey
        );

        if (affiliationGroup) {
            return buildOverallAffiliationMemberTitle(affiliationGroup);
        }
    }

    if (overallDrilldownState.dateGroupKey) {
        const dateGroup = findCurrentOverallDateGroup(
            overallDrilldownState.dateGroupKey
        );

        if (dateGroup) {
            return shouldShowOverallAffiliationLayer()
                ? buildOverallDateAffiliationTitle(dateGroup)
                : buildOverallDateMemberTitle(dateGroup);
        }
    }

    return buildOverallDetailTitle(currentOverallDetailContext?.statusLabel);
}


function buildOverallDateAffiliationTitle(group) {
    const statusLabel = currentOverallDetailContext?.statusLabel || '対象';
    const groupLabel = buildHomeDetailGroupTitleLabel(group);

    return buildHomeDetailTitle([
        groupLabel,
        buildHomeDetailAffiliationTitle(statusLabel),
    ]);
}


function buildOverallDateMemberTitle(group) {
    const statusLabel = currentOverallDetailContext?.statusLabel || '対象';
    const groupLabel = buildHomeDetailGroupTitleLabel(group);

    return buildHomeDetailTitle([
        groupLabel,
        buildHomeDetailAssigneeTitle(statusLabel),
    ]);
}


function buildOverallAffiliationMemberTitle(group) {
    const statusLabel = currentOverallDetailContext?.statusLabel || '対象';
    const dateGroup = findCurrentOverallDateGroup(
        overallDrilldownState.dateGroupKey
    );
    const dateLabel = buildHomeDetailGroupTitleLabel(dateGroup);
    const affiliationLabel = buildHomeDetailGroupTitleLabel(group);

    return buildHomeDetailTitle([
        dateLabel,
        affiliationLabel,
        buildHomeDetailAssigneeTitle(statusLabel),
    ]);
}


function buildOverallMemberTaskTitle(group) {
    const statusLabel = currentOverallDetailContext?.statusLabel || '対象';
    const dateGroup = findCurrentOverallDateGroup(
        overallDrilldownState.dateGroupKey
    );
    const dateLabel = buildHomeDetailGroupTitleLabel(dateGroup);
    const affiliationGroup = findCurrentOverallAffiliationGroup(
        overallDrilldownState.affiliationGroupKey
    );
    const affiliationLabel = buildHomeDetailGroupTitleLabel(affiliationGroup);
    const memberLabel = buildHomeDetailGroupTitleLabel(group);

    return buildHomeDetailTitle([
        dateLabel,
        affiliationLabel,
        memberLabel,
        buildHomeDetailWorkTitle(statusLabel),
    ]);
}


function findOverallItemByPlanId(planId) {
    const visibleMemberGroup = findCurrentOverallMemberGroup(
        overallDrilldownState.memberGroupKey
    );

    return findHomeTaskByPlanIdFromSources(planId, [
        {
            type: 'items',
            value: visibleMemberGroup?.items,
        },
        {
            type: 'groups',
            value: currentOverallDetailContext?.groups,
        },
    ]);
}