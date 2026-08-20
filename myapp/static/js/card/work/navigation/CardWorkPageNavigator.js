// static/js/card/work/navigation/CardWorkPageNavigator.js

const CARD_WORK_PAGE_PATH = '/card-work/';


export function openCardWorkPage({
    source = '',
    scope = '',
    statusKey = '',
    date = '',
    planId = '',
} = {}) {
    const url = buildCardWorkPageUrl({
        source,
        scope,
        statusKey,
        date,
        planId,
    });

    if (!url) {
        return;
    }

    window.location.assign(url);
}


export function buildCardWorkPageUrl({
    source = '',
    scope = '',
    statusKey = '',
    date = '',
    planId = '',
} = {}) {
    if (!source || !scope) {
        return '';
    }

    const url = new URL(
        CARD_WORK_PAGE_PATH,
        window.location.origin
    );

    url.searchParams.set('source', source);
    url.searchParams.set('scope', scope);

    if (statusKey) {
        url.searchParams.set('status', statusKey);
    }

    if (date) {
        url.searchParams.set('date', date);
    }

    if (planId) {
        url.searchParams.set('plan_id', planId);
    }

    return url.toString();
}