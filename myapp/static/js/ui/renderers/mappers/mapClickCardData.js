// ui/render/mappers/mapClickCardData.js
export function mapClickCardDataFromRow(rowEl) {
    const d = rowEl.dataset;
  
    return {
      planId: d.planId ?? '',
      status: d.status ?? '',
      workName: d.workName ?? '',
      manHour: d.manHour ?? '',
      affilation: d.affilation ?? '',
      timeZone: d.timeZone ?? '',
      controlName: d.controlName ?? '',
      inspectionNo: d.planInspectionNo ?? '',
      lineName: d.line ?? '',
      weekdayNum: d.weekday ?? '',          // 0..6 の文字列想定
      weekLabel: d.week ?? '',              // date_alias
      planWeekdayNum: d.planWeekOfDay ?? '',// h_day_of_week（0..6）
    };
}