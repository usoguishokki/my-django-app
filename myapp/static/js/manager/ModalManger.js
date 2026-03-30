import { UIManger } from '../manager/UIManger.js';

export class ModalManger {
    static myModal = null;
    static modalContent = null;

    static initializeModal() {
        this.myModal = document.getElementById('myModal');
        this.modalContent = this.myModal
            ? this.myModal.querySelector('.modal__content')
            : null;
    }

    static ensureInitialized() {
        if (!this.myModal || !this.modalContent) {
            this.initializeModal();
        }

        if (!this.modalContent) {
            console.warn('モーダルが初期化されていません。');
            return false;
        }

        return true;
    }

    static getOrCreateModalMessage() {
        let modalMessage = document.getElementById('modalMessage');

        if (!modalMessage) {
            modalMessage = document.createElement('div');
            modalMessage.id = 'modalMessage';
            modalMessage.className = 'modal__message';
            this.modalContent.appendChild(modalMessage);
        }

        return modalMessage;
    }

    static resetModalContentClass() {
        if (!this.modalContent) return;
        this.modalContent.className = 'modal__content';
    }

    static openModalWithColor(color = 'default') {
        this.resetModalContentClass();
        this.modalContent.classList.add(`modal__content--${color}`);
        this.myModal.style.display = 'block';
    }

    static bindCloseButton(onClose = () => {}) {
        const closeSpan = this.myModal?.querySelector('.close');
        if (!closeSpan) return;

        closeSpan.onclick = () => this.closeModal(onClose);
    }

    /**
     * 通知用モーダル
     * @param {string} message
     * @param {string} color
     * @param {boolean} autoClose
     * @param {Function} onClose
     */
    static async showModal(message, color = 'default', autoClose = false, onClose = () => {}) {
        if (!this.ensureInitialized()) return;

        const modalMessage = this.getOrCreateModalMessage();

        if (message === 'success') {
            message = '処理が完了しました。';
        }

        modalMessage.innerHTML = message;

        this.openModalWithColor(color);
        this.bindCloseButton(onClose);

        if (autoClose) {
            setTimeout(() => {
                this.closeModal(onClose);
            }, 1700);
        }
    }

    /**
     * 確認用モーダル
     * @param {Object} args
     * @param {string} args.message
     * @param {string} [args.color='default']
     * @param {string} [args.confirmText='OK']
     * @param {string} [args.cancelText='キャンセル']
     * @returns {Promise<boolean>}
     */
    static showConfirmModal({
        message,
        color = 'default',
        confirmText = 'OK',
        cancelText = 'キャンセル',
    }) {
        return new Promise((resolve) => {
            if (!this.ensureInitialized()) {
                resolve(false);
                return;
            }
    
            const modalMessage = this.getOrCreateModalMessage();
    
            modalMessage.innerHTML = `
                <div class="modal__confirmBody">
                    <div class="modal__confirmMessage">${message}</div>
                    <div class="modal__confirmActions">
                        <button
                            type="button"
                            class="modal__confirmBtn modal__confirmBtn--ok"
                            data-role="modal-confirm-ok"
                        >
                            ${UIManger.escapeHtml(confirmText)}
                        </button>
                        <button
                            type="button"
                            class="modal__confirmBtn modal__confirmBtn--cancel"
                            data-role="modal-confirm-cancel"
                        >
                            ${UIManger.escapeHtml(cancelText)}
                        </button>
                    </div>
                </div>
            `;
    
            this.openModalWithColor(color);
    
            const finish = (result) => {
                this.closeModal();
                resolve(result);
            };
    
            const closeSpan = this.myModal?.querySelector('.close');
            if (closeSpan) {
                closeSpan.onclick = () => finish(false);
            }
    
            const okButton = modalMessage.querySelector('[data-role="modal-confirm-ok"]');
            const cancelButton = modalMessage.querySelector('[data-role="modal-confirm-cancel"]');
    
            okButton?.addEventListener('click', () => finish(true), { once: true });
            cancelButton?.addEventListener('click', () => finish(false), { once: true });
        });
    }

    /**
     * モーダルを閉じる
     * @param {Function} onClose
     */
    static closeModal(onClose = () => {}) {
        if (!this.myModal || !this.modalContent) return;

        this.myModal.style.display = 'none';
        this.resetModalContentClass();

        const modalMessage = document.getElementById('modalMessage');
        if (modalMessage) {
            modalMessage.innerHTML = '';
        }

        onClose();
    }

    static apiLoadingOverlayShow() {
        document.querySelector('.api-loading')?.classList.add('api-loading--visible');
        document.querySelector('.api-loading')?.classList.remove('api-loading--hidden');
    }

    static apiLoadingOverlayHide() {
        document.querySelector('.api-loading')?.classList.add('api-loading--hidden');
        document.querySelector('.api-loading')?.classList.remove('api-loading--visible');
    }
}