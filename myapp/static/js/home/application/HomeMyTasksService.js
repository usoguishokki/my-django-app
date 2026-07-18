// static/js/home/application/HomeMyTasksService.js

import {
    fetchHomeMyTasks,
} from '../../api/fetchers.js';

import {
    renderMyTasks,
    renderMyTasksError,
} from '../ui/HomeMyTasksRenderer.js';

export class HomeMyTasksService {
    constructor() {
        this.latestPayload = null;
    
        this.load = this.load.bind(this);
        this.shouldRefreshAfterAssign = this.shouldRefreshAfterAssign.bind(this);
    }

    async load() {
        try {
            const response = await fetchHomeMyTasks();

            if (!response || response.status !== 'success') {
                this.latestPayload = null;
                renderMyTasksError();
                return null;
            }

            this.latestPayload = response.data;
            renderMyTasks(response.data);

            return response.data;
        } catch (error) {
            console.error('[HomeMyTasksService] load failed:', error);

            this.latestPayload = null;
            renderMyTasksError();

            return null;
        }
    }

    shouldRefreshAfterAssign(assignDetail) {
        const assignedHolderId = normalizeId(assignDetail?.formValue?.holderId);
        const myHolderId = normalizeId(this.latestPayload?.scope?.holderId);

        if (!assignedHolderId || !myHolderId) {
            return false;
        }

        return assignedHolderId === myHolderId;
    }
}


function normalizeId(value) {
    return String(value ?? '').trim();
}