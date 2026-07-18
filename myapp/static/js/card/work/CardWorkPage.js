// static/js/card/work/CardWorkPage.js

import {
    forceHideLoadingScreen,
    initializeLoadingScreen,
} from '../../manager/loadingManager.js';

import {
    CardWorkPageService,
} from './application/CardWorkPageService.js';


document.addEventListener('DOMContentLoaded', async () => {
    initializeLoadingScreen();

    try {
        const root = document.querySelector('[data-card-work-root]');
        const initialState = readInitialState();

        console.log('[CardWorkPage] initialized:', initialState);

        if (!root) {
            console.warn('[CardWorkPage] root element not found.');
            return;
        }

        const page = new CardWorkPageService({
            root,
            initialState,
        });

        await page.init();
    } catch (error) {
        console.error('[CardWorkPage] initialize failed:', error);
        forceHideLoadingScreen();
        return;
    } finally {
        window.dispatchEvent(new Event('app:ready'));
    }
});


function readInitialState() {
    const stateElement = document.getElementById('cardWorkInitialState');

    if (!stateElement) {
        return {};
    }

    try {
        return JSON.parse(stateElement.textContent);
    } catch (error) {
        console.error('[CardWorkPage] initial state parse failed:', error);
        return {};
    }
}