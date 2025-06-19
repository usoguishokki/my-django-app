import { asynchronousCommunication } from '../asyncCommunicator/asyncCommunicator.js';
import { UIManger } from '../manager/UIManger.js';
import { ModalManger } from '../manager/ModalManger.js'
import { TableManager } from '../manager/TableManger.js'
import { dropdownManger } from '../manager/dropdownbox.js'
import { workContentsManager } from './workContentsMappingConfig.js'

import { initializeLoadingScreen } from '../manager/loadingManager.js';

class workContents {
    constructor() {
        this.workContentsManager = new workContentsManager();
        this.table = document.getElementById('myTable');
        this.tableSetup()

        this.dropdownMangerSetup();
        this.init();
    }

    init() {
        this.adjustTableScrollHeight();
        this.tableManager.setupResizers();
        this.setupButtons();
        this.setupFilterArea()
        this.dropdownManger.setupDropdowns();
        const statusSelectDropdown = document.getElementById('statusSelect');
        statusSelectDropdown.removeEventListener('change', this.handleDropdownChange.bind(this));
        statusSelectDropdown.addEventListener('change', this.handleDropdownChange.bind(this));
        this.tableManager.filterTable();
        window.addEventListener('resize', this.adjustTableScrollHeight.bind(this));
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
            //指定されたplanIdを持つURLへ遷移
            window.location.href = `/card/?planId=${planId}`;
        };
        
        this.tableManager = new TableManager('myTable', {
            conditionFunction,
            onRowDoubleClick,
            'isDraggable': false
        }, null, this.workContentsManager);

        this.statusConfig = this.workContentsManager.statusConfig();
        this._toggleColumnVisible('label' ,'')
    }

    dropdownMangerSetup() {
        //ドロップダウンとそれに対応する列のセレクタをオブジェクトで定義
        const dropdownsObj = {
            'statusSelect' : 'data-status',
            'resultSelect': 'data-result',
            'applicantSelect': 'data-applicant',
            'approverSelect': 'data-approver',
        };

        this.dropdownManger = new dropdownManger(dropdownsObj, this.tableManager);
        this.tableManager.setupDropdownManager(this.dropdownManger);
        this.dropdownManger.setupDropdowns(() => {
            this.onRowFilters();
        })
        this.dropdownManger.updateFilterConditionsFromDropdowns();
    }

    onRowFilters() {
        this.dropdownManger.updateFilterConditionsFromDropdowns();
        this.tableManager.filterTable();
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

        const allCheckButton =  document.getElementById('approveButton');
        allCheckButton.addEventListener('click', () => {
            this.handleRegistration();
            allCheckButton.disabled = true;
        });    
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

    handleRegistration() {
        const tableRows = document.querySelectorAll('#myTable tbody tr');
        const filteredRows = [...tableRows].filter(UIManger.isElementVisible);
        const filtedRows = filteredRows.filter(row => row?.getAttribute('data-result') === 'OK');
        const rowsData = this.extractandUpdateRowData(filtedRows)
        this.processApprovalOrRejectio(rowsData)
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
        //共通の非同期処理関数を呼び出す
        const response = await this.performAsynchronousOperation(params);
        //サーバからの応答に基づいて行を削除またはステータス更新
        this.handleServerResponse(response);
    }

    handleButtonClick(button) {
        let cardStatus = '';
        //ボタンのテキスト取得
        const buttonText = button.textContent;

        //ボタンが属する行を
        const row = button.closest('tr');
        const statusText = row.getAttribute('data-status')
        const idText = row.getAttribute('data-plan-id');

        if ((buttonText === '承認' || buttonText === '棄却') && statusText !== '承認待ち') {
            const message = this.createMessage(`Error: ID.${idText}のステータスが "承認待ち" 以外です。承認/棄却できません。`)
            ModalManger.showModal(message, 'red',true);
            return;
        } else if  (buttonText === '棄却') {
            cardStatus = '差戻し'
        } else {
            cardStatus = '完了'
        }

        //行からtextareaの値の取得
        const textarea = row.querySelector('.comment-row textarea');
        //textareaの値の取得
        const textValue = textarea.value;

        row.setAttribute('data-status', cardStatus)
        row.setAttribute('data-comment', textValue)

        const dataObj = {
            planId: idText,
            planStatus: cardStatus,
            planComment: textValue,
        }

        this.processApprovalOrRejectio(dataObj);
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

        ModalManger.showModal('success', 'green', true);
    }

    handleDropdownChange(event) {
        const dorpdown = event.target;
        const selectedValue = dorpdown.value;
        const checkButton =  document.getElementById('approveButton');
        const checkButtonSvg = document.getElementById('checkButtonSvg');
        if (selectedValue === '承認待ち') {
            UIManger.toggleClass(checkButton, 'active', 'add');
            UIManger.toggleClass(checkButtonSvg, 'active', 'add');
            checkButton.disabled = false;
        } else {
            UIManger.toggleClass(checkButton, 'active', 'remove');
            UIManger.toggleClass(checkButtonSvg, 'active', 'remove');
            checkButton.disabled = true;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeLoadingScreen();
    new workContents();
});