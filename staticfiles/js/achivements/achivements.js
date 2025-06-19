import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { initializeLoadingScreen } from '../manager/loadingManager.js';
import { UIManger } from '../manager/UIManger.js';
import { TableManager } from '../manager/TableManger.js';
import { achivementsManager } from './achivementsMappingConfig.js';
import { renderStackedBarChart } from './achivementsChartSetup.js';

class achivements {
    constructor() {
        this.chartInstance = null;
        this.inspectionStandardManager = new achivementsManager();
        this.table = document.getElementById('myTable');
        this.tableSetup();
        this.setupFilterArea();
        this.setupDropdownbox();
        const { chart_title, labels, datasetOperating, datasetNotOperating } = this.chartSetup();
        this.chartInstanceCreate(chart_title, labels, datasetOperating, datasetNotOperating)
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

    setupDropdownbox() {
        const monthSelect = document.getElementById('monthSelect');

        const onFilterChange = (event) => {
            const value = event.target.value;
            this.setupAsyncCommunication(value);
        }

        monthSelect.addEventListener('change', event => {
            this.tableManager.clearTbody(this.table, this.initialTbody);
            onFilterChange(event);
        });

        const today = new Date();
        const currntyear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;


        const targetMonth = `${currntyear}年${currentMonth}月`

        Array.from(monthSelect.options).forEach(option => {
            if (option.value === targetMonth) {
                option.selected = true;
            }
        })


    }

    async setupAsyncCommunication(value) {
        const params = {
            url: '/achievements/',
            method: 'POST',
            data: {
                'action': 'get_month_details',
                'data': value
            }
        }
        await asynchronousCommunication(
            params
        ).then((data) => {
            const details = data.details
            const resultData = {
                'duties': details
            }
            this.clearTbody();
            this.tableManager.createTableRow(resultData);
            const { chart_title, labels, datasetOperating, datasetNotOperating } = this.chartSetup();
            this.updateChart(chart_title, labels, datasetOperating, datasetNotOperating);
        })
    }

    chartSetup() {
        const selectElement = document.getElementById('monthSelect');
        const selectedValue = selectElement.value;
        const chart_title = `${selectedValue}度業務工数`
        
        const labels = Array.from(document.querySelectorAll('tbody tr')).map(row => 
            row.dataset.day
        );

        const datasetOperating = Array.from(document.querySelectorAll('tbody tr')).map(row => 
            parseInt(row.dataset.activeHours, 10) || 0
        );

        const datasetNotOperating = Array.from(document.querySelectorAll('tbody tr')).map(row => 
            parseInt(row.dataset.inactiveHours, 10) || 0
        );

        return { chart_title, labels, datasetOperating, datasetNotOperating }
        
    }

    chartInstanceCreate(chart_title, labels, datasetOperating, datasetNotOperating) {
        // グラフを描画
        this.chartInstance = renderStackedBarChart('myStackedBarChart', chart_title, labels, datasetOperating, datasetNotOperating);
    }

    updateChart(chart_title, labels, datasetOperating, datasetNotOperating) {
        this.chartInstance.data.labels = labels;
        this.chartInstance.data.datasets[0].data = datasetOperating;
        this.chartInstance.data.datasets[1].data = datasetNotOperating;
        this.chartInstance.options.plugins.title.text = chart_title;
        this.chartInstance.update()
    }

    clearTbody() {
        const tbody = this.table.querySelector('tbody');
        tbody.replaceChildren();
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen();
    new achivements();
});
