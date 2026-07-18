// static/js/home/homeDashboardPage.js

import {
    HomeDashboardPageService,
} from './application/HomeDashboardPageService.js';

import {
    initHomeMobileTabs,
} from './ui/HomeMobileTabsController.js';

document.addEventListener('DOMContentLoaded', async () => {
    initHomeMobileTabs({
        defaultTab: 'tasks',
    });

    const page = new HomeDashboardPageService();

    await page.init();
});