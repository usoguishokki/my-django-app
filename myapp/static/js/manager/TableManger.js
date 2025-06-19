import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { UIManger } from './UIManger.js';

export class TableManager {
    constructor(tableId, options={ isDraggable: false, isDisplayNone: false, addClass: [] }, columnClasses=null, columnManager=null) {
        this.table = document.getElementById(tableId);
        this.tbody = this.table.querySelector("tbody");
        this.options = options;
        this.filterConditions = {};
        this.columnClasses = columnClasses;
        this.columnMapping =  columnManager;
        this.columnTrInf = columnManager.getTrInf();
    }

    setupDropdownManager(dropdownManager) {
        this.dropdownManager = dropdownManager
    }

    initializeColumns(columns) {
        const columnElements = {};
        for (const [key, colId] of Object.entries(columns)) {
            const columnElement = document.getElementById(colId);
            if (columnElement) {
                columnElements[key] = columnElement;
            }
        }
        return columnElements;
    }

    toggleColumnVisible(visibilityMap) {
        this.columnTrInf.forEach(({ id, colgroup }) => {
            const columnsSettings = visibilityMap[id];
            const elements = document.querySelectorAll(`.${colgroup}`);
            elements.forEach(element => {
                element.style.display = columnsSettings.visible ? 'table-cell' : 'none';
                element.style.width = columnsSettings.width;
                element.style.maxWidth = columnsSettings.width;
            })
        })
    }

    setupResizers() {
        const tableHeaders = document.querySelectorAll('th');
        tableHeaders.forEach(header => {
            this.addResizer(header);
        });
    }

    addResizer(column) {
        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        column.appendChild(resizer);

        let startX, startWidth;

        const doDrag = (e) => {
            console.log(column)
            const newWidth = startWidth + e.clientX - startX;
            console.log(newWidth)
            column.style.width = `${newWidth}px`;
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        resizer.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startWidth = column.offsetWidth;
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        });
    }

    updateRowStyles(row, visibleRowIndex) {
        UIManger.toggleClass(row, ['even', 'odd'], 'remove');
        UIManger.toggleClass(row, visibleRowIndex % 2 === 0 ? 'even' : 'odd', 'add');
        if (this.options.conditionFunction) {
            this.options.conditionFunction(row);
        }
        visibleRowIndex++;
        return visibleRowIndex;
    }

    setup() {
        const rows = this.table.querySelectorAll('tbody tr');
        const visibleRows = [];
        const filterPattern = this.options.filterPattern
        return { rows, visibleRows, filterPattern }

    }

    styleContent(row, visibleRowIndex) {
        visibleRowIndex = this.updateRowStyles(row, visibleRowIndex);
        this.handleRowClick(row)
        return visibleRowIndex
    }

    filterTable() {
        let visibleRowIndex = 0;
        const { rows, visibleRows} = this.setup();
        visibleRows.length = 0;
        rows.forEach(row => {
            const shouldDisplay = this.shouldDisplayRow(row);
            if (shouldDisplay) {
                visibleRowIndex = this.styleContent(row, visibleRowIndex);
                visibleRows.push(row);
                this.dropdownManager.collectUniqueValues(row);
            } else {
                UIManger.toggleClass(row, 'display-none', 'add');
            }
        });
        this.dropdownManager.allUpdateDropdownOptions();
        return visibleRows;
    }

    homeFilterTable() {
        let visibleRowIndex = 0;
        const { rows, visibleRows, filterPattern } = this.setup()
        const filterStatus = this.filterConditions['data-status'];
        const affiliation = this.filterConditions['affiliation'];
        const holderId = this.filterConditions['data-holder-member-id'];
        switch (filterPattern) {
            case 'filterVisbledRow':
                rows.forEach(row => {
                    let shouldDisplay = this.homeshouldDisplayRow(row, filterStatus, affiliation, holderId);
                    if (shouldDisplay) {
                        visibleRowIndex = this.styleContent(row, visibleRowIndex);
                        visibleRows.push(row);
                    } else {
                        UIManger.toggleClass(row, 'display-none', 'add');
                    }
                });
                break;
            case 'tagetTableListUp':
                rows.forEach(row => {
                    //let shouldDisplay = this.shouldDisplayRow(row);
                    let shouldDisplay = this.homeshouldDisplayRow(row, filterStatus, affiliation, holderId);
                    if (shouldDisplay) {
                        const planId = row.getAttribute('data-plan-id');
                        visibleRows.push(planId);
                    }
                });
                break;
        }
        return visibleRows;
    }

    shouldDisplayRow(row) {
        for (const [attribute, value] of Object.entries(this.filterConditions)) {
            if (value !== "" && row.getAttribute(attribute) !== value) {
                return false;
            }
        }
        return true;
    }

    homeshouldDisplayRow(row, filterStatus, affiliation, holderId) {
        let rowAffiliation = row.getAttribute('data-affilation');
        let rowHolderId = row.getAttribute('data-holder-member-id');
        if (row.getAttribute('data-status') === filterStatus) {
            switch(row.getAttribute('data-status')) {
                case '配布待ち':
                    if (rowAffiliation === affiliation) {
                        row.classList.add('no-touch');
                        return true;
                    } else {

                        return false;
                    }
                case '実施待ち':
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (rowHolderId === holderId) {
                        return true;
                    } else {
                        return false;
                    }
                case '承認待ち':
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (rowHolderId === holderId) {
                        return true;
                    } else {
                        return false;
                    }
                case '遅れ':
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (rowHolderId === holderId) {
                        return true;
                    } else {
                        return false;
                    }
                case '完了':
                    const practitioners = row.getAttribute('data-practitioner-id').split(', ');
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (practitioners.includes(holderId)) {
                        return true;
                    } else {
                        return false;
                    }
                case '差戻し':
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (rowHolderId === holderId) {
                        return true;
                    } else {
                        return false;
                    }
                default:
                    return false;
            }
        }
    }

    handleRowClick(row) {
        UIManger.toggleClass(row, 'display-none', 'remove');
        row.style.display = '';
        if(row._dbClickHandler) {
            UIManger.removeEventListenerFromElement(row, 'dblclick', row._dblClickHandler);
        } else if (row._clickHandler) {
            UIManger.removeEventListenerFromElement(row, 'click', row._clickHandler);
        }

        if (this.options.onRowDoubleClick) {
            row._dbClickHandler = () => this.options.onRowDoubleClick(row);
            UIManger.addEventListenerToElement(row, 'dblclick', row._dbClickHandler);
        } else if(this.options.onRowClick) {
            row._clickHandler = () => this.options.onRowClick(row);
            UIManger.addEventListenerToElement(row, 'click', row._clickHandler);
        }
    }

    async loadUpdateTableData({url, method}) {
        const result = await asynchronousCommunication({
            url: url,
            method: method,
        });
        return result.data;
    }
    
    createTableRow = (data = {}) => {
        const tableData = Array.isArray(data.duties) ? data.duties : []
        const practitioners = data.practitioners || {};
        const datasetMapping = this.columnMapping.getDatasetMapping(practitioners);
        tableData.forEach(item => {
            const row = this.createRow(item, datasetMapping);
            this.tbody.appendChild(row);
        });  
    }

    createRow = (item, datasetMapping) => {
        const row = document.createElement('tr');
        if (this.options.isDisplayNone) {
            UIManger.toggleClass(row, 'display-none', 'add');
        }
        
        if (this.options.isDraggable) {
            row.setAttribute('draggable', true)
        }
        
        if (this.options.addClass) {
            const classes = Array.isArray(this.options.addClass) ? this.options.addClass : [this.options.addClass];
            classes.forEach(cls => {
                UIManger.toggleClass(row, cls, 'add');
            })
        }
        this.mapDataToRow(row, item, datasetMapping);
        return row;
    };

    mapDataToRow = (row, item, datasetMapping) => {
        Object.keys(datasetMapping).forEach((key) => {
            const { datasetKey, formatFn } = datasetMapping[key];
            const value = item[key] ?? '';
            row.dataset[datasetKey] = formatFn ? formatFn(value, item) : value;  
        });

        this.columnTrInf.forEach((col) => {
            const td = document.createElement('td');
            const mappingKey = col.mappingKey;
            td.className = col.className;
            const datasetKey = datasetMapping[mappingKey].datasetKey || '';
            td.innerHTML = col.tdData(row.dataset[datasetKey]) || '';
            row.appendChild(td); 
        });
    }
    
    setColumnWidths(table, columnWidths) {
         const colgroup = table.querySelector('colgroup');
         if (!colgroup) {
            return;
         }
         Object.keys(columnWidths).forEach(colId => {
            const col = colgroup.querySelector(`#${colId}`);
            if (col) {
                col.style.width = columnWidths[colId]
            }
         })
    }

    scrollToRow = (container, row) => {
        //const offset = row.offsetTop - container.offsetTop;
        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const offset = rowRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({ top: offset, behavior: 'smooth'});
    };

    clearTbody = (table, targetTbody) => {
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = targetTbody;
    }
}