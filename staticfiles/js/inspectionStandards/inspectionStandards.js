import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { initializeLoadingScreen } from '../manager/loadingManager.js';
import { UIManger } from '../manager/UIManger.js';
import { TableManager } from '../manager/TableManger.js';
import { inspectionStandardManager } from './inspectionStandardsMappingConfig.js';

class inspectionStandards {
    constructor() {
        this.inspectionStandardManager = new inspectionStandardManager();
        this.table = document.getElementById('myTable');
        this.tableSetup();
        this.initialTbody = this.table.querySelector('tbody').innerHTML;
        this.setupFilterArea();
        this.setupDropdownbox();

    }

    tableSetup() {
        this.tableManager = new TableManager('myTable', {
            'isDraggable': false
        }, null, this.inspectionStandardManager);
        this.statusConfig = this.inspectionStandardManager.statusConfig();
        this._toggleColumnVisible('label' ,'');
    }

    _toggleColumnVisible(property, value) {
        const statusColumnsConfig = Object.values(this.statusConfig).find(config => config[property] === value) || null;
        this.tableManager.toggleColumnVisible(statusColumnsConfig.columnsStyle);
        return statusColumnsConfig
    }

    setupDropdownbox() {
        const controlNameSelect = document.getElementById('controlNameSelect');
        const controlIdSelect = document.getElementById('controlIdSelect');
        const controlNameSpan = document.getElementById('controlNameSpan');
        const controlNoSpan = document.getElementById('controlNoSpan');

        const synchronizeDropdowns = (sourceSelect, targetSelect, attribute) => {
            const selectedOption = sourceSelect.selectedOptions[0];
            const targetValue = selectedOption.getAttribute(attribute);

            Array.from(targetSelect.options).forEach((option) => {
                if (option.value === targetValue) {
                    option.selected = true;
                }
            })

            controlNameSpan.textContent = selectedOption.getAttribute('data-machine');
            controlNoSpan.textContent = selectedOption.getAttribute('data-control-no');
        }

        const blunkOptionsNone = () => {
            controlNameSelect.options[0].style.display = 'none';
            controlIdSelect.options[0].style.display = 'none';
        }

        const onFilterChange = (event) => {
            const target = event.target;
            const filters = {};

            if (controlNameSelect.options[0].display !== 'none') {
                blunkOptionsNone()
            }

            if (target.tagName !== 'SELECT') return;

            const column = target.dataset.filterAttribute;
            const value = target.value;

            if (column) {
                filters[column] = value;
            }

            if (target === controlNameSelect) {
                synchronizeDropdowns(controlNameSelect, controlIdSelect, 'data-control-no');
            } else if (target === controlIdSelect) {
                synchronizeDropdowns(controlIdSelect, controlNameSelect, 'data-machine');
            }
            
            this.setupAsyncCommunication(filters);
        }

        controlNameSelect.addEventListener('change', event => {
            this.tableManager.clearTbody(this.table, this.initialTbody);
            onFilterChange(event);
        });
        controlIdSelect.addEventListener('change', event => {
            this.tableManager.clearTbody(this.table, this.initialTbody);
            onFilterChange(event);
        });
    }

    async setupAsyncCommunication(filters) {
        const params = {
            url: '/inspectionStadards/',
            method: 'POST',
            data: {
                'action': 'get_details',
                'data': filters
            }
        }
        await asynchronousCommunication(
            params
        ).then((data) => {
            const details = data.details
            const resultData = {
                'duties': details
            }
            this.tableManager.createTableRow(resultData);
            this.removeDuplicateBorders();
        })
    }

    removeDuplicateBorders() {
        const columnsToCheck = ['inspection-no-content', 'work-name-content', 'applicable-device-content',
                                'method-content', 'timezone-content'];

        let lastIndexArray = []
        columnsToCheck.forEach((className, index) => {
            const cells = this.table.querySelectorAll(`tbody td.${className}`);
            let standardCell = null;

            cells.forEach((cell, cellIndex) => {
                if (lastIndexArray.includes(cellIndex)) {
                    standardCell = null;
                    return;
                }

                const currentCellValue = cell.textContent.trim();
                const nextCell = cells[cellIndex+1];

                if (!currentCellValue || !nextCell) return;

                const nextCellValue = nextCell.textContent.trim();
                
                if (currentCellValue === nextCellValue) {
                    if (!UIManger.isValidValue(standardCell)) {
                        standardCell = cell;
                        
                    }

                    standardCell.rowSpan = standardCell.rowSpan + 1
                    nextCell.style.display = 'none'
                } else {
                    standardCell = null;

                    if (className === 'inspection-no-content') {
                        lastIndexArray.push(cellIndex)
                    }
                }

            });
        
        });
        lastIndexArray.forEach(index => {
            const row = this.table.rows[index+2];

            for (const cell of row.cells) {
                UIManger.toggleClass(cell, 'thick-top-border', 'add');
            }
        })
    }

    setupFilterArea() {
        document.querySelectorAll('.filter-item').forEach(item => {
            UIManger.toggleClass(item, 'hidden', 'add');
        })

        const filterButton = document.querySelector('.filter-button');
        if (filterButton) {
            UIManger.toggleClass(filterButton, 'hidden', 'add');    
        }

        const filterArea = document.getElementById('filterarea');
        if (filterArea) {
            // マウスオーバー時の処理
            filterArea.addEventListener('mouseover', () => {
                const filterItems = document.querySelectorAll('.filter-item');
                filterItems.forEach(item => {
                    UIManger.toggleClass(item, 'hidden', 'remove'); // 非表示を解除
                    UIManger.toggleClass(item, 'visible', 'add'); // 表示を追加
                });

                if (filterButton) {
                    UIManger.toggleClass(filterButton, 'hidden', 'remove'); // 非表示を解除
                    UIManger.toggleClass(filterButton, 'visible', 'add'); // 表示を追加
                }
            });

            // マウスリーブ時の処理
            filterArea.addEventListener('mouseleave', () => {
                const filterItems = document.querySelectorAll('.filter-item');
                filterItems.forEach(item => {
                    UIManger.toggleClass(item, 'visible', 'remove'); // 表示を解除
                    UIManger.toggleClass(item, 'hidden', 'add'); // 非表示を追加
                });

                if (filterButton) {
                    UIManger.toggleClass(filterButton, 'visible', 'remove'); // 表示を解除
                    UIManger.toggleClass(filterButton, 'hidden', 'add'); // 非表示を追加
                }
            });
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen();
    new inspectionStandards();
});
