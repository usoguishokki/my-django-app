export class ScheduleAxisBuilder {
    static build({
      totalMinutes,
      pxPerMinute,
      labelEveryMinutes,
      gridEveryMinutes,
      formatLabel,
    }) {
        const axisLabels = [];
        const gridLines = [];
  
        for (let minute = 0; minute <= totalMinutes; minute += labelEveryMinutes) {
            axisLabels.push({
            minute,
            top: minute * pxPerMinute,
            text: formatLabel(minute),
            });
        }
  
        for (let minute = 0; minute <= totalMinutes; minute += gridEveryMinutes) {
            gridLines.push({
            minute,
            top: minute * pxPerMinute,
            });
        }
  
        return {
            axisLabels,
            gridLines,
        };
    }
}