// static/js/home/ui/domHelpers.js

export function getById(id) {
    return document.getElementById(id);
}

export function setText(id, value) {
    const element = getById(id);
    if (!element) return;

    element.textContent = value;
}

export function setPanelHealth(panelId, health) {
    const panel = getById(panelId);
    if (!panel) return;

    panel.dataset.health = health || 'normal';
}