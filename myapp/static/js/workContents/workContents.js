import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';

import { getCurrentUserName } from '../utils/currentUser.js';


import { UIManger } from '../manager/UIManger.js';
import { ModalManger } from '../manager/ModalManger.js'

import { TableManager } from '../manager/TableManger.js'
import { dropdownManger } from '../manager/dropdownbox.js'

import { workContentsManager } from './workContentsMappingConfig.js';

import { bindUIActions } from '../ui/componets/actions/UIActionDispatcher.js';

import { initializeLoadingScreen } from '../manager/loadingManager.js';

class workContents {
    constructor() {
        this.workContentsManager = new workContentsManager();
        this.table = document.getElementById('myTable');
        this.tableSetup();
    
        this.dropdownMangerSetup();
    
        this.init();
    }

    init() {
        this.adjustTableScrollHeight();
        this.tableManager.setupResizers();
        this.setupButtons();
        this.setupFilterArea();
        this.bindUIActions();
        this.onRowFilters();
        this.updateApproveButtonState();
    
        window.addEventListener('resize', this.adjustTableScrollHeight.bind(this));
    }

    getRowApproverName(row) {
        return row?.dataset?.approver?.trim() || '';
    }
    
    isApproverMismatch(row) {
        const currentUserName = getCurrentUserName();
        const rowApproverName = this.getRowApproverName(row);
    
        if (!currentUserName || !rowApproverName) {
            return false;
        }
    
        return currentUserName !== rowApproverName;
    }

    getApproverMismatchRows(rows) {
        return rows.filter((row) => this.isApproverMismatch(row));
    }
    
    showApproverMismatchConfirm(message) {
        return ModalManger.showConfirmModal({
            message,
            color: 'red',
            confirmText: 'OK',
            cancelText: 'キャンセル',
        });
    }
    
    buildApproverMismatchMessage(row) {
        const currentUserName = getCurrentUserName();
        const rowApproverName = this.getRowApproverName(row);
        const planId = row?.getAttribute('data-plan-id') || '';
    
        return `
            <p>ログインユーザーと承認者が一致していません。</p>
            <p>planId: ${UIManger.escapeHtml(planId)}</p>
            <p>ログインユーザー: ${UIManger.escapeHtml(currentUserName)}</p>
            <p>承認者: ${UIManger.escapeHtml(rowApproverName)}</p>
            <p>このまま実行しますか？</p>
        `;
    }
    
    buildBulkApproverMismatchMessage(mismatchRows) {
        const currentUserName = getCurrentUserName();
    
        return `
            <p>ログインユーザーと承認者が一致しない行が含まれています。</p>
            <p>ログインユーザー: ${UIManger.escapeHtml(currentUserName)}</p>
            <p>不一致件数: ${UIManger.escapeHtml(String(mismatchRows.length))}件</p>
            <p>このまま一括登録を実行しますか？</p>
        `;
    }
    
    async confirmIfApproverMismatch(row) {
        if (!this.isApproverMismatch(row)) {
            return true;
        }
    
        return this.showApproverMismatchConfirm(
            this.buildApproverMismatchMessage(row)
        );
    }
    
    async confirmIfBulkApproverMismatch(rows) {
        const mismatchRows = this.getApproverMismatchRows(rows);
    
        if (mismatchRows.length === 0) {
            return true;
        }
    
        return this.showApproverMismatchConfirm(
            this.buildBulkApproverMismatchMessage(mismatchRows)
        );
    }
    
    
    validateActionTarget(button, row) {
        const buttonText = button.textContent.trim();
        const statusText = row.getAttribute('data-status');
        const idText = row.getAttribute('data-plan-id');
    
        if (
            (buttonText === '承認' || buttonText === '棄却') &&
            statusText !== '承認待ち'
        ) {
            const message = this.createMessage(
                `Error: ID.${idText}のステータスが "承認待ち" 以外です。承認/棄却できません。`
            );
            ModalManger.showModal(message, 'red', true);
            return false;
        }
    
        return true;
    }
    
    resolveCardStatus(buttonText) {
        return buttonText === '棄却' ? '差戻し' : '完了';
    }
    
    buildRowActionData(button) {
        const row = button.closest('tr');
        if (!row) return null;
    
        const buttonText = button.textContent.trim();
        const cardStatus = this.resolveCardStatus(buttonText);
        const idText = row.getAttribute('data-plan-id');
    
        const textarea = row.querySelector('.comment-row textarea');
        const textValue = textarea?.value ?? '';
    
        return {
            row,
            cardStatus,
            textValue,
            dataObj: {
                planId: idText,
                planStatus: cardStatus,
                planComment: textValue,
            },
        };
    }
    
    applyRowState(row, cardStatus, textValue) {
        row.setAttribute('data-status', cardStatus);
        row.setAttribute('data-comment', textValue);
    }

    
    bindUIActions() {
        this._unbindUIActions?.();
        this._unbindUIActions = bindUIActions(document, this.getUIActionHandlers());
    }

    getUIActionHandlers() {
        return {
            rowFilterChange: this.handleRowFilterChange,
        };
    }

    handleRowFilterChange = ({ type }) => {
        if (type !== 'change') return;
        this.onRowFilters();
    };


    updateApproveButtonState() {
        const checkButton = document.getElementById('approveButton');
        const checkButtonSvg = document.getElementById('checkButtonSvg');
        if (!checkButton) return;
    
        const visibleRows = [...this.table.querySelectorAll('tbody tr')]
            .filter(UIManger.isElementVisible);
    
        // 表示行が0件なら inactive
        if (visibleRows.length === 0) {
            UIManger.toggleClass(checkButton, 'active', 'remove');
            if (checkButtonSvg) UIManger.toggleClass(checkButtonSvg, 'active', 'remove');
            checkButton.disabled = true;
            return;
        }
    
        // ★表示中の「全て」が承認待ちか？
        const allApprovalWaiting = visibleRows.every(
            row => row.getAttribute('data-status') === '承認待ち'
        );
    
        UIManger.toggleClass(checkButton, 'active', allApprovalWaiting ? 'add' : 'remove');
        if (checkButtonSvg) {
            UIManger.toggleClass(checkButtonSvg, 'active', allApprovalWaiting ? 'add' : 'remove');
        }
        checkButton.disabled = !allApprovalWaiting;
    }

    async performAsynchronousOperation(params) {
        const response = await asynchronousCommunication(params);
        return response; //応答を返すか、必要に応じて処理続ける
    }
    
    tableSetup() {
        const conditionFunction = (row) => {
            const resultCell = row.querySelector('.result-row');
            if (resultCell && resultCell.textContent.trim() === 'NG') {
                row.classList.add('alarm');
            } else {
                row.classList.remove('alarm');
            }
        };

        const onRowDoubleClick = (row) => {
            const planId = row.getAttribute('data-plan-id');
            const url = UIManger._updateUrlQuery(
                { planId, filterLabel: 'getOne'},
                { base: '/card/', history: false }
            );
            window.location.assign(url.toString());
        };
        
        this.tableManager = new TableManager('myTable', {
            conditionFunction,
            onRowDoubleClick,
            'isDraggable': false
        }, null, this.workContentsManager);

        this.statusConfig = this.workContentsManager.statusConfig();
        this._toggleColumnVisible('label' ,'');
    }

    getInitialDropdownSelections() {
        return {
            statusSelect: this.findInitialStatusValue(),
            approverSelect: this.findInitialApproverValue(),
        };
    }

    findSelectableValue(selectId, targetValue) {
        const select = document.getElementById(selectId);
        if (!select) return '';

        const hasTarget = Array.from(select.options).some(
            (option) => option.value === targetValue
        );

        return hasTarget ? targetValue : '';
    }

    findInitialStatusValue() {
        return this.findSelectableValue('statusSelect', '承認待ち');
    }

    findInitialApproverValue() {
        const employee = document.getElementById('employeeName');
        if (!employee) return '';

        if (employee.dataset.jobTitle !== '班長') {
            return '';
        }

        const userProfile = employee.querySelector('#userProfile');
        return userProfile?.textContent?.trim() || '';
    }


    dropdownMangerSetup() {
        const itemSelector = '#myTable tbody tr';
    
        const dropdownsObj = {
            statusSelect: { attr: 'data-status', hideByUnique: true },
            resultSelect: { attr: 'data-result', hideByUnique: true },
            applicantSelect: { attr: 'data-applicant', hideByUnique: true },
            approverSelect: { attr: 'data-approver', hideByUnique: true },
        };
    
        this.dropdownManger = new dropdownManger(
            dropdownsObj,
            this.tableManager,
            itemSelector,
            null,
            { showCounts: false, countsScope: 'visible' }
        );
    
        this.tableManager.setupDropdownManager(this.dropdownManger);
        this.dropdownManger.initDropdownsWithAttributes();
        this.dropdownManger.bootstrap({
            initialSelections: this.getInitialDropdownSelections(),
        });
    }

    updateRowActionButtonsState() {
        const rows = Array.from(this.table.querySelectorAll('tbody tr'));
    
        rows.forEach((row) => {
            const status = row.getAttribute('data-status') || '';
            const canApprove = status === '承認待ち';
    
            const approveButton = row.querySelector('.btn-approve');
            const rejectButton = row.querySelector('.btn-reject');
    
            this.setRowActionButtonState(approveButton, canApprove);
            this.setRowActionButtonState(rejectButton, canApprove);
        });
    }
    
    setRowActionButtonState(button, enabled) {
        if (!button) return;
    
        button.disabled = !enabled;
        button.setAttribute('aria-disabled', String(!enabled));
    
        UIManger.toggleClass(button, 'is-disabled', enabled ? 'remove' : 'add');
    }

    onRowFilters() {
        this.dropdownManger.refreshAll();
        this.tableManager.applyRowParityClasses();
        this.updateRowActionButtonsState();
        this.updateApproveButtonState();
    }

    _toggleColumnVisible(property, value) {
        const statusColumnsConfig = Object.values(this.statusConfig).find(config => config[property] === value) || null;
        this.tableManager.toggleColumnVisible(statusColumnsConfig.columnsStyle);
        return statusColumnsConfig
    }

    adjustTableScrollHeight() {
        const childGrid = document.getElementById('workcontents');
        const childGridBoxModelDimensions = UIManger.calculateBoxModelDimensions(childGrid, ['paddingTop', 'paddingBottom']);            
        const childUsableDimensions = childGrid.offsetHeight - childGridBoxModelDimensions;
        const tableScroll = document.getElementById('tableScroll');
        const usableRange = `${childUsableDimensions}px`;
        tableScroll.style.height = usableRange;
        tableScroll.style.maxHeight = usableRange;
    }
    
    
    setupButtons() {
        const buttons = document.querySelectorAll('.approve-reject-row button');
        buttons.forEach(button => {
            button.addEventListener('click', () => this.handleButtonClick(button));
        });

        const allCheckButton = document.getElementById('approveButton');
        if (allCheckButton) {
            allCheckButton.addEventListener('click', async () => {
                allCheckButton.disabled = true;
        
                try {
                    await this.handleRegistration();
                } finally {
                    this.updateApproveButtonState();
                }
            });
        }
    }

    extractandUpdateRowData(rows) {
        return rows.map(row => {
            const id = row.getAttribute('data-plan-id');
            const textarea = row.querySelector('textarea');
            const commentValue = textarea.value;

            row.setAttribute('data-status', '完了')
            row.setAttribute('data-comment', commentValue)

            return {
                planId: id,
                planStatus: '完了',
                planComment: commentValue
            }
        })
    }

    getBulkTargetRows() {
        const tableRows = document.querySelectorAll('#myTable tbody tr');
        const visibleRows = [...tableRows].filter(UIManger.isElementVisible);
    
        return visibleRows.filter(
            (row) => row?.getAttribute('data-result') === 'OK'
        );
    }

    async handleRegistration() {
        const targetRows = this.getBulkTargetRows();
    
        if (targetRows.length === 0) {
            return;
        }
    
        const isConfirmed = await this.confirmIfBulkApproverMismatch(targetRows);
        if (!isConfirmed) {
            return;
        }
    
        const rowsData = this.extractandUpdateRowData(targetRows);
        await this.processApprovalOrRejectio(rowsData);
    }

    createMessage(message) {
        return message
    }

    async processApprovalOrRejectio(dataObj) {
        //必要なパラメータを準備
        const params = {
            url: '/workContents/',
            method: 'POST',
            data: {
                action: 'fetch_approval_or_rejection',
                detail: dataObj
            }
        };

        //オーバレイ表示
        //ModalManger.apiLoadingOverlayShow();
        ModalManger.showModal('', 'green', true);

        const modal = document.getElementById('modalMessage');
        if (!modal) {
            console.warn('modalMessage が見つかりません。');
            return;
        }

        let busy = modal.querySelector('#registrationBusy');
        if (!busy) {
            busy = document.createElement('div');
            busy.id = 'registrationBusy';
            busy.className = 'registration-modal__loading';
            busy.innerHTML = `
                <div class="loading-stack">
                    <p class="loading-text">処理中</p>
                    <span class="spinner spinner--md" aria-hidden="true"></span>
                </div>
            `;
        }
        modal.appendChild(busy);
        

        try {
            //共通の非同期処理関数を呼び出す
            const response = await this.performAsynchronousOperation(params);
            //サーバからの応答に基づいて行を削除またはステータス更新
            this.handleServerResponse(response);
        } catch (error) {
            console.error('通信エラー:', error);
        } finally {
            ModalManger.closeModal();
            //ModalManger.apiLoadingOverlayHide();
        }
    }
    

    async handleButtonClick(button) {
        const row = button.closest('tr');
        if (!row) return;
    
        if (!this.validateActionTarget(button, row)) {
            return;
        }
    
        const isConfirmed = await this.confirmIfApproverMismatch(row);
        if (!isConfirmed) {
            return;
        }
    
        const actionData = this.buildRowActionData(button);
        if (!actionData) return;
    
        const { row: targetRow, cardStatus, textValue, dataObj } = actionData;
    
        this.applyRowState(targetRow, cardStatus, textValue);
        await this.processApprovalOrRejectio(dataObj);
    }
    
    setupFilterArea() {
        document.querySelectorAll('.filter-item').forEach(item => {
            UIManger.toggleClass(item, 'hidden', 'add');
        })

        const filterArea = document.getElementById('filterarea');
        if (filterArea) {
            // マウスオーバー時の処理
            filterArea.addEventListener('mouseover', () => {
                const filterItems = document.querySelectorAll('.filter-item');
                filterItems.forEach(item => {
                    UIManger.toggleClass(item, 'hidden', 'remove'); // 非表示を解除
                    UIManger.toggleClass(item, 'visible', 'add'); // 表示を追加
                });
            });

            // マウスリーブ時の処理
            filterArea.addEventListener('mouseleave', () => {
                const filterItems = document.querySelectorAll('.filter-item');
                filterItems.forEach(item => {
                    UIManger.toggleClass(item, 'visible', 'remove'); // 表示を解除
                    UIManger.toggleClass(item, 'hidden', 'add'); // 非表示を追加
                });
            });
        }
    }

    findTableRowByPlanId(planId) {
        return this.table.querySelector(`tr[data-plan-id="${planId}"]`)
    }

    removeTableRow(row) {
        row?.remove();
    }

    handleServerResponse = ({ planId }) => {
        const planIds = Array.isArray(planId) ? planId : [planId]

        planIds.forEach((id) => {
            const row = this.findTableRowByPlanId(id);
            const planStatus = row.getAttribute('data-status')

            if (planStatus === '完了') { 
                this.removeTableRow(row)
            } else if (planStatus === '差戻し') {
                UIManger.toggleClass(row, 'even', 'remove');
                UIManger.toggleClass(row, 'odd', 'remove');
                UIManger.toggleClass(row, 'alarm', 'add');
                UIManger.toggleClass(row, 'display-none', 'add');
            }
        });

        this.updateRowActionButtonsState();
        this.updateApproveButtonState();

        ModalManger.showModal('success', 'green', true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen();
    new workContents();
});