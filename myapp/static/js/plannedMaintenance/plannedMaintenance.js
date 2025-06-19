import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { initializeLoadingScreen } from '../manager/loadingManager.js';
import { UIManger } from '../manager/UIManger.js';
import { renderStackedBarChart } from './plannedMaintenanceChartSetup.js';

class plannedMaintenance {
    constructor() {
        this.chartInstance = null;
        this.init()
        initializeLoadingScreen();
    }

    async init() {
        this.setupFilterArea();
        try {
            const data = await this.fetchChartData('weekly-manhours');
            this.chartInstanceCreate(data, '週別工数');
        } catch (error) {
            console.error("データの取得に失敗しました。", error)
        }
        this.setupDropdownbox()
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
        const graphSelect = document.getElementById('graphSelect');
        const onFilterChange = async (event) => {
            const selectedOption = event.target.selectedOptions[0];
            const titleName = selectedOption.value;
            const action = selectedOption.dataset.action
            try {
                const data = await this.fetchChartData(action);
                this.setupdateChart(data, titleName);
            } catch (error) {
                console.error("データの取得に失敗しました。", error)
            }
        }

        graphSelect.addEventListener('change', onFilterChange);

    }

    async fetchChartData(action) {
        const params = {
            url: `/api/get-chart-data/?action=${action}`,
            method: 'GET',
        }
        const response = await asynchronousCommunication(params)
        return response
    }

    chartInstanceCreate(data, title) {
        const chart_data = data.data
        this.chartInstance = renderStackedBarChart('plannedMaintenanceGraph', title, chart_data);
    }

    setupdateChart(data, tilte) {
        this.chartInstance.options.plugins.title.text = tilte;
        this.chartInstance.data = data.data;
        this.updateChart()
    }

    updateChart() {
        this.chartInstance.update();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new plannedMaintenance();

});