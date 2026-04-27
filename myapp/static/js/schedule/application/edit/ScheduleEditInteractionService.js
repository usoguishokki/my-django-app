export class ScheduleEditInteractionService {
    constructor({
      editSummaryService,
      editMemberDropdownService,
      dragPreviewService,
      dragTimeIndicatorService,
      dragTargetHighlighter,
      getScheduleContainer,
      getSelectedDate,
      getVisibleHours,
      onBindDateTimeEvents,
      onSyncSubmitButton,
    }) {
      this.editSummaryService = editSummaryService;
      this.editMemberDropdownService = editMemberDropdownService;
      this.dragPreviewService = dragPreviewService;
      this.dragTimeIndicatorService = dragTimeIndicatorService;
      this.dragTargetHighlighter = dragTargetHighlighter;
      this.getScheduleContainer = getScheduleContainer;
      this.getSelectedDate = getSelectedDate;
      this.getVisibleHours = getVisibleHours;
      this.onBindDateTimeEvents = onBindDateTimeEvents;
      this.onSyncSubmitButton = onSyncSubmitButton;
    }

    syncPendingTarget({ pendingEditEvent, isMemberWeekView }) {
        const scheduleContainer = this.getScheduleContainer?.();
      
        this.dragTargetHighlighter.sync({
          scheduleContainer,
          memberId: isMemberWeekView
            ? ''
            : pendingEditEvent?.memberId ?? '',
          dayKey: isMemberWeekView
            ? pendingEditEvent?.planDate ?? ''
            : '',
        });
    }

    startDragPreview(sourceEl) {
        if (!sourceEl) {
          return;
        }
      
        this.dragTimeIndicatorService.reset();
        this.dragPreviewService.start(sourceEl);
        this.onSyncSubmitButton?.();
    }
      
    moveDragPreview(dragState) {
      if (!dragState) {
        return;
      }

      this.dragPreviewService.move({
        startClientX: dragState.startClientX,
        startClientY: dragState.startClientY,
        currentClientX: dragState.currentClientX,
        currentClientY: dragState.currentClientY,
      });
    }
  
    syncSelected({ selectedEditEvent, pendingEditEvent }) {
      this.editSummaryService.syncBefore(selectedEditEvent);
      this.editSummaryService.syncAfter(pendingEditEvent);
      this.editMemberDropdownService.sync();
  
      this.onBindDateTimeEvents?.();
      this.onSyncSubmitButton?.();
    }
  
    syncPending({ pendingEditEvent, isMemberWeekView = false }) {
        const scheduleContainer = this.getScheduleContainer?.();
      
        this.editSummaryService.syncAfter(pendingEditEvent);
        this.editMemberDropdownService.sync();
      
        this.dragTimeIndicatorService.sync({
          scheduleContainer,
          selectedDate: this.getSelectedDate?.(),
          pendingEditEvent,
          visibleHours: this.getVisibleHours?.(),
        });
      
        this.syncPendingTarget({
          pendingEditEvent,
          isMemberWeekView,
        });
      
        this.onSyncSubmitButton?.();
    }
  
    resetDrag() {
        const scheduleContainer = this.getScheduleContainer?.();
      
        this.dragPreviewService.reset();
        this.dragTimeIndicatorService.reset();
        this.dragTargetHighlighter.reset(scheduleContainer);
      }
      
    resetPending({ selectedEditEvent }) {
      this.resetDrag();
    
      if (selectedEditEvent) {
        this.editSummaryService.syncAfter(selectedEditEvent);
      } else {
        this.editSummaryService.resetAll();
      }
    
      this.editMemberDropdownService.sync();
      this.onSyncSubmitButton?.();
    }
    
    resetEdit() {
      this.resetDrag();
      this.editSummaryService.resetAll();
      this.onSyncSubmitButton?.();
    }
  }