// static/js/home/domain/HomeStatusPolicy.js

export const HOME_STATUS_KEYS = Object.freeze({
    WAITING: 'waiting',
    IN_PROGRESS: 'in_progress',
    APPROVAL_WAITING: 'approval_waiting',
    COMPLETED: 'completed',
    SENT_BACK: 'sent_back',
    DELAYED: 'delayed',
});

export const HOME_STATUS_LABELS = Object.freeze({
    [HOME_STATUS_KEYS.WAITING]: '配布待ち',
    [HOME_STATUS_KEYS.IN_PROGRESS]: '実施待ち',
    [HOME_STATUS_KEYS.APPROVAL_WAITING]: '承認待ち',
    [HOME_STATUS_KEYS.COMPLETED]: '完了',
    [HOME_STATUS_KEYS.SENT_BACK]: '差戻し',
    [HOME_STATUS_KEYS.DELAYED]: '遅れ',
});

export const HOME_ATTENTION_STATUS_ORDER = Object.freeze([
    HOME_STATUS_KEYS.IN_PROGRESS,
    HOME_STATUS_KEYS.APPROVAL_WAITING,
    HOME_STATUS_KEYS.SENT_BACK,
    HOME_STATUS_KEYS.DELAYED,
]);

export const HOME_MY_TASK_STATUS_ORDER = Object.freeze([
    ...HOME_ATTENTION_STATUS_ORDER,
]);

export function normalizeHomeStatusKey(statusKey) {
    return String(statusKey ?? '').trim();
}

export function resolveHomeStatusLabel(
    statusKey,
    fallbackLabel = '',
    defaultLabel = '対象'
) {
    const normalizedStatusKey = normalizeHomeStatusKey(statusKey);

    return HOME_STATUS_LABELS[normalizedStatusKey]
        || fallbackLabel
        || defaultLabel;
}