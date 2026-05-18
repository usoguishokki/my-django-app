import { ScheduleRangeSelectionResolver } from '../domain/ScheduleRangeSelectionResolver.js';

export class ScheduleRangeSelectionManager {
  constructor({
    rootEl,
    canStartSelection,
    getScheduleContainer,
    getSelectedDate,
    getSelectedMemberId,
    getVisibleHours,
    getMoveSourceRange,
    onSelectionComplete,
    onMoveComplete,
    onMovePreview,
    onMoveCancel,
  }) {
    this.rootEl = rootEl;
    this.canStartSelection = canStartSelection;
    this.getScheduleContainer = getScheduleContainer;
    this.getSelectedDate = getSelectedDate;
    this.getSelectedMemberId = getSelectedMemberId;
    this.getVisibleHours = getVisibleHours;
    this.getMoveSourceRange = getMoveSourceRange;
    this.onSelectionComplete = onSelectionComplete;
    this.onMoveComplete = onMoveComplete;
    this.onMovePreview = onMovePreview;
    this.onMoveCancel = onMoveCancel;

    this.selectionState = null;
    this.moveState = null;
    this.selectedRange = null;
    this.blockEl = null;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
  }

  bind() {
    if (!this.rootEl) {
      return;
    }

    this.rootEl.addEventListener('pointerdown', this.handlePointerDown);
  }

  destroy() {
    if (this.rootEl) {
      this.rootEl.removeEventListener('pointerdown', this.handlePointerDown);
    }

    this.unbindWindowEvents();
    this.reset();
  }

  handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    if (
      typeof this.canStartSelection === 'function'
      && !this.canStartSelection({ event })
    ) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (!target) {
      return;
    }

    const rangeBlock = target.closest('.time-schedule__rangeSelectionBlock.is-final');

    if (rangeBlock && rangeBlock === this.blockEl) {
      this.startMove(event);
      return;
    }

    if (this.isBlockedTarget(target)) {
      return;
    }

    const gridEl = target.closest('.time-schedule__grid');

    if (!gridEl) {
      return;
    }

    const scheduleContainer = this.getScheduleContainer?.();

    if (!scheduleContainer?.contains(gridEl)) {
      return;
    }

    const columnEl = ScheduleRangeSelectionResolver.resolveColumnByClientX({
      scheduleContainer,
      clientX: event.clientX,
    });

    if (!columnEl) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.reset();

    this.selectionState = {
      pointerId: event.pointerId,
      gridEl,
      columnEl,
      startClientY: event.clientY,
      currentClientY: event.clientY,
    };

    this.ensureBlock(gridEl);
    this.updateSelectionBlock(event.clientY);

    this.bindWindowEvents();
  }

  startMove(event) {
    if (!this.blockEl || !this.selectedRange) {
      return;
    }
  
    const gridEl = this.blockEl.closest('.time-schedule__grid');
  
    if (!gridEl) {
      return;
    }
  
    const sourceRange =
      this.getMoveSourceRange?.({
        selectedRange: this.selectedRange,
      })
      ?? this.selectedRange;
  
    this.applyRangeToBlock(sourceRange);
    this.selectedRange = sourceRange;
  
    const gridRect = gridEl.getBoundingClientRect();
  
    const pointerOffsetY = ScheduleRangeSelectionResolver.clamp(
      event.clientY - gridRect.top - sourceRange.topPx,
      0,
      sourceRange.heightPx
    );
  
    event.preventDefault();
    event.stopPropagation();
  
    this.moveState = {
      pointerId: event.pointerId,
      gridEl,
      sourceRange,
      pointerOffsetY,
      heightPx: sourceRange.heightPx,
    };
  
    this.blockEl.classList.add('is-moving');
  
    this.bindWindowEvents();
  }

  handlePointerMove(event) {
    if (
      this.moveState
      && event.pointerId === this.moveState.pointerId
    ) {
      event.preventDefault();
      this.updateMoveBlock(event);
      return;
    }

    if (
      !this.selectionState
      || event.pointerId !== this.selectionState.pointerId
    ) {
      return;
    }

    event.preventDefault();

    this.selectionState = {
      ...this.selectionState,
      currentClientY: event.clientY,
    };

    this.updateSelectionBlock(event.clientY);
  }

  handlePointerUp(event) {
    if (
      this.moveState
      && event.pointerId === this.moveState.pointerId
    ) {
      this.completeMove(event);
      return;
    }

    if (
      !this.selectionState
      || event.pointerId !== this.selectionState.pointerId
    ) {
      return;
    }

    const completedRange = this.buildRange(event.clientY, {
      requireMinHeight: true,
    });

    this.unbindWindowEvents();

    if (!completedRange) {
      this.reset();
      return;
    }

    const adjustedRange =
    this.onSelectionComplete?.(completedRange) ?? completedRange;
  
    this.applyRangeToBlock(adjustedRange);
    this.blockEl?.classList.add('is-final');
  
    this.selectedRange = adjustedRange;
    this.selectionState = null;
  }

  handlePointerCancel(event) {
    if (
      this.moveState
      && event.pointerId === this.moveState.pointerId
    ) {
      this.unbindWindowEvents();
      this.moveState = null;
      this.blockEl?.classList.remove('is-moving');
      this.onMoveCancel?.();
      return;
    }

    if (
      !this.selectionState
      || event.pointerId !== this.selectionState.pointerId
    ) {
      return;
    }

    this.unbindWindowEvents();
    this.reset();
  }

  updateSelectionBlock(currentClientY) {
    const range = this.buildRange(currentClientY, {
      requireMinHeight: false,
    });

    if (!range) {
      return;
    }

    this.applyRangeToBlock(range);
  }

  updateMoveBlock(event) {
    const range = this.buildMoveRange(event);
  
    if (!range) {
      this.onMoveCancel?.();
      return;
    }
  
    this.applyRangeToBlock(range);
    this.selectedRange = range;
  
    this.onMovePreview?.({
      sourceRange: this.moveState?.sourceRange ?? null,
      targetRange: range,
    });
  }

  completeMove(event) {
    const targetRange = this.buildMoveRange(event);
    const sourceRange = this.moveState?.sourceRange ?? null;

    this.unbindWindowEvents();

    this.blockEl?.classList.remove('is-moving');
    this.moveState = null;

    if (!sourceRange || !targetRange) {
      return;
    }

    this.applyRangeToBlock(targetRange);
    this.selectedRange = targetRange;

    this.onMoveComplete?.({
      sourceRange,
      targetRange,
    });
  }

  buildRange(currentClientY, { requireMinHeight = false } = {}) {
    if (!this.selectionState) {
      return null;
    }

    return ScheduleRangeSelectionResolver.buildRange({
      startClientY: this.selectionState.startClientY,
      currentClientY,
      gridEl: this.selectionState.gridEl,
      columnEl: this.selectionState.columnEl,
      visibleHours: this.getVisibleHours?.(),
      selectedDate: this.getSelectedDate?.(),
      selectedMemberId: this.getSelectedMemberId?.(),
      requireMinHeight,
    });
  }

  buildMoveRange(event) {
    if (!this.moveState) {
      return null;
    }

    const scheduleContainer = this.getScheduleContainer?.();

    if (!scheduleContainer) {
      return null;
    }

    const columnEl = ScheduleRangeSelectionResolver.resolveColumnByClientX({
      scheduleContainer,
      clientX: event.clientX,
    });

    if (!columnEl) {
      return null;
    }

    const gridRect = this.moveState.gridEl.getBoundingClientRect();

    const rawTopPx =
      event.clientY - gridRect.top - this.moveState.pointerOffsetY;

    const maxTopPx = Math.max(
      0,
      gridRect.height - this.moveState.heightPx
    );

    const topPx = ScheduleRangeSelectionResolver.clamp(
      rawTopPx,
      0,
      maxTopPx
    );

    return ScheduleRangeSelectionResolver.buildRangeFromPixels({
      topPx,
      heightPx: this.moveState.heightPx,
      gridEl: this.moveState.gridEl,
      columnEl,
      visibleHours: this.getVisibleHours?.(),
      selectedDate: this.getSelectedDate?.(),
      selectedMemberId: this.getSelectedMemberId?.(),
    });
  }

  ensureBlock(gridEl) {
    this.blockEl = document.createElement('div');
    this.blockEl.className = 'time-schedule__rangeSelectionBlock';
    gridEl.appendChild(this.blockEl);
  }

  applyRangeToBlock(range) {
    if (!this.blockEl) {
      return;
    }

    this.blockEl.style.top = `${range.topPx}px`;
    this.blockEl.style.left = `${range.leftPx}px`;
    this.blockEl.style.width = `${range.widthPx}px`;
    this.blockEl.style.height = `${range.heightPx}px`;
  }

  reset() {
    this.blockEl?.remove();
    this.blockEl = null;
    this.selectionState = null;
    this.moveState = null;
    this.selectedRange = null;
  }

  isBlockedTarget(target) {
    return Boolean(
      target.closest('[data-role="schedule-event"]')
      || target.closest('[data-role="schedule-test-card"]')
      || target.closest('[data-ui-action]')
      || target.closest('button')
      || target.closest('a')
      || target.closest('input')
      || target.closest('textarea')
      || target.closest('select')
    );
  }

  bindWindowEvents() {
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerCancel);
  }

  unbindWindowEvents() {
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);
  }
}