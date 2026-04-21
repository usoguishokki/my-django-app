export class ScheduleDragManager {
    constructor({
      rootEl,
      canStartDrag,
      onDragStart,
      onDragMove,
      onDrop,
      onCancel,
    }) {
      this.rootEl = rootEl;
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
      const eventEl = event.target.closest('[data-role="schedule-event"]');
      if (!eventEl || !this.rootEl?.contains(eventEl)) {
        return;
      }
  
      if (typeof this.canStartDrag === 'function' && !this.canStartDrag()) {
        return;
      }
  
      // 左クリック/主ポインタのみ
      if (event.button !== 0) {
        return;
      }
  
      event.preventDefault();
      event.stopPropagation();
  
      const planId = eventEl.dataset.planId ?? '';
      const memberId = eventEl.dataset.memberId ?? '';
      const startTime = eventEl.dataset.startTime ?? '';
      const endTime = eventEl.dataset.endTime ?? '';
          
      const sourceRect = eventEl.getBoundingClientRect();
          
      this.dragState = {
        pointerId: event.pointerId,
        sourceEl: eventEl,
        startClientX: event.clientX,
        startClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        sourceOffsetY: event.clientY - sourceRect.top,
        eventData: {
          planId,
          memberId,
          startTime,
          endTime,
        },
      };
  
      if (typeof eventEl.setPointerCapture === 'function') {
        eventEl.setPointerCapture(event.pointerId);
      }
  
      this.bindWindowEvents();
  
      this.onDragStart?.({
        ...this.dragState,
      });
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