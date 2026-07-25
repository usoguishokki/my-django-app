// static/js/parts/search/ui/PartsSearchRenderer.js

import {
    renderGenericTableHTML,
} from '../../../ui/renderers/genericTableRenderer.js';


const QUANTITY_FORMATTER = new Intl.NumberFormat(
    'ja-JP',
    {
        maximumFractionDigits: 3,
    }
);


const PARTS_SEARCH_COLUMNS = Object.freeze([
    Object.freeze({
        key: 'sectionLabel',
        label: '係',
        widthPx: 88,
    }),
    Object.freeze({
        key: 'barcode',
        label: 'バーコード',
        widthPx: 136,
    }),
    Object.freeze({
        key: 'rackLevel1',
        label: '棚番',
        widthPx: 112,
    }),
    Object.freeze({
        key: 'storageLocationName',
        label: '保管場所',
        widthPx: 192,
    }),
    Object.freeze({
        key: 'partsName',
        label: '品名',
        widthPx: 352,
    }),
    Object.freeze({
        key: 'partsModel',
        label: '型式',
        widthPx: 320,
    }),
    Object.freeze({
        key: 'newStockQty',
        label: '新品',
        widthPx: 72,
        align: 'right',
        formatter: formatQuantity,
    }),
    Object.freeze({
        key: 'usedStockQty',
        label: '中古',
        widthPx: 72,
        align: 'right',
        formatter: formatQuantity,
    }),
    Object.freeze({
        key: 'partsNote',
        label: '備考',
        widthPx: 224,
    }),
]);


const SECTION_LABELS = Object.freeze({
    molding: '成形',
    press: 'プレス',
    body: 'ボデー',
    painting: '塗装',
    assembly: '組立て',
});


const SEARCH_CRITERIA_DEFINITIONS = Object.freeze([
    Object.freeze({
        key: 'section',
        parameterName: 'section',
        label: '係',
        formatter: formatSectionLabel,
    }),
    Object.freeze({
        key: 'barcode',
        parameterName: 'barcode',
        label: 'バーコード',
    }),
    Object.freeze({
        key: 'rackLevel1',
        parameterName: 'rack_level1',
        label: '棚番',
    }),
    Object.freeze({
        key: 'partsName',
        parameterName: 'parts_name',
        label: '品名',
    }),
    Object.freeze({
        key: 'partsModel',
        parameterName: 'parts_model',
        label: '型式',
    }),
]);


function formatQuantity(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return '0';
    }

    return QUANTITY_FORMATTER.format(
        numericValue
    );
}


function normalizeText(value) {
    return String(
        value ?? ''
    ).trim();
}


function formatSectionLabel(
    value,
) {
    const normalizedValue = normalizeText(
        value
    );

    return (
        SECTION_LABELS[normalizedValue]
        ?? normalizedValue
    );
}


function normalizeQuantity(value) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue)
        ? numericValue
        : 0;
}


function normalizeSearchCriteria(
    criteria = {},
) {
    return Object.fromEntries(
        SEARCH_CRITERIA_DEFINITIONS.map(
            ({
                key,
                parameterName,
            }) => [
                key,
                normalizeText(
                    criteria?.[key]
                    ?? criteria?.[parameterName]
                ),
            ]
        )
    );
}


function buildSearchCriteriaText(
    criteria,
) {
    const normalizedCriteria =
        normalizeSearchCriteria(
            criteria
        );

    return SEARCH_CRITERIA_DEFINITIONS
        .filter(({
            key,
        }) => Boolean(
            normalizedCriteria[key]
        ))
        .map(({
            key,
            label,
            formatter,
        }) => {
            const value =
                normalizedCriteria[key];

            const displayValue =
                typeof formatter === 'function'
                    ? formatter(value)
                    : value;

            return (
                `${label}「${displayValue}」`
            );
        })
        .join('、');
}

function normalizePartsSearchItem(
    item = {},
    index = 0,
) {
    const barcode = normalizeText(
        item.barcode
    );

    const groupCd = normalizeText(
        item.group_cd
    );

    const rackLevel1 = normalizeText(
        item.rack_level1
    );

    const section = normalizeText(
        item.section
    );

    const rackLocationNo = normalizeText(
        item.rack_location_no
    );

    return {
        rowId: [
            groupCd,
            barcode,
            rackLevel1,
            index,
        ].join(':'),

        groupCd,
        barcode,
        rackLevel1,

        section,

        sectionLabel: normalizeText(
            item.section_label
        ),

        rackLocationNo,

        storageLocationName: normalizeText(
            item.storage_location_name
        ),

        partsName: normalizeText(
            item.parts_name
        ),

        partsModel: normalizeText(
            item.parts_model
        ),

        newStockQty: normalizeQuantity(
            item.new_stock_qty
        ),

        usedStockQty: normalizeQuantity(
            item.used_stock_qty
        ),

        partsNote: normalizeText(
            item.parts_note
        ),

        dataset: {
            groupCd,
            barcode,
            rackLevel1,
            section,
            rackLocationNo,
        },
    };
}


function normalizePartsSearchItems(
    items,
) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map(
        normalizePartsSearchItem
    );
}


function getElement(
    root,
    selector,
) {
    return root?.querySelector(
        selector
    ) ?? null;
}


function setHidden(
    element,
    hidden,
) {
    if (!element) {
        return;
    }

    element.hidden = Boolean(
        hidden
    );
}


function setText(
    element,
    value,
) {
    if (!element) {
        return;
    }

    element.textContent = String(
        value ?? ''
    );
}


function resolveElements(root) {
    return {
        initialState: getElement(
            root,
            '#partsSearchInitialState'
        ),

        emptyState: getElement(
            root,
            '#partsSearchEmptyState'
        ),

        errorState: getElement(
            root,
            '#partsSearchErrorState'
        ),

        tableContainer: getElement(
            root,
            '#partsSearchTableContainer'
        ),

        table: getElement(
            root,
            '#partsSearchTable'
        ),

        summary: getElement(
            root,
            '#partsSearchSummary'
        ),

        countContainer: getElement(
            root,
            '#partsSearchCount'
        ),

        countValue: getElement(
            root,
            '[data-parts-search-count]'
        ),

        validationMessage: getElement(
            root,
            '#partsSearchValidationMessage'
        ),
    };
}


function hideAllResultStates(
    elements,
) {
    setHidden(
        elements.initialState,
        true
    );

    setHidden(
        elements.emptyState,
        true
    );

    setHidden(
        elements.errorState,
        true
    );

    setHidden(
        elements.tableContainer,
        true
    );
}


function buildSummaryText({
    criteria,
    count,
    limit,
}) {
    const criteriaText =
        buildSearchCriteriaText(
            criteria
        );

    const searchConditionText =
        criteriaText
        || '指定された条件';

    if (
        Number.isFinite(limit)
        && limit > 0
        && count >= limit
    ) {
        return (
            `${searchConditionText}の検索結果を`
            + `${count}件表示しています。`
            + `表示上限は${limit}件です。`
        );
    }

    return (
        `${searchConditionText}の検索結果を`
        + `${count}件表示しています。`
    );
}


function buildEmptySummaryText(
    criteria,
) {
    const criteriaText =
        buildSearchCriteriaText(
            criteria
        );

    if (!criteriaText) {
        return (
            '指定された条件に該当する'
            + '部品はありませんでした。'
        );
    }

    return (
        `${criteriaText}に該当する`
        + '部品はありませんでした。'
    );
}


export function renderPartsSearchInitial(
    root,
) {
    const elements = resolveElements(
        root
    );

    hideAllResultStates(
        elements
    );

    setHidden(
        elements.initialState,
        false
    );

    setHidden(
        elements.countContainer,
        true
    );

    setText(
        elements.summary,
        (
            '係、バーコード、棚番、品名、型式の'
            + 'いずれかを指定して検索してください。'
        )
    );
}


export function renderPartsSearchEmpty(
    root,
    {
        criteria = {},
    } = {},
) {
    const elements = resolveElements(
        root
    );

    hideAllResultStates(
        elements
    );

    setHidden(
        elements.emptyState,
        false
    );

    setHidden(
        elements.countContainer,
        false
    );

    setText(
        elements.countValue,
        '0'
    );

    setText(
        elements.summary,
        buildEmptySummaryText(
            criteria
        )
    );
}


export function renderPartsSearchError(
    root,
) {
    const elements = resolveElements(
        root
    );

    hideAllResultStates(
        elements
    );

    setHidden(
        elements.errorState,
        false
    );

    setHidden(
        elements.countContainer,
        true
    );

    setText(
        elements.summary,
        '検索処理中にエラーが発生しました。'
    );
}


export function renderPartsSearchResults(
    root,
    {
        criteria = {},
        items = [],
        summary = {},
    } = {},
) {
    const rows = normalizePartsSearchItems(
        items
    );

    if (rows.length === 0) {
        renderPartsSearchEmpty(
            root,
            {
                criteria,
            }
        );

        return;
    }

    const elements = resolveElements(
        root
    );

    hideAllResultStates(
        elements
    );

    if (!elements.table) {
        renderPartsSearchError(
            root
        );

        return;
    }

    elements.table.innerHTML =
        renderGenericTableHTML(
            {
                columns: PARTS_SEARCH_COLUMNS,
                rows,
            }
        );

    setHidden(
        elements.tableContainer,
        false
    );

    setHidden(
        elements.countContainer,
        false
    );

    const summaryCount = Number(
        summary.count
    );

    const summaryLimit = Number(
        summary.limit
    );

    const count = Number.isFinite(
        summaryCount
    )
        ? summaryCount
        : rows.length;

    const limit = Number.isFinite(
        summaryLimit
    )
        ? summaryLimit
        : 0;

    setText(
        elements.countValue,
        count
    );

    setText(
        elements.summary,
        buildSummaryText({
            criteria,
            count,
            limit,
        })
    );
}


export function setPartsSearchValidationMessage(
    root,
    message = '',
) {
    const elements = resolveElements(
        root
    );

    const normalizedMessage = normalizeText(
        message
    );

    setText(
        elements.validationMessage,
        normalizedMessage
    );

    setHidden(
        elements.validationMessage,
        !normalizedMessage
    );
}


export function clearPartsSearchValidationMessage(
    root,
) {
    setPartsSearchValidationMessage(
        root,
        ''
    );
}