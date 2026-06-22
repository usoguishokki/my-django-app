// static/js/inspectionStandards/application/table/InspectionStandardTableService.js

import { UIManger } from '../../../manager/UIManger.js';
import { TableManager } from '../../../manager/TableManger.js';

const DEFAULT_MERGE_TARGET_COLUMNS = Object.freeze([
  'inspection-no-content',
  'work-name-content',
  'applicable-device-content',
  'method-content',
  'period-content',
  'timezone-content',
]);

export class InspectionStandardTableService {
  constructor({
    table,
    manager,
    tableId = 'myTable',
    onRowClick,
  } = {}) {
    this.table = table;
    this.manager = manager;
    this.tableId = tableId;
    this.onRowClick = onRowClick;

    this.tbody = null;
    this.initialTbody = '';
    this.tableManager = null;
    this.statusConfig = null;

    this._hoverBound = false;
  }

  init() {
    if (!this.table) {
      console.warn('[InspectionStandardTableService] table not found');
      return;
    }

    this.tbody = this.table.querySelector('tbody');
    this.initialTbody = this.tbody ? this.tbody.innerHTML : '';

    this.tableManager = new TableManager(
      this.tableId,
      {
        onRowClick: (row, event) => this._handleRowClick(row, event),
        isDraggable: false,
      },
      null,
      this.manager
    );

    this.statusConfig = this.manager.statusConfig();

    this.toggleColumnVisible('label', '');
    this.bindHoverGroup();
  }

  _handleRowClick(row, event) {
    if (isCheckAbolishedRow(row)) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      return;
    }
  
    this.onRowClick?.(row, event);
  }

  getTbody() {
    return this.tbody;
  }

  resetToInitial() {
    if (!this.tbody) return;

    this.tbody.innerHTML = this.initialTbody;
  }

  clearRows() {
    if (!this.tbody) return;

    this.tbody.innerHTML = '';
  }

  renderRows(details = []) {
    this.tableManager?.createTableRow(details);
    this.applyAbolishedRowStyles();
  }

  toggleColumnVisible(property, value) {
    const statusColumnsConfig =
      Object.values(this.statusConfig ?? {}).find(
        (config) => config[property] === value
      ) || null;

    if (statusColumnsConfig?.columnsStyle) {
      this.tableManager?.toggleColumnVisible(statusColumnsConfig.columnsStyle);
    }

    return statusColumnsConfig;
  }

  applyAbolishedRowStyles() {
    if (!this.tbody) return;
  
    this.tbody.querySelectorAll('tr').forEach((row) => {
      const isCheckAbolished = isTruthyAttributeValue(
        row.getAttribute('data-is_check_abolished')
      );
  
      const isDetailAbolished = isTruthyAttributeValue(
        row.getAttribute('data-is_detail_abolished')
      );
  
      row.classList.toggle('is-check-abolished', isCheckAbolished);
      row.classList.toggle('is-detail-abolished', isDetailAbolished);
  
      row.classList.toggle('is-row-disabled', isCheckAbolished);
  
      if (isCheckAbolished) {
        row.classList.remove('is-clickable');
        row.setAttribute('aria-disabled', 'true');
        row.setAttribute('title', '廃止されたカードのため開けません');
      } else {
        row.removeAttribute('aria-disabled');
        row.removeAttribute('title');
      }
    });
  }

  bindHoverGroup() {
    if (this._hoverBound || !this.tbody) return;

    let currentKey = null;
    let highlighted = [];

    const clearHighlight = () => {
      highlighted.forEach((tr) => tr.classList.remove('is-hover-group'));
      highlighted = [];
      currentKey = null;
    };

    const highlightGroup = (key) => {
      if (!key || key === currentKey) return;

      clearHighlight();

      highlighted = Array.from(
        this.tbody.querySelectorAll(
          `tr[data-inspection_no="${CSS.escape(String(key))}"]`
        )
      );

      highlighted.forEach((tr) => tr.classList.add('is-hover-group'));
      currentKey = key;
    };

    this.tbody.addEventListener('mouseover', (event) => {
      const tr = event.target.closest('tr');

      if (!tr || !this.tbody.contains(tr)) return;

      highlightGroup(tr.getAttribute('data-inspection_no'));
    });

    this.tbody.addEventListener('mouseout', (event) => {
      const fromTr = event.target.closest('tr');

      if (!fromTr) return;

      const toEl = event.relatedTarget;
      const toTr = toEl?.closest ? toEl.closest('tr') : null;

      if (toTr && this.tbody.contains(toTr)) {
        const fromKey = fromTr.getAttribute('data-inspection_no');
        const toKey = toTr.getAttribute('data-inspection_no');

        if (fromKey === toKey) return;
        return;
      }

      clearHighlight();
    });

    this.tbody.addEventListener('mouseleave', clearHighlight);

    this._hoverBound = true;
  }

  removeDuplicateBorders(columnsToCheck = DEFAULT_MERGE_TARGET_COLUMNS) {
    if (!this.table) return;

    const lastIndexArray = [];

    columnsToCheck.forEach((className) => {
      const cells = this.table.querySelectorAll(`tbody td.${className}`);
      let standardCell = null;

      cells.forEach((cell, cellIndex) => {
        if (lastIndexArray.includes(cellIndex)) {
          standardCell = null;
          return;
        }

        const currentCellValue = cell.textContent.trim();
        const nextCell = cells[cellIndex + 1];

        if (!currentCellValue || !nextCell) return;

        const nextCellValue = nextCell.textContent.trim();

        if (currentCellValue === nextCellValue) {
          if (!UIManger.isValidValue(standardCell)) {
            standardCell = cell;
          }

          standardCell.rowSpan = standardCell.rowSpan + 1;
          nextCell.style.display = 'none';
        } else {
          standardCell = null;

          if (className === 'inspection-no-content') {
            lastIndexArray.push(cellIndex);
          }
        }
      });
    });

    lastIndexArray.forEach((index) => {
      const row = this.table.rows[index + 2];

      if (!row) return;

      for (const cell of row.cells) {
        UIManger.toggleClass(cell, 'thick-top-border', 'add');
      }
    });
  }
}

function isCheckAbolishedRow(row) {
  return isTruthyAttributeValue(
    row?.getAttribute?.('data-is_check_abolished')
  );
}

function isTruthyAttributeValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();

  return normalized === 'true' || normalized === '1';
}