export const renderStackedBarChart = (canvasId, chart_title, labels, dataset1, dataset2) => {
    const baseFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);

    Chart.defaults.font.family = "'Helvetica', serif";
    Chart.defaults.font.weight = 'normal';

    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'bar', // 棒グラフ
      data: {
        labels, // ラベル配列
        datasets: [
          {
            label: '定期点検(稼動)',
            data: dataset1, // データセット1
            backgroundColor: 'rgba(79, 168, 241, 0.8)',
          },
          {
            label: '定期点検(非稼動)',
            data: dataset2, // データセット2
            backgroundColor: 'rgba(150, 150, 150, 0.8)',
          },
        ],
      },
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
            }
          },
          y: {
            stacked: true, // Y軸で積み上げを有効化
            beginAtZero: true,
            grid: {
                display: false,
            },
            ticks: {
                stepSize: 50,
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
  };