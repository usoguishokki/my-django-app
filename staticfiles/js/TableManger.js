import { asynchronousCommunication } from './asyncCommunicator.js';
import { UIManger } from './UIManger.js';

export class TableManager {
    constructor(tableId, options={}, columnClasses=null) {
        this.table = document.getElementById(tableId);
        this.options = options;
        this.filterConditions = {}
        this.columnClasses = columnClasses;
        console.log('TableManager initialized with columns:', this.columns);
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
        Object.entries(this.columnClasses).forEach(([key, value])=> {
            const columnsSettings = visibilityMap[key];
            const elements = document.querySelectorAll(`.${value}`);
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
        row.className = visibleRowIndex % 2 === 0 ? 'even' :'odd';
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
        const { rows, visibleRows} = this.setup()
        rows.forEach(row => {
            let shouldDisplay = this.shouldDisplayRow(row);
            if (shouldDisplay) {
                visibleRowIndex = this.styleContent(row, visibleRowIndex);
                visibleRows.push(row);
            } else {
                UIManger.toggleClass(row, 'hidden', 'add');
            }
        });
        return visibleRows;
    }

    homeFilterTable() {
        let visibleRowIndex = 0;
        const { rows, visibleRows, filterPattern } = this.setup()
        const filterStatus = this.filterConditions['data-status'];
        const affiliation = this.filterConditions['affiliation'];
        const holderId = this.filterConditions['data-holder-id'];
        switch (filterPattern) {
            case 'filterVisbledRow':
                rows.forEach(row => {
                    let shouldDisplay = this.homeshouldDisplayRow(row, filterStatus, affiliation, holderId);
                    if (shouldDisplay) {
                        visibleRowIndex = this.styleContent(row, visibleRowIndex);
                        visibleRows.push(row);
                    } else {
                        UIManger.toggleClass(row, 'hidden', 'add');
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
        let rowHolderId = row.getAttribute('data-holder-id');
        if (row.getAttribute('data-status') === filterStatus) {
            switch(row.getAttribute('data-status')) {
                case '配布待ち':
                    if (rowAffiliation === affiliation) {
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
                    if (rowHolderId === holderId && rowAffiliation === affiliation) {
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
                    if (rowHolderId === holderId && rowAffiliation === affiliation) {
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
                    if (rowHolderId === holderId && rowAffiliation === affiliation) {
                        return true;
                    } else {
                        return false;
                    }
                case '完了':
                    const practitioners = row.getAttribute('data-practitioner').split(', ');
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
                    if (rowHolderId === holderId && rowAffiliation === affiliation) {
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
        UIManger.toggleClass(row, 'hidden', 'remove');
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
        this.insertTable(result.data)
    }

    insertTable = (data) => {
        const tableBody = document.querySelector('#myTable tbody');
        data.forEach(card => {
            let cardDate = '';
            let cardTime = '';
            if (UIManger.isValidValue(card.start_time)) {
                cardDate = UIManger.formatDate(card.start_time, "m月d日");
                cardTime = UIManger.formatDate(card.start_time, "H:i");
            }
            const row = document.createElement('tr');
            row.style.display = 'none';
            row.dataset.status = card.plan_status;
            row.dataset.startTime = card.start_time ? UIManger.removeZFromISODate(card.start_time): '';
            row.dataset.planId = card.plan_id;
            row.dataset.workName = card.work_name;
            row.dataset.manHour = card.man_hour;
            row.dataset.holder = card.holder;
            row.dataset.holderId = card.holder_id;
            row.dataset.thisWeek = card.this_week ? 'True' : 'False';
            row.dataset.affilation = card.affilation;
            row.dataset.timeZone = card.time_zone;
            row.dataset.controlName = card.machine;
            row.dataset.practitioner = card.practitioner;
            row.dataset.practitioner_name = card.practitioner_name;
            row.innerHTML = `
            <td class="start-date-content start-date-row">${cardDate}</td>
            <td class="start-time-content start-time-row">${cardTime}~ <span class="start-time-line-break"></span></td>
            <td class="id-content card-no-row">${card.card_no}</td>
            <td class="status-content status-row">${card.plan_status}</td>
            <td class="work-name-content work-name-row">${card.work_name}</td>
            <td class="time-zone-content time-zone-row">${card.time_zone}</td>
            <td class="man-hour-content man-hour-row">${card.man_hour}</td>
            <td class="control-name-content control-name-row">${card.machine}<span class="control-name-line-break"></span></td>
            <td class="comment-content comment-row">${card.comment}</td>
            <td class="holder-content holder-row">${card.holder}</td>
            <td class="practitioner-content practitioner-row">${card.practitioner_name}</td>
            `
            tableBody.appendChild(row);
        })
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
}