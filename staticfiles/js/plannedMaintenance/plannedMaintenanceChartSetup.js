export const renderStackedBarChart = (canvasId, chart_title, chart_data) => {
    const baseFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);

    Chart.defaults.font.family = "'Helvetica', serif";
    Chart.defaults.font.weight = 'normal';
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'bar', // 棒グラフ
      data: chart_data,
      options: {
        responsive: true,
        maintainAspectRatio: false, // アスペクト比を維持しない
        plugins: {
          legend: {
            position: 'top',
            align: 'end'
          },
          title: {
            display: true,
            text: chart_title,
            font: {
                size: baseFontSize,
                weight: 'normal'
            },
            color: '#000000',
          },
        },
        scales: {
          x: {
            stacked: true, // X軸で積み上げを有効化
            ticks :{
                color: '#000000',
                font: {

                    size: baseFontSize * 0.8
                }
            },
          },
          y: {
            stacked: true, // Y軸で積み上げを有効化
            beginAtZero: true,
            grid: {
                display: false,
            },
            ticks: {
                stepSize: 2000,
                color: '#000000',
                font: {
                    size: baseFontSize * 0.8
                }
            },
            title: {
                display: true,
                text: '点検時間(分)',
                font: {
                    size: baseFontSize * 0.8,
                },
                color: '#000000',
            }
          },
        },
      },
    });
}