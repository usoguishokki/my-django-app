// static/js/presenters/inspectionStandardHistoryListPresenter.js

export function buildInspectionStandardHistoryListTableVM(
    histories = [],
    {
      filters = {},
    } = {}
  ) {
    const normalizedHistories = Array.isArray(histories) ? histories : [];
    const normalizedFilters = normalizeFilters(filters);
  
    return {
      title: buildTitle(normalizedFilters),
      columns: [
        {
          key: 'operatedAtText',
          label: '日時',
          widthPx: 140,
        },
        {
          key: 'sourceLabel',
          label: '操作',
          widthPx: 120,
        },
        {
          key: 'machine',
          label: '設備名',
          widthPx: 160,
        },
        {
          key: 'controlNo',
          label: '管理番号',
          widthPx: 120,
        },
        {
          key: 'inspectionNo',
          label: '点検No',
          widthPx: 120,
        },
        {
          key: 'summary',
          label: '内容',
        },
        {
          key: 'operatedByName',
          label: '実施者',
          widthPx: 120,
        },
        {
          key: 'targetSummary',
          label: '対象',
          widthPx: 120,
        },
      ],
      rows: normalizedHistories.map((history) => buildRow(history)),
    };
  }
  
  function buildRow(history = {}) {
    const historyId = String(history?.id ?? '').trim();
  
    return {
      rowId: historyId,
      operatedAtText: normalizeText(history?.operatedAtText),
      sourceLabel: normalizeText(history?.sourceLabel),
      machine: normalizeText(history?.machine),
      controlNo: normalizeText(history?.controlNo),
      inspectionNo: normalizeText(history?.inspectionNo),
      summary: normalizeText(history?.summary),
      operatedByName: normalizeText(history?.operatedByName),
      targetSummary: buildTargetSummary(history),
      dataset: {
        historyId,
      },
    };
  }
  
  function buildTargetSummary(history = {}) {
    const targetCount = Number(history?.targetCount ?? 0);
    const targetTypes = Array.isArray(history?.targetTypes)
      ? history.targetTypes.filter(Boolean)
      : [];
  
    const typeText = targetTypes.length
      ? targetTypes.join(' / ')
      : '対象';
  
    if (!targetCount) return typeText;
  
    return `${typeText} ${targetCount}件`;
  }
  
  function buildTitle(filters = {}) {
    const labels = [
      filters.machine ? `設備名: ${filters.machine}` : '',
      filters.controlNo ? `管理番号: ${filters.controlNo}` : '',
    ].filter(Boolean);
  
    if (!labels.length) {
      return '変更履歴（全件）';
    }
  
    return `変更履歴（${labels.join('　')}）`;
  }
  
  function normalizeFilters(filters = {}) {
    return {
      machine: normalizeText(filters?.machine),
      controlNo: normalizeText(
        filters?.controlNo ??
        filters?.control_no
      ),
    };
  }
  
  function normalizeText(value) {
    return String(value ?? '').trim();
  }