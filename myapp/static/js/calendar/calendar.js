import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { UIManger } from '../manager/UIManger.js';
import { UtilityManager } from '../manager/UtilityManager.js';

import { toDateTimeLocalString, isValidDate, splitDateTimeLocal } from '../utils/dateTime.js';


import { TableManager } from '../manager/TableManger.js';
import { dropdownManger } from '../manager/dropdownbox.js';
import { calendarColumnManager } from './calendarMappingConfig.js';
import { ModalManger } from '../manager/ModalManger.js'
import { 
    fetchPlanRows, 
    fetchInspectionCardDetail, 
    fetchRegistration, 
    fetchMemberAssignedPlans,
    executePullback,
    executeBulkPullback,
} from "../api/fetchers.js";

import { renderRegistrationDrawerTop } from '../ui/renderers/registrationDrawerTopRenderer.js';
import { buildPlanDetailCardsVM } from '../presenters/planDetailPresenter.js';
import { buildRegistrationDrawerTableVM } from '../presenters/registrationDrawerPresenter.js';

import { renderPullbackDrawerTop } from '../ui/renderers/pullbackDrawerTopRenderer.js';
import { buildPullbackDrawerTableVM } from '../presenters/pullbackDrawerPresenter.js';

import { renderPlanDetailCardsHTML } from '../ui/renderers/planDetailCardsRenderer.js';
import { renderGenericTableHTML } from '../ui/renderers/genericTableRenderer.js';

import { DrawerStack } from '../ui/componets/drawer/DrawerStack.js';
import { panelBinder } from '../ui/bindings/panelBinder.js';

import { labelForAttrValue } from '../ui/formatters/labelFormatters.js';

import { initializeLoadingScreen } from '../manager/loadingManager.js';

const fadeOutAndRemoveRow = (row, tbMgr) => {
    if (!row) return;
    const id = row.getAttribute('data-plan-id');
  
    // 高さをアニメ対象にするため固定してから collapse へ
    const h = row.getBoundingClientRect().height;
    row.style.height = h + 'px';
    row.classList.add('removing');
  
    // 次フレームで height:0 へ（トランジション発火）
    requestAnimationFrame(() => {
      row.classList.add('collapse');
    });
  
    // アニメ完了したら remove
    row.addEventListener('transitionend', () => {
        tbMgr.removeRowsByIds([id]);
    }, { once: true });
}

function applyMemberOptionsVisibility(memberSelect, {
    mode = 'team',   // 'team' | 'all'
    team = '',
    showAllMember = true,
  } = {}) {
    if (!memberSelect) return;
  
    const options = Array.from(memberSelect.options);
    const placeholder = document.getElementById('memberSelectPlaceholder');
    const allMemberOption = document.getElementById('allMember');
  
    options.forEach((option) => {
      // placeholder は初期表示専用なので、常に隠す
      if (option === placeholder) {
        UIManger.toggleClass(option, 'display-none', 'add');
        return;
      }
  
      // allMember は常に残す
      if (option === allMemberOption) {
        UIManger.toggleClass(option, 'display-none', showAllMember ? 'remove' : 'add');
        return;
      }
  
      const optionTeam = option.getAttribute('data-team') || '';
  
      if (mode === 'all') {
        UIManger.toggleClass(option, 'display-none', 'remove');
        return;
      }
  
      if (!team) {
        UIManger.toggleClass(option, 'display-none', 'remove');
        return;
      }
  
      const shouldHide = optionTeam !== team || optionTeam === '';
      UIManger.toggleClass(option, 'display-none', shouldHide ? 'add' : 'remove');
    });
}

function readSelectedMember(memberSelect) {
    if (!memberSelect) return null;
  
    const selectedOption = memberSelect.options[memberSelect.selectedIndex];
    if (!selectedOption) return null;
  
    const value = selectedOption.value ?? '';
    const isPlaceholder = selectedOption.id === 'memberSelectPlaceholder';
    const isAll = selectedOption.id === 'allMember';
  
    return {
      value,
      isPlaceholder,
      isAll,
      loginNumber: selectedOption.getAttribute('data-login-number') || null,
      team: selectedOption.getAttribute('data-team') || '',
      shift: {
        start: selectedOption.getAttribute('data-shift-start-time') || '',
        end: selectedOption.getAttribute('data-shift-end-time') || '',
      },
      optionEl: selectedOption,
    };
  }
  
const getSelectedMember = () => {
  const memberSelect = document.getElementById('memberSelect');
  const selected = readSelectedMember(memberSelect);
  if (!selected) return null;

  applyMemberOptionsVisibility(memberSelect, {
    mode: selected.isAll ? 'all' : 'team',
    team: selected.team,
    showAllMember: true,
  });

  return selected;
};

const updateStatus = (_status, action) => {
    let updateStatus
    switch(action) {
        case 'drop':
            if (_status === '配布待ち') {
                updateStatus = '実施待ち';
            } else if (_status === '遅れ') {
                updateStatus = '遅れ'
            } else {
                throw new Error(`statusが${status}なので処理できません`);
            }
            break;
        case 'receive':
            if (_status === '遅れ') {
                updateStatus = '遅れ';
            } else if (_status === '実施待ち') {
                updateStatus = '配布待ち';
            } else {
                throw new Error(`statusが${_status}なので処理できません`);
            }
            break;
    }
    return updateStatus;
}

const calcTotalsFromVisibleRows = (rowSelector = "#external-events tr") => {
    const rows = Array.from(document.querySelectorAll(rowSelector));

    const visibleRows = rows.filter(row => !row.classList.contains("display-none"));
  
    const totalCount = visibleRows.length;
  
    const totalManHours = visibleRows.reduce((sum, row) => {
      const raw = row.getAttribute("data-man-hour");
      const n = Number(raw);
      return Number.isFinite(n) ? (sum + n) : sum;
    }, 0);
  
    return { totalCount, totalManHours };
};
  
const renderTotals = ({ totalCount, totalManHours }) => {
    const countEl = document.getElementById("totalCount");
    const hoursEl = document.getElementById("manHours");
  
    if (countEl) {
      countEl.dataset.count = String(totalCount);
      countEl.textContent = `${totalCount}枚`;
    }
    if (hoursEl) {
      hoursEl.dataset.count = String(totalManHours);
      hoursEl.textContent = `${totalManHours}分`;
    }
};
  
const updateTotalsFromUI = () => {
    renderTotals(calcTotalsFromVisibleRows("#external-events tr"));
};

class Calendar {
    constructor() {
        const Calendar = FullCalendar.Calendar;
        const Draggable = FullCalendar.Draggable;


        this.containerEl = document.getElementById('external-events');
        this.calendarEl = document.getElementById('calendar');


        this._dragGhost = null;
        this._dragMoveHandler = null;
        this._onPointerDownForGhost = null;
        this._draggable = null;     // ← Draggable インスタンス保持
        this._dndEnabled = false;   // ← 現在の有効/無効フラグ

        this.myCalendar = new Calendar(this.calendarEl, {
            headerToolbar: {
                left: 'prev,next',
                center: 'title',
                right: 'timeGridDay,listMonth',
            },
            initialView: 'timeGridDay',
            locale: 'ja',
            timeZone: 'Asia/Tokyo',
            navLinks: true,
            businessHours: true,
            editable: false,
            droppable: false,
            allDaySlot: false,
            slotDuration: '00:05:00',
            slotMinTime: '06:30:00',
            slotMaxTime: '30:30:00',
    
            eventDrop: function(info) {
                const { loginNumber } = getSelectedMember();
                const event_id = info.event.id;
                const event_date = info.event.startStr;
                const event_status = info.event._def.extendedProps.planStatus
                asynchronousCommunication({
                    url: '/calendar/',
                    method: 'POST',
                    data: {
                        action: "update_date_time",
                        plan_id: event_id,
                        new_date: event_date,
                        member: loginNumber,
                        status: event_status
                    }
                });
            },
            drop: (info) => {
                const row = info.draggedEl?.closest('tr.fc-event');
                if (row) {
                  row.classList.add('dragging', 'removing'); // ← ここで確定的に薄いまま
                  row.style.opacity = '0.05';
                }
            },
            eventReceive: (info) => {
                const row = info.draggedEl?.closest('tr.fc-event');
                const manHours = Number(info.event.extendedProps.man_hours || 0);
                const status   = info.event.extendedProps.planStatus;
                const { loginNumber }    = getSelectedMember();
                const _updateStatus = updateStatus(status, 'drop');
              
                asynchronousCommunication({
                    url: '/calendar/',
                    method: 'POST',
                    data: {
                        action: "update_date_time",
                        plan_id: info.event.id,
                        new_date: info.event.startStr,
                        member: loginNumber,
                        status: _updateStatus
                    }
                }).then(() => {
                    updateProgressText(manHours, 1, 0, 0);
                    updateAfterRegistration(manHours, 1,'sub')
                    //decrementCardTotalContents(manHours);
                    info.event.setExtendedProp('planStatus', _updateStatus);
                    if (row) {
                        row.classList.add('dragging'); // 念のため薄い状態を確実に
                        fadeOutAndRemoveRow(row, this.calendarUI.tableManager);
                    };
                }).catch(err => {
                    console.error('[eventReceive] failed:', err);
                    // エラー時は元に戻す
                    if (row) row.classList.remove('dragging', 'removing', 'collapse');
                });
            },
            eventClick: async (info) => {
                const isDouble = info.jsEvent?.detail >= 2;
                const ev = info.event;
            
                if (!isDouble) return;
            
                const eventDetails = {
                    planId: ev.id,
                    monthAndWeek: ev.extendedProps.monthAndWeek,
                    weekOfDay: ev.extendedProps.weekOfDay,
                    machineName: ev.extendedProps.machineName,
                    title: ev.extendedProps.title,
                };
            
                try {
                    await this.calendarUI.handleSinglePullbackAction(eventDetails);
                } catch (err) {
                    console.error('[eventClick] single pullback failed:', err);
                }
            },
            
            eventDidMount: (info) => {

                //const harnessElement = info.el.closest('.fc-timegrid-event-harness.fc-timegrid-event-harness-inset');
                const row = info.draggedEl?.closest('tr.fc-event');
                if (row) {
                    row.classList.add('dragging', 'removing'); // ← ここで確定的に薄いまま
                }
            },
            eventContent: (arg) => {
                const eventData =arg.event;
                const modifiedTitle = `<span>${eventData.extendedProps.machineName}: ${eventData.extendedProps.title}</span>`;
                return { html: modifiedTitle };
            },
        });

        this._onPointerDownForGhost = (e) => {
            const hit = e.target.closest('.dnd-handle');
            if (!hit) return;
          
            // 重要：ここで preventDefault しない（ネイティブDnD開始を妨げない）
            const row = hit.closest('tr.fc-event');
            if (!row) return;
          
            // 行の見た目は薄く（任意）
            this._draggingRow = row;
            row.classList.add('dragging');
            row.style.opacity = '0.3';
          
            // ゴースト生成→配置→初期位置
            this._dragGhost = this._buildGhost(row);
            document.body.appendChild(this._dragGhost);
            this._dragGhost.style.top  = '0px';
            this._dragGhost.style.left = '0px';
            this._moveGhost(e); // 初期位置に移動
          
            // FullCalendar の .fc-mirror は隠す（CSSに .hide-fc-mirror .fc-mirror {opacity:0} 済）
            document.body.classList.add('hide-fc-mirror');
          
            // 追従（passive: true でスクロール等を邪魔しない）
            this._dragMoveHandler = (ev) => this._moveGhost(ev);
            document.addEventListener('pointermove', this._dragMoveHandler, { passive: true });
          
            // 終了（いずれかで回収）
            const cleanup = () => {
                document.removeEventListener('pointermove', this._dragMoveHandler);
                this._dragMoveHandler = null;
          
                if (this._dragGhost?.parentNode) this._dragGhost.parentNode.removeChild(this._dragGhost);
                this._dragGhost = null;
          
                document.body.classList.remove('hide-fc-mirror');
          
                setTimeout(() => {
                    if (this._draggingRow && !this._draggingRow.classList.contains('removing')) {
                        this._draggingRow.classList.remove('dragging');
                        this._draggingRow.style.opacity = '';
                        this._draggingRow = null;
                    };
                }, 100)
            };
            
          
            // マウス/タッチ放し、またはネイティブDnDの dragend/drop でも掃除
            const once = { once: true };
            document.addEventListener('pointerup', cleanup, once);
            document.addEventListener('dragend',   cleanup, once);
            document.addEventListener('drop',      cleanup, once);
        };
        this.containerEl.addEventListener('pointerdown', this._onPointerDownForGhost, { capture: true });
        this.calendarUI = new CalendarUI(this);
    }
    
    
    ensureDndHandle(cell) {
        if (!cell.querySelector(':scope > .dnd-handle')) {
            const h = document.createElement('span');
            h.className = 'dnd-handle';
            cell.appendChild(h);
        }
    }

    _installHandles() {
        const rows = this.containerEl.querySelectorAll('tr.fc-event:not([data-draggable="false"])');
        rows.forEach(row => {
            row.querySelectorAll('td').forEach(cell => this.ensureDndHandle(cell));
        })
    }

    /** 透明ハンドルとゴースト & Draggable をまとめて有効化 */
    enableDragAndDrop() {
        if (this._dndEnabled) return;
        this._dndEnabled = true;

        this._installHandles();

        // Draggable 作成（すでにあればスキップ）
        if (!this._draggable) {
            const Draggable = FullCalendar.Draggable;
            this._draggable = new Draggable(this.containerEl, {
                itemSelector: '.dnd-handle',
                eventData: (handleEl) => {
                    const row = handleEl.closest('tr.fc-event');
                    const manHours = Number(row.getAttribute('data-man-hour') || 0);
                    const h = String(Math.floor(manHours/60)).padStart(2,'0');
                    const m = String(manHours%60).padStart(2,'0');
                    return {
                        id: row.getAttribute('data-plan-id'),
                        duration: `${h}:${m}`,
                        extendedProps: {
                            title:        row.getAttribute('data-work-name'),
                            machineName:  row.getAttribute('data-control-name'),
                            weekOfDay: labelForAttrValue(
                                'data-plan-week-of-day',
                                row.getAttribute('data-plan-week-of-day')
                            ),
                            monthAndWeek: row.getAttribute('data-week'),
                            man_hours:    manHours,
                            planStatus:   row.getAttribute('data-status'),
                            inspectionNo: row.getAttribute('data-plan-inspection-no'),
                        },
                    };
                },
            });
        }

        // FullCalendar 側も有効化
        this.myCalendar.setOption('editable',  true);
        this.myCalendar.setOption('droppable', true);
    }

    /** 透明ハンドルとゴースト & Draggable をまとめて無効化 */
    
    disableDragAndDrop() {
        if (!this._dndEnabled) return;
        this._dndEnabled = false;

        // ゴースト掃除
        if (this._dragGhost?.parentNode) this._dragGhost.parentNode.removeChild(this._dragGhost);
        this._dragGhost = null;
        if (this._dragMoveHandler) {
            document.removeEventListener('pointermove', this._dragMoveHandler);
            this._dragMoveHandler = null;
        }
        document.body.classList.remove('hide-fc-mirror');

        // pointerdown を解除
        if (this._onPointerDownForGhost) {
            this.containerEl.removeEventListener('pointerdown', this._onPointerDownForGhost, { capture: true });
            this._onPointerDownForGhost = null;
        }

        // ハンドルを撤去（必要なら）
        this.containerEl.querySelectorAll('.dnd-handle').forEach(h => h.remove());

        // Draggable は破棄（存在する場合）
        if (this._draggable && typeof this._draggable.destroy === 'function') {
            this._draggable.destroy();
            this._draggable = null;
        }

        // FullCalendar 側も無効化
        this.myCalendar.setOption('editable',  false);
        this.myCalendar.setOption('droppable', false);
    }
    

    _moveGhost(e) {
        if (!this._dragGhost) return;
            this._dragGhost.style.transform = `translate(${e.pageX + 12}px, ${e.pageY + 12}px)`;
    }
    
    _buildGhost(row) {
        const title   = row.getAttribute('data-work-name') || '';
        const machine = row.getAttribute('data-control-name') || '';
        const man     = row.getAttribute('data-man-hour') || '';
        const dowRaw     = row.getAttribute('data-plan-week-of-day') || '';

        const dowLabel = labelForAttrValue('data-plan-week-of-day', dowRaw);
    
        const g = document.createElement('div');
        g.className = 'drag-ghost';
        g.innerHTML = `
          <div class="ghost-title">${machine}: ${title} (${dowLabel})</div>
          <div class="ghost-meta">工数 ${man}分</div>
        `;
        return g;
    }

    destroyCalendar() {
        if(this.myCalendar) {
            this.myCalendar.removeAllEvents();
            this.myCalendar.removeAllEventSources();
            this.myCalendar.destroy(); 
        }
    };
}

class CalendarUI {
    constructor(calendar) {
        this.calendar = calendar
        this.calendarColumnManager = new calendarColumnManager();
        this.myCalendar = this.calendar.myCalendar;
        this.isCalendarRendered = this.calendar.isCalendarRendered;
        this.state = {
            memberTimeRange: {
                start: null,
                end: null,
            }
        }
        this.hydrate();
        this.initializeFilterUI();
        this.initializeDrawerStack();
        this.tableMangerSetup();
        this.tableManager.initializeRowMapFromSSR()
        this.dropdownMangerSetup();
        this.tableManager.applyRowParityClasses();
        this.setupFilterAreaInteraction();
        this._weekReqSeq = 0;

    }

    initializeFilterUI() {
        const memberSelect = document.getElementById('memberSelect');
    
        applyMemberOptionsVisibility(memberSelect, {
            mode: 'team',
            team: this.teamSelect,
            showDefault: true
        });
    }

    setMemberTimeRange(range) {
        this.state.memberTimeRange = {
          ...this.state.memberTimeRange,
          ...range
        };
      }

    hydrate() {
        const ssr = UtilityManager.readJSONSafe("ssr-initialSelections") ?? {};
        this.teamSelect = ssr.team_name ?? ""
        this.daySelect = ssr.day_of_week != null ? String(ssr.day_of_week) : ""
    }

    handleToggleRowState({ element, checked, type }) {
        if (type !== 'toggle') return;
      
        const row = element.closest('tr');
        if (!row) return;
      
        this.updateRowState(row, checked);
    }

    initializeDrawerStack() {
        this.$root =
            document.querySelector('[data-ui-root="drawer"]')
    
        if (!this.$root) {
            console.warn('[InspectionStandards] root not found');
            return;
        }

        const stackEl = document.querySelector('[data-drawer-stack]');
        if (!stackEl) return;

        const toggleHandler = this.handleToggleRowState.bind(this);
      
        // rootEl は「ページ全体」を渡すのが一般的（スクロール抑止などのclass付与に使う）
        this.drawers = new DrawerStack({
            stackEl,
            rootEl: this.$root,
            rootClassBase: 'page',
            enableEscapeClose: true,
            side: 'left',
            order: ['cell', 'detail'],
            actionsByPanel: {
              cell: {
                'toggle-register': toggleHandler,

                'toggle-pullback': toggleHandler,
          
                'open-plan-detail': ({ payload, type }) => {
                  if (type !== 'click') return;
          
                  this.openPlanDetail({
                    inspectionNo: payload.inspectionNo ?? '',
                    workName: payload.workName ?? '',
                    keepCellOpen: true,
                  });
                },

                'bulkRegister': async ({ type }) => {
                    if (type !== 'click') return;
                    await this.handleBulkRegisterAction();
                },

                'bulkPullback': async ({ type }) => {
                    if (type !== 'click') return;
                    await this.handleBulkPullbackExecuteAction();
                },


              },
            },
        });

    }

    collectEnabledDrawerRows() {
        const cell = this.drawers?.panel('cell');
        const tableEl = cell?.tableEl;
        if (!tableEl) return [];
      
        return Array.from(tableEl.querySelectorAll('tbody tr'))
          .filter((row) => !row.classList.contains('is-disabled'));
    }
      
    collectEnabledDrawerDatasetValues(datasetKey) {
      return this.collectEnabledDrawerRows()
        .map((row) => row.dataset?.[datasetKey])
        .filter(Boolean);
    }

    collectDrawerRegistrationDateTime() {
        const cell = this.drawers?.panel('cell');
        if (!cell) return null;
    
        const root = cell.tableTopEl;
        if (!root) return null;
    
        const startDate = root.querySelector('[data-role="start-date"]')?.value ?? '';
        const startTime = root.querySelector('[data-role="start-time"]')?.value ?? '';
        const endDate = root.querySelector('[data-role="end-date"]')?.value ?? '';
        const endTime = root.querySelector('[data-role="end-time"]')?.value ?? '';
    
        const dateStart = startDate && startTime ? `${startDate}T${startTime}` : '';
        const dateEnd = endDate && endTime ? `${endDate}T${endTime}` : '';
    
        return {
            dateStart,
            dateEnd,
        };
    }

    async applyRegistrationResult(data, { member }) {
        const planIds = data.events.plan_ids_list;
        const count = Number(data.events.count || 0);
        const manHours = Number(data.events.man_hours || 0);
    
        this.tableManager.removeRowsByIds(planIds);
        updateAfterRegistration(manHours, count, 'sub');
        await this.updateCalendar(member);
    }

    openPlanDetail({ inspectionNo = '', workName = '', keepCellOpen = false } = {}) {
        if (!this.drawers) {
            console.warn('[CalendarUI] drawers not initialized');
            return;
        }
    
        const detail = this.drawers.panel('detail');
        if (!detail) return;
    
        if (keepCellOpen) {
            this.drawers.openPanels(['cell', 'detail']);
        } else {
            this.drawers.openPanels(['detail']);
        }
    
        const detailTitle = `${inspectionNo} / ${workName}`;
    
        detail.setTitle('読み込み中');
        detail.clearBody();
        detail.showBody?.();
    
        this._loadInspectionCardDetail({
            inspectionNo,
            detailTitle,
            panelKey: 'detail',
        }).catch((e) => {
            console.error(e);
            detail.setTitle(`カードNo: ${inspectionNo}（エラー）`);
            detail.setBodyHtml('<p class="drawer__placeholder">読み込みに失敗しました</p>');
            detail.showBody?.();
        });
    }

    updateRowState(row, isActive) {
        row.classList.toggle('is-disabled', !isActive);
    }

    setupFilterAreaInteraction() {
        const filterArea = document.getElementById('filterarea');

        let openTimer = null;
        let isOpen = false;

        const cleanupInside = () => {
            const active = document.activeElement;
            if (active && filterArea.contains(active)) active.blur();
            filterArea.querySelectorAll('select').forEach(sel => sel.blur());
            filterArea.querySelectorAll('details[open]').forEach(d => d.removeAttribute('open'));
        };


        const close = () => {
            if (!isOpen) return;
            isOpen = false;
            filterArea.classList.remove('is-open');
            UIManger.hideOverlay();
            cleanupInside();
        };

        const open = () => {
            if (isOpen) return;
            isOpen = true;
            filterArea.classList.add('is-open');
        
            // overlay 表示（外側クリックで close）
            UIManger.showOverlay({
                zIndex: 20,
                opacity: 0.25,
                closeOnClick: true,
                onClick: () => close(),
                lockScroll: false,
            });

            // ★ ここが重要：open直後は overlay のクリック受け付けを一時的に無効化
            //   → overlay 出現で pointerleave が直発火するのを防ぐ
            const overlayEl = document.getElementById('screenDim');
            if (overlayEl) {
                overlayEl.style.pointerEvents = 'none';
                // 次フレーム以降に短時間だけ待ってから有効化
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        overlayEl.style.pointerEvents = 'auto';
                    }, 120); // 100～150ms 目安
                });
            }
        };

        // --- イベント登録 ---
        //hover-intent：pointerenter 後すぐ開かず、わずかに遅延させると誤発火が減る
        filterArea.addEventListener('pointerenter', () => {
            if (openTimer) clearTimeout(openTimer);
            openTimer = setTimeout(open, 80);  // 0でも可。80ms程度で安定
        });

        //pointerleave で閉じる
        filterArea.addEventListener('pointerleave', () => {
            if (openTimer) { clearTimeout(openTimer); openTimer = null; }
            close();
        });
    }

    
    updateConfirmButtonState() {
        if (isValidDate(this.startInput.value) && isValidDate(this.endInput.value)) {
            this.confirmButton.classList.remove('is-disabled');
        } else {
            this.confirmButton.classList.add('is-disabled');
        }
    };
    
    collectVisibleExternalEventRows() {
        if (!this.tableManager) return [];
        return this.tableManager.extractVisibleRowDatasets([
            'planId',
            'planInspectionNo',
            'controlName',
            'workName',
            'period',
            'manHour',
        ]);
    }

    resetRegistrationModalUI() {
        const modal   = document.getElementById('registrationModal');
        if (!modal) return;
      
        // フォーム部品を表示に戻す
        modal.querySelector('.registration-modal__row')?.classList.remove('display-none');
        modal.querySelector('.modal-actions')?.classList.remove('display-none');
      
        // “登録中”パネルを消す（あれば）
        const busy = modal.querySelector('#registrationBusy');
        if (busy) busy.remove();  // 再オープンで必ず白紙から
      
        // 入力を初期化
        this.startInput?.setAttribute('value', '');
        this.endInput?.setAttribute('value', '');
        if (this.startInput) this.startInput.value = '';
        if (this.endInput)  this.endInput.value  = '';
      
        // 確認ボタンを初期状態へ
        if (this.confirmButton) {
            this.confirmButton.classList.add('is-disabled');
            this.confirmButton.disabled = true;
        }
      
        // 内部フラグも解放
        this._regBusy = false;
    }
    
    openRegistrationModal = () => {
        const modal = document.getElementById('registrationModal');
        const memberSelect = document.getElementById('memberSelect');

        this.resetRegistrationModalUI();

        // ★ 先にオーバレイON（モーダルz-index=1000前提：overlayは下の900）
        UIManger.showOverlay({
            zIndex: 200,
            opacity: 0.35,
            closeOnClick: true,                  
            onClick: () => closeRegistrationModal(),
            lockScroll: true,
        });
    
        UIManger.toggleClass(modal, 'display-none', 'remove');
    
        const selectedOption = memberSelect.options[memberSelect.selectedIndex];
        if (!selectedOption) {
            console.warn('No member selected');
            return;
        }
    
        const shiftStart = selectedOption.dataset.shiftStartTime;
        const shiftEnd = selectedOption.dataset.shiftEndTime;
    
        if (shiftStart) this.startInput.value = shiftStart;
        if (shiftEnd) this.endInput.value = shiftEnd;
    
        this.updateConfirmButtonState();

        // ★ キャンセルボタンでも閉じる
        const cancelBtn = document.getElementById('registrationCancelButton');
        cancelBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeRegistrationModal();
        }, { once: true });
    }

    // ★ 閉じ関数（オーバレイとモーダルを同期して閉じる）
    closeRegistrationModal = () => {
        const modal = document.getElementById('registrationModal');
        if (!modal) return;
        
        this.resetRegistrationModalUI();

        modal.classList.add('display-none');
        UIManger.hideOverlay();
      
        // ネイティブUIの取りこぼし対策
        const active = document.activeElement;
        if (active && modal.contains(active)) active.blur();
    }

    _openPlanDetailFromRow(rowEl) {
        const inspectionNo = rowEl.dataset.planInspectionNo ?? '';
        const workName = rowEl.dataset.workName ?? '';
    
        this.openPlanDetail({
            inspectionNo,
            workName,
            keepCellOpen: false,
        });
    }

    
    async _loadInspectionCardDetail({ inspectionNo, detailTitle, panelKey = 'detail' }) {
        const panel = this.drawers?.panel(panelKey);
        if (!panel) return;
    
        try {
            const res = await fetchInspectionCardDetail({ inspectionNo });
            const inspectionManHour = res.plan.check.man_hours;
    
            const title = `${detailTitle} ${inspectionManHour}分`;
            const vm = buildPlanDetailCardsVM(res, { title });
            const html = renderPlanDetailCardsHTML(vm);
    
            panel.showBody?.();
            panelBinder.setTitle(panel.titleEl, vm.title);
            panelBinder.setBodyHTML(panel.bodyEl, html);
        } catch (e) {
            console.error(e);
            panelBinder.showError(panel.titleEl, panel.bodyEl);
            panel.showBody?.();
        }
    }

    tableMangerSetup() {
        const tableId = "myTable"
        this.overlayTable = document.getElementById('cardDetailSpinner');
        const onRowClick = (rowEl) => {
            this._openPlanDetailFromRow(rowEl);
        }
        this.tableManager = new TableManager(tableId, {
            onRowClick,
            'isDraggable': false,
            'isDisplayNone': true,
            'addClass': ['fc-event'],
            'filterRunner': 'standard'
        }, null, this.calendarColumnManager);
        this.statusConfig = this.calendarColumnManager.statusConfig();
        this._toggleColumnVisible('label' ,'')
    }

    _toggleColumnVisible(property, value) {
        const statusColumnsConfig = Object.values(this.statusConfig).find(config => config[property] === value) || null;
        this.tableManager.toggleColumnVisible(statusColumnsConfig.columnsStyle);
        return statusColumnsConfig
    }

    destroyCalendarInstance() {
        this.calendar.destroyCalendar();
    }

    updateCalendar = async (memberName) => {
        const defaultCalendarLabel = document.getElementById('calendarLabel');
        UIManger.toggleClass(defaultCalendarLabel, 'display-none', 'add');
        try {
            const data = await asynchronousCommunication({
                url: '/calendar/',
                method: 'POST',
                data: {
                    action: "calendar_open",
                    member: memberName
                }
            });
            
            const memberStartTime = data.member_start_time;
            const iso = toDateTimeLocalString(memberStartTime);
            let date = '', time = '';
            if (iso?.includes('T')) [date, time] = iso.split('T');


            if (!this.isCalendarRendered) {
                this.isCalendarRendered = true;
                if (date) this.myCalendar.gotoDate(date);
                if (time) this.myCalendar.setOption('scrollTime', time);

                this.myCalendar.render();
                this.myCalendar.addEventSource(data.events);        
            } else {
                this.myCalendar.batchRendering(() => {
                    this.myCalendar.removeAllEventSources();
                    this.myCalendar.removeAllEvents();
                    this.myCalendar.addEventSource(data.events);
                });
                this.myCalendar.render();
                requestAnimationFrame(() => {
                    if (date) this.myCalendar.gotoDate(date);
                    if (time) {
                        this.myCalendar.setOption('scrollTime', time);
                        this.myCalendar.updateSize();
                    }
                });
            }

            updateBarWidthAndPercentage(data.events);

        } catch (err) {
            console.error('[onMemberChange] failed:', err)
        }
    };

    validateBulkRegisterCondition() {
        const states = this.dropdownManger?.getDropdownStates([
            'inspectionTypeSelect',
            'daySelect',
        ]) ?? {};
    
        const inspectionTypeValue = states.inspectionTypeSelect?.value ?? '';
        const dayValue = states.daySelect?.value ?? '';
    
        const isInspectionTypeAll = inspectionTypeValue === '';
        const isDailyInspection = inspectionTypeValue === '日常点検';
        const isDayAll = dayValue === '';
    
        if ((isInspectionTypeAll || isDailyInspection) && isDayAll) {
            return {
                ok: false,
                message: '点検種類が全て又は日常点検時に曜日を全てでの一括登録はできません。',
            };
        }
    
        return { ok: true };
    }

    showBulkRegisterValidationMessage(message) {
        ModalManger.showModal(`<p>${message}</p>`, 'default', true);
    }
    
    dropdownMangerSetup() {
        const itemSelector = "#external-events tr"
        this.dropdowns= {
            teamSelect:      { attr: 'data-affilation', hideByUnique: true, persistOnDataReplace: true, keepSelectionEvenIfMissing: true },
            inspectionTypeSelect: { attr: 'data-check-status',  hideByUnique: true},
            lineSelect:      { attr: 'data-line', hideByUnique: true  },
            machineSelect:   { attr: 'data-control-name', hideByUnique: true  },
            periodSelect:    { attr: 'data-period', hideByUnique: true  },
            daySelect:       { attr: 'data-plan-week-of-day', hideByUnique: true, persistOnDataReplace: true, keepSelectionEvenIfMissing: true },
            timezoneSelect:  { attr: 'data-time-zone', hideByUnique: true }, 
        }

        this.dropdownManger = new dropdownManger(this.dropdowns, this.tableManager, itemSelector, '', { globalShowCount: false });
        this.dropdownManger.initDropdownsWithAttributes();
        this.dropdownManger.bootstrap({
            initialSelections: {
                teamSelect: this.teamSelect ?? '',
                daySelect: String(this.daySelect ?? ''),
            }
        });

        updateTotalsFromUI();

        ['teamSelect', 'inspectionTypeSelect', 'lineSelect', 'machineSelect', 'periodSelect', 'daySelect', 'timezoneSelect'].forEach(id => {
            this.dropdownManger.setChangeListener(id, this.refreshTableViewAfterFilter);
        });


        this.dropdownManger.setChangeListener("weekSelect", async (e) => {
            await this.reloadTableBySelectedWeek();
        });

        this.dropdownManger.setChangeListener("memberSelect", this.onMemberChange.bind(this));
    }

    async reloadTableBySelectedWeek() {
        const weekSelect = document.getElementById('weekSelect');
        const week = weekSelect?.value ?? '';
        const reqId = ++this._weekReqSeq;
    
        if (weekSelect) {
            weekSelect.disabled = true;
        }
    
        this.tableManager.clearTable();
    
        UIManger.toggleClass(this.overlayTable, 'display-none', 'remove');
        UIManger.showSpinner({
            container: '#cardDetailSpinner',
            id: 'cardSpinner',
            size: 'lg',
        });
    
        try {
            const payload = await fetchPlanRows({ week });
    
            if (reqId !== this._weekReqSeq) return;
    
            this.tableManager.replaceRows(payload.rows);
            this.calendar._installHandles();
    
            this.dropdownManger.syncAfterDataReplace();
    
            try {
                updateTotalsFromUI();
            } catch {}
        } catch (err) {
            console.error('[reloadTableBySelectedWeek] api/plans error:', err);
        } finally {
            if (weekSelect) {
                weekSelect.disabled = false;
            }
            UIManger.hideSpinner({ id: 'cardSpinner' });
            UIManger.toggleClass(this.overlayTable, 'display-none', 'add');
        }
    }

    async reloadCalendarBySelectedMember() {
        const selected = getSelectedMember();
    
        if (selected && !selected.isPlaceholder && selected.loginNumber) {
            this.setMemberTimeRange(selected.shift);
    
            this.destroyCalendarInstance?.();
            await this.updateCalendar(selected.loginNumber);
    
            this.calendar.enableDragAndDrop?.();
            this.isCalendarRendered = true;
        } else {
            this.destroyCalendarInstance?.();
            this.isCalendarRendered = false;
    
            this.setMemberTimeRange({ start: null, end: null });
    
            const defaultCalendarLabel = document.querySelector('.noneDisplay');
            UIManger.toggleClass(defaultCalendarLabel, 'display-none', 'remove');
            resetUIValues?.();
        }
    }

    refreshTableViewAfterFilter = () => {
        this.dropdownManger.refreshAll();
        this.tableManager.applyRowParityClasses();
        updateTotalsFromUI();
      };

    async onMemberChange() {
        if (this._memberBusy) return;
        this._memberBusy = true;
    
        clearTimeout(this._memberDebounce);
        this._memberDebounce = setTimeout(async () => {
            try {
                UIManger.showSpinner({ container: '#calendar', id: 'calSpinner', size: 'lg' });
    
                await this.reloadCalendarBySelectedMember();
            } catch (err) {
                console.error('[onMemberChange] failed:', err);
            } finally {
                this.setupBulkActionButtons?.();
                UIManger.hideSpinner({ id: 'calSpinner' });
                this._memberBusy = false;
            }
        }, 120);
    }

    setupBulkActionButtons = (() => {
        let isInitialized = false;
      
        return () => {
          if (isInitialized) return;
          isInitialized = true;
      
          this.bindBulkActionButton({
            buttonId: 'buttonRegistration',
            mode: 'register',
          });
      
          this.bindBulkActionButton({
            buttonId: 'buttonPullback',
            mode: 'pullback',
          });
        };
    })();

    bindBulkActionButton({ buttonId, mode }) {
        const buttonEl = document.getElementById(buttonId);
        if (!buttonEl) return;
    
        UIManger.toggleClass(buttonEl, 'disable-events', 'remove');
    
        buttonEl.addEventListener('click', async (e) => {
            e.preventDefault();
    
            switch (mode) {
                case 'register':
                    this.openBulkRegistrationDrawer();
                    break;
    
                case 'pullback':
                    await this.handleBulkPullbackAction();
                    break;
    
                default:
                    console.warn(`[CalendarUI] unknown bulk action mode: ${mode}`);
            }
        });
    }

    openBulkRegistrationDrawer() {
        const validation = this.validateBulkRegisterCondition();
        if (!validation.ok) {
            this.showBulkRegisterValidationMessage(validation.message);
            return;
        }

        const range = this.state?.memberTimeRange ?? {};
        const start = splitDateTimeLocal(range.start ?? '');
        const end = splitDateTimeLocal(range.end ?? '');
    
        if (!this.drawers) {
            console.warn('[CalendarUI] drawers not initialized yet');
            return;
        }
    
        const cell = this.drawers.panel('cell');
        if (!cell) return;
        cell.setWide(true);
    
        this.drawers.openPanels(['cell']);
    
        cell.setTitle('読み込み中…');
        cell.showEmpty('データを読み込んでいます…');
        cell.clearTable();
        cell.showTable?.();
    
        const rows = this.collectVisibleExternalEventRows();
    
        if (!rows.length) {
            cell.setTitle('一括登録');
            cell.showEmpty('該当するデータがありません。');
            cell.clearTable();
            return;
        }
    
        const vm = buildRegistrationDrawerTableVM(rows, { title: '一括登録' });
        const html = renderGenericTableHTML(vm, {
            emptyText: '該当するデータがありません。',
        });
    
        cell.setTitle(vm.title);
        cell.hideEmpty();
    
        const topHtml = renderRegistrationDrawerTop({
            startDate: start.date ?? '',
            startTime: start.time ?? '',
            endDate: end.date ?? '',
            endTime: end.time ?? '',
        });
    
        cell.setTableTopHtml(topHtml);
        cell.showTableTop?.();
        cell.setTableHtml(html);
        this.tableManager.applyRowParityClasses(cell.tableEl);
        cell.showTable?.();
    }

    

    getBulkActionConfig(mode) {
        const range = this.state?.memberTimeRange ?? {};
        const start = splitDateTimeLocal(range.start ?? '');
        const end = splitDateTimeLocal(range.end ?? '');
      
        const configs = {
          register: {
            emptyTitle: '一括登録',
            collectRows: this.collectVisibleExternalEventRows,
            buildVM: (rows) => buildRegistrationDrawerTableVM(rows, { title: '一括登録' }),
            renderTopHtml: () => renderRegistrationDrawerTop({
              startDate: start.date ?? '',
              startTime: start.time ?? '',
              endDate: end.date ?? '',
              endTime: end.time ?? '',
            }),
          },
      
          pullback: {
            emptyTitle: '一括引戻し',
            collectRows: () => [],
            buildVM: (rows) => buildPullbackDrawerTableVM(rows, { title: '一括引戻し' }), // 後で作る
            renderTopHtml: null, // 必要なら後で追加
          },
        };
      
        return configs[mode] ?? null;
    };

    async runDrawerBulkAction({
        title = '処理中…',
        sub = 'しばらくお待ちください',
        action,
    } = {}) {
        if (this._drawerBulkBusy) return;
    
        this.enterDrawerBulkBusyState({ title, sub });
    
        try {
            return await action();
        } finally {
            this.leaveDrawerBulkBusyState();
        }
    }

    enterDrawerBulkBusyState({
        title = '処理中…',
        sub = 'しばらくお待ちください',
        size = 'lg',
    } = {}) {
        const cell = this.drawers?.panel('cell');
        if (!cell) return;
    
        const baseEl = cell.tableWrapEl || cell.bodyEl || cell.el;
        const container = baseEl?.closest('.drawer__body') || cell.el;
        if (!container) return;
    
        this._drawerBulkBusy = true;
    
        if (cell.tableEl) {
            cell.tableEl.style.pointerEvents = 'none';
        }
        if (cell.tableTopEl) {
            cell.tableTopEl.style.pointerEvents = 'none';
        }
    
        UIManger.showSpinner({
            container,
            id: 'drawerBulkSpinner',
            size,
            title,
            sub,
        });
    }
    
    leaveDrawerBulkBusyState() {
        const cell = this.drawers?.panel('cell');
        if (!cell) return;
    
        this._drawerBulkBusy = false;
    
        if (cell.tableEl) {
            cell.tableEl.style.pointerEvents = '';
        }
        if (cell.tableTopEl) {
            cell.tableTopEl.style.pointerEvents = '';
        }
    
        UIManger.hideSpinner({ id: 'drawerBulkSpinner' });
    }

    showBulkRegisterRangeValidationMessage() {
        ModalManger.showModal('<p>開始時間と終了時間を12時間以内にして下さい</p>', 'red', true);
    }

    isRangeWithinTwelveHours(range) {
        if (!range?.dateStart || !range?.dateEnd) return false;

        const start = new Date(range.dateStart);
        const end = new Date(range.dateEnd);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return false;
        }

        const diffMs = end.getTime() - start.getTime();
        const maxMs = 12 * 60 * 60 * 1000;

        return diffMs > 0 && diffMs <= maxMs;
    }

    async handleBulkRegisterAction() {
        const validation = this.validateBulkRegisterCondition();
        if (!validation.ok) {
            this.showBulkRegisterValidationMessage(validation.message);
            return;
        }


        const { loginNumber } = getSelectedMember() ?? {};
        if (!loginNumber) {
            console.warn('[CalendarUI] member is not selected');
            return;
        }
    
        const range = this.collectDrawerRegistrationDateTime();
        if (!range?.dateStart || !range?.dateEnd) {
            console.warn('[CalendarUI] registration datetime is invalid');
            return;
        }

        if (!this.isRangeWithinTwelveHours(range)) {
            this.showBulkRegisterRangeValidationMessage();
            return;
        }
    
        const dataPlanIds = this.collectEnabledDrawerDatasetValues('planId');
        if (!dataPlanIds.length) {
            console.warn('[CalendarUI] no enabled rows to register');
            return;
        }
    
        try {
            await this.runDrawerBulkAction({
                title: '登録中…',
                sub: 'カードを一括登録しています',
                action: async () => {
                    const data = await fetchRegistration({
                        dateStart: range.dateStart,
                        dateEnd: range.dateEnd,
                        dataPlanIds,
                        member: loginNumber,
                    });
    
                    await this.applyRegistrationResult(data, { member: loginNumber });
                    this.drawers.openPanels([]);
                },
            });
        } catch (err) {
            console.error('[handleBulkRegisterAction] failed:', err);
        }
    }

    async handleBulkPullbackExecuteAction() {
        const planIds = this.collectEnabledDrawerDatasetValues('planId');
        if (!planIds.length) {
            console.warn('[CalendarUI] no enabled pullback rows');
            return;
        }
    
        try {
            await this.runDrawerBulkAction({
                title: '引戻し中…',
                sub: '配布済みのカードを引戻しています',
                action: async () => {
                    const data = await executeBulkPullback({
                        planIds,
                    });
    
                    await this.applyPullbackResult(data);
                    this.drawers.openPanels([]);
                },
            });
        } catch (err) {
            console.error('[handleBulkPullbackExecuteAction] failed:', err);
        }
    }

    async applyPullbackResult(_data) {
        await this.reloadTableBySelectedWeek();
        await this.reloadCalendarBySelectedMember();
    }


    async handleBulkPullbackAction() {
        const { loginNumber } = getSelectedMember() ?? {};
        if (!loginNumber) {
            console.warn('[CalendarUI] member is not selected');
            return;
        }
    
        if (!this.drawers) {
            console.warn('[CalendarUI] drawers not initialized yet');
            return;
        }
    
        const cell = this.drawers.panel('cell');
        if (!cell) return;
    
        cell.setWide(true);
        this.drawers.openPanels(['cell']);
    
        cell.setTitle('読み込み中…');
        cell.showEmpty('データを読み込んでいます…');
        cell.clearTable();
        cell.showTable?.();
    
        try {
            const data = await fetchMemberAssignedPlans({
                member: loginNumber,
            });
    
            const rows = Array.isArray(data?.rows) ? data.rows : [];
    
            if (!rows.length) {
                cell.setTitle('一括引戻し');
                cell.clearTableTop?.();
                cell.hideTableTop?.();
                cell.showEmpty('引戻し対象のデータがありません。');
                cell.clearTable();
                return;
            }
    
            const vm = buildPullbackDrawerTableVM(rows, {
                title: '一括引戻し',
            });
    
            const html = renderGenericTableHTML(vm, {
                emptyText: '引戻し対象のデータがありません。',
            });
    
            cell.setTitle(vm.title);
            cell.hideEmpty();
    
            const topHtml = renderPullbackDrawerTop();
            cell.setTableTopHtml(topHtml);
            cell.showTableTop?.();
    
            cell.setTableHtml(html);
            this.tableManager.applyRowParityClasses(cell.tableEl);
            cell.showTable?.();
    
        } catch (err) {
            console.error('[handleBulkPullbackAction] failed:', err);
            cell.setTitle('一括引戻し');
            cell.clearTableTop?.();
            cell.hideTableTop?.();
            cell.showEmpty('データの取得に失敗しました。');
            cell.clearTable();
        }
    }

    async handleSinglePullbackAction(detail) {
        const message = `
            <div class="modal__actionRow">
                <div id="modalMessage" class="modal__message">
                    <p>${detail.monthAndWeek}(${detail.weekOfDay}) ${detail.machineName}(${detail.title})を引き戻しますか？</p>
                </div>
                <div class="modal__actionSlot"></div>
            </div>
            `;
    
    
        return new Promise((resolve, reject) => {
            let isSubmitting = false;
            let pullBackButton = null;
    
            const setSubmittingState = (submitting) => {
                if (!pullBackButton) return;
    
                if (submitting) {
                    pullBackButton.classList.add('is-disabled', 'loading');
                    pullBackButton.setAttribute('aria-disabled', 'true');
                    pullBackButton.disabled = true;
                    pullBackButton.innerHTML = `
                        <span class="loading-text">実行中</span>
                        <span class="spinner spinner--sm" aria-hidden="true"></span>
                    `;
                    return;
                }
    
                pullBackButton.classList.remove('is-disabled', 'loading');
                pullBackButton.removeAttribute('aria-disabled');
                pullBackButton.disabled = false;
                pullBackButton.textContent = '実行';
            };
    
            const onConfirm = async (e) => {
                e?.preventDefault?.();
    
                if (isSubmitting) return;
                isSubmitting = true;
                setSubmittingState(true);
    
                try {
                    const data = await executePullback({
                        planId: detail.planId,
                    });
    
                    await this.applySinglePullbackResult(data);
    
                    UIManger.removeElement('#pullBackButton');
                    ModalManger.closeModal();
                    ModalManger.showModal('success', 'green', true);
    
                    resolve(data);
                } catch (err) {
                    isSubmitting = false;
                    setSubmittingState(false);
                    reject(err);
                }
            };
    
            ModalManger.showModal(message, 'default', false, () => {
                UIManger.removeElement('#pullBackButton');
            });
    
            pullBackButton = UIManger.addActionElement(
                '.modal__actionSlot',
                'a',
                'ui-btn ui-btn--sm ui-btn--primary',
                'pullBackButton',
                '実行',
                onConfirm
            );
    
            // addActionElement 内で click を付けるなら、ここで addEventListener は不要
        });
    }
    
    async applySinglePullbackResult(_data) {
        await this.reloadTableBySelectedWeek();
        await this.reloadCalendarBySelectedMember();
    }

}


const updateProgressText = (totalManHoursThisWeek, thisWeekEventsSize) => {
    const necessaryTimeElement = document.getElementById('distributedMinutes');
    const necessaryTime = parseInt(necessaryTimeElement.textContent, 10);
    necessaryTimeElement.textContent = `${necessaryTime + totalManHoursThisWeek}分`;
    
    const thisWeekTotalCardElement =  document.getElementById('distributedCards');
    const thisWeekTotalCard = parseInt(thisWeekTotalCardElement.textContent, 10);
    thisWeekTotalCardElement.textContent = `${thisWeekTotalCard + thisWeekEventsSize}枚`;
}

const updateBarWidthAndPercentage = (events) => {
    resetUIValues();
    const stats = calculateEventStats(events);
    updateProgressText(stats.totalManHoursThisWeek, stats.thisWeekEventsSize, stats.totalManHoursLate, stats.lateEventsSize);
}

const calculateEventStats = (events) => {
    const thisWeekEvents = events.filter(event => event.extendedProps.planStatus==='実施待ち');
    const totalManHoursThisWeek = thisWeekEvents.reduce((total, event) => total + event.extendedProps.man_hours, 0);
    const thisWeekEventsSize = thisWeekEvents.length;

    const lateEvents = events.filter(event => event.extendedProps.planStatus === '遅れ');
    const totalManHoursLate = lateEvents.reduce((total, event) => total + event.extendedProps.man_hours, 0);
    const lateEventsSize = lateEvents.length;

    return {
        totalManHoursThisWeek,
        thisWeekEventsSize,
        totalManHoursLate,
        lateEventsSize
    };
};

const resetUIValues = () => {
    document.getElementById('distributedCards').textContent = "0枚";
    document.getElementById('distributedMinutes').textContent = "0分";
};

const updateAfterRegistration = (registeredManHours, registeredCount, mode='sub') => {
    const countEl = document.getElementById('totalCount');
    const manHourEl = document.getElementById('manHours');

    const currMins = parseFloat(manHourEl.dataset.count);
    const currCount = parseFloat(countEl.dataset.count);

    const sign = mode === 'add' ? +1 : -1;

    //マイナス防止
    let nextCount = currCount + sign * (Number(registeredCount)   || 0);
    let nextMins  = currMins  + sign * (Number(registeredManHours) || 0);

    if (manHourEl) {
        manHourEl.dataset.count = String(nextMins);
        manHourEl.textContent   = `${nextMins}分`;
    }
    if (countEl) {
        countEl.dataset.count = String(nextCount);
        countEl.textContent   = `${nextCount}枚`;
    }
};


document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen();
    new Calendar();    
});



