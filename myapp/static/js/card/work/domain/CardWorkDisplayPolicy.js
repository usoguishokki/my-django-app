// static/js/card/work/domain/CardWorkDisplayPolicy.js

import {
    formatHourMinuteLabel,
    formatJapaneseMonthDayWeekdayLabel,
} from '../../../utils/dateTime.js';

export const CARD_WORK_RESULT_OPTIONS = Object.freeze([
    {
        value: 'OK',
        label: 'OK',
    },
    {
        value: 'NG',
        label: 'NG',
    },
]);

export function formatPlanTimeLabel(value) {
    return formatHourMinuteLabel(value) || '-';
}

export function formatManHoursLabel(value) {
    if (value === null || value === undefined || value === '') {
        return '-';
    }

    return `${value}分`;
}

export function formatTargetDateLabel(value) {
    return formatJapaneseMonthDayWeekdayLabel(value) || value || '';
}

const CARD_WORK_CHECK_STATUS = Object.freeze({
    DAILY: '日常点検',
    PERIODIC: '定期点検',
});

const CARD_WORK_TIME_ZONE = Object.freeze({
    STOPPED: '停止中',
});

const CARD_WORK_PLAN_HEADER_TONE_CLASSES = Object.freeze({
    DAILY: 'card-work-plan-card__header--daily',
    STOPPED: 'card-work-plan-card__header--stopped',
});


export function resolvePlanHeaderToneClassName(plan = {}) {
    const checkStatus = readPlanCheckStatus(plan);
    const timeZone = readPlanTimeZone(plan);

    if (checkStatus === CARD_WORK_CHECK_STATUS.DAILY) {
        return CARD_WORK_PLAN_HEADER_TONE_CLASSES.DAILY;
    }

    if (timeZone === CARD_WORK_TIME_ZONE.STOPPED) {
        return CARD_WORK_PLAN_HEADER_TONE_CLASSES.STOPPED;
    }

    return '';
}


function readPlanCheckStatus(plan = {}) {
    return normalizeCardWorkDisplayValue(
        plan?.checkStatus ??
        plan?.check_status ??
        plan?.check?.status
    );
}


function readPlanTimeZone(plan = {}) {
    return normalizeCardWorkDisplayValue(
        plan?.timeZone ??
        plan?.time_zone ??
        plan?.check?.timeZone ??
        plan?.check?.time_zone
    );
}


function normalizeCardWorkDisplayValue(value) {
    return String(value ?? '').trim();
}


export function formatRequiredPeopleLabel(value) {
    const text = String(value ?? '').trim();

    if (!text) {
        return '';
    }

    return text.endsWith('人')
        ? text
        : `${text}人`;
}


export function formatDayOfWeekLabel(value) {
    const text = String(value ?? '').trim();

    if (!text) {
        return '';
    }

    return text.endsWith('曜日')
        ? text.replace('曜日', '')
        : text;
}