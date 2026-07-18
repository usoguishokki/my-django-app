// static/js/home/application/HomeDashboardPageService.js

import {
    forceHideLoadingScreen,
    initializeLoadingScreen,
} from '../../manager/loadingManager.js';

import {
    HomeMyTeamProgressService,
} from './HomeMyTeamProgressService.js';

import {
    HomeMyTasksService,
} from './HomeMyTasksService.js';

import {
    HomeOverallProgressService,
} from './HomeOverallProgressService.js';

import {
    addHomeAssignCompletedListener,
} from '../ui/HomeAssignEvents.js';


export class HomeDashboardPageService {
    constructor({
        overallProgressService = new HomeOverallProgressService(),
        myTeamProgressService = new HomeMyTeamProgressService(),
        myTasksService = new HomeMyTasksService(),
    } = {}) {
        this.overallProgressService = overallProgressService;
        this.myTeamProgressService = myTeamProgressService;
        this.myTasksService = myTasksService;

        this.isHomeAssignCompletedEventBound = false;
        this.handleHomeAssignCompleted = this.handleHomeAssignCompleted.bind(this);
    }

    async init() {
        try {
            initializeLoadingScreen();

            this.bindHomeAssignCompletedEvent();

            await Promise.all([
                this.overallProgressService.load(),
                this.myTeamProgressService.load(),
                this.myTasksService.load(),
            ]);
        } catch (error) {
            console.error('[HomeDashboardPageService] init failed:', error);
            forceHideLoadingScreen();
        } finally {
            window.dispatchEvent(new Event('app:ready'));
        }
    }

    bindHomeAssignCompletedEvent() {
        if (this.isHomeAssignCompletedEventBound) {
            return;
        }

        addHomeAssignCompletedListener(this.handleHomeAssignCompleted);

        this.isHomeAssignCompletedEventBound = true;
    }

    async handleHomeAssignCompleted(event) {
        if (!this.myTasksService.shouldRefreshAfterAssign(event.detail)) {
            return;
        }

        await this.myTasksService.load();
    }
}