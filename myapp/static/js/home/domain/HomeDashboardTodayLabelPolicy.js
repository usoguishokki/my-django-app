// static/js/home/domain/HomeDashboardTodayLabelPolicy.js

import {
    formatJapaneseMonthDayLabel,
} from '../../utils/dateTime.js';

export function buildTodayLabel(today, currentPeriod) {
    return buildFocusProgressLabel(today, currentPeriod);
}

export function buildFocusProgressLabel(day, currentPeriod) {
    const dateLabel = formatJapaneseMonthDayLabel(day?.date);

    if (dateLabel) {
        return day?.isToday
            ? `今日${dateLabel}の進捗`
            : `選択日${dateLabel}の進捗`;
    }

    return day?.isToday
        ? '今日の進捗'
        : '選択日の進捗';
}