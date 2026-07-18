// static/js/card/work/domain/CardWorkInputStatePolicy.js

import {
    formatDate,
    joinDateTimeLocal,
    splitDateTimeLocal,
} from '../../../utils/dateTime.js';

export function createDefaultCardWorkInputState({
    practitionerIds = [],
} = {}) {
    return {
        isOpen: false,
        implementationDate: getTodayDateInputValue(),
        implementationTime: getCurrentTimeInputValue(),
        result: 'OK',
        implementationContent: '',
        practitionerIds: normalizeStringArray(practitionerIds),
        practitionerNames: [],
        actualManHours: null,
        comment: '',
    };
}

export function buildImplementationDateTimeValue(inputState = {}) {
    return joinDateTimeLocal({
        date: inputState.implementationDate || '',
        time: inputState.implementationTime || '',
    });
}

export function splitImplementationDateTimeValue(value) {
    const {
        date = '',
        time = '',
    } = splitDateTimeLocal(value);

    return {
        date,
        time: normalizeTimeMinuteValue(time),
    };
}

function getTodayDateInputValue() {
    return formatDate(new Date(), 'YYYY-MM-DD');
}

function getCurrentTimeInputValue() {
    return formatDate(new Date(), 'HH:mm');
}

function normalizeTimeMinuteValue(value) {
    return String(value || '').slice(0, 5);
}

function normalizeStringArray(values) {
    return Array.isArray(values)
        ? values.map((value) => String(value ?? '')).filter(Boolean)
        : [];
}