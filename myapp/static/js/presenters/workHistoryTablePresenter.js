import { formatDate } from '../utils/dateTime.js';

function formatJapaneseDate(value) {
    if (!value) return '';
    return formatDate(value, 'YYYY年MM月DD日');
  }
  
  function formatPlannedDate(pDate) {
    const hDateText = formatJapaneseDate(pDate?.h_date);
    const alias = pDate?.date_alias ?? '';
  
    if (!hDateText && !alias) return '';
    if (!alias) return hDateText;
    if (!hDateText) return alias;
  
    return `${hDateText}(${alias})`;
  }
  

export function buildWorkHistoryTableVM(res, { title = '作業履歴' } = {}) {
    const plans = res?.plans ?? []; // サーバpayloadに合わせて
    return {
        title,
        columns: [
            { key: 'plannedDate', label: '計画日', type: 'text', widthPx: 180 },
            { key: 'implementationDate', label: '実施日', type: 'text', widthPx: 150 },
            { key: 'resultManHours', label: '実施工数', type: 'text', widthPx: 100, align: 'right' },
            { key: 'result', label: '結果', type: 'text', widthPx: 100 },
        ],
        rows: plans.map((r, i) => ({
            rowId: String(i),
            
            plannedDate: formatPlannedDate(r.p_date),
            implementationDate: formatJapaneseDate(r.implementation_date),
            resultManHours: r.result_man_hours ?? '',
            result: r.result ?? '',
            
            dataset: {
              planId: r.plan_id ?? '',
            },

            uiAction: 'open-plan-extra',
            uiPayload: {
                planId: r.plan_id ?? '',
            }
        })),
    };
}