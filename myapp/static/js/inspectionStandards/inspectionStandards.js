import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';

import { initializeLoadingScreen } from '../manager/loadingManager.js';
import { UIManger } from '../manager/UIManger.js';
import { TableManager } from '../manager/TableManger.js';

import { inspectionStandardManager } from './inspectionStandardsMappingConfig.js';

import { DrawerStack } from '../ui/componets/drawer/DrawerStack.js';
import { panelBinder } from '../ui/bindings/panelBinder.js';


import { buildPlanDetailCardsVM, buildExtraDetailVM } from '../presenters/planDetailPresenter.js';

import { buildInspectionCardPlansTableVM } from '../presenters/inspectionCardPlansPresenter.js';

import { renderGenericTableHTML } from '../ui/renderers/genericTableRenderer.js';
import { buildWorkHistoryTableVM } from '../presenters/workHistoryTablePresenter.js'

import { renderPlanDetailCardsHTML, renderExtraDetailHTML } from '../ui/renderers/planDetailCardsRenderer.js';
import { renderInspectionCardPlansTableHTML } from '../ui/renderers/inspectionCardPlansTableRenderer.js';

import { fetchInspectionCardDetail, fetchInspectionPlansHistory, fetchPlanDetail } from "../api/fetchers.js";

  

class inspectionStandards {
    constructor() {
        this.inspectionStandardManager = new inspectionStandardManager();
        this.table = document.getElementById('myTable');
        this.drawers = null;
        this._inited = false;
        this.spinnerId = 'inspectionStandardsSpinner'
    }

    async init() {
        if (this._inited) return;
        if (!this.table) {
            console.warn('[InspectionStandards] #myTable not found at init');
            return;
        }
        this.parentArea = document.getElementById('parentFilterArea');
        this.setupDrawers();
        this.tbody = this.table.querySelector('tbody');
        this.initialTbody = this.tbody ? this.tbody.innerHTML : '';
    
        // 3) テーブル/ドロップダウン等の本格セットアップ
        this.tableSetup();         // TableManager作成・列マッピングなど
    
        // 4) 同一inspection_noのホバー強調（委譲）※TableManager後
        this._bindHoverGroup();
    
        this._bindEquipmentSelects();


        this._inited = true;
    }

    setupDrawers() {
      // root は data-ui-root="drawer" を優先
      this.$root =
        document.querySelector('[data-ui-root="drawer"]') ||
        document.getElementById('parentFilterArea');
    
      if (!this.$root) {
        console.warn('[InspectionStandards] root not found');
        return;
      }
    
      const stackEl = this.$root.querySelector('[data-drawer-stack]');
      if (!stackEl) {
        console.warn('[InspectionStandards] drawer stack not found: [data-drawer-stack]');
        return;
      }
    
      this.drawers = new DrawerStack({
        stackEl,
        rootEl: this.$root,
        rootClassBase: 'page',          // 既存drawer scssが page--drawer-* を見ている想定
        order: ['cell', 'plan', 'extra'], // drawer_stack.html 側の data-panel と合わせる
        enableEscapeClose: true,
        side: 'right',
        actionsByPanel: {
          plan: {
            'open-plan-extra': ({ payload, type}) => {
              if (type !== 'click') return;

              const planId = Number(payload?.planId ?? 0);
              if (!Number.isFinite(planId) || planId <= 0) return;

              this._openExtraFromHistoryRow({ planId }).catch(console.error);
            },
          },
        },
      });
    }

    _bindEquipmentSelects() {
      this.$controlNameSelect = document.getElementById('controlNameSelect');
      this.$controlNoSelect   = document.getElementById('controlNoSelect');
    
      if (!this.$controlNameSelect || !this.$controlNoSelect) {
        console.warn('[InspectionStandards] control selects not found');
        return;
      }
    
      const raf = () => new Promise(requestAnimationFrame);

      const applyPlaceholderClass = (selectEl) => {
        selectEl.classList.toggle('is-placeholder', !selectEl.value);
      };
    
      applyPlaceholderClass(this.$controlNameSelect);
      applyPlaceholderClass(this.$controlNoSelect);
    
      // ★追加：同期による二重発火ガード
      this._syncingSelect = false;
    
      const handleChange = async (source, { machine, controlNo }) => {
        if (this._syncingSelect) return;
    
        // ① すぐ出す
        this._showFilterSpinner();
    
        // ② 同期（相手の値を変える）
        this._syncingSelect = true;
        try {
          if (source === 'name') this._syncControlNoSelect(controlNo);
          if (source === 'no')   this._syncControlNameSelect(machine);
    
          applyPlaceholderClass(this.$controlNameSelect);
          applyPlaceholderClass(this.$controlNoSelect);
        } finally {
          this._syncingSelect = false;
        }
    
        // ③ 描画を通す
        await raf();
    
        // ④ fetch（通信しない場合は _applyFiltersAndFetch 内で hide する設計）
        await this._applyFiltersAndFetch({ machine, control_no: controlNo });
      };
    
      this.$controlNameSelect.addEventListener('change', async (e) => {
        const opt = e.target.selectedOptions?.[0];
        const machine   = opt?.dataset?.machine ?? '';
        const controlNo = opt?.dataset?.controlNo ?? '';
        await handleChange('name', { machine, controlNo });
      });
    
      this.$controlNoSelect.addEventListener('change', async (e) => {
        const opt = e.target.selectedOptions?.[0];
        const machine   = opt?.dataset?.machine ?? '';
        const controlNo = opt?.dataset?.controlNo ?? '';
        await handleChange('no', { machine, controlNo });
      });
    }


    _syncControlNoSelect(controlNo) {
        if (!this.$controlNoSelect) return;
        const options = Array.from(this.$controlNoSelect.options);
        const hit = options.find(o => (o.dataset?.controlNo ?? o.value) === controlNo);
        if (hit) this.$controlNoSelect.value = hit.value;
    }

    _syncControlNameSelect(machine) {
        if (!this.$controlNameSelect) return;
        const options = Array.from(this.$controlNameSelect.options);
        const hit = options.find(o => (o.dataset?.machine ?? o.value) === machine);
        if (hit) this.$controlNameSelect.value = hit.value;
    }

    async _applyFiltersAndFetch(filters) {
        // 未選択なら初期状態に戻す（任意）
        const hasAny = !!(filters?.machine || filters?.control_no);
        if (!hasAny) {
          if (this.tbody) this.tbody.innerHTML = this.initialTbody;
          UIManger.hideSpinner?.({ id: 'inspectionStandardsSpinner' });
          return;
        }
      
        await this.setupAsyncCommunication(filters);
    }

    _openPlanDetailFromRow(row) {
      if (!this.drawers) {
        console.warn('[InspectionStandards] drawers not initialized');
        return;
      }
    
      // まずは2枚だけ開く（cell + plan）
      this.drawers.openToLevel(2);
    
      // タイトルだけ仮で入れておく（あとでデータ連動）
      const inspectionNo = row.getAttribute('data-inspection_no') || '';
      const workName = row.getAttribute('data-wark_name') || ''

      const cellTitle = `${inspectionNo} / ${workName}`

      const cell = this.drawers.panel('cell');
      const plan = this.drawers.panel('plan');

      cell?.setTitle('読み込み中');
      plan?.setTitle('読み込み中');

      this._loadInspectionCardDetail({ inspectionNo, cellTitle }).catch((e) => {
        console.error(e);
        cell?.setTitle?.(`カードNo: ${inspectionNo}（エラー）`);
        cell?.setBodyHTML?.(`<p class="drawer__placeholder">読み込みに失敗しました</p>`);
      });

      
      this._loadInspectionHistory({ inspectionNo }).catch((e) => {
        console.error(e);
        plan?.setTitle?.(`履歴（エラー）: ${inspectionNo}`);
        // plan パネルは data-role="body" があるのでそこに仮文言を入れる
        plan?.setBodyHtml?.(`<p class="drawer__placeholder">読み込みに失敗しました</p>`);
      });
    }

    async _loadInspectionCardDetail({ inspectionNo, cellTitle }) {
      const cell = this.drawers?.panel('cell');
      if (!cell) return;
    
      try {
        const res = await fetchInspectionCardDetail({ inspectionNo });
        
        const inspectionManHour = res.plan.check.man_hours 
    
        // plannedMaintenance.js と同じ作り（vm2/html2）
        const title = `${cellTitle} ${inspectionManHour}分`;
        const vm2 = buildPlanDetailCardsVM(res, { title });
        const html2 = renderPlanDetailCardsHTML(vm2);
    
        cell.showBody?.();

        panelBinder.setTitle(cell.titleEl, vm2.title);
        panelBinder.setBodyHTML(cell.bodyEl, html2);
    
      } catch (e) {
        console.error(e);
        panelBinder.showError(cell.titleEl, cell.bodyEl);
      }
    }

    async _loadInspectionHistory({ inspectionNo }) {
      const plan = this.drawers?.panel('plan');
      if (!plan) return;

      plan.setTitle?.(`履歴: ${inspectionNo}（読み込み中…）`);
      plan.showEmpty?.('データを読み込んでいます…');

      plan.showTable?.();
      plan.clearTable?.();
      plan.clearBody?.();
    
      try {
        const res = await fetchInspectionPlansHistory({ inspectionNo });

        //const vm = buildInspectionCardPlansTableVM(res, { title: '点検履歴' });

        const vm = buildWorkHistoryTableVM(res, { title: '作業履歴' });

        const html = renderGenericTableHTML(vm);
        
        plan.setTitle?.(vm.title);

        plan.showTable?.();
        plan.setTableHtml?.(html);

      } catch(e) {
        console.error(e);
        plan.setTitle?.(`履歴: ${inspectionNo}（エラー）`);
        // エラー時は empty を見せるのが一番安全
        plan.showEmpty?.('読み込みに失敗しました');
      }
    }

    _bindHistoryRowClickOnce() {
      if (this._historyRowClickBound) return;
    
      const planPanel = this.drawers?.panel('plan');
      if (!planPanel?.tableEl) return;
    
      planPanel.tableEl.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-plan-id]');
        if (!tr) return;
    
        const planId = Number(tr.getAttribute('data-plan-id') || 0);
        if (!planId) return;
    
        // ★ panel3へ
        this._openExtraFromHistoryRow({ planId }).catch(console.error);
      });
    
      this._historyRowClickBound = true;
    }

    async _openExtraFromHistoryRow({ planId }) {
      const extra = this.drawers?.panel('extra');
      if (!extra) return;
    
      // ③まで開く
      this.drawers.openToLevel(3);
    
      // skeleton
      extra.setTitle?.('点検結果（読み込み中…）');
      extra.showBody?.();
      extra.setBodyHtml?.(`<p class="drawer__placeholder">データを読み込んでいます…</p>`);
    
      try {
        const res = await fetchPlanDetail({ planId });
    
        const title = `plan_id: ${planId}`;
        const vm3 = buildExtraDetailVM(res, { title });
        const html3 = renderExtraDetailHTML(vm3);
    
        extra.showBody?.();
        panelBinder.setTitle(extra.titleEl, '点検結果');
        panelBinder.setBodyHTML(extra.bodyEl, html3);
    
      } catch (e) {
        console.error(e);
        extra.showBody?.();
        panelBinder.showError(extra.titleEl, extra.bodyEl);
      }
    }



    tableSetup() {
        const onRowClick = (row) => {
            const inspectionNo = row.getAttribute('data-inspection_no');
            if (!inspectionNo) {
                console.warn('[onRowClick] data-inspection_no is missing on row:', row);
                return;
            }
            this._openPlanDetailFromRow(row);
        };

        this.tableManager = new TableManager('myTable', {
            onRowClick,
            isDraggable: false
        }, null, this.inspectionStandardManager);
        this.statusConfig = this.inspectionStandardManager.statusConfig();
        this._toggleColumnVisible('label' ,'');
    }

    openSubviewSkeleton({ label = '' }) {
      this._openPanel(this.$subview);
      this.openPanels(1);
    
      // ①のスケルトン（binder化してるなら binder を使ってOK）
      if (this.$cellDetailTitle) {
        this.$cellDetailTitle.textContent = `${label}（読み込み中…）`;
      }
      if (this.$cellDetailEmptyMsg) {
        this.$cellDetailEmptyMsg.style.display = 'block';
        this.$cellDetailEmptyMsg.textContent = 'データを読み込んでいます…';
      }
      if (this.$cellDetailTable) {
        this.$cellDetailTable.innerHTML = '';
      }
    }

    _bindHoverGroup() {
        let currentKey = null;
        let highlighted = [];

        const clearHighlight = () => {
            highlighted.forEach(tr => tr.classList.remove('is-hover-group'));
            highlighted = [];
            currentKey  = null
        };

        const highlightGroup = (key) => {
            if (!key || key === currentKey) return;
            clearHighlight();
            highlighted = Array.from(
                this.tbody.querySelectorAll(
                    `tr[data-inspection_no="${CSS.escape(String(key))}"]`
                )
            );
            highlighted.forEach(tr => tr.classList.add('is-hover-group'));
            currentKey = key; 
        };

        this.tbody.addEventListener('mouseover', (e) => {
            const tr = e.target.closest('tr');
            if (!tr || !this.tbody.contains(tr)) return;
            highlightGroup(tr.getAttribute('data-inspection_no'));
        });

        this.tbody.addEventListener('mouseout', (e) => {
            const fromTr = e.target.closest('tr');
            if (!fromTr) return;

            const toEl = e.relatedTarget;
            const toTr = toEl && toEl.closest ? toEl.closest('tr') : null;

            if (toTr && this.tbody.contains(toTr)) {
                const fromKey = fromTr.getAttribute('data-inspection_no');
                const toKey = toTr.getAttribute('data-inspection_no');
                if (fromKey === toKey) return;
                return;
            }

            clearHighlight();
        })

        this.tbody.addEventListener('mouseleave', clearHighlight);
    }

    _toggleColumnVisible(property, value) {
        const statusColumnsConfig = Object.values(this.statusConfig).find(config => config[property] === value) || null;
        this.tableManager.toggleColumnVisible(statusColumnsConfig.columnsStyle);
        return statusColumnsConfig
    }


    _showFilterSpinner() {
      const spinnerContainer = this.parentArea;
    
      UIManger.showSpinner?.({
        container: spinnerContainer,
        id: this.spinnerId,
        size: 'lg',
        title: '点検基準書を取得中…',
        sub: 'データを読み込んでいます',
        delayMs: 300, // ← ここを0に
      });
    
    }
    
    _hideFilterSpinner() {
      UIManger.hideSpinner?.({ id: this.spinnerId });
    }

    async setupAsyncCommunication(filters) {
        const params = {
          url: '/inspectionStadards/',
          method: 'POST',
          data: { action: 'get_details', data: filters }
        };
      
        if (!this.tbody) return;

        this._reqSeq = (this._reqSeq ?? 0) + 1;
        const mySeq = this._reqSeq;
      
      
        const nextFrame = () => new Promise(requestAnimationFrame);
      
        try {
      
          this.tbody.innerHTML = ''; // ここから重い処理OK
      
          this.tbody.classList.remove('fade-enter-active');
          this.tbody.classList.add('fade-enter');
      
          const data = await asynchronousCommunication(params);
          if (mySeq !== this._reqSeq) return;
      
          const details = data?.details || [];
          this.tableManager.createTableRow(details);
      
          await nextFrame(); // ★ DOM追加後に一旦描画（体感を滑らかに）
          this.removeDuplicateBorders();
      
          requestAnimationFrame(() => {
            this.tbody.classList.add('fade-enter-active');
            const onEnd = (e) => {
              if (e.target !== this.tbody) return;
              this.tbody.classList.remove('fade-enter', 'fade-enter-active');
              this.tbody.removeEventListener('transitionend', onEnd);
            };
            this.tbody.addEventListener('transitionend', onEnd);
          });
      
        } catch (err) {
          console.error('[setupAsyncCommunication] failed:', err);
          this.tbody?.classList.remove('fade-enter', 'fade-enter-active');
        } finally {
          if (mySeq === this._reqSeq) {
            UIManger.hideSpinner?.({ id: this.spinnerId });
          }
        }
      
    }
      

    removeDuplicateBorders() {
        const columnsToCheck = ['inspection-no-content', 'work-name-content', 'applicable-device-content',
                                'method-content', 'timezone-content'];

        let lastIndexArray = []
        columnsToCheck.forEach((className, index) => {
            const cells = this.table.querySelectorAll(`tbody td.${className}`);
            let standardCell = null;

            cells.forEach((cell, cellIndex) => {
                if (lastIndexArray.includes(cellIndex)) {
                    standardCell = null;
                    return;
                }

                const currentCellValue = cell.textContent.trim();
                const nextCell = cells[cellIndex+1];

                if (!currentCellValue || !nextCell) return;

                const nextCellValue = nextCell.textContent.trim();
                
                if (currentCellValue === nextCellValue) {
                    if (!UIManger.isValidValue(standardCell)) {
                        standardCell = cell;
                        
                    }

                    standardCell.rowSpan = standardCell.rowSpan + 1
                    nextCell.style.display = 'none'
                } else {
                    standardCell = null;

                    if (className === 'inspection-no-content') {
                        lastIndexArray.push(cellIndex)
                    }
                }

            });
        
        });
        lastIndexArray.forEach(index => {
            const row = this.table.rows[index+2];

            for (const cell of row.cells) {
                UIManger.toggleClass(cell, 'thick-top-border', 'add');
            }
        })
    }
}


document.addEventListener('DOMContentLoaded', async() => {
    initializeLoadingScreen();
    const app = new inspectionStandards();
    await app.init();

});
