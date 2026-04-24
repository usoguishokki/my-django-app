import { ModalManger } from '../../manager/ModalManger.js';

export class ScheduleFeedbackPresenter {
  static async showSaveSuccess(message = '登録が完了しました。') {
    await ModalManger.showModal(message, 'success', true);
  }

  static async showSaveError(message = '登録に失敗しました。') {
    await ModalManger.showModal(message, 'danger', false);
  }
}