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
    
    adjustCanvasHeight(itemProgressSelector, itemProgressFraction, totalFraction) {
        const childGrid = document.querySelector('.child-grid');
        //.child-gridのスタイルからpaddingを取得
        const style = window.getComputedStyle(childGrid);
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);

        //.child-gridの実際の高さからpaddingを差し引いて計算
        const gridHeight = childGrid.offsetHeight - paddingTop - paddingBottom;

        //gridHeightとfrの比率からitemProgressの高さを計算
        const itemProgressHeight = gridHeight * (itemProgressFraction / totalFraction);

        // itemProgress内のheタグの高さを取得
        const title = document.querySelector(`${itemProgressSelector} > h3`);
        const titleStyle = window.getComputedStyle(title);
        const titleHeight = title.offsetHeight;
        const titleMarginTop = parseFloat(titleStyle.marginTop);
        const titelMarginBottom = parseFloat(titleStyle.marginBottom);
        const titelHeightTotal = titleHeight + titleMarginTop + titelMarginBottom

        //itemProgressのpaddingを取得して下さい。
        const itemProgressStyle = window.getComputedStyle(document.getElementById('itemProgress'));
        const itemProgressPaddingTop = parseFloat(itemProgressStyle.paddingTop);
        const itemProgressPaddingBottom = parseFloat(itemProgressStyle.paddingBottom);
        const itemProgressHeightPadding =  itemProgressPaddingTop + itemProgressPaddingBottom;

        //charConatinerの高さを計算
        const containerHeight = itemProgressHeight - titelHeightTotal - itemProgressHeightPadding - itemProgressPaddingBottom;
        const chartContainer = document.getElementById('chartContainer');
        chartContainer.style.height = `${containerHeight}px`;

        if (this.chart) {
            this.chart.resize();
            console.log('ok')
        }
    }
    
    chartResize() {
        this.chart.resize();
    }
}