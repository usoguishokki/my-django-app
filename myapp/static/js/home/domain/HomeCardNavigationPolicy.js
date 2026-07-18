// static/js/home/domain/HomeCardNavigationPolicy.js

const CARD_PREVIEW_STATUS_KEYS = new Set([
    'in_progress',
]);

const CARD_OPENABLE_STATUS_KEYS = new Set([
    'sent_back',
    'delayed',
]);


export function shouldPreviewCardListFromMyTaskDateGroup({
    statusKey = '',
    dateGroup = null,
} = {}) {
    if (!CARD_PREVIEW_STATUS_KEYS.has(statusKey)) {
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