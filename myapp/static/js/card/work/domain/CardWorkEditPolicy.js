// static/js/card/work/domain/CardWorkEditPolicy.js

const READ_ONLY_STATUSES = Object.freeze([
    '完了',
]);


export function isCardWorkResultReadOnly(planStatus) {
    const normalizedStatus = String(
        planStatus ?? ''
    ).trim();

    return READ_ONLY_STATUSES.includes(
        normalizedStatus
    );
}


export function canEditCardWorkResult(planStatus) {
    return !isCardWorkResultReadOnly(
        planStatus
    );
}