// static/js/home/domain/HomeTaskDetailGroupingPolicy.js
import {
    formatJapaneseMonthDayWeekdayLabel,
} from '../../utils/dateTime.js';


import {
    isoDateSortKey,
} from '../../ui/sorters/sortKeys.js';

const DEFAULT_UNASSIGNED_HOLDER_LABEL = '未配布';
const DEFAULT_UNASSIGNED_AFFILIATION_LABEL = '所属班未設定';
const DEFAULT_UNDATED_PLAN_LABEL = '計画日未設定';

export function buildTaskDetailGroups({
    items = [],
    undatedPlanLabel = DEFAULT_UNDATED_PLAN_LABEL,
} = {}) {
    const safeItems = Array.isArray(items) ? items : [];

    return buildDateDetailGroups({
        items: safeItems,
        undatedPlanLabel,
    });
}

export function buildAffiliationDetailGroups({
    items = [],
    unassignedAffiliationLabel = DEFAULT_UNASSIGNED_AFFILIATION_LABEL,
} = {}) {
    const safeItems = Array.isArray(items) ? items : [];

    return groupTaskItemsByAffiliation({
        items: safeItems,
        unassignedAffiliationLabel,
    }).map((group, index) => buildDisplayGroup({
        prefix: 'affiliation',
        value: group.affiliationId,
        index,
        label: group.affiliationName,
        items: group.items,
    }));
}

export function buildMemberDetailGroups({
    items = [],
    unassignedHolderLabel = DEFAULT_UNASSIGNED_HOLDER_LABEL,
} = {}) {
    const safeItems = Array.isArray(items) ? items : [];

    return groupTaskItemsByHolder({
        items: safeItems,
        unassignedHolderLabel,
    }).map((group, index) => buildDisplayGroup({
        prefix: 'holder',
        value: group.holderId,
        index,
        label: group.holderName,
        items: group.items,
    }));
}

/**
 * 既存の呼び出し互換用。
 * 今後は buildMemberDetailGroups() を使う。
 */
export function buildDelayedMemberDetailGroups({
    items = [],
    unassignedHolderLabel = DEFAULT_UNASSIGNED_HOLDER_LABEL,
} = {}) {
    return buildMemberDetailGroups({
        items,
        unassignedHolderLabel,
    });
}

function buildDateDetailGroups({
    items,
    undatedPlanLabel,
}) {
    return groupTaskItemsByScheduleDate({
        items,
        undatedPlanLabel,
    }).map((group, index) => buildDisplayGroup({
        prefix: 'date',
        value: group.date || group.dateLabel,
        index,
        label: group.dateLabel,
        dateAlias: group.dateAlias,
        items: group.items,
    }));
}

function buildDisplayGroup({
    prefix,
    value,
    index,
    label,
    dateAlias = '',
    items,
}) {
    return {
        groupKey: buildTaskDetailGroupKey(prefix, value, index),
        groupType: prefix,
        label,
        dateAlias,
        count: items.length,
        items,
    };
}

function buildTaskDetailGroupKey(prefix, value, index) {
    const normalizedValue = String(value ?? '').trim();
    const fallbackValue = `empty:${index}`;

    return `${prefix}:${normalizedValue || fallbackValue}`;
}

function groupTaskItemsByScheduleDate({
    items,
    undatedPlanLabel,
}) {
    const groups = new Map();

    items.forEach((item) => {
        const groupDate = item?.delayGroupDate || item?.planDate || '';
        const groupDateLabel = formatJapaneseMonthDayWeekdayLabel(groupDate)
            || item?.delayGroupDateLabel
            || item?.planDateLabel
            || undatedPlanLabel;
        const groupDateAlias = item?.delayGroupDateAlias
            || item?.planDateAlias
            || '';
        const groupKey = groupDate || groupDateLabel;

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                date: groupDate,
                dateLabel: groupDateLabel,
                dateAlias: groupDateAlias,
                items: [],
            });
        }

        const group = groups.get(groupKey);

        if (!group.dateAlias && groupDateAlias) {
            group.dateAlias = groupDateAlias;
        }

        group.items.push(item);
    });

    return Array.from(groups.values()).sort(compareTaskDateGroupsByDate);
}

function compareTaskDateGroupsByDate(a, b) {
    const aSortKey = isoDateSortKey(a?.date);
    const bSortKey = isoDateSortKey(b?.date);

    if (aSortKey !== bSortKey) {
        return aSortKey.localeCompare(bSortKey);
    }

    return String(a?.dateLabel || '').localeCompare(
        String(b?.dateLabel || ''),
        'ja'
    );
}

function groupTaskItemsByAffiliation({
    items,
    unassignedAffiliationLabel,
}) {
    const groups = new Map();

    items.forEach((item) => {
        const affiliationName = item?.affiliationName || unassignedAffiliationLabel;
        const affiliationId = item?.affiliationId || affiliationName;

        if (!groups.has(affiliationId)) {
            groups.set(affiliationId, {
                affiliationId,
                affiliationName,
                items: [],
            });
        }

        groups.get(affiliationId).items.push(item);
    });

    return Array.from(groups.values()).sort(compareAffiliationGroups);
}

function compareAffiliationGroups(a, b) {
    const aKey = buildAffiliationSortKey(a);
    const bKey = buildAffiliationSortKey(b);

    return aKey.localeCompare(bKey, 'ja');
}

function buildAffiliationSortKey(group) {
    const id = String(group?.affiliationId ?? '').trim();

    if (id && /^\d+$/.test(id)) {
        return id.padStart(10, '0');
    }

    return group?.affiliationName || DEFAULT_UNASSIGNED_AFFILIATION_LABEL;
}

function groupTaskItemsByHolder({
    items,
    unassignedHolderLabel,
}) {
    const groups = new Map();

    items.forEach((item) => {
        const holderName = resolveTaskHolderName({
            item,
            unassignedHolderLabel,
        });
        const holderId = item?.holderId || holderName;

        if (!groups.has(holderId)) {
            groups.set(holderId, {
                holderId,
                holderName,
                items: [],
            });
        }

        groups.get(holderId).items.push(item);
    });

    return Array.from(groups.values()).sort(compareHolderGroups);
}

function resolveTaskHolderName({
    item,
    unassignedHolderLabel,
}) {
    return item?.holderName || unassignedHolderLabel;
}

function compareHolderGroups(a, b) {
    return String(a?.holderName || '').localeCompare(
        String(b?.holderName || ''),
        'ja'
    );
}