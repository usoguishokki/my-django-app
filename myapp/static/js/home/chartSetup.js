export class ChartSetup {
    constructor(containerId, canvasId) {
        this.chartContainer = document.getElementById(containerId);
        this.canvas = document.getElementById(canvasId);
        if (!this.chartContainer || !this.canvas) {
            throw new Error('Chart container or canvas element not found');
        }
        this.ctx = this.canvas.getContext('2d');
        this.chart = null
    }

    createDonutChart(chartData, options = {}) {
        if (this.chart) {
            this.chart.destroy();
        }
        //Chart.jsのインスタンスを生成してthis.chartに保持
        this.chart = new Chart(this.ctx, {
            type: 'doughnut',
            data: chartData,
            options: options,
        });
    }

   

    chartUpdate(chartData, chartOptions, { animate = true } = {}) {
        this.chart.data = chartData;
        this.chart.options = chartOptions;
        this.chart.update(animate ? undefined : 'none');
    }
    
    chartResize() {
        this.chart.resize();
    }
}