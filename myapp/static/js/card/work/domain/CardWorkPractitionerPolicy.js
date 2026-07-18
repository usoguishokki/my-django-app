// static/js/card/work/domain/CardWorkPractitionerPolicy.js

export function normalizePractitionerOptions(initialState = {}) {
    const members = Array.isArray(initialState?.memberOptions)
        ? initialState.memberOptions
        : [];

    return members
        .map(normalizePractitionerOption)
        .filter((option) => option.value && option.label);
}

export function resolveDefaultPractitionerIds({
    initialState = {},
    practitionerOptions = [],
} = {}) {
    const loginMemberId = String(
        initialState?.currentUser?.memberId
        ?? initialState?.loginUser?.memberId
        ?? ''
    );

    if (!loginMemberId) {
        return [];
    }

    const existsInOptions = practitionerOptions.some(
        (option) => option.value === loginMemberId
    );

    return existsInOptions
        ? [loginMemberId]
        : [];
}

export function readPractitionerSelectionFromDropdownDetail(detail = {}) {
    const selectedItems = Array.isArray(detail.selectedItems)
        ? detail.selectedItems
        : [];

    return {
        practitionerIds: Array.isArray(detail.values)
            ? detail.values.map((value) => String(value ?? '')).filter(Boolean)
            : [],
        practitionerNames: selectedItems
            .map((item) => String(item?.label ?? ''))
            .filter(Boolean),
    };
}

export function formatPractitionerTriggerText(inputState = {}) {
    const names = Array.isArray(inputState.practitionerNames)
        ? inputState.practitionerNames.filter(Boolean)
        : [];

    if (names.length === 0) {
        return '実施者を選択してください';
    }

    if (names.length <= 2) {
        return names.join('、');
    }

    return `${names[0]} 他${names.length - 1}名`;
}

function normalizePractitionerOption(member = {}) {
    const value = member?.memberId
        ?? member?.id
        ?? member?.value
        ?? '';

    const label = member?.name
        ?? member?.memberName
        ?? member?.label
        ?? '';

    return {
        value: String(value ?? ''),
        label: String(label ?? ''),
        raw: member,
    };
}