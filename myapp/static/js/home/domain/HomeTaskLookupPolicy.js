// static/js/home/domain/HomeTaskLookupPolicy.js

export function normalizeHomePlanId(planId) {
    const normalizedPlanId = String(planId ?? '').trim();

    return normalizedPlanId;
}


export function findHomeTaskByPlanId(items = [], planId) {
    const normalizedPlanId = normalizeHomePlanId(planId);

    if (!normalizedPlanId || !Array.isArray(items)) {
        return null;
    }

    return items.find((item) => {
        return normalizeHomePlanId(item?.planId) === normalizedPlanId;
    }) || null;
}


export function findHomeTaskByPlanIdFromGroups(groups = [], planId) {
    const normalizedPlanId = normalizeHomePlanId(planId);

    if (!normalizedPlanId || !Array.isArray(groups)) {
        return null;
    }

    for (const group of groups) {
        const foundItem = findHomeTaskByPlanId(group?.items, normalizedPlanId);

        if (foundItem) {
            return foundItem;
        }
    }

    return null;
}


export function findHomeTaskByPlanIdFromSources(
    planId,
    sources = []
) {
    const normalizedPlanId = normalizeHomePlanId(planId);

    if (!normalizedPlanId || !Array.isArray(sources)) {
        return null;
    }

    for (const source of sources) {
        if (!source) {
            continue;
        }

        const foundItem = source.type === 'groups'
            ? findHomeTaskByPlanIdFromGroups(source.value, normalizedPlanId)
            : findHomeTaskByPlanId(source.value, normalizedPlanId);

        if (foundItem) {
            return foundItem;
        }
    }

    return null;
}