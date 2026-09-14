import {
    splitImplementationDateTimeValue,
} from './CardWorkInputStatePolicy.js';


export function applyExistingCardWorkResult(defaultState, existingResult = {}) {
    if (!hasExistingCardWorkResult(existingResult)) {
        return defaultState;
    }

    const { date, time } = splitImplementationDateTimeValue(
        existingResult.implementationDatetime || ''
    );

    return {
        ...defaultState,
        implementationDate: date,
        implementationTime: time,
        result: String(existingResult.result || ''),
        implementationContent: String(existingResult.implementationContent || ''),
        practitionerIds: normalizeIds(existingResult.practitionerIds),
        actualManHours: existingResult.actualManHours,
        comment: String(existingResult.comment || ''),
    };
}


function hasExistingCardWorkResult(result) {
    return Boolean(
        result.implementationDatetime ||
        result.result ||
        result.implementationContent ||
        normalizeIds(result.practitionerIds).length ||
        result.actualManHours !== null && result.actualManHours !== undefined ||
        result.comment
    );
}


function normalizeIds(values) {
    return Array.isArray(values)
        ? values.map((value) => String(value ?? '')).filter(Boolean)
        : [];
}
