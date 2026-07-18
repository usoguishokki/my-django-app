// static/js/home/ui/HomeMobileTabsController.js

const MOBILE_TAB_SELECTOR = '[data-home-mobile-tab]';
const MOBILE_PANEL_SELECTOR = '[data-home-mobile-panel]';

const ACTIVE_CLASS = 'is-active';
const HIDDEN_CLASS = 'is-mobile-hidden';

const DEFAULT_MOBILE_TAB = 'tasks';
const STORAGE_KEY = 'homeMobileActiveTab';

let isHomeMobileTabsBound = false;

export function initHomeMobileTabs({
    defaultTab = DEFAULT_MOBILE_TAB,
} = {}) {
    const tabs = getMobileTabs();
    const panels = getMobilePanels();

    if (!tabs.length || !panels.length) {
        return;
    }

    bindHomeMobileTabsOnce();

    activateHomeMobileTab(resolveInitialMobileTab(defaultTab));
}

function bindHomeMobileTabsOnce() {
    if (isHomeMobileTabsBound) {
        return;
    }

    getMobileTabs().forEach((tab) => {
        tab.addEventListener('click', handleMobileTabClick);
    });

    isHomeMobileTabsBound = true;
}

function handleMobileTabClick(event) {
    const tab = event.currentTarget;
    const tabKey = tab?.dataset?.homeMobileTab || '';

    if (!tabKey) {
        return;
    }

    activateHomeMobileTab(tabKey);
}

function activateHomeMobileTab(tabKey) {
    if (!isExistingTab(tabKey)) {
        return;
    }

    getMobileTabs().forEach((tab) => {
        const isActive = tab.dataset.homeMobileTab === tabKey;

        tab.classList.toggle(ACTIVE_CLASS, isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    getMobilePanels().forEach((panel) => {
        const isActive = panel.dataset.homeMobilePanel === tabKey;

        panel.classList.toggle(HIDDEN_CLASS, !isActive);
    });

    saveActiveTab(tabKey);
}

function resolveInitialMobileTab(defaultTab) {
    const savedTab = loadActiveTab();

    if (isExistingTab(savedTab)) {
        return savedTab;
    }

    if (isExistingTab(defaultTab)) {
        return defaultTab;
    }

    return getMobileTabs()[0]?.dataset?.homeMobileTab || DEFAULT_MOBILE_TAB;
}

function isExistingTab(tabKey) {
    if (!tabKey) {
        return false;
    }

    return getMobileTabs().some((tab) => {
        return tab.dataset.homeMobileTab === tabKey;
    });
}

function saveActiveTab(tabKey) {
    try {
        window.sessionStorage?.setItem(STORAGE_KEY, tabKey);
    } catch (error) {
        // sessionStorage が使えない環境では保存しない
    }
}

function loadActiveTab() {
    try {
        return window.sessionStorage?.getItem(STORAGE_KEY) || '';
    } catch (error) {
        return '';
    }
}

function getMobileTabs() {
    return Array.from(document.querySelectorAll(MOBILE_TAB_SELECTOR));
}

function getMobilePanels() {
    return Array.from(document.querySelectorAll(MOBILE_PANEL_SELECTOR));
}