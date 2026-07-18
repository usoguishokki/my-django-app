// static/js/home/domain/HomeDashboardNumberFormatPolicy.js

export function toNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return number;
}

export function formatCount(value) {
    return toNumber(value).toLocaleString('ja-JP');
}

export function formatCountWithUnit(value) {
    return `${formatCount(value)} 件`;
}

export function clampRate(value) {
    const rate = toNumber(value);

    return Math.max(0, Math.min(100, rate));
}