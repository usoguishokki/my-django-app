// static/js/presenters/planDetailPresenter.js

import {
  fmtDt,
  fmtManHours,
  fmtText,
  fmtPractitioners,
} from './formatters.js';

export function buildPlanDetailCardsVM(res, { title } = {}) {
  const plan = res?.plan ?? {};
  const check = plan?.check ?? {};

  const details = Array.isArray(plan?.db_details)
    ? plan.db_details
    : [];

  return {
    title: fmtText(title),

    // 共通項目変更フォームで使う元データ
    commonItems: buildPlanCommonItemsVM(check),

    cards: details.map((detail, index) => {
      const sectionId = String(
        detail?.id ??
        detail?.detail_id ??
        detail?.db_detail_id ??
        `detail-${index + 1}`
      );

      return {
        sectionId,
        device: fmtText(detail?.applicable_device),

        // section選択時に右側ドロワーの「変更後」で使う元データ
        editData: {
          sectionId,
          applicableDevice: fmtText(detail?.applicable_device),
          contents: fmtText(detail?.contents),
          method: fmtText(detail?.method),
          standard: fmtText(detail?.standard),
          remarks: fmtText(detail?.remarks),
          inspectionManHours: fmtText(detail?.inspection_man_hours),
        },

        items: [
          { label: '内容', value: fmtText(detail?.contents) },
          { label: '方法', value: fmtText(detail?.method) },
          { label: '基準', value: fmtText(detail?.standard) },
          { label: '工数', value: fmtManHours(detail?.inspection_man_hours) },
        ],
      };
    }),
  };
}

function buildPlanCommonItemsVM(check = {}) {
  const rule = check?.rule ?? {};
  const practitionerPattern = check?.practitioner_pattern ?? {};

  return {
    checkId: check?.id ?? '',
    inspectionNo: fmtText(check?.inspection_no),

    workName: fmtText(check?.work_name),

    ruleId: rule?.id ?? '',
    ruleName: fmtText(rule?.name),
    period: fmtText(rule?.label),

    anchorYear: fmtText(check?.anchor_year),
    anchorMonth: fmtText(check?.anchor_month),
    weekOfMonth: fmtText(check?.week_of_month),

    practitionerPatternId:
      practitionerPattern?.id ??
      check?.practitioner_pattern_id ??
      '',

    practitionerPatternName: fmtText(
      practitionerPattern?.name ??
      check?.practitioner_pattern_name
    ),

    dayOfWeek: check?.day_of_week ?? '',
    status: fmtText(check?.status),
    timeZone: fmtText(check?.time_zone),

    manHours: check?.man_hours ?? '',
    requiredPersonCount: check?.required_person_count ?? '',
    safePoint: fmtText(check?.safe_point),
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
