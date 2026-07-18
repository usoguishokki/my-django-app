// static/js/card/work/domain/CardWorkResultPayloadPolicy.js

import {
    buildImplementationDateTimeValue,
} from './CardWorkInputStatePolicy.js';

export function buildCardWorkResultPayload({
    plan = {},
    inputState = {},
} = {}) {
    return {
        planId: normalizePlanId(plan?.planId),
        implementationDatetime: buildImplementationDateTimeValue(inputState),
        result: normalizeText(inputState.result),
        implementationContent: normalizeText(inputState.implementationContent),
        practitionerIds: normalizePractitionerIds(inputState.practitionerIds),
        actualManHours: normalizeManHours(inputState.actualManHours),
        comment: normalizeText(inputState.comment),
    };
}

function normalizePlanId(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    return String(value);
}

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizePractitionerIds(values) {
    return Array.isArray(values)
        ? values.map((value) => String(value ?? '')).filter(Boolean)
        : [];
}

function normalizeManHours(value) {
    const normalizedValue = normalizeNumericText(value);

    if (normalizedValue === '') {
        return '';
    }

    return normalizedValue;
}


function normalizeNumericText(value) {
    return String(value ?? '')
        .trim()
        .replace(/[０-９]/g, (char) =>
            String.fromCharCode(char.charCodeAt(0) - 0xfee0)
        )
        .replace(/[．]/g, '.')
        .replace(/[，、]/g, ',')
        .replace(/\s+/g, '');
}