// static/js/card/work/domain/CardWorkResultValidationPolicy.js

const VALID_RESULTS = new Set(['OK', 'NG']);

export function validateCardWorkResultPayload(payload = {}) {
    const errors = [];

    if (!payload.implementationDatetime) {
        errors.push(createValidationError({
            field: 'implementationDatetime',
            message: '実施日時を入力してください。',
        }));
    }

    if (!VALID_RESULTS.has(payload.result)) {
        errors.push(createValidationError({
            field: 'result',
            message: '結果を選択してください。',
        }));
    }

    if (!Array.isArray(payload.practitionerIds) || payload.practitionerIds.length === 0) {
        errors.push(createValidationError({
            field: 'practitionerIds',
            message: '実施者を1人以上選択してください。',
        }));
    }

    if (!isValidManHours(payload.actualManHours)) {
        errors.push(createValidationError({
            field: 'actualManHours',
            message: '工数を0以上の整数で入力してください。',
        }));
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

function createValidationError({
    field,
    message,
}) {
    return {
        field,
        message,
    };
}

function isValidManHours(value) {
    if (value === null || value === undefined || value === '') {
        return false;
    }

    const numericValue = Number(value);

    return (
        Number.isFinite(numericValue) &&
        Number.isInteger(numericValue) &&
        numericValue >= 0
    );
}