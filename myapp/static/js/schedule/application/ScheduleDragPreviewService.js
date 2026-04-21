export class ScheduleDragPreviewService {
    constructor() {
      this.dragPreview = null;
    }
  
    start(sourceEl) {
      if (!sourceEl) {
        return;
      }
  
      this.dragPreview = sourceEl;
      this.dragPreview.classList.add('is-dragging');
    }
  
    move({ startClientX, startClientY, currentClientX, currentClientY }) {
      if (!this.dragPreview) {
        return;
      }
  
      const deltaX = currentClientX - startClientX;
      const deltaY = currentClientY - startClientY;
  
      this.dragPreview.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
  
    reset() {
      if (!this.dragPreview) {
        return;
      }
  
      this.dragPreview.classList.remove('is-dragging');
      this.dragPreview.style.transform = '';
      this.dragPreview = null;
    }
  }