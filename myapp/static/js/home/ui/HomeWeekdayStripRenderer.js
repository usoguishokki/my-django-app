// static/js/home/ui/HomeWeekdayStripRenderer.js

import {
    buildWeekDayMeta,
    getWeekdayStateLabel,
} from '../domain/HomeDashboardWeekdayStatePolicy.js';

import {
    toNumber,
} from '../domain/HomeDashboardNumberFormatPolicy.js';

import {
    getById,
} from './domHelpers.js';

export function renderWeekDays(
    days,
    {
        selectedDate = '',
        onSelectDay = null,
    } = {}
) {
    const container = getById('myTeamWeekDays');
    if (!container) return;

    container.innerHTML = '';

    if (!Array.isArray(days) || days.length === 0) {
        container.appendChild(createEmptyWeekDayCard());
        return;
    }

    const fragment = document.createDocumentFragment();

    days.forEach((day) => {
        fragment.appendChild(
            createWeekDayCard(day, {
                selectedDate,
                onSelectDay,
            })
        );
    });

    container.appendChild(fragment);
}

function createWeekDayCard(
    day,
    {
        selectedDate = '',
        onSelectDay = null,
    } = {}
) {
    const state = day?.state || 'empty';
    const stateLabel = getWeekdayStateLabel(state);
    const remaining = toNumber(day?.remaining);
    const total = toNumber(day?.total);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `home-week-day home-week-day--${state}`;
    card.dataset.state = state;
    card.dataset.date = day?.date || '';

    if (day?.isToday) {
        card.classList.add('is-today');
    }

    if (day?.date && day.date === selectedDate) {
        card.classList.add('is-selected');
    }

    card.addEventListener('click', () => {
        if (typeof onSelectDay === 'function') {
            onSelectDay(day);
        }
    });

    const label = document.createElement('span');
    label.className = 'home-week-day__label';
    label.textContent = day?.weekday || '-';

    const stateElement = document.createElement('strong');
    stateElement.className = 'home-week-day__state';
    stateElement.textContent = stateLabel;

    const meta = document.createElement('span');
    meta.className = 'home-week-day__meta';
    meta.textContent = buildWeekDayMeta({
        state,
        remaining,
        total,
        completedRate: day?.completedRate,
    });

    card.appendChild(label);
    card.appendChild(stateElement);
    card.appendChild(meta);

    return card;
}

function createEmptyWeekDayCard() {
    const card = document.createElement('div');
    card.className = 'home-week-day home-week-day--empty';

    const label = document.createElement('span');
    label.className = 'home-week-day__label';
    label.textContent = '-';

    const state = document.createElement('strong');
    state.className = 'home-week-day__state';
    state.textContent = 'なし';

    const meta = document.createElement('span');
    meta.className = 'home-week-day__meta';
    meta.textContent = '対象なし';

    card.appendChild(label);
    card.appendChild(state);
    card.appendChild(meta);

    return card;
}