// static/js/home/navigation/HomeCardPageNavigator.js

const CARD_WORK_PAGE_PATH = '/card-work/';

export function openCardPageFromMyTaskDateGroup({
    statusKey = '',
    date = '',
    planId = '',
} = {}) {
    const url = buildCardWorkPageUrlFromMyTaskDateGroup({
        statusKey,
        date,
        planId,
    });

    if (!url) {
        return;
    }

    window.location.assign(url);
}


export function openCardPageFromMyTaskItem({
    statusKey = '',
    date = '',
    planId = '',
} = {}) {
    openCardPageFromMyTaskDateGroup({
        statusKey,
        date,
        planId,
    });
}


function buildCardWorkPageUrlFromMyTaskDateGroup({
    statusKey,
    date,
    planId = '',
}) {
    if (!statusKey || !date) {
        return '';
    }

    const url = new URL(CARD_WORK_PAGE_PATH, window.location.origin);

    url.searchParams.set('source', 'home');
    url.searchParams.set('scope', 'my_tasks');
    url.searchParams.set('status', statusKey);
    url.searchParams.set('date', date);

    if (planId) {
        url.searchParams.set('plan_id', planId);
    }

    return url.toString();
}