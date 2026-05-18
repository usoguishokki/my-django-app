export class ScheduleDragManager {
  static DEFAULT_SOURCE_SELECTOR = '[data-role="schedule-event"]';

  constructor({
    rootEl,
    sourceSelector = ScheduleDragManager.DEFAULT_SOURCE_SELECTOR,
    canStartDrag,
    onDragStart,
    onDragMove,
    onDrop,
    onCancel,
  }) {
    this.rootEl = rootEl;
    this.sourceSelector = sourceSelector;
    this.canStartDrag = canStartDrag;
    this.onDragStart = onDragStart;
    this.onDragMove = onDragMove;
    this.onDrop = onDrop;
    this.onCancel = onCancel;

    this.dragState = null;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
  }

  bind() {
    if (!this.rootEl) return;

    this.rootEl.addEventListener('pointerdown', this.handlePointerDown);
  }

  destroy() {
    if (this.rootEl) {
      this.rootEl.removeEventListener('pointerdown', this.handlePointerDown);
    }

    this.unbindWindowEvents();
    this.dragState = null;
  }

  handlePointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const sourceEl = target?.closest(this.sourceSelector);

    if (!sourceEl || !this.rootEl?.contains(sourceEl)) {
      return;
    }

    if (
      typeof this.canStartDrag === 'function' &&
      !this.canStartDrag({ sourceEl, event })
    ) {
      return;
    }

    const eventData = this.buildEventData(sourceEl);

    if (!eventData.planId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const sourceRect = sourceEl.getBoundingClientRect();

    this.dragState = {
      pointerId: event.pointerId,
      sourceEl,
      startClientX: event.clientX,
      startClientY: event.clientY,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
      sourceOffsetY: event.clientY - sourceRect.top,
      eventData,
    };

    if (typeof sourceEl.setPointerCapture === 'function') {
      sourceEl.setPointerCapture(event.pointerId);
    }

    this.bindWindowEvents();

    this.onDragStart?.({
      ...this.dragState,
    });
  }

  buildEventData(sourceEl) {
    const dataset = sourceEl?.dataset ?? {};

    return {
      sourceType: dataset.dragSource ?? 'schedule-event',
      planId: dataset.planId ?? '',
      memberId: dataset.memberId ?? '',
      startTime: dataset.startTime ?? '',
      endTime: dataset.endTime ?? '',
      planDate: dataset.dayKey ?? dataset.planDate ?? '',
      durationMinutes: dataset.durationMinutes ?? dataset.manHours ?? '',
      manHours: dataset.manHours ?? '',
      workName: dataset.workName ?? '',
      inspectionNo: dataset.inspectionNo ?? '',
      machineName: dataset.machineName ?? '',
      assignedAffiliationId: dataset.assignedAffiliationId ?? '',
    };
  }

  handlePointerMove(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    this.dragState = {
      ...this.dragState,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
    };

    this.onDragMove?.({
      ...this.dragState,
    });
  }

  handlePointerUp(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    const dragResult = {
      ...this.dragState,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
    };

    this.onDrop?.(dragResult);

    this.unbindWindowEvents();
    this.dragState = null;
  }

  handlePointerCancel(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    this.onCancel?.({
      ...this.dragState,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
    });

    this.unbindWindowEvents();
    this.dragState = null;
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