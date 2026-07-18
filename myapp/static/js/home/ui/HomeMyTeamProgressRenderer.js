// static/js/home/ui/HomeMyTeamProgressRenderer.js

import {
    UIManger,
} from '../../manager/UIManger.js';


import {
    clampRate,
    formatCount,
} from '../domain/HomeDashboardNumberFormatPolicy.js';


import {
    buildFocusProgressLabel,
} from '../domain/HomeDashboardTodayLabelPolicy.js';


import {
    getById,
    setPanelHealth,
    setText,
} from './domHelpers.js';


import {
    renderWeekDays,
} from './HomeWeekdayStripRenderer.js';


import {
    handleHomeAssignButtonClick,
} from './HomeAssignButtonHandler.js';


import {
    buildAffiliationDetailGroups,
    buildMemberDetailGroups,
} from '../domain/HomeTaskDetailGroupingPolicy.js';


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
    renderHomeDetailEmpty,
    renderHomeDetailGroupSummary,
    renderHomeDetailTaskList,
} from './HomeDetailListRenderer.js';


import {
    findHomeTaskByPlanIdFromSources,
} from '../domain/HomeTaskLookupPolicy.js';


import {
    buildHomeDetailAssigneeTitle,
    buildHomeDetailTitle,
    buildHomeDetailWorkTitle,
} from '../domain/HomeDetailTitlePolicy.js';


import {
    HOME_DETAIL_EMPTY_MESSAGES,
    HOME_DETAIL_GROUP_SUMMARY_OPTIONS,
} from './HomeDetailViewConfig.js';


const MY_TEAM_FOCUS_METRIC_DEFINITIONS = {
    waiting: {
        countId: 'myTeamTodayWaitingCount',
    },
    in_progress: {
        countId: 'myTeamTodayInProgressCount',
    },
    approval_waiting: {
        countId: 'myTeamTodayApprovalWaitingCount',
    },
    delayed: {
        countId: 'myTeamTodayDelayedCount',
    },
};


const MY_TEAM_FOCUS_METRIC_SELECTOR = '[data-my-team-status-key]';
const MY_TEAM_DISABLED_CLASS = 'is-disabled';
const MY_TEAM_HEADER_BACK_BUTTON_ID = 'myTeamHeaderBackButton';

let latestDayDetailRequestHandler = null;
let latestMyTeamHeaderTitle = '所属班の進捗';
let currentFocusItem = null;
let latestMyTeamScope = {};
let currentMyTeamDayDetailContext = null;
let isMyTeamPanelEventBound = false;

const myTeamDrilldownState = createHomeDetailDrilldownState();


const MY_TEAM_GROUP_SELECTOR = '[data-my-team-group-key]';


export function renderMyTeamProgress(payload, options = {}) {
    latestDayDetailRequestHandler = typeof options.onDayDetailRequest === 'function'
        ? options.onDayDetailRequest
        : null;

    bindMyTeamPanelEvents();

    const scope = payload?.scope || {};
    latestMyTeamScope = scope;
    const currentPeriod = payload?.currentPeriod || {};
    const team = payload?.team || {};

    const weekSummary = team.summary || {};
    const weekCounts = weekSummary.counts || {};
    const weekRates = weekSummary.rates || {};
    const weekHealth = weekSummary.health || 'normal';

    const weekDays = Array.isArray(team.weekDays)
        ? team.weekDays
        : [];

    const initialFocusItem = resolveInitialFocusItem({
        today: team.today,
        weekDays,
    });

    const weekCompletedRate = clampRate(weekRates.completed);

    setPanelHealth('homeMyTeamPanel', weekHealth);

    const teamTitle = team.title || `${scope.affiliationName || '所属班'}の進捗`;
    const periodLabel = currentPeriod.dateAlias || '';
    
    latestMyTeamHeaderTitle = UIManger.joinText([periodLabel, teamTitle]);

    setText(
        'myTeamTitle',
        latestMyTeamHeaderTitle
    );

    setText('myTeamCompletedRate', weekCompletedRate);

    bindWeekDayStrip({
        days: weekDays,
        currentPeriod,
        selectedDate: initialFocusItem?.date || '',
    });

    renderFocusProgress(
        initialFocusItem,
        currentPeriod
    );

    setText(
        'myTeamWeekSummary',
        `全 ${formatCount(weekCounts.total)} 件 / 残り ${formatCount(weekCounts.remaining)} 件`
    );
}


function resolveInitialFocusItem({
    today,
    weekDays,
}) {
    const todayFromWeekDays = weekDays.find((day) => day?.isToday);

    return todayFromWeekDays || today || {};
}

function bindWeekDayStrip({
    days,
    currentPeriod,
    selectedDate,
}) {
    renderWeekDays(days, {
        selectedDate,
        onSelectDay: (selectedDay) => {
            renderFocusProgress(
                selectedDay,
                currentPeriod
            );

            bindWeekDayStrip({
                days,
                currentPeriod,
                selectedDate: selectedDay?.date || '',
            });
        },
    });
}


function renderFocusProgress(focusItem, currentPeriod) {
    currentFocusItem = focusItem || {};
    showMyTeamFocusView();

    const focusSummary = focusItem?.summary || {};
    const focusCounts = focusSummary.counts || {};
    const focusRates = focusSummary.rates || {};
    const completedRate = clampRate(focusRates.completed);

    setText('myTeamTodayLabel', buildFocusProgressLabel(focusItem, currentPeriod));
    setText('myTeamTodayCompletedRate', completedRate);
    setText('myTeamTodayWaitingCount', formatCount(focusCounts.waiting));
    setText('myTeamTodayInProgressCount', formatCount(focusCounts.in_progress));
    setText('myTeamTodayApprovalWaitingCount', formatCount(focusCounts.approval_waiting));
    setText('myTeamTodayDelayedCount', formatCount(focusCounts.delayed));

    updateFocusMetricStates(focusCounts);

    const progressBar = getById('myTeamProgressBar');
    if (progressBar) {
        progressBar.style.width = `${completedRate}%`;
    }
}


export function renderMyTeamError() {
    showMyTeamFocusView();

    setPanelHealth('homeMyTeamPanel', 'danger');

    setText('myTeamTitle', '所属班の進捗');
    setText('myTeamCompletedRate', '--');

    renderWeekDays([]);

    setText('myTeamTodayLabel', '今日の進捗');
    setText('myTeamTodayCompletedRate', '--');
    setText('myTeamTodayWaitingCount', '--');
    setText('myTeamTodayInProgressCount', '--');
    setText('myTeamTodayApprovalWaitingCount', '--');
    setText('myTeamTodayDelayedCount', '--');
    setText('myTeamWeekSummary', '全 -- 件 / 残り -- 件');

    const progressBar = getById('myTeamProgressBar');
    if (progressBar) {
        progressBar.style.width = '0%';
    }
}


function bindMyTeamPanelEvents() {
    if (isMyTeamPanelEventBound) {
        return;
    }

    const panel = getById('homeMyTeamPanel');

    if (!panel) {
        return;
    }

    panel.addEventListener('click', handleMyTeamPanelClick);
    panel.addEventListener('keydown', handleMyTeamPanelKeydown);
    addHomeAssignCompletedListener(handleHomeAssignCompleted);

    isMyTeamPanelEventBound = true;
}


function handleMyTeamPanelClick(event) {
    if (handleHomeAssignButtonClick(event, {
        findItemByPlanId: findMyTeamItemByPlanId,
        logPrefix: '[home my team assign]',
    })) {
        return;
    }

    const backButton = event.target.closest(`#${MY_TEAM_HEADER_BACK_BUTTON_ID}`);

    if (backButton) {
        event.preventDefault();
        handleMyTeamBackButtonClick();
        return;
    }

    const groupButton = event.target.closest(MY_TEAM_GROUP_SELECTOR);

    if (groupButton) {
        event.preventDefault();
        handleMyTeamGroupClick(groupButton.dataset.myTeamGroupKey || '');
        return;
    }

    const metric = event.target.closest(MY_TEAM_FOCUS_METRIC_SELECTOR);

    if (!metric) {
        return;
    }

    event.preventDefault();
    requestMyTeamDayDetail(metric);
}


function findMyTeamItemByPlanId(planId) {
    const visibleMemberGroup = findCurrentMyTeamMemberGroup(
        myTeamDrilldownState.memberGroupKey
    );

    return findHomeTaskByPlanIdFromSources(planId, [
        {
            type: 'items',
            value: visibleMemberGroup?.items,
        },
        {
            type: 'items',
            value: currentMyTeamDayDetailContext?.items,
        },
    ]);
}


function buildMyTeamAssignRefreshSnapshot() {
    const target = currentMyTeamDayDetailContext?.payload?.target || {};

    return {
        date: target.date || '',
        statusKey: target.statusKey || '',
        affiliationGroupKey: myTeamDrilldownState.affiliationGroupKey,
        memberGroupKey: myTeamDrilldownState.memberGroupKey,
        memberGroupIdentity: myTeamDrilldownState.memberGroupIdentity,
        fallbackTitle: getById('myTeamTitle')?.textContent || '',
    };
}


async function handleHomeAssignCompleted() {
    const snapshot = buildMyTeamAssignRefreshSnapshot();

    if (!snapshot.date || !snapshot.statusKey || !latestDayDetailRequestHandler) {
        return;
    }

    try {
        const payload = await latestDayDetailRequestHandler(
            {
                date: snapshot.date,
                statusKey: snapshot.statusKey,
            },
            {
                render: false,
            }
        );

        if (!payload) {
            return;
        }

        renderMyTeamAfterAssignRefresh({
            payload,
            snapshot,
        });
    } catch (error) {
        console.error('[home my team] refresh after assign failed:', error);
    }
}


function renderMyTeamAfterAssignRefresh({
    payload,
    snapshot,
}) {
    renderMyTeamDayDetailAfterAssignRefresh({
        payload,
        previousAffiliationGroupKey: snapshot.affiliationGroupKey,
        previousMemberGroupKey: snapshot.memberGroupKey,
        previousMemberGroupIdentity: snapshot.memberGroupIdentity,
        previousTitle: snapshot.fallbackTitle,
    });
}


function renderMyTeamDayDetailAfterAssignRefresh({
    payload,
    previousAffiliationGroupKey,
    previousMemberGroupKey,
    previousMemberGroupIdentity,
    previousTitle,
}) {
    const title = buildMyTeamDayDetailTitle(payload);
    const items = Array.isArray(payload?.items)
        ? payload.items
        : [];
    const groups = buildMyTeamDisplayGroups(items);

    resetMyTeamDrilldownState();

    currentMyTeamDayDetailContext = {
        payload,
        items,
        groups,
    };

    showMyTeamDetailView({
        title,
    });

    if (shouldShowMyTeamAffiliationLayer()) {
        setMyTeamAffiliationGroups(groups);
    } else {
        setMyTeamMemberGroups(groups);
    }

    if (previousMemberGroupKey) {
        renderMyTeamMemberTaskListAfterAssignRefresh({
            previousAffiliationGroupKey,
            previousMemberGroupKey,
            previousMemberGroupIdentity,
            previousTitle,
        });
        return;
    }

    if (previousAffiliationGroupKey) {
        showMyTeamAffiliationMemberSummaryView(previousAffiliationGroupKey);
        return;
    }

    showMyTeamGroupSummaryView();
}


function renderMyTeamMemberTaskListAfterAssignRefresh({
    previousAffiliationGroupKey,
    previousMemberGroupKey,
    previousMemberGroupIdentity,
    previousTitle,
}) {
    const list = getById('myTeamDayDetailList');

    if (
        shouldShowMyTeamAffiliationLayer()
        && previousAffiliationGroupKey
    ) {
        const affiliationGroup = findCurrentMyTeamAffiliationGroup(
            previousAffiliationGroupKey
        );

        setMyTeamAffiliationGroupKey(previousAffiliationGroupKey);

        if (!affiliationGroup) {
            setMyTeamHeaderDetailMode(previousTitle);

            renderHomeDetailEmpty(
                list,
                HOME_DETAIL_EMPTY_MESSAGES.EMPTY_AFTER_ASSIGN
            );
            return;
        }

        setMyTeamMemberGroups(
            buildMemberDetailGroups({
                items: affiliationGroup.items,
            })
        );
    }

    const memberGroup = findCurrentMyTeamMemberGroupByIdentity({
        groupKey: previousMemberGroupKey,
        identity: previousMemberGroupIdentity,
    });

    if (!memberGroup) {
        clearMyTeamMemberGroupState();

        setMyTeamHeaderDetailMode(previousTitle);

        renderHomeDetailEmpty(
            list,
            HOME_DETAIL_EMPTY_MESSAGES.EMPTY_AFTER_ASSIGN
        );
        return;
    }

    enterMyTeamMemberGroup(memberGroup);

    setMyTeamHeaderDetailMode(
        buildMyTeamMemberTaskTitle(memberGroup)
    );

    renderHomeDetailTaskList(
        list,
        memberGroup.items
    );
}


function handleMyTeamGroupClick(groupKey) {
    if (!groupKey) {
        return;
    }

    if (
        shouldShowMyTeamAffiliationLayer()
        && !myTeamDrilldownState.affiliationGroupKey
    ) {
        showMyTeamAffiliationMemberSummaryView(groupKey);
        return;
    }

    showMyTeamMemberTaskListView(groupKey);
}


function showMyTeamMemberTaskListView(groupKey) {
    const list = getById('myTeamDayDetailList');
    const memberGroup = findCurrentMyTeamMemberGroup(groupKey);

    if (!memberGroup) {
        return;
    }

    enterMyTeamMemberGroup(memberGroup);

    setMyTeamHeaderDetailMode(
        buildMyTeamMemberTaskTitle(memberGroup)
    );

    renderHomeDetailTaskList(
        list,
        memberGroup.items
    );
}


function findCurrentMyTeamMemberGroupByIdentity({
    groupKey,
    identity,
}) {
    return findHomeDetailGroupByIdentity(
        myTeamDrilldownState.memberGroups,
        {
            groupKey,
            identity,
        }
    );
}


function handleMyTeamPanelKeydown(event) {
    if (!['Enter', ' '].includes(event.key)) {
        return;
    }

    const metric = event.target.closest(MY_TEAM_FOCUS_METRIC_SELECTOR);

    if (!metric) {
        return;
    }

    event.preventDefault();
    requestMyTeamDayDetail(metric);
}


function handleMyTeamBackButtonClick() {
    if (myTeamDrilldownState.memberGroupKey) {
        if (shouldShowMyTeamAffiliationLayer()) {
            showMyTeamAffiliationMemberSummaryView(myTeamDrilldownState.affiliationGroupKey);
            return;
        }

        showMyTeamGroupSummaryView();
        return;
    }

    if (myTeamDrilldownState.affiliationGroupKey) {
        showMyTeamGroupSummaryView();
        return;
    }

    showMyTeamFocusView();
}


function showMyTeamAffiliationMemberSummaryView(groupKey) {
    const list = getById('myTeamDayDetailList');
    const affiliationGroup = findCurrentMyTeamAffiliationGroup(groupKey);

    if (!affiliationGroup) {
        return;
    }

    enterMyTeamAffiliationGroup(affiliationGroup);

    setMyTeamHeaderDetailMode(
        buildMyTeamAffiliationMemberTitle(affiliationGroup)
    );

    renderMyTeamGroupSummary(
        list,
        myTeamDrilldownState.memberGroups
    );
}


function resetMyTeamDrilldownState() {
    resetHomeDetailDrilldownState(myTeamDrilldownState);
}


function setMyTeamCurrentStatusKey(statusKey = '') {
    const list = getById('myTeamDayDetailList');

    if (!list) {
        return;
    }

    if (statusKey) {
        list.dataset.myTeamCurrentStatusKey = statusKey;
        return;
    }

    delete list.dataset.myTeamCurrentStatusKey;
}


function enterMyTeamAffiliationGroup(affiliationGroup) {
    myTeamDrilldownState.affiliationGroupKey = affiliationGroup?.groupKey || '';
    myTeamDrilldownState.memberGroupKey = '';
    myTeamDrilldownState.memberGroupIdentity = null;
    myTeamDrilldownState.memberGroups = buildMemberDetailGroups({
        items: affiliationGroup?.items,
    });
}


function enterMyTeamMemberGroup(memberGroup) {
    myTeamDrilldownState.memberGroupKey = memberGroup?.groupKey || '';
    myTeamDrilldownState.memberGroupIdentity = buildHomeDetailGroupIdentity(memberGroup);
}


function clearMyTeamMemberGroupState() {
    myTeamDrilldownState.memberGroupKey = '';
    myTeamDrilldownState.memberGroupIdentity = null;
}


function clearMyTeamAffiliationGroupState() {
    myTeamDrilldownState.affiliationGroupKey = '';
    clearMyTeamMemberGroupState();
}

function setMyTeamAffiliationGroupKey(groupKey) {
    myTeamDrilldownState.affiliationGroupKey = groupKey || '';
}


function setMyTeamAffiliationGroups(groups) {
    myTeamDrilldownState.affiliationGroups = Array.isArray(groups)
        ? groups
        : [];
}


function setMyTeamMemberGroups(groups) {
    myTeamDrilldownState.memberGroups = Array.isArray(groups)
        ? groups
        : [];
}


function showMyTeamGroupSummaryView() {
    const list = getById('myTeamDayDetailList');
    const groups = currentMyTeamDayDetailContext?.groups || [];

    clearMyTeamAffiliationGroupState();

    if (shouldShowMyTeamAffiliationLayer()) {
        setMyTeamAffiliationGroups(groups);
        setMyTeamMemberGroups([]);
    } else {
        setMyTeamAffiliationGroups([]);
        setMyTeamMemberGroups(groups);
    }

    setMyTeamHeaderDetailMode(
        buildMyTeamDayDetailTitle(currentMyTeamDayDetailContext?.payload)
    );

    renderMyTeamGroupSummary(
        list,
        groups
    );
}


function requestMyTeamDayDetail(metric) {
    if (isFocusMetricDisabled(metric)) {
        return;
    }

    if (!latestDayDetailRequestHandler) {
        return;
    }

    const date = currentFocusItem?.date || '';
    const statusKey = metric.dataset.myTeamStatusKey || '';

    if (!date || !statusKey) {
        return;
    }

    latestDayDetailRequestHandler({
        date,
        statusKey,
    });
}


function updateFocusMetricStates(counts = {}) {
    Object.entries(MY_TEAM_FOCUS_METRIC_DEFINITIONS).forEach(([statusKey, definition]) => {
        const countElement = getById(definition.countId);
        const metric = countElement?.closest('.home-focus-metric');

        if (!metric) {
            return;
        }

        const count = normalizeMetricCount(counts[statusKey]);
        const shouldDisable = count <= 0;

        metric.dataset.myTeamStatusKey = statusKey;
        metric.classList.toggle(MY_TEAM_DISABLED_CLASS, shouldDisable);
        metric.setAttribute('aria-disabled', shouldDisable ? 'true' : 'false');

        if (shouldDisable) {
            metric.removeAttribute('role');
            metric.removeAttribute('tabindex');
            return;
        }

        metric.setAttribute('role', 'button');
        metric.setAttribute('tabindex', '0');
    });
}


function isFocusMetricDisabled(metric) {
    return metric.getAttribute('aria-disabled') === 'true'
        || metric.classList.contains(MY_TEAM_DISABLED_CLASS);
}


function normalizeMetricCount(value) {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : 0;
}


function renderMyTeamGroupSummary(list, groups) {
    renderHomeDetailGroupSummary(list, groups, {
        emptyMessage: HOME_DETAIL_EMPTY_MESSAGES.DEFAULT,
        ...HOME_DETAIL_GROUP_SUMMARY_OPTIONS.MY_TEAM,
    });
}


function setMyTeamHeaderSummaryMode() {
    setText('myTeamTitle', latestMyTeamHeaderTitle || '所属班の進捗');
    setMyTeamCompletedRateVisible(true);
    setMyTeamHeaderBackButtonVisible(false);
}


function setMyTeamHeaderDetailMode(title) {
    setText('myTeamTitle', title || '対象の仕事');
    setMyTeamCompletedRateVisible(false);
    setMyTeamHeaderBackButtonVisible(true);
}


function setMyTeamCompletedRateVisible(isVisible) {
    const rateValue = getById('myTeamCompletedRate');
    const rateBlock = rateValue?.closest('.home-rate') || rateValue;

    if (rateBlock) {
        rateBlock.classList.toggle('is-hidden', !isVisible);
    }
}


function setMyTeamHeaderBackButtonVisible(isVisible) {
    const button = resolveMyTeamHeaderBackButton();

    if (button) {
        button.classList.toggle('is-hidden', !isVisible);
    }
}


function resolveMyTeamHeaderBackButton() {
    const existingButton = getById(MY_TEAM_HEADER_BACK_BUTTON_ID);

    if (existingButton) {
        existingButton.classList.add(
            'home-my-team-detail__back',
            'home-panel-back-button'
        );

        return existingButton;
    }

    const panel = getById('homeMyTeamPanel');
    const header = panel?.querySelector('.home-panel__header');

    if (!header) {
        return null;
    }

    const button = document.createElement('button');
    button.id = MY_TEAM_HEADER_BACK_BUTTON_ID;
    button.className = 'home-my-team-detail__back home-panel-back-button is-hidden';
    button.type = 'button';
    button.textContent = '戻る';

    header.appendChild(button);

    return button;
}


function resolveMyTeamDayDetailView() {
    const existingView = getById('myTeamDayDetailView');

    if (existingView) {
        return existingView;
    }

    const panel = getById('homeMyTeamPanel');

    if (!panel) {
        return null;
    }

    const detailView = document.createElement('div');
    detailView.id = 'myTeamDayDetailView';
    detailView.className = 'home-my-team-detail is-hidden';

    const list = document.createElement('div');
    list.id = 'myTeamDayDetailList';
    list.className = 'home-my-team-detail__list';

    detailView.append(list);

    const focusArea = panel.querySelector('.home-today-focus');

    if (focusArea) {
        focusArea.insertAdjacentElement('afterend', detailView);
    } else {
        panel.appendChild(detailView);
    }

    return detailView;
}


function showMyTeamFocusView() {
    currentMyTeamDayDetailContext = null;
    resetMyTeamDrilldownState();
    setMyTeamCurrentStatusKey('');

    setMyTeamHeaderSummaryMode();

    getMyTeamSummaryElements().forEach((element) => {
        element.classList.remove('is-hidden');
    });

    const detailView = getById('myTeamDayDetailView');

    if (detailView) {
        detailView.classList.add('is-hidden');
    }
}


function showMyTeamDetailView({
    title = '対象の仕事',
} = {}) {
    setMyTeamHeaderDetailMode(title);

    getMyTeamSummaryElements().forEach((element) => {
        element.classList.add('is-hidden');
    });

    const detailView = resolveMyTeamDayDetailView();

    if (detailView) {
        detailView.classList.remove('is-hidden');
    }
}


function buildMyTeamDayDetailTitle(payload) {
    const target = payload?.target || {};
    const dateLabel = target.dateLabel || '';
    const statusLabel = target.statusLabel || '対象';

    return buildHomeDetailTitle([
        dateLabel,
        buildHomeDetailWorkTitle(statusLabel),
    ]);
}


function buildMyTeamDisplayGroups(items) {
    if (shouldShowMyTeamAffiliationLayer()) {
        return buildAffiliationDetailGroups({
            items,
        });
    }

    return buildMemberDetailGroups({
        items,
    });
}


function findCurrentMyTeamAffiliationGroup(groupKey) {
    return findHomeDetailGroupByKey(
        myTeamDrilldownState.affiliationGroups,
        groupKey
    );
}


function findCurrentMyTeamMemberGroup(groupKey) {
    return findHomeDetailGroupByKey(
        myTeamDrilldownState.memberGroups,
        groupKey
    );
}


function buildMyTeamAffiliationMemberTitle(group) {
    const target = currentMyTeamDayDetailContext?.payload?.target || {};
    const statusLabel = target.statusLabel || '対象';
    const affiliationLabel = buildHomeDetailGroupTitleLabel(group);

    return buildHomeDetailTitle([
        affiliationLabel,
        buildHomeDetailAssigneeTitle(statusLabel),
    ]);
}


function buildMyTeamMemberTaskTitle(group) {
    const target = currentMyTeamDayDetailContext?.payload?.target || {};
    const statusLabel = target.statusLabel || '対象';
    const affiliationGroup = findCurrentMyTeamAffiliationGroup(
        myTeamDrilldownState.affiliationGroupKey
    );

    const affiliationLabel = buildHomeDetailGroupTitleLabel(affiliationGroup);
    const memberLabel = buildHomeDetailGroupTitleLabel(group);

    return buildHomeDetailTitle([
        affiliationLabel,
        memberLabel,
        buildHomeDetailWorkTitle(statusLabel),
    ]);
}


function getMyTeamSummaryElements() {
    const panel = getById('homeMyTeamPanel');

    if (!panel) {
        return [];
    }

    return [
        panel.querySelector('.home-week-strip'),
        panel.querySelector('.home-today-focus'),
        panel.querySelector('.home-panel__footer'),
    ].filter(Boolean);
}


export function renderMyTeamDayDetail(payload) {
    const title = buildMyTeamDayDetailTitle(payload);
    const items = Array.isArray(payload?.items)
        ? payload.items
        : [];

    currentMyTeamDayDetailContext = null;
    resetMyTeamDrilldownState();

    showMyTeamDetailView({
        title,
    });

    const list = getById('myTeamDayDetailList');

    if (!list) {
        return;
    }
    
    setMyTeamCurrentStatusKey(payload?.target?.statusKey || '');

    const groups = buildMyTeamDisplayGroups(items);

    currentMyTeamDayDetailContext = {
        payload,
        items,
        groups,
    };

    if (shouldShowMyTeamAffiliationLayer()) {
        setMyTeamAffiliationGroups(groups);
    } else {
        setMyTeamMemberGroups(groups);
    }

    renderMyTeamGroupSummary(list, groups);
}


function shouldShowMyTeamAffiliationLayer() {
    return Boolean(latestMyTeamScope?.showAffiliationLayer);
}


export function renderMyTeamDayDetailError() {
    currentMyTeamDayDetailContext = null;
    resetMyTeamDrilldownState();
    setMyTeamCurrentStatusKey('');

    showMyTeamDetailView({
        title: '対象の仕事',
    });

    const list = getById('myTeamDayDetailList');

    if (list) {
        renderHomeDetailEmpty(
            list,
            HOME_DETAIL_EMPTY_MESSAGES.LOAD_FAILED
        );
    }
}