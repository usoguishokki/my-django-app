import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { UIManger } from './UIManger.js';

export class TableManager {
    /**
     * 
     * @param {*} tableId 
     * @param {*} options 
     * @param {*} columnClasses 
     * @param {*} columnManager 
     */
    constructor(
        tableId,
        options = {},
        columnClasses = null,
        columnManager = null,
        
    ) {
        this.table = document.getElementById(tableId);
        if (!this.table) {
            this.tbody = null;
        } else {
            this.tbody = this.table.querySelector('tbody') || null;
        };

        const defaultOptions = {
            isDraggable: false,
            isDisplayNone: false,
            addClass: [],
            filterRunner: "auto",
            onRowClick: null,
            onRowDoubleClick: null,
            conditionFunction: null,
            getRowId: (item) => item?.plan_id ?? item?.plan__plan_id ?? null,
        };
        this.options = { ...defaultOptions, ...options };

        if (typeof this.options.onRowClick !== "function") {
            this.options.onRowClick = null;
        }
        if (typeof this.options.onRowDoubleClick !== "function") {
            this.options.onRowDoubleClick = null;
        }
        if (
            this.options.filterRunner !== "auto" &&
            this.options.filterRunner !== "home" &&
            this.options.filterRunner !== "standard" &&
            this.options.filterRunner !== "none" &&
            typeof this.options.filterRunner !== "function"
        ) {
            this.options.filterRunner = "auto";
        }
        this.filterConditions = {};
        this.columnClasses = columnClasses;
        this.columnMapping = columnManager;
        this.columnTrInf = columnManager?.getTrInf
            ? columnManager.getTrInf()
            : null;
            
        this._rowById = new Map();
        this.filterMeta = {};
        
        if (this.table) {
            this._bindDelegatedRowClick();
        }
    }

    

    _bindDelegatedRowClick() {
        if (this._delegatedClickHandler) {
            this.tbody.removeEventListener('click', this._delegatedClickHandler);
            this.tbody.removeEventListener('dblclick', this._delegateDbClickHandler);
        }

        this._delegatedClickHandler = (e) => {
            const row = e.target.closest("tr");
            if (!row || !this.tbody.contains(row)) return;
            if (row.classList.contains("no-touch")) return;
            if (typeof this.options.onRowClick == "function") {
                this.options.onRowClick(row);
            }
        };
        this.tbody.addEventListener("click", this._delegatedClickHandler);

        if (typeof this.options.onRowDoubleClick === "function") {
            this._delegatedDbClickHandler = (e) => {
                const row = e.target.closest("tr");
                if (!row || !this.tbody.contains(row)) return;
                if (row.classList.contains("no-touch")) return;
                this.options.onRowDoubleClick(row); 
            };
            this.tbody.addEventListener("dblclick", this._delegatedDbClickHandler)
        }
    }

    initializeRowMapFromSSR() {
        // tbody の tr をすべて走査して Map 登録
        this._rowById.clear();
        const rows = this.tbody.querySelectorAll('tr.fc-event');
        rows.forEach(row => {
            const id = row.getAttribute('data-plan-id');
            if (id) {
                this._rowById.set(String(id), row);
            }
        });
    }

    /** 全消し */
    clearTable() {
        this.tbody.innerHTML = "";
        this._rowById.clear();
    }

    /** 置き換え(全消し→追加) */
    replaceRows(rows = []) {
        this.clearTable();
        this._bulkAppend(rows);
        this._afterRowsMutated();
    }

    /** 追加(重複IDはスキップ) */
    appendRows(rows = []) {
        const dataMapping = this.columnMapping.getDatasetMapping([]);
        const frag = document.createDocumentFragment();
        rows.forEach(item => {
            const id = item["plan__plan_id"];
            if (!id || this._rowById.has(id)) return;
            const row = this._createRowAndIndex(item);
            frag.appendChild(row);
        });
        if (frag.childNodes.length) this.tbody.appendChild(frag);
    }

    /** Upsert(同一IDは置き換え、なければ追加) */
    upsertRows(rows = []) {
        const datasetMapping = this.columnMapping.getDatasetMapping([]);
        const frag = document.createDocumentFragment();
        rows.forEach(item => {
            const id = String(item["plan_id"]);
            if (!id) return;

            const exist = this._rowById.get(id);
            const newRow = this.createRow(item, datasetMapping);

            if (exist) {
                this.tbody.replaceChild(newRow, exist);
            } else {
                frag.appendChild(newRow);
            }
            this._rowById.set(id, newRow);
        });

        if (frag.childNodes.length) this.tbody.appendChild(frag);
    }

    /** 行削除（ID配列） */
    removeRowsByIds(ids = []) {
        ids.forEach(id => {
            const row = this._rowById.get(id);
            if (row) {
                row.remove();
                this._rowById.delete(id);
            }
        });
    }

      // ---- 内部ヘルパ ----
    _bulkAppend(rows) {
        const frag = document.createDocumentFragment();
        const datasetMapping = this.columnMapping.getDatasetMapping([]);
        rows.forEach(item => {
            const row = this._createRowAndIndex(item, datasetMapping);
            frag.appendChild(row);
        });
        this.tbody.appendChild(frag);
    }

    _createRowAndIndex(item, datasetMapping) {
        const mapping = datasetMapping || this.columnMapping.getDatasetMapping(item.practitioners || []);
        const row = this.createRow(item, mapping);
        const rawId = this.options.getRowId(item);
        const id = rawId == null ? null : String(rawId); // Mapキーは文字列統一が安全
        if (id) this._rowById.set(id, row);
        return row;
    }

    _afterRowsMutated() {
        this._runConfiguredFilter();
    }

    _runConfiguredFilter() {
        const runner = this.options.filterRunner ?? "auto";

        if (typeof runner === "function") {
            try { runner(this); } catch (e) { console.error(e); }
            return
        }

        switch (runner) {
            case "home":
                if (typeof this.homeFilterTable === "function") {
                    this.homeFilterTable();
                }
                break;

            case "standard":
                if (typeof this.filterTable === "function") this.filterTable();
                break;

            case "none":
                break;
        }
    }
    setFilterRunner(runner) {
        this.options.filterRunner = runner;
    }

    setupDropdownManager(dropdownManager) {
        this.dropdownManager = dropdownManager
    }

    initializeColumns(columns) {
        const columnElements = {};
        for (const [key, colId] of Object.entries(columns)) {
            const columnElement = document.getElementById(colId);
            if (columnElement) {
                columnElements[key] = columnElement;
            }
        }
        return columnElements;
    }

    toggleColumnVisible(visibilityMap) {
        this.columnTrInf.forEach(({ id, colgroup }) => {
            const columnsSettings = visibilityMap[id];
            const elements = document.querySelectorAll(`.${colgroup}`);
            elements.forEach(element => {
                element.style.display = columnsSettings.visible ? 'table-cell' : 'none';
                element.style.width = columnsSettings.width;
                element.style.maxWidth = columnsSettings.width;
            })
        })
    }

    setupResizers() {
        const tableHeaders = document.querySelectorAll('th');
        tableHeaders.forEach(header => {
            this.addResizer(header);
        });
    }

    addResizer(column) {
        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        column.appendChild(resizer);

        let startX, startWidth;

        const doDrag = (e) => {
            const newWidth = startWidth + e.clientX - startX;
            column.style.width = `${newWidth}px`;
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        resizer.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startWidth = column.offsetWidth;
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        });
    }

    updateRowStyles(row, visibleRowIndex) {
        UIManger.toggleClass(row, ['even', 'odd'], 'remove');
        UIManger.toggleClass(row, visibleRowIndex % 2 === 0 ? 'even' : 'odd', 'add');
        if (this.options.conditionFunction) {
            this.options.conditionFunction(row);
        }
        visibleRowIndex++;
        return visibleRowIndex;
    }

    setup() {
        const rows = this.table.querySelectorAll('tbody tr');
        const visibleRows = [];
        const filterPattern = this.options.filterPattern
        return { rows, visibleRows, filterPattern }

    }

    styleContent(row, visibleRowIndex) {
        visibleRowIndex = this.updateRowStyles(row, visibleRowIndex);
        return visibleRowIndex
    }

    filterTable() {
        let visibleRowIndex = 0;
        const { rows, visibleRows} = this.setup();
        visibleRows.length = 0;
        rows.forEach(row => {
            const shouldDisplay = this.shouldDisplayRow(row);
            if (shouldDisplay) {
                UIManger.toggleClass(row, 'display-none', 'remove');
                visibleRowIndex = this.styleContent(row, visibleRowIndex);
                visibleRows.push(row);
                //this.dropdownManager.collectUniqueValues(row);
            } else {
                UIManger.toggleClass(row, 'display-none', 'add');
            }
        });
        //this.dropdownManager.allUpdateDropdownOptions();
        return visibleRows;
    }

    homeFilterTable() {
        let visibleRowIndex = 0;
        const { rows, visibleRows, filterPattern } = this.setup()
        const filterStatus = this.filterConditions['data-status'];
        const affiliation = this.filterConditions['affiliation'];
        const holderId = this.filterConditions['data-holder-member-id'];
        switch (filterPattern) {
            case 'filterVisbledRow':
                rows.forEach(row => {
                    let shouldDisplay = this.homeshouldDisplayRow(row, filterStatus, affiliation, holderId);
                    if (shouldDisplay) {
                        visibleRowIndex = this.styleContent(row, visibleRowIndex);
                        visibleRows.push(row);
                    } else {
                        UIManger.toggleClass(row, 'display-none', 'add');
                    }
                });
                break;
            case 'tagetTableListUp':
                rows.forEach(row => {
                    //let shouldDisplay = this.shouldDisplayRow(row);
                    let shouldDisplay = this.homeshouldDisplayRow(row, filterStatus, affiliation, holderId);
                    if (shouldDisplay) {
                        const planId = row.getAttribute('data-plan-id');
                        visibleRows.push(planId);
                    }
                });
                break;
        }
        return visibleRows;
    }

    shouldDisplayRow(row) {
        for (const [attribute, value] of Object.entries(this.filterConditions)) {
            if (value !== "" && row.getAttribute(attribute) !== value) {
                return false;
            }
        }
        return true;
    }

    homeshouldDisplayRow(row, filterStatus, affiliation, holderId) {
        let rowAffiliation = row.getAttribute('data-affilation');
        let rowHolderId = row.getAttribute('data-holder-member-id');
        if (row.getAttribute('data-status') === filterStatus) {
            switch(row.getAttribute('data-status')) {
                case '配布待ち':
                    if (rowAffiliation === affiliation) {
                        row.classList.add('no-touch');
                        return true;
                    } else {

                        return false;
                    }
                case '実施待ち':
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (rowHolderId === holderId) {
                        return true;
                    } else {
                        return false;
                    }
                case '承認待ち':
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (rowHolderId === holderId) {
                        return true;
                    } else {
                        return false;
                    }
                case '遅れ':
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (rowHolderId === holderId) {
                        return true;
                    } else {
                        return false;
                    }
                case '完了':
                    const practitioners = row.getAttribute('data-practitioner-id').split(', ');
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (practitioners.includes(holderId)) {
                        return true;
                    } else {
                        return false;
                    }
                case '差戻し':
                    if (!UIManger.isValidValue(holderId)) {
                        if (rowAffiliation === affiliation) {
                            return true;
                        }
                    }
                    if (rowHolderId === holderId) {
                        return true;
                    } else {
                        return false;
                    }
                default:
                    return false;
            }
        }
    }

    async loadUpdateTableData({url, method}) {
        const result = await asynchronousCommunication({
            url: url,
            method: method,
        });
        return result.data;
    }
    
    createTableRow = (data = {}) => {
        const tableData = Array.isArray(data) ? data : [];
        const practitioners = data.practitioners || [];
        const datasetMapping = this.columnMapping.getDatasetMapping(practitioners);
        const fragment = document.createDocumentFragment();

        tableData.forEach(item => {
            const row = this.createRow(item, datasetMapping);
            fragment.appendChild(row);
        });

        this.tbody.appendChild(fragment);
    }

    createRow = (item, datasetMapping) => {
        const row = document.createElement('tr');
        if (this.options.isDisplayNone) {
            UIManger.toggleClass(row, 'display-none', 'add');
        }
        
        if (this.options.isDraggable) {
            row.setAttribute('draggable', true)
        }
        
        if (this.options.addClass) {
            const classes = Array.isArray(this.options.addClass) ? this.options.addClass : [this.options.addClass];
            classes.forEach(cls => {
                UIManger.toggleClass(row, cls, 'add');
            })
        }
        this.mapDataToRow(row, item, datasetMapping);
        return row;
    };

    mapDataToRow = (row, item, datasetMapping) => {
        Object.keys(datasetMapping).forEach((key) => {
            const { datasetKey, formatFn } = datasetMapping[key];
            const value = item[key] ?? '';
            row.dataset[datasetKey] = formatFn ? formatFn(value, item) : value;  
        });

        this.columnTrInf.forEach((col) => {
            const td = document.createElement('td');
            const mappingKey = col.mappingKey;
            td.className = col.className;
            const datasetKey = datasetMapping[mappingKey].datasetKey || '';
            td.innerHTML = col.tdData(row.dataset[datasetKey]) || '';
            row.appendChild(td); 
        });
    }
    
    setColumnWidths(table, columnWidths) {
         const colgroup = table.querySelector('colgroup');
         if (!colgroup) {
            return;
         }
         Object.keys(columnWidths).forEach(colId => {
            const col = colgroup.querySelector(`#${colId}`);
            if (col) {
                col.style.width = columnWidths[colId]
            }
         })
    }

    scrollToRow = (container, row) => {
        //const offset = row.offsetTop - container.offsetTop;
        const containerRect = container.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const offset = rowRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({ top: offset, behavior: 'smooth'});
    };

    clearTbody = (table, targetTbody) => {
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = targetTbody;
    }

    getVisibleRows() {
        // tbody が無ければ空配列
        if (!this.tbody) return [];
        return Array.from(this.tbody.querySelectorAll('tr:not(.display-none)'));
      }
      
    /** 可視行の件数を返す */
    countVisibleRows() {
      if (!this.tbody) return 0;
      return this.tbody.querySelectorAll('tr:not(.display-none)').length;
    }
    
    /**
     * data-属性でさらに絞り込んだ可視行の件数を返す（任意）
     * 例) countVisibleRowsBy('data-status', '配布待ち')
     */
    countVisibleRowsBy(attr, value) {
      if (!this.tbody) return 0;
      const rows = this.tbody.querySelectorAll('tr:not(.display-none)');
      let count = 0;
      rows.forEach(tr => {
        if (value === undefined || value === null) {
          if (tr.hasAttribute(attr)) count += 1;
        } else if (tr.getAttribute(attr) === String(value)) {
          count += 1;
        }
      });
      return count;
    }

    _buildCornerTh({ rowSpan }) {
      const th = document.createElement('th');
      th.rowSpan = rowSpan;
      th.scope = 'col';
      th.className = 'kpi-matrix__header kpi-matrix__header--row-label';
      
      // --- wrapper 1個方式 ---
      const wrap = document.createElement('div');
      wrap.className = 'kpi-rowlabel-wrap';
      
      const rowlabel = document.createElement('div');
      rowlabel.className = 'kpi-rowlabel';
      
      rowlabel.innerHTML = `
        <div class="kpi-rowlabel__item kpi-rowlabel__item--count">件数</div>
        <div class="kpi-rowlabel__item kpi-rowlabel__item--mh">工数</div>
      `;
      
      wrap.appendChild(rowlabel);
      th.appendChild(wrap);
      
      return th;
    }

    _appendTeamHeaderCells(teamRow, { teamDefs, period, addGroupEnd = true }) {
        teamDefs.forEach((team) => {
          const th = document.createElement('th');
          th.scope = 'col';
          th.textContent = team.label;
          th.className = 'kpi-matrix__header kpi-matrix__team';
          th.dataset.team = team.key;
      
          if (addGroupEnd && team.key === 'all') th.classList.add('kpi-matrix__group-end');
          if (period?.is_current) th.classList.add('kpi-matrix__header--current-period');
      
          teamRow.appendChild(th);
        });
    }
    
    applyRowParityClasses = (root = this.tbody) => {
        if (!root) return; 
        const rows = Array.from(root.querySelectorAll('tr'));
        const visible = rows.filter((tr) => !tr.classList.contains('display-none'));
      
        rows.forEach((tr) => tr.classList.remove('is-odd', 'is-even'));
        visible.forEach((tr, idx) => tr.classList.add(idx % 2 === 0 ? 'is-odd' : 'is-even'));
    };

    /**
     * KPIマトリクス用のテーブルを組み立てる
     * @param {HTMLTableElement} table
     * @param {Object} config
     * @param {Array} config.rowDefs  - [{ key, label, ... }]
     * @param {Array} config.teamDefs - [{ key, label }]
     * @param {Array} config.periods  - [{ key, label, ... }]
     */
    buildKpiMatrixTable(table, { rowDefs, teamDefs, periods, periodView }) {
        
        if (!table) return;

        // 一旦クリア
        table.innerHTML = '';
    
        // === colgroup ===
        const colgroup = document.createElement('colgroup');
    
        // 先頭列（行ラベル用）
        const labelCol = document.createElement('col');
        labelCol.className = 'kpi-matrix__col kpi-matrix__col--row-label';
        colgroup.appendChild(labelCol);
    
        // 各期間 × 各班の列
        periods.forEach(() => {
            teamDefs.forEach((team) => {
                const col = document.createElement('col');
                col.classList.add('kpi-matrix__col');
                col.dataset.team = team.key;
                
                // 必要であれば team ごとのクラスは付けてもOK（現状 SCSS では未使用）
                col.classList.add(`kpi-matrix__col--team-${team.key}`);
                
                if (team.key === 'all') {
                    // ★「全体」列用の共通クラス
                    col.classList.add('kpi-matrix__group-end');
                }
              
                colgroup.appendChild(col);
            });
        });
    
        table.appendChild(colgroup);
    
        // === thead / tbody ===
        const thead = table.createTHead();
        const tbody = table.createTBody();
    
        this._buildHeaderRows(thead, { teamDefs, periods, periodView });
        this._buildBodyRows(tbody, { rowDefs, teamDefs, periods });
    }

    _buildHeaderRows(thead, { teamDefs, periods, periodView }) {
        // まず初期化しておく
        thead.innerHTML = '';

        if (!periods || periods.length === 0) {
            return;
        }

        // week プロパティがあれば「週ビュー」とみなす

        if (periodView == "month") {
            // ====== これまでどおりの「月ビュー」ヘッダ ======
            // 1行目: 月ヘッダ
            const monthRow = thead.insertRow();

            monthRow.appendChild(this._buildCornerTh({ rowSpan: 2 }));
        
            // 月ヘッダ（ここは従来通り）
            periods.forEach((p) => { 
                const monthTh = document.createElement('th');
                monthTh.scope = 'colgroup';
                monthTh.colSpan = teamDefs.length;
                monthTh.textContent = `${p.month}月`;
                monthTh.className = 'kpi-matrix__header kpi-matrix__header--month';
        
                if (p.is_current) {
                    monthTh.classList.add('kpi-matrix__header--current-period');
                }
        
                monthRow.appendChild(monthTh);
            });
        
            const teamRow = thead.insertRow();
            periods.forEach((p) => this._appendTeamHeaderCells(teamRow, { teamDefs, period: p }));

            return; // ★ 月ビューはここで終了
        } else if (periodView == "week") {
                    // ====== ここから「週ビュー」ヘッダ ======
        // 1行目: 月
            const monthRow = thead.insertRow();
            // 2行目: 週
            const weekRow = thead.insertRow();
            // 3行目: 班
            const teamRow = thead.insertRow();

            // 左端の空セル（行ラベル用）: 3行分rowspan
            monthRow.appendChild(this._buildCornerTh({ rowSpan: 3 }));

            // 月ごとに periods をグルーピング
            const monthMap = new Map();
            periods.forEach((p) => {
                const m = p.month;
                if (!monthMap.has(m)) monthMap.set(m, []);
                monthMap.get(m).push(p);
            });

            // 月順に並べてヘッダを作成
            for (const [month, weekPeriods] of monthMap.entries()) {
                // 1行目: 月セル
                const monthTh = document.createElement('th');
                monthTh.scope = 'colgroup';
                monthTh.colSpan = weekPeriods.length * teamDefs.length;
                monthTh.textContent = `${month}月`;
                monthTh.className =
                    'kpi-matrix__header kpi-matrix__header--month kpi-matrix__group-end';

                if (weekPeriods.some(p => p.is_current)) {
                    monthTh.classList.add('kpi-matrix__header--current-period');
                }

                monthRow.appendChild(monthTh);
            
                // 2行目: 各週（1週目・2週目…） → 週の中だけは数値ソートでOK
                weekPeriods
                    .sort((a, b) => a.week - b.week)
                    .forEach((p) => {
                        const wTh = document.createElement('th');
                        wTh.scope = 'colgroup';
                        wTh.colSpan = teamDefs.length;
                        wTh.textContent = `${p.week}週目`;
                        wTh.className =
                            'kpi-matrix__header kpi-matrix__header--week kpi-matrix__group-end';

                        if (p.is_current) {
                            wTh.classList.add('kpi-matrix__header--current-period');
                        }

                        weekRow.appendChild(wTh);

                    
                        // 3行目: 班ヘッダ
                        teamDefs.forEach((team) => {
                            const th = document.createElement('th');
                            th.scope = 'col';
                            th.textContent = team.label;
                            th.className = 'kpi-matrix__header kpi-matrix__team';
                            th.dataset.team = team.key;
                        
                            if (team.key === 'all') {
                                th.classList.add('kpi-matrix__group-end');
                            }

                            if (p.is_current) {
                                th.classList.add('kpi-matrix__header--current-period')
                            }
                        
                            teamRow.appendChild(th);
                        });
                    });   
            }
        } else if (periodView == "day") {
            const monthRow = thead.insertRow();
            const weekRow  = thead.insertRow();
            const dayRow   = thead.insertRow();
            const teamRow  = thead.insertRow();

            monthRow.appendChild(this._buildCornerTh({ rowSpan: 4 }));
          

          
            const sortedPeriods = [...periods].sort((a, b) =>
                String(a.key).localeCompare(String(b.key))
            );
          
            // 直前の月/週（「変わった時だけ表示」のため）
            let prevMonth = null;
            let prevWeek  = null;

            let weekStartIndex = 0;
            const weekThRefs = [];
            const monthThRefs = [];
          
            for (let i = 0; i < sortedPeriods.length; i++) {
                const p = sortedPeriods[i];

                // ★ next はここで1回だけ
                const next = sortedPeriods[i + 1];
              
                // --- 月 th ---
                const monthTh = document.createElement('th');
                monthTh.scope = 'colgroup';
                monthTh.colSpan = teamDefs.length;
                monthTh.className = 'kpi-matrix__header kpi-matrix__header--month';
                
                // ★いったん空（高さ維持）
                monthTh.textContent = '\u00A0';
                
                // ★参照保持（週末で start/mid/end に月を入れる）
                monthThRefs[i] = monthTh;
                
                // ★月末（= 次が別month or 最後）だけ group-end
                const isMonthEnd = !next || (next.month !== p.month);
                if (isMonthEnd) monthTh.classList.add('kpi-matrix__group-end');
                
                monthRow.appendChild(monthTh);
              
                // --- 週 th ---

                const weekTh = document.createElement('th');
                weekTh.scope = 'colgroup';
                weekTh.colSpan = teamDefs.length;
                weekTh.className = 'kpi-matrix__header kpi-matrix__header--week';

                // 週の開始判定（= prevと違うなら開始）
                const isWeekStart =
                    (prevWeek == null) ||
                    (p.week !== prevWeek) ||
                    (p.month !== prevMonth);

                if (isWeekStart) {
                    weekStartIndex = i;
                }

                // いったん空で作る（高さ維持）
                weekTh.textContent = '\u00A0';

                // 参照を保持（週末になったときに start/mid/end を埋めるため）
                weekThRefs[i] = weekTh;

                // 週末判定（= 次の日が別週 or 別月 or 最後）
                const isWeekEnd =
                    !next ||
                    next.month !== p.month ||
                    next.week !== p.week;

                if (isWeekEnd) {
                    const start = weekStartIndex;
                    const end = i;
                    const mid = Math.floor((start + end) / 2);
                    const weekLabel = `${p.week}週目`;
                      
                    for (const idx of new Set([start, mid, end])) {
                        // 週ラベル
                        if (weekThRefs[idx]) weekThRefs[idx].textContent = weekLabel;
                      
                        // ★月ラベル（週ラベルと同じ列に入れる）
                        // idx列の month を使うと、月跨ぎ週でも破綻しません
                        if (monthThRefs[idx]) monthThRefs[idx].textContent = `${sortedPeriods[idx].month}月`;
                    }
                      
                    // 週の区切り線は「週末」セルだけ
                    weekTh.classList.add('kpi-matrix__group-end');
                }

                weekRow.appendChild(weekTh);

                // --- 日 th ---
                const youbi = (() => {
                    const m = String(p.label ?? '').match(/\((.)\)/);
                    return m ? m[1] : '';
                  })();
                const dTh = document.createElement('th');
                dTh.scope = 'colgroup';
                dTh.colSpan = teamDefs.length;
                const dd = String(p.day ?? '').padStart(2, '0');
                dTh.textContent = `${dd}${youbi ? `(${youbi})` : ''}`;
                dTh.dataset.periodKey = p.key;
                dTh.className = 'kpi-matrix__header kpi-matrix__header--day kpi-matrix__group-end';
                if (p.is_current) dTh.classList.add('kpi-matrix__header--current-period');
                dayRow.appendChild(dTh);
              
                // --- 班 th ---
                for (const team of teamDefs) {
                    const th = document.createElement('th');
                    th.scope = 'col';
                    th.textContent = team.label;
                    th.className = 'kpi-matrix__header kpi-matrix__team';
                    th.dataset.team = team.key;
              
                    if (team.key === 'all') th.classList.add('kpi-matrix__group-end');
                    if (p.is_current) th.classList.add('kpi-matrix__header--current-period');
              
                  teamRow.appendChild(th);
                }
              
                prevMonth = p.month;
                prevWeek  = p.week;
            }
        }
    }

    _buildBodyRows(tbody, { rowDefs, teamDefs, periods }) {
        rowDefs.forEach((rowDef, rowIndex) => {
            const tr = tbody.insertRow();

            const isMh = rowDef.key.endsWith('_mh') || rowDef.key === 'mh_rate';
            tr.classList.add(isMh ? 'kpi-row--mh' : 'kpi-row--count');

            const labelTh = document.createElement('th');
            labelTh.scope = 'row';
            labelTh.textContent = rowDef.label;
            
            // ✅ 固定行ラベルのベースクラス（必ず付く）
            labelTh.classList.add('kpi-matrix__row-label');
            
            // ✅ count / mh の判別（行の tr と同じ判定でOK）
            labelTh.classList.add(isMh ? 'kpi-matrix__row-label--mh' : 'kpi-matrix__row-label--count');
            
            // ✅ セクション境界（必要なら）
            if (rowDef.sectionStart) labelTh.classList.add('kpi-matrix__row-label--section-start');
            if (rowDef.sectionEnd)   labelTh.classList.add('kpi-matrix__row-label--section-end');
            
            tr.appendChild(labelTh);
            periods.forEach((period) => {
                teamDefs.forEach((team) => {
                    const td = tr.insertCell();
                    td.classList.add('kpi-matrix__cell');
                    td.dataset.periodKey = period.key; // "4" / "2025-11-18" など何でもOK
                    td.dataset.team = team.key;
                    td.dataset.type = rowDef.key; // "plan" / "actual" / "delay" / "rate"

                    if (team.key === 'all') td.classList.add('kpi-matrix__group-end');
                    if (period.is_current) td.classList.add('kpi-matrix__cell--current-period');
                    if (rowDef.clickable) td.classList.add('kpi-matrix__cell--clickable');
                });
            });
        });
    }


    /**
     * KPIマトリクスのセルに値を流し込む
     * @param {HTMLTableElement} table
     * @param {Object} matrix   - kpi_matrix_api の matrix 部分そのまま
     *   {
     *     months: [...],
     *     teams: [...],
     *     metrics: [...],
     *     data: {
     *       plan: { "4": {A: 10, B: 20, all: 30}, ... },
     *       actual: {...},
     *       ... 
     *     }
     *   }
     */

    renderKpiMatrix(table, matrix, { rowDefs }) {
        if (!table || !matrix || !matrix.data) return;
      
        const data = matrix.data; // {plan: {...}, actual: {...}, ...}
      
        // metricKey -> rowDef
        const rowDefMap = new Map((rowDefs || []).map(r => [r.key, r]));
      
        const cells = table.querySelectorAll('tbody td');
      
        cells.forEach(td => {
          const periodKey = td.dataset.periodKey; // "4", "2026-01-09", ...
          const teamKey   = td.dataset.team;      // "A", "B", "C", "all"
          const metricKey = td.dataset.type;      // "plan", "rate", "mh_rate", ...
      
          const metricMap = data?.[metricKey];
          const periodData = metricMap?.[periodKey];
          const rawValue = periodData?.[teamKey];
      
          if (rawValue == null) {
            td.textContent = '';
            td.removeAttribute('data-value');
            return;
          }
      
          const rowDef = rowDefMap.get(metricKey);
          const formatter = rowDef?.formatter;
      
          // 表示文字列（formatter があればそれを使う）
          let text;
          try {
            text = formatter ? formatter(rawValue, { metricKey, periodKey, teamKey }) : String(rawValue);
          } catch (e) {
            // formatter が落ちても画面が壊れないようにフォールバック
            text = String(rawValue);
          }
      
          td.textContent = text;
          td.dataset.value = String(rawValue); // 生値は data-value に残す（クリック時などに使える）
        });
      }

    /**
     * KPIマトリクス・セル詳細用テーブルを描画
     * @param {HTMLTableElement} table  - #cellDetailTable など
     * @param {Array<Object>} rows      - kpi_matrix_cell_detail_api の rows
     */
    renderKpiCellDetail(table, rows = []) {
        if (!table) return;

        // 一旦クリア
        table.innerHTML = '';

        if (!rows.length) {
            // 0件のときはテーブル空のまま（「データがありません」は外側で表示制御）
            return;
        }

        // --- thead ---
        const thead = table.createTHead();
        const headerTr = thead.insertRow();

        const headers = ['点検カードNo', '作業名', '計(分)', '実(分)', 'ステータス', '保持者', '周期', '計週', '実週'];
        headers.forEach((label) => {
            const th = document.createElement('th');
            th.textContent = label;
            headerTr.appendChild(th);
        });

        // --- tbody ---
        const tbody = table.createTBody();

        rows.forEach((row) => {
            const tr = tbody.insertRow();
            tr.dataset.planId = row.plan_id != null ? String(row.plan_id) : '';
            tr.dataset.cardNo = row.card_no ?? '';
            tr.dataset.workName = row.work_name ?? '';

            
            tr.classList.add('kpi-cell-detail__row', 'is-clickable');

            const cardNo    = row.card_no ?? '';
            const workName  = row.work_name ?? '';
            const manHours  = row.man_hours ?? '';
            const resultMH  = row.result_mh ?? '';
            const status    = row.status_label ?? '';
            const holder    = row.holder_name ?? '';
            const period    = row.period ?? '';
            const planDate  = row.plan_date ?? '';
            const inspectionDateAlias = row.inspection_date_alias ?? '';

            const cellValues = [
                cardNo,
                workName,
                manHours,
                resultMH, 
                status,
                holder,
                period,
                planDate,
                inspectionDateAlias
            ];

            cellValues.forEach((v, idx) => {
                const td = tr.insertCell();
                td.textContent = v == null ? '' : String(v);

                // 工数だけ右寄せしたい場合の軽い調整（SCSSでも可）
                if (idx === 2 || idx === 3) {
                    td.style.textAlign = 'right';
                } 
            });
        });
    }

    /**
     * 可視行から dataset を抽出して配列で返す（汎用）
     * @param {string[]} keys - 例: ['controlName', 'workName', 'manHour']
     * @returns {Array<Object>}
     */
    extractVisibleRowDatasets(keys = []) {
        const rows = this.getVisibleRows();
        const safeKeys = Array.isArray(keys) ? keys : [];
  
        return rows.map((tr) => {
            const obj = {};
            safeKeys.forEach((k) => {
                obj[k] = tr?.dataset?.[k] ?? '';
            });
            return obj;
        });
    }
}