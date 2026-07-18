// static/js/card/work/ui/CardWorkPlanCardRenderer.js

import {
    formatManHoursLabel,
    formatPlanTimeLabel,
    formatRequiredPeopleLabel,
    resolvePlanHeaderToneClassName,
} from '../domain/CardWorkDisplayPolicy.js';

import {
    DOW_LABEL,
} from '../../../ui/formatters/labelFormatters.js';

export function createCardWorkPlanCard({
    plan,
    index,
    total,
}) {
    const card = document.createElement('article');
    card.className = 'card-work-plan-card';
    card.dataset.planId = String(plan?.planId ?? '');

    const header = createPlanCardHeader({
        plan,
        index,
        total,
    });

    const detailSummary = createDetailSummary(plan);

    card.append(header, detailSummary);

    return card;
}


function createPlanCardHeader({
    plan,
    index,
    total,
}) {
    const header = document.createElement('header');
    header.className = 'card-work-plan-card__header';

    const toneClassName = resolvePlanHeaderToneClassName(plan);

    if (toneClassName) {
        header.classList.add(toneClassName);
    }

    const headerTop = document.createElement('div');
    headerTop.className = 'card-work-plan-card__header-top';

    const titleRow = createPlanTitleRow(plan);

    const number = document.createElement('span');
    number.className = 'card-work-plan-card__number';
    number.textContent = `${index + 1}/${total}`;

    headerTop.append(titleRow, number);

    const meta = createPlanMeta(plan);

    header.append(headerTop, meta);

    return header;
}


function createPlanTitleRow(plan) {
    const titleRow = document.createElement('div');
    titleRow.className = 'card-work-plan-card__title-row';

    const equipment = document.createElement('p');
    equipment.className = 'card-work-plan-card__equipment';
    equipment.textContent = plan?.equipmentName || '設備名未設定';

    const title = document.createElement('h3');
    title.className = 'card-work-plan-card__title';
    title.textContent = plan?.workName || '作業名未設定';

    titleRow.append(equipment, title);

    return titleRow;
}


function createPlanMeta(plan) {
    const meta = document.createElement('dl');
    meta.className = 'card-work-plan-card__meta';

    const metaItems = [
        {
            label: '予定時刻',
            value: formatPlanTimeLabel(plan?.planTime),
        },
        {
            label: '必要人数',
            value: formatRequiredPeopleLabel(plan?.requiredPeople),
        },
        {
            label: '工数',
            value: formatManHoursLabel(plan?.manHours),
        },
        {
            label: '曜日',
            value: formatCardWorkDayOfWeekLabel(plan?.dayOfWeek),
        },
        {
            label: '時間帯',
            value: plan?.timeZone || '',
        },
        {
            label: '状態',
            value: plan?.status || '-',
            modifierClassName: 'card-work-plan-card__meta-item--status',
        },
        {
            label: 'カードNo',
            value: plan?.inspectionNo || '-',
        },
    ];

    metaItems
        .filter((item) => hasMetaValue(item.value))
        .forEach((item) => {
            appendMeta(
                meta,
                item.label,
                item.value,
                item.modifierClassName
            );
        });

    return meta;
}


function appendMeta(meta, labelText, valueText, modifierClassName = '') {
    const item = document.createElement('div');
    item.className = 'card-work-plan-card__meta-item';

    if (modifierClassName) {
        item.classList.add(modifierClassName);
    }

    const label = document.createElement('dt');
    label.textContent = labelText;

    const value = document.createElement('dd');
    value.textContent = valueText;

    item.append(label, value);
    meta.appendChild(item);
}


function hasMetaValue(value) {
    return String(value ?? '').trim() !== '';
}


function formatCardWorkDayOfWeekLabel(value) {
    const text = String(value ?? '').trim();

    if (!text) {
        return '';
    }

    const numericValue = Number(text);

    if (!Number.isFinite(numericValue)) {
        return text;
    }

    return DOW_LABEL[numericValue] ?? text;
}


function createDetailSummary(plan) {
    const details = Array.isArray(plan?.details)
        ? plan.details
        : [];

    const safePoint = String(plan?.safePoint || '').trim();

    const section = document.createElement('section');
    section.className = 'card-work-plan-card__details';

    if (safePoint) {
        section.appendChild(createSafePointCard(safePoint));
    }

    if (details.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'detail-card__emptyMessage';
        empty.textContent = '点検項目はありません。';
        section.appendChild(empty);
        return section;
    }

    const list = document.createElement('div');
    list.className = 'detail-card__detailItems';

    details.forEach((detail) => {
        list.appendChild(createDetailItem(detail));
    });

    section.appendChild(list);

    return section;
}


function createSafePointCard(safePoint) {
    const card = document.createElement('div');
    card.className = 'card-work-safe-point';
    card.setAttribute('aria-label', '安全ポイント');

    const icon = document.createElement('span');
    icon.className = 'card-work-safe-point__icon';
    icon.setAttribute('aria-hidden', 'true');

    const value = document.createElement('p');
    value.className = 'card-work-safe-point__value';
    value.textContent = safePoint;

    card.append(icon, value);

    return card;
}


function createDetailItem(detail) {
    const item = document.createElement('div');
    item.className = 'detail-card__detailItem';

    const device = document.createElement('div');
    device.className = 'detail-card__detailItemDevice';
    device.textContent = detail?.applicableDevice || '対象未設定';

    const info = createDetailItemInfo(detail);

    item.append(device, info);

    return item;
}


function createDetailItemInfo(detail) {
    const contents = String(detail?.contents || '').trim();
    const method = String(detail?.method || '').trim();
    const standard = String(detail?.standard || '').trim();

    const info = document.createElement('dl');
    info.className = 'detail-card__detailItemInfo';

    appendDetailInfo(
        info,
        '内容',
        contents || '内容未設定'
    );

    if (method) {
        appendDetailInfo(info, '方法', method);
    }

    if (standard) {
        appendDetailInfo(info, '基準', standard);
    }

    return info;
}


function appendDetailInfo(info, labelText, valueText) {
    const item = document.createElement('div');
    item.className = 'detail-card__detailItemInfoRow';

    const label = document.createElement('dt');
    label.className = 'detail-card__detailItemInfoLabel';
    label.textContent = labelText;

    const value = document.createElement('dd');
    value.className = 'detail-card__detailItemInfoValue';
    value.textContent = valueText;

    item.append(label, value);
    info.appendChild(item);
}