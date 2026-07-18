// static/js/home/ui/HomeAssignEvents.js

export const HOME_ASSIGN_COMPLETED_EVENT = 'home:assign-completed';


export function dispatchHomeAssignCompletedEvent(detail = {}) {
    document.dispatchEvent(new CustomEvent(HOME_ASSIGN_COMPLETED_EVENT, {
        detail,
    }));
}


export function addHomeAssignCompletedListener(listener) {
    if (typeof listener !== 'function') {
        return;
    }

    document.addEventListener(HOME_ASSIGN_COMPLETED_EVENT, listener);
}