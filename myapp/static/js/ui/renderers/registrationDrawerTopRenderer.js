// static/js/ui/renderers/registrationDrawerTopRenderer.js
import { renderDrawerTableTop } from './drawerTableTopRenderer.js';

export function renderRegistrationDrawerTop({
  startDate = '',
  startTime = '',
  endDate = '',
  endTime = '',
} = {}) {
  return renderDrawerTableTop({
    fields: [
      {
        type: 'range',
        start: {
          type: 'datetime',
          mode: 'split',
          groupLabel: '開始',            // ✅ ラベルを「開始」に寄せる（後述）
          dateRole: 'start-date',
          dateValue: startDate,
          timeRole: 'start-time',
          timeValue: startTime,
          showIcons: true,              // ✅ 📅/⏰（後述）
        },
        separator: { type: 'separator', label: '～' },
        end: {
          type: 'datetime',
          mode: 'split',
          groupLabel: '終了',
          dateRole: 'end-date',
          dateValue: endDate,
          timeRole: 'end-time',
          timeValue: endTime,
          showIcons: true,
        },
      },
    ],
    buttons: [{ action: 'bulkRegister', label: '確定', payload: {} }],
  });
}