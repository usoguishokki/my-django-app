
import { initializeLoadingScreen } from '../manager/loadingManager.js';
import { UIManger } from '../manager/UIManger.js';
import { TableManager } from '../manager/TableManger.js';
import { inspectionHistoryManager } from './inspectionHistoryMappingConfig.js';

class inspectionHistory {
    constructor() {
        this.inspectionHistoryManager = new inspectionHistoryManager();
        this.table = document.getElementById('myTable');
        this.tableSetup();
    }

    async init() {
        
    }

    tableSetup() {
        this.tableManager = new TableManager('myTable', {
            'isDraggable': false
        }, null, this.inspectionHistoryManager);
        this.statusConfig = this.inspectionHistoryManager.statusConfig();
        this._toggleColumnVisible('label' ,'');
    }

    _toggleColumnVisible(property, value) {
        const statusColumnsConfig = Object.values(this.statusConfig).find(config => config[property] === value) || null;
        this.tableManager.toggleColumnVisible(statusColumnsConfig.columnsStyle);
        return statusColumnsConfig
    }
}


document.addEventListener('DOMContentLoaded', async() => {
    initializeLoadingScreen();
    const app = new inspectionHistory();
    await app.init();
});