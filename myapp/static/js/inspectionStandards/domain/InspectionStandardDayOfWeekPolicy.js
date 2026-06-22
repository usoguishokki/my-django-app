// static/js/inspectionStandards/domain/InspectionStandardDayOfWeekPolicy.js

const DAY_OF_WEEK_LABEL_BY_VALUE = Object.freeze({
    '0': '月',
    '1': '火',
    '2': '水',
    '3': '木',
    '4': '金',
    '5': '土',
    '6': '日',
  
    SUN: '日',
    MON: '月',
    TUE: '火',
    WED: '水',
    THU: '木',
    FRI: '金',
    SAT: '土',
});
  
export function formatInspectionStandardDayOfWeekLabel(value) {
  const text = String(value ?? '').trim();

  if (!text) return '';

  if (isAlreadyDayOfWeekLabel(text)) {
    return text;
  }

  const upperText = text.toUpperCase();

  return DAY_OF_WEEK_LABEL_BY_VALUE[text] ??
    DAY_OF_WEEK_LABEL_BY_VALUE[upperText] ??
    text;
}

function isAlreadyDayOfWeekLabel(value) {
  return [
    '日',
    '月',
    '火',
    '水',
    '木',
    '金',
    '土',
    '日曜',
    '月曜',
    '火曜',
    '水曜',
    '木曜',
    '金曜',
    '土曜',
    '日曜日',
    '月曜日',
    '火曜日',
    '水曜日',
    '木曜日',
    '金曜日',
    '土曜日',
  ].includes(String(value ?? '').trim());
}