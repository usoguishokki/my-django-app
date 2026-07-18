// static/js/home/application/HomeMyTeamProgressService.js

import {
    fetchHomeMyTeamDayDetail,
    fetchHomeMyTeamProgress,
} from '../../api/fetchers.js';

import {
    renderMyTeamDayDetail,
    renderMyTeamDayDetailError,
    renderMyTeamError,
    renderMyTeamProgress,
} from '../ui/HomeMyTeamProgressRenderer.js';


export class HomeMyTeamProgressService {
    constructor() {
        this.load = this.load.bind(this);
        this.requestMyTeamProgress = this.requestMyTeamProgress.bind(this);
        this.loadDayDetail = this.loadDayDetail.bind(this);
    }

    async load() {
        try {
            const payload = await this.requestMyTeamProgress();

            if (!payload) {
                renderMyTeamError();
            }

            return payload;
        } catch (error) {
            console.error('[HomeMyTeamProgressService] load failed:', error);
            renderMyTeamError();

            return null;
        }
    }

    async requestMyTeamProgress({
        render = true,
    } = {}) {
        const response = await fetchHomeMyTeamProgress();

        if (!response || response.status !== 'success') {
            if (render) {
                renderMyTeamError();
            }

            return null;
        }

        const payload = response.data;

        if (render) {
            renderMyTeamProgress(payload, {
                onDayDetailRequest: this.loadDayDetail,
            });
        }

        return payload;
    }

    async loadDayDetail({
        date,
        statusKey,
    }, {
        render = true,
    } = {}) {
        try {
            const response = await fetchHomeMyTeamDayDetail({
                date,
                statusKey,
            });

            if (!response || response.status !== 'success') {
                if (render) {
                    renderMyTeamDayDetailError();
                }

                return null;
            }

            const payload = response.data;

            if (render) {
                renderMyTeamDayDetail(payload);
            }

            return payload;
        } catch (error) {
            console.error('[HomeMyTeamProgressService] loadDayDetail failed:', error);

            if (render) {
                renderMyTeamDayDetailError();
            }

            return null;
        }
    }
}