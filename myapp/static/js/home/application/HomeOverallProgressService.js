// static/js/home/application/HomeOverallProgressService.js

import {
    fetchHomeOverallProgress,
} from '../../api/fetchers.js';

import {
    renderOverallError,
    renderOverallProgress,
} from '../ui/HomeOverallProgressRenderer.js';


export class HomeOverallProgressService {
    constructor() {
        this.load = this.load.bind(this);
        this.requestOverallProgress = this.requestOverallProgress.bind(this);
    }

    async load() {
        try {
            const payload = await this.requestOverallProgress();

            if (!payload) {
                renderOverallError();
            }
        } catch (error) {
            console.error('[HomeOverallProgressService] load failed:', error);
            renderOverallError();
        }
    }

    async requestOverallProgress({
        render = true,
    } = {}) {
        const response = await fetchHomeOverallProgress();

        if (!response || response.status !== 'success') {
            if (render) {
                renderOverallError();
            }

            return null;
        }

        const payload = response.data;

        if (render) {
            renderOverallProgress(payload, {
                onRefreshRequest: this.requestOverallProgress,
            });
        }

        return payload;
    }
}