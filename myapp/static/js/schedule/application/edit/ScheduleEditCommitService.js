import { executeScheduleEventMove } from '../../../api/fetchers.js';
import { ScheduleFeedbackPresenter } from '../../ui/ScheduleFeedbackService.js';

export class ScheduleEditCommitService {
  constructor({
    captureScrollPosition,
    finalizeCommit,
    resetDragInteraction,
  }) {
    this.captureScrollPosition = captureScrollPosition;
    this.finalizeCommit = finalizeCommit;
    this.resetDragInteraction = resetDragInteraction;
  }

  async commitMove({
    payload,
    committedEditEvent,
    successMessage = '登録を完了しました',
    failureMessage = '登録に失敗しました。',
    keepDragPreviewUntilRender = true,
    resetDragOnFailure = false,
  } = {}) {
    if (!payload) {
      console.warn('[ScheduleEditCommitService] payload is invalid');
      return false;
    }

    const preservedScroll = this.captureScrollPosition?.();
    let isCommitted = false;

    try {
      await executeScheduleEventMove(payload);
      isCommitted = true;

      await this.finalizeCommit?.({
        committedEditEvent,
        preservedScroll,
        keepDragPreviewUntilRender,
      });
      
      await ScheduleFeedbackPresenter.showSaveSuccess(successMessage);
      
      return true;
    } catch (error) {
      console.error('[edit commit failed]:', error);
      await ScheduleFeedbackPresenter.showSaveError(failureMessage);

      return false;
    } finally {
      if (!isCommitted && resetDragOnFailure) {
        this.resetDragInteraction?.();
      }
    }
  }
}