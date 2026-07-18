// static/js/home/domain/HomeDashboardWeekdayStatePolicy.js

import {
    clampRate,
    formatCount,
    toNumber,
} from './HomeDashboardNumberFormatPolicy.js';

const WEEKDAY_DONE_STATE = 'done';
const WEEKDAY_DONE_LABEL = '済';
const WEEKDAY_NOT_DONE_LABEL = '未';

export function getWeekdayStateLabel(state) {
    return state === WEEKDAY_DONE_STATE
        ? WEEKDAY_DONE_LABEL
        : WEEKDAY_NOT_DONE_LABEL;
}

export function buildWeekDayMeta({
    state,
    remaining,
    total,
    completedRate,
}) {
    const normalizedTotal = toNumber(total);
    const normalizedRemaining = toNumber(remaining);

    if (normalizedTotal <= 0) {
        return '対象なし';
    }

    if (state === 'done') {
        return formatCount(normalizedTotal);
    }

    if (state === 'future') {
        return formatCount(normalizedTotal);
    }

    if (state === 'today') {
        return formatCount(normalizedRemaining);
    }

    if (state === 'danger') {
        return formatCount(normalizedRemaining);
    }

    if (state === 'warning') {
        return formatCount(normalizedRemaining);
    }

    if (state === 'pending') {
        return formatCount(normalizedRemaining);
    }

    return `${clampRate(completedRate)}%`;
}