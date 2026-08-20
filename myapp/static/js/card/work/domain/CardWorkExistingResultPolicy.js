// static/js/card/work/domain/CardWorkExistingResultPolicy.js

const EXISTING_RESULT_STATUSES = Object.freeze([
    '承認待ち',
    '遅れ',
    '完了',
    '差戻し',
]);


export function shouldRestoreExistingCardWorkResult(planStatus) {
    const normalizedStatus = String(
        planStatus ?? ''
    ).trim();

    return EXISTING_RESULT_STATUSES.includes(
        normalizedStatus
    );
}