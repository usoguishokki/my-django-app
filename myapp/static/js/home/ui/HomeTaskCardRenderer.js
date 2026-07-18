// static/js/home/ui/HomeTaskCardRenderer.js

import {
    createDetailItemsElement,
} from '../../ui/renderers/detailItemsRenderer.js';

import {
    createDetailCardElement,
} from '../../ui/renderers/detailCardElementRenderer.js';

import {
    resolveHomeStatusLabel,
} from '../domain/HomeStatusPolicy.js';


export function createHomeTaskCardElement(item) {
    const statusKey = item?.statusKey || '';

    return createDetailCardElement({
        className: buildTaskCardClassName(statusKey),
        dataset: {
            status: statusKey,
            planId: item?.planId ?? '',
        },
        headerElement: createTaskCardHeader(item, statusKey),
        bodyElement: createTaskCardBody(item),
    });
}

function createTaskCardHeader(item, statusKey) {
    const header = document.createElement('header');
    header.className = 'detail-card__header';

    header.appendChild(createTaskCardTitle(item));
    header.appendChild(createTaskStatusBadge(item, statusKey));

    return header;
}

function createTaskCardTitle(item) {
    const title = document.createElement('div');
    title.className = 'detail-card__title';

    const titleLine = createTextElement(
        'p',
        'detail-card__titleLine',
        formatTaskTitleLine(item)
    );

    const titleSub = createTextElement(
        'p',
        'detail-card__titleSub',
        formatTaskTitleSub(item)
    );

    title.appendChild(titleLine);

    if (titleSub.textContent) {
        title.appendChild(titleSub);
    }

    return title;
}

function createTaskStatusBadge(item, statusKey) {
    const status = document.createElement('span');
    status.className = 'home-task-card__status';
    status.dataset.homeStatusKey = statusKey || '';
    status.textContent = resolveHomeStatusLabel(
        statusKey,
        item?.status,
        ''
    );

    return status;
}

function createTaskCardBody(item) {
    const body = document.createElement('div');
    body.className = 'detail-card__body';

    const detailItemsElement = createDetailItemsElement(item?.detailItems);

    if (detailItemsElement) {
        body.appendChild(detailItemsElement);
    }

    if (item?.canAssignFromHome) {
        body.appendChild(createHomeAssignAction(item));
    }

    return body;
}

function createHomeAssignAction(item) {
    const action = document.createElement('div');
    action.className = 'home-task-card__actions';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-task-card__assign-button';
    button.dataset.homeAssignPlanId = item?.planId ?? '';
    button.textContent = '作業登録';

    action.appendChild(button);

    return action;
}

function formatTaskTitleLine(item) {
    const equipmentName = item?.equipmentName || '';
    const workName = item?.workName || '';

    return [equipmentName, workName]
        .filter(Boolean)
        .join('_') || '作業名なし';
}

function formatTaskTitleSub(item) {
    const planTime = item?.planTimeLabel || '';
    const manHours = formatManHours(item?.manHours);

    return [planTime, manHours]
        .filter(Boolean)
        .join('_');
}

function formatManHours(manHours) {
    if (manHours === '' || manHours == null) {
        return '';
    }

    return `${manHours}分`;
}

function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;

    return element;
}

function buildTaskCardClassName(statusKey) {
    return [
        'detail-card',
        'click-card',
        'home-task-card',
        statusKey ? `home-task-card--${statusKey}` : '',
    ].filter(Boolean).join(' ');
}