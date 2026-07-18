// static/js/home/ui/HomeDetailGroupRenderer.js

import {
    createHomeTaskCardElement,
} from './HomeTaskCardRenderer.js';

export function createHomeDetailEmptyState(message) {
    const empty = document.createElement('div');
    empty.className = 'home-empty-state';

    const text = document.createElement('p');
    text.textContent = message;

    empty.appendChild(text);

    return empty;
}

export function createHomeDetailTaskList(items = [], options = {}) {
    const list = document.createElement('div');
    list.className = options.className || 'home-task-list';

    const safeItems = Array.isArray(items)
        ? items
        : [];

    safeItems.forEach((item) => {
        list.appendChild(createHomeTaskCardElement(item));
    });

    return list;
}

export function createHomeDetailGroupSummaryList(groups = [], options = {}) {
    const list = document.createElement('div');
    list.className = [
        'home-detail-group-list',
        options.listClassName || '',
    ].filter(Boolean).join(' ');

    const safeGroups = Array.isArray(groups)
        ? groups
        : [];

    safeGroups.forEach((group) => {
        list.appendChild(createHomeDetailGroupSummaryButton(group, options));
    });

    return list;
}

function createHomeDetailGroupSummaryButton(group, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = [
        'home-detail-group-card',
        options.cardClassName || '',
    ].filter(Boolean).join(' ');

    const datasetKey = options.datasetKey || 'detailGroupKey';
    button.dataset[datasetKey] = group.groupKey;

    const label = document.createElement('span');
    label.className = [
        'home-detail-group-card__label',
        options.labelClassName || '',
    ].filter(Boolean).join(' ');

    label.textContent = [
        group.label,
        group.dateAlias,
    ].filter(Boolean).join(' ');

    const count = document.createElement('strong');
    count.className = [
        'home-detail-group-card__count',
        options.countClassName || '',
    ].filter(Boolean).join(' ');
    count.textContent = `${group.count}件`;

    button.append(label, count);

    return button;
}