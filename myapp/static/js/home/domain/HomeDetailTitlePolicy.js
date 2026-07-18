// static/js/home/domain/HomeDetailTitlePolicy.js

export function buildHomeDetailTitle(parts = []) {
    return parts
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(' ');
}


export function buildHomeDetailWorkTitle(statusLabel = '対象') {
    return `${statusLabel || '対象'}の仕事`;
}


export function buildHomeDetailAssigneeTitle(statusLabel = '対象') {
    return `${statusLabel || '対象'}の担当`;
}


export function buildHomeDetailAffiliationTitle(statusLabel = '対象') {
    return `${statusLabel || '対象'}の班`;
}