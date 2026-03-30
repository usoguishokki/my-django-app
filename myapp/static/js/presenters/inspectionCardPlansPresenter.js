// static/js/presenters/inspectionCardPlansPresenter.js
import { fmtDt, fmtText, fmtManHours, fmtPractitioners } from './formatters.js';

export function buildInspectionCardPlansTableVM(res, { title } = {}) {
  const plans = res?.plans ?? []; // サーバpayloadに合わせて
  return {
    title: fmtText(title ?? '履歴'),
    columns: [
      { key: 'p_date', label: '計画日' },
      { key: 'implementation_date', label: '実施日' },
      { key: 'status', label: 'ステータス' },
      { key: 'result', label: '結果' },
      { key: 'points_to_note', label: '指摘事項' },
      { key: 'practitioners', label: '実施者' },
      { key: 'result_man_hours', label: '実施工数' },
    ],
    rows: plans.map(p => ({
      plan_id: p?.plan_id,
      p_date: fmtText(p?.p_date?.h_date),                 // dateはAPI側でstring化してるならfmtTextでOK
      implementation_date: fmtDt(p?.implementation_date),
      status: fmtText(p?.status),
      result: fmtText(p?.result),
      points_to_note: fmtText(p?.points_to_note || p?.comment),
      practitioners: fmtPractitioners(p?.practitioners),
      result_man_hours: fmtManHours(p?.result_man_hours),
    })),
  };
}