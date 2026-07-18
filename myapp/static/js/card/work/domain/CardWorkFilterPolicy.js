// static/js/card/work/domain/CardWorkFilterPolicy.js

export const CARD_WORK_FILTER_DEFINITIONS = Object.freeze([
    {
        key: 'process',
        role: 'filter-process',
        queryKey: 'process',
        optionKey: 'processes',
        label: '工程',
    },
    {
        key: 'equipment',
        role: 'filter-equipment',
        queryKey: 'equipment',
        optionKey: 'equipments',
        label: '設備名',
    },
    {
        key: 'checkStatus',
        role: 'filter-check-status',
        queryKey: 'checkStatus',
        optionKey: 'checkStatuses',
        label: '点検種類',
    },
]);

export const CARD_WORK_FILTER_FIELDS = Object.freeze(
    CARD_WORK_FILTER_DEFINITIONS.reduce((fields, definition) => ({
        ...fields,
        [definition.key]: definition.key,
    }), {})
);


export function createDefaultFilterDraft(activeFilters = {}) {
    return createFilterDraftFromSource(activeFilters);
}


export function buildCascadingFilterOptions({
    filterRows = [],
    draft = {},
} = {}) {
    return CARD_WORK_FILTER_DEFINITIONS.reduce((options, definition) => ({
        ...options,
        [definition.optionKey]: buildOptionsForField({
            filterRows,
            draft,
            field: definition.key,
        }),
    }), {});
}


export function normalizeFilterDraft({
    draft = {},
    filterRows = [],
} = {}) {
    const nextDraft = createFilterDraftFromSource(draft);

    const options = buildCascadingFilterOptions({
        filterRows,
        draft: nextDraft,
    });

    return CARD_WORK_FILTER_DEFINITIONS.reduce((normalizedDraft, definition) => {
        const value = nextDraft[definition.key];
        const fieldOptions = options[definition.optionKey] || [];

        return {
            ...normalizedDraft,
            [definition.key]: hasOptionValue(fieldOptions, value)
                ? value
                : '',
        };
    }, {});
}


export function readFilterValuesFromDraft(draft = {}) {
    return createFilterDraftFromSource(draft);
}


export function getCardWorkFilterDefinitionByRole(role) {
    return CARD_WORK_FILTER_DEFINITIONS.find(
        (definition) => definition.role === role
    ) || null;
}


function createFilterDraftFromSource(source = {}) {
    return CARD_WORK_FILTER_DEFINITIONS.reduce((draft, definition) => ({
        ...draft,
        [definition.key]: normalizeFilterValue(source[definition.key]),
    }), {});
}


function buildOptionsForField({
    filterRows = [],
    draft = {},
    field,
}) {
    const values = new Set();

    filterRows
        .filter((row) => rowMatchesOtherFilters({
            row,
            draft,
            field,
        }))
        .forEach((row) => {
            const value = normalizeFilterValue(row?.[field]);

            if (value) {
                values.add(value);
            }
        });

    return [...values]
        .sort((a, b) => a.localeCompare(b, 'ja'))
        .map((value) => ({
            value,
            label: value,
        }));
}


function rowMatchesOtherFilters({
    row = {},
    draft = {},
    field,
}) {
    return CARD_WORK_FILTER_DEFINITIONS.every((definition) => {
        if (definition.key === field) {
            return true;
        }

        const selectedValue = normalizeFilterValue(draft[definition.key]);

        if (!selectedValue) {
            return true;
        }

        return normalizeFilterValue(row?.[definition.key]) === selectedValue;
    });
}


function hasOptionValue(options = [], value) {
    const normalizedValue = normalizeFilterValue(value);

    if (!normalizedValue) {
        return true;
    }

    return options.some(
        (option) => normalizeFilterValue(option.value) === normalizedValue
    );
}


function normalizeFilterValue(value) {
    return String(value || '').trim();
}