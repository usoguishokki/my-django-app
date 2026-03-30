import {
    forceHideLoadingScreen,
    setupLoadingOnLinkClick,
} from './manager/loadingManager.js';

function handlePageShow(event) {
    const navEntries = performance.getEntriesByType('navigation');
    const navType = navEntries.length > 0 ? navEntries[0].type : '';

    if (event.persisted || navType === 'back_forward') {
        forceHideLoadingScreen();
    }
}

function initializeBaseUI() {
    setupLoadingOnLinkClick();
}

window.addEventListener('pageshow', handlePageShow);
document.addEventListener('DOMContentLoaded', initializeBaseUI);