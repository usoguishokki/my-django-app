export function buildRegistrationDrawerTableVM(rows, { title = '登録候補' } = {}) {
  return {
    title,
    columns: [
      { key: 'controlName', label: '設備', type: 'text', widthPx: 220 },
      { key: 'workName', label: '作業', type: 'text', widthPx: 220 },
      { key: 'period', label: '周期', type: 'text', widthPx: 90 },
      { key: 'manHour', label: '工数', type: 'text', widthPx: 90, align: 'right' },

      // ★ 4列目：トグル
      {
        key: 'toggle',
        label: '対象',
        type: 'slot',
        resolve: (row) => ({
          kind: 'toggle',
          // 表示
          textOn: 'ON',
          textOff: 'OFF',
          // 状態
          checked: !!row.enabled,
          // クリック時に必要な情報
          action: 'toggle-register',
          payload: { rowId: row.rowId },
          // 任意：無効化条件
          disabled: !!row.disabled,
        }),
        widthPx: 100,
      },
    ],
    rows: rows.map((r, i) => ({
      rowId: String(i),
      controlName: r.controlName ?? '',
      workName: r.workName ?? '',
      manHour: r.manHour ?? '',
      period: r.period ?? '',
      enabled: true,     // 初期ONにしたいならtrue
      disabled: false,   // 条件でtrueにしてもOK

      dataset: {
        planId: r.planId,
        planInspectionNo: r.planInspectionNo ?? '',
      },

      uiAction: 'open-plan-detail',
      uiPayload: {
        inspectionNo: r.planInspectionNo ?? '',
        workName: r.workName ?? '',
      },
    })),
  };
}