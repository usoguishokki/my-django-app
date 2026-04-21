export class ScheduleAxisTemplate {
    static createAxisLabels(axisLabels = []) {
      return axisLabels
        .map((axis) => `
          <div
            class="time-schedule__axisLabel"
            style="top: ${axis.topPx}px;"
          >
            ${axis.label}
          </div>
        `)
        .join('');
    }
  
    static createGridLines(gridLines = []) {
      return gridLines
        .map((axis) => `
          <div
            class="time-schedule__gridLine ${axis.isHour ? 'is-hour' : ''}"
            style="top: ${axis.topPx}px;"
          ></div>
        `)
        .join('');
    }
}