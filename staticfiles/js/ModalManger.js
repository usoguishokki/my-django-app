export class ModalManger {
    static myModal = null;
    static modalContent = null;

    static initializeModal() {
        this.myModal = document.getElementById("myModal");
        this.modalContent = this.myModal ? this.myModal.querySelector('.modal-content') : null;
    }

    /**
     * messageの内容を画面上部に表示する
     * @param {string} message -表示する内容
     * @param {string} color -モーダルの色('default', 'green', 'red', 'blue')
     * @param {boolean} autoClose -モーダルを自動で閉じるかの制御するフラグ
     * @param {Fuction} onClose -モーダルが閉じたときに実行されるコールバック関数
     */


    static async showModal(message, color = 'default', autoClose = false, onClose = () => {}) {
        if (!this.myModal || this.modalContent) {
            this.initializeModal();
        }
        /*
        const myModal = document.getElementById("myModal");
        const modalContent = myModal.querySelector('.modal-content');
        */
        const modalMessage = document.getElementById("modalMessage");
        const closeSpan = document.querySelector(".close");
        const modalDisplayTime = 1700;

        //メッセージ設定
        if (message == 'success') {
            message = '処理が完了しました。'
        }
        modalMessage.innerHTML = message;

        //モーダルの色を設定
        this.modalContent.classList.add(`modal_${color}`);

        //モーダル表示
        this.myModal.style.display = "block";

        //クローズボタンでモーダルを閉じるイベントハンドラー
        closeSpan.onclick = () => this.closeModal(onClose);

        if (autoClose) {
            setTimeout(() => {
                this.closeModal(onClose)
            }, modalDisplayTime);
        }
    }

    /**
     * モーダルを閉じる処理
     * @param {Fuction} onClose -モーダルを閉じた後に呼び出されるコールバック関数
     */
    static closeModal(onClose = () => {}) {
        this.myModal.style.display = "none";
        this.modalContent.className = 'modal-content'
        onClose();
    }
}