export function buildPullbackDrawerTableVM(rows, { title = '一括引戻し' } = {}) {
    return {
      title,
      columns: [
        { key: 'machineName', label: '設備', type: 'text', widthPx: 220 },
        { key: 'workName', label: '作業', type: 'text', widthPx: 220 },
        {
          key: 'planTime',
          label: '予定時刻',
          type: 'text',
          widthPx: 180,
          formatter: (value) => formatPlanTime(value),
        },
        {
          key: 'toggle',
          label: '対象',
          type: 'slot',
          resolve: (row) => ({
            kind: 'toggle',
            checked: !!row.enabled,
            action: 'toggle-pullback',
            payload: { rowId: row.rowId },
            disabled: !!row.disabled,
          }),
          widthPx: 100,
        },
      ],
      rows: rows.map((r, i) => ({
        rowId: String(i),
        machineName: r.machineName ?? '',
        workName: r.workName ?? '',
        planTime: r.planTime ?? '',
        enabled: true,
        disabled: false,
        dataset: {
          planId: r.planId ?? '',
        },
      })),
    };
  }
  
  function formatPlanTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
  
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
  
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }