// static/js/home/domain/HomeDetailGroupPolicy.js

export function buildHomeDetailGroupTitleLabel(group) {
    return [
        group?.label || '',
        group?.dateAlias || '',
    ].filter(Boolean).join(' ');
}


export function buildHomeDetailGroupIdentity(group) {
    if (!group) {
        return null;
    }

    return {
        groupType: group.groupType || '',
        label: group.label || '',
        dateAlias: group.dateAlias || '',
    };
}


export function isSameHomeDetailGroupIdentity(group, identity) {
    if (!group || !identity) {
        return false;
    }

    return (group.groupType || '') === identity.groupType
        && (group.label || '') === identity.label
        && (group.dateAlias || '') === identity.dateAlias;
}


export function findHomeDetailGroupByIdentity(
    groups = [],
    {
        groupKey = '',
        identity = null,
    } = {}
) {
    const safeGroups = Array.isArray(groups)
        ? groups
        : [];

    const exactGroup = findHomeDetailGroupByKey(
        safeGroups,
        groupKey
    );

    if (exactGroup) {
        return exactGroup;
    }

    if (!identity) {
        return null;
    }

    return safeGroups.find((group) => {
        return isSameHomeDetailGroupIdentity(group, identity);
    }) || null;
}


export function findHomeDetailGroupByKey(groups = [], groupKey = '') {
    const safeGroups = Array.isArray(groups)
        ? groups
        : [];

    const normalizedGroupKey = String(groupKey ?? '');

    if (!normalizedGroupKey) {
        return null;
    }

    return safeGroups.find((group) => {
        return String(group?.groupKey ?? '') === normalizedGroupKey;
    }) || null;
}


export function createHomeDetailDrilldownState({
    withDateGroup = false,
} = {}) {
    return {
        ...(withDateGroup ? { dateGroupKey: '' } : {}),
        affiliationGroupKey: '',
        memberGroupKey: '',
        memberGroupIdentity: null,
        affiliationGroups: [],
        memberGroups: [],
    };
}


export function resetHomeDetailDrilldownState(
    state,
    {
        withDateGroup = false,
    } = {}
) {
    if (!state) {
        return;
    }

    if (withDateGroup) {
        state.dateGroupKey = '';
    }

    state.affiliationGroupKey = '';
    state.memberGroupKey = '';
    state.memberGroupIdentity = null;
    state.affiliationGroups = [];
    state.memberGroups = [];
}