// static/js/home/ui/HomeAssignButtonHandler.js

import {
    openHomeAssignModal,
} from './HomeAssignModalRenderer.js';


export const HOME_ASSIGN_BUTTON_SELECTOR = '[data-home-assign-plan-id]';


export function handleHomeAssignButtonClick(
    event,
    {
        findItemByPlanId,
        logPrefix = '[home assign]',
    } = {}
) {
    const target = event.target instanceof Element
        ? event.target
        : null;

    const button = target?.closest(HOME_ASSIGN_BUTTON_SELECTOR);

    if (!button) {
        return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const planId = button.dataset.homeAssignPlanId || '';

    if (!planId) {
        console.warn(`${logPrefix} planId is empty.`);
        return true;
    }

    if (typeof findItemByPlanId !== 'function') {
        console.warn(`${logPrefix} findItemByPlanId is not function.`);
        return true;
    }

    const item = findItemByPlanId(planId);

    if (!item) {
        console.warn(`${logPrefix} item not found:`, {
            planId,
        });
        return true;
    }

    openHomeAssignModal(item);

    return true;
}