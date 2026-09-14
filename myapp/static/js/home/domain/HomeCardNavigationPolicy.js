// static/js/home/domain/HomeCardNavigationPolicy.js

const CARD_ITEM_OPENABLE_STATUS_KEYS = new Set([
    'in_progress',
    'approval_waiting',
]);

const CARD_OPENABLE_STATUS_KEYS = new Set([
    'sent_back',
    'delayed',
]);


export function shouldPreviewCardListFromMyTaskDateGroup({
    statusKey = '',
    dateGroup = null,
} = {}) {
    if (!CARD_ITEM_OPENABLE_STATUS_KEYS.has(statusKey)) {
        return false;
    }

    if (!dateGroup?.date) {
        return false;
    }

    const items = Array.isArray(dateGroup?.items)
        ? dateGroup.items
        : [];

    return items.length > 0;
}


export function canOpenCardPageFromMyTaskDateGroup({
    statusKey = '',
    dateGroup = null,
} = {}) {
    if (!CARD_OPENABLE_STATUS_KEYS.has(statusKey)) {
        return false;
    }

    if (!dateGroup?.date) {
        return false;
    }

    const items = Array.isArray(dateGroup?.items)
        ? dateGroup.items
        : [];

    return items.some(hasPlanTime);
}


function hasPlanTime(item) {
    return Boolean(
        item?.planTime ||
        item?.planTimeLabel
    );
}


export function canOpenCardPageFromMyTaskItem(statusKey = '') {
    return CARD_ITEM_OPENABLE_STATUS_KEYS.has(statusKey);
}
