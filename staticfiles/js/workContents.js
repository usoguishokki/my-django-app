import { asynchronousCommunication } from './asyncCommunicator.js';
import { UIManger } from './UIManger.js';
import { ModalManger } from './ModalManger.js'
import { TableManager } from './TableManger.js'
import { dropdownManger } from './dropdownbox.js'

class workContents {
    constructor(tableId) {
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
        }


        this.tableManager = new TableManager(tableId, {
            conditionFunction,
            onRowDoubleClick
        });
        
        //this.tableManager.setupTable();
        this.filterButton = document.getElementById('openModal');
        this.overlayWindow = document.getElementById('overlayWindow');
        this.mask = document.getElementById('mask');
        this.closeOverlayButton = document.getElementById('closeOverlayButton');
        this.filterButtonClickHandler = this.showOverlay.bind(this);
        this.closeOverlayButtonClickHandler = this.hideOverlay.bind(this);

        this.table = document.getElementById(tableId);
        this.tableScroll = document.getElementById('tableScroll');
        this.holderSelect = document.getElementById('holderSelect');
        //ドロップダウンとそれに対応する列のセレクタをオブジェクトで定義
        this.dropdowns = {
            'statusSelect' : '#myTable .status-row',
            'resultSelect': '#myTable .result-row',
            'applicantSelect': '#myTable .applicant-row',
            'approverSelect': '#myTable .approver-row',
        };
        this.dropdownManger = new dropdownManger(this.dropdowns, this.tableManager);
        this.tableManager.options.filterPattern = 'filterVisbledRow'
        this.init()
    }

    init() {
        this.adjustTableScrollHeight();
        this.tableManager.setupResizers();
        this.setupButtons();
        this.setupFilterButton();
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
    
    adjustTableScrollHeight() {
        const childGrid = document.getElementById('workContents');
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
    }

    createMessage(message) {
        return message
    }

    async handleButtonClick(button) {
        let cardStatus = '';
        //ボタンのテキスト取得
        const buttonText = button.textContent;

        //ボタンが属する行を
        const row = button.closest('tr');

        const statusCell = row.querySelector('.status-row');
        const statusText = statusCell.textContent.trim();

        //行からID番号を持つtd要素を取得
        const idCell = row.querySelector('.id-row');
        const idText = idCell.textContent;

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

        //必要なパラメータを準備
        const params = {
            url: '/workContents/',
            method: 'POST',
            data: {
                action: 'fetch_approval_or_rejection',
                planId: idText,
                planStatus: cardStatus,
                planComment: textValue,
            }
        };
        //共通の非同期処理関数を呼び出す
        const response = await this.performAsynchronousOperation(params);
        //サーバからの応答に基づいて行を削除またはステータス更新
        this.handleServerResponse(response);
    }

    setupFilterButton() {
        this.filterButton.removeEventListener('click', this.filterButtonClickHandler);
        this.closeOverlayButton.removeEventListener('click', this.closeOverlayButtonClickHandler);

        this.filterButton.addEventListener('click', this.filterButtonClickHandler);
        this.closeOverlayButton.addEventListener('click', this.closeOverlayButtonClickHandler);
    }

    showOverlay() {
        this.overlayWindow.classList.add('show');
        this.mask.style.display = 'block';
    }

    hideOverlay() {
        this.overlayWindow.classList.remove('show');
        this.mask.style.display = 'none';
    }

    findTableRowByPlanId(planId) {
        return this.table.querySelector(`tr[data-plan-id="${planId}"]`)
    }

    removeTableRow(row) {
        row?.remove();
    }

    updateTableRow(row, status, comment) {
        const statusElement = row.querySelector('.status-row');
        if (statusElement !== null) {
            statusElement.textContent = status;
        }

        const commentElement = row.querySelector('.comment-row textarea');
        if (commentElement !== null) {
            commentElement.value = comment;
        }
    }

    handleServerResponse = ({ planId, planStatus, planComment }) => {
        const row = this.findTableRowByPlanId(planId);
        if (planStatus === '完了') {
            UIManger.toggleClass(row, 'hidden', 'add');
            ModalManger.showModal('success', 'green', true)
        } else if (planStatus === '差戻し') {
            this.updateTableRow(row, planStatus, planComment);
            UIManger.toggleClass(row, 'hidden', 'add');
        }
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
    new workContents('myTable');
});