// static/js/home/ui/HomeDetailListRenderer.js

import {
    createHomeDetailEmptyState,
    createHomeDetailGroupSummaryList,
    createHomeDetailTaskList,
} from './HomeDetailGroupRenderer.js';


export function renderHomeDetailGroupSummary(
    container,
    groups,
    {
        emptyMessage = '対象の仕事一覧はまだありません。',
        listClassName = '',
        cardClassName = '',
        labelClassName = '',
        countClassName = '',
        datasetKey = '',
    } = {}
) {
    if (!container) {
        return;
    }

    const safeGroups = Array.isArray(groups)
        ? groups
        : [];

    if (!safeGroups.length) {
        container.replaceChildren(createHomeDetailEmptyState(emptyMessage));
        return;
    }

    container.replaceChildren(
        createHomeDetailGroupSummaryList(safeGroups, {
            listClassName,
            cardClassName,
            labelClassName,
            countClassName,
            datasetKey,
        })
    );
}


export function renderHomeDetailTaskList(
    container,
    items,
    options = {}
) {
    if (!container) {
        return;
    }

    const safeItems = Array.isArray(items)
        ? items
        : [];

    container.replaceChildren(
        createHomeDetailTaskList(safeItems, options)
    );
}


export function renderHomeDetailEmpty(
    container,
    message = '対象の仕事一覧はまだありません。'
) {
    if (!container) {
        return;
    }

    container.replaceChildren(
        createHomeDetailEmptyState(message)
    );
}