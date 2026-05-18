import {
  executeScheduleEventMove,
  executeScheduleBulkEventMove,
  executeScheduleEventRetract,
  executeScheduleBulkEventRetract,
} from '../../../api/fetchers.js';

import { ScheduleFeedbackPresenter } from '../../ui/ScheduleFeedbackService.js';

export class ScheduleEditCommitService {
  constructor({
    captureScrollPosition,
    finalizeCommit,
    finalizeRetract,
    resetDragInteraction,
  }) {
    this.captureScrollPosition = captureScrollPosition;
    this.finalizeCommit = finalizeCommit;
    this.finalizeRetract = finalizeRetract;
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

  async commitBulkMove({
    payloads = [],
    successMessage = '一括移動を完了しました',
    failureMessage = '一括移動に失敗しました。',
  } = {}) {
    if (!Array.isArray(payloads) || payloads.length === 0) {
      console.warn('[ScheduleEditCommitService] bulk move payloads are invalid');
      return false;
    }
  
    const preservedScroll = this.captureScrollPosition?.();
  
    try {
      await executeScheduleBulkEventMove({
        payloads,
      });
  
      await this.finalizeCommit?.({
        committedEditEvent: null,
        preservedScroll,
        keepDragPreviewUntilRender: false,
      });
  
      await ScheduleFeedbackPresenter.showSaveSuccess(successMessage);
  
      return true;
    } catch (error) {
      console.error('[bulk range move commit failed]:', error);
      await ScheduleFeedbackPresenter.showSaveError(failureMessage);
  
      return false;
    }
  }

  async commitBulkRetract({
    planIds = [],
    successMessage = '一括引き戻しを完了しました',
    failureMessage = '一括引き戻しに失敗しました。',
  } = {}) {
    if (!Array.isArray(planIds) || planIds.length === 0) {
      console.warn('[ScheduleEditCommitService] bulk retract planIds are invalid');
      return false;
    }
  
    const preservedScroll = this.captureScrollPosition?.();
  
    try {
      await executeScheduleBulkEventRetract({
        planIds,
      });
  
      await this.finalizeRetract?.({
        preservedScroll,
      });
  
      await ScheduleFeedbackPresenter.showSaveSuccess(successMessage);
  
      return true;
    } catch (error) {
      console.error('[bulk range retract failed]:', error);
  
      await ScheduleFeedbackPresenter.showSaveError(
        error?.message || failureMessage
      );
  
      return false;
    }
  }

  async commitRetract({
    payload,
    successMessage = '引き戻しを完了しました',
    failureMessage = '引き戻しに失敗しました。',
  } = {}) {
    if (!payload?.planId) {
      console.warn('[ScheduleEditCommitService] retract payload is invalid');
      return false;
    }

    const preservedScroll = this.captureScrollPosition?.();

    try {
      await executeScheduleEventRetract(payload);

      await this.finalizeRetract?.({
        preservedScroll,
      });

      await ScheduleFeedbackPresenter.showSaveSuccess(successMessage);

      return true;
    } catch (error) {
      console.error('[edit retract failed]:', error);
      await ScheduleFeedbackPresenter.showSaveError(failureMessage);

      return false;
    }
  }
}