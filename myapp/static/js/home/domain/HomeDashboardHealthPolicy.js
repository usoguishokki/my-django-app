// static/js/home/domain/HomeDashboardHealthPolicy.js

const HEALTH_LABELS = {
    normal: '正常',
    warning: '確認あり',
    danger: '要対応',
    empty: '対象なし',
};

export function getHealthLabel(health) {
    return HEALTH_LABELS[health] || HEALTH_LABELS.normal;
}