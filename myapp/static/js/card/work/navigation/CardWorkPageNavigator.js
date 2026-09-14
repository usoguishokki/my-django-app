const CARD_WORK_PAGE_PATH = '/card-work/';


export function openCardWorkPage(options = {}) {
    const url = buildCardWorkPageUrl(options);

    if (url) {
        window.location.assign(url);
    }
}


export function buildCardWorkPageUrl({
    source = '',
    scope = '',
    statusKey = '',
    date = '',
    planId = '',
} = {}) {
    if (!isSupportedContract({ source, scope, statusKey, date, planId })) {
        return '';
    }

    const url = new URL(CARD_WORK_PAGE_PATH, window.location.origin);
    url.searchParams.set('source', source);
    url.searchParams.set('scope', scope);

    if (statusKey) url.searchParams.set('status', statusKey);
    if (date) url.searchParams.set('date', date);
    if (planId !== '' && planId !== null && planId !== undefined) {
        url.searchParams.set('plan_id', String(planId));
    }

    return url.toString();
}


function isSupportedContract({ source, scope, statusKey, date, planId }) {
    if (source === 'home' && scope === 'my_tasks') {
        return Boolean(statusKey && date);
    }

    if (source === 'work_contents' && scope === 'plan') {
        return planId !== '' && planId !== null && planId !== undefined;
    }

    return false;
}
