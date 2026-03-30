// static/js/presenters/planDetailPresenter.js

import {
  fmtDt,
  fmtManHours,
  fmtText,
  fmtPractitioners,
} from './formatters.js';

export function buildPlanDetailCardsVM(res, { title }) {
  const details = res?.plan?.db_details ?? [];
  return {
    title: fmtText(title),
    cards: details.map(d => ({
      device: fmtText(d?.applicable_device),
      items: [
        { label: '内容', value: fmtText(d?.contents) },
        { label: '方法', value: fmtText(d?.method) },
        { label: '基準', value: fmtText(d?.standard) },
        { label: '工数', value: fmtManHours(d?.inspection_man_hours) },
      ],
    })),
  };
}

export function buildExtraDetailVM(res, { title } = {}) {
  // ここは “plan_detail_api と inspection_card_detail_api の差” を吸収しておくと強い
  // - plan_detail_api: res.plan がある
  // - inspection_card_detail_api: res.plan がある想定（あなたは plan を返す設計）
  const plan = res?.plan ?? res ?? {};

  return {
    title: title ? `${fmtText(title)} / 実施情報` : '実施情報',
    items: [
      { label: 'ステータス', value: fmtText(plan?.status) },
      { label: '実施日', value: fmtDt(plan?.implementation_date) },
      { label: '結果', value: fmtText(plan?.result) },
      { label: '工数', value: fmtManHours(plan?.result_man_hours) },
      // ここはあなたのモデルだと comment / points_to_note が混在しがちなので優先順を決めるのおすすめ
      { label: '指摘事項', value: fmtText(plan?.points_to_note || plan?.comment) },
      { label: '作業者', value: fmtPractitioners(plan?.practitioners) },
    ],
  };
}
