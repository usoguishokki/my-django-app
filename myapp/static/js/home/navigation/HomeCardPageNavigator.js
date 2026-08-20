// static/js/home/navigation/HomeCardPageNavigator.js

import {
    openCardWorkPage,
} from '../../card/work/navigation/CardWorkPageNavigator.js';


export function openCardPageFromMyTaskDateGroup({
    statusKey = '',
    date = '',
    planId = '',
} = {}) {
    if (!statusKey || !date) {
        return;
    }

    openCardWorkPage({
        source: 'home',
        scope: 'my_tasks',
        statusKey,
        date,
        planId,
    });
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