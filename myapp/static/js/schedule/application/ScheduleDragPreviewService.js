export class ScheduleDragPreviewService {
  constructor() {
    this.dragPreview = null;
    this.sourceEl = null;
    this.isFloatingPreview = false;
  }

  start(sourceEl) {
    if (!sourceEl) {
      return;
    }

    this.reset();

    const sourceType = sourceEl?.dataset?.dragSource ?? 'schedule-event';

    if (sourceType === 'test-card') {
      this.startTestCardPreview(sourceEl);
      return;
    }

    this.startSourceElementPreview(sourceEl);
  }

  startSourceElementPreview(sourceEl) {
    this.sourceEl = sourceEl;
    this.dragPreview = sourceEl;
    this.isFloatingPreview = false;

    this.dragPreview.classList.add('is-dragging');
  }

  startTestCardPreview(sourceEl) {
    const sourceRect = sourceEl.getBoundingClientRect();
    const titleText = this.getTestCardTitleText(sourceEl);

    const previewEl = document.createElement('div');
    previewEl.className =
      'schedule-drag-preview schedule-drag-preview--test-card is-dragging';
    previewEl.setAttribute('aria-hidden', 'true');

    const titleLineEl = document.createElement('div');
    titleLineEl.className = 'detail-card__titleLine';
    titleLineEl.textContent = titleText;

    previewEl.appendChild(titleLineEl);

    previewEl.style.left = `${sourceRect.left}px`;
    previewEl.style.top = `${sourceRect.top}px`;
    previewEl.style.width = `${Math.min(sourceRect.width, 360)}px`;

    document.body.appendChild(previewEl);

    sourceEl.classList.add('is-dragging-source');

    this.sourceEl = sourceEl;
    this.dragPreview = previewEl;
    this.isFloatingPreview = true;
  }

  getTestCardTitleText(sourceEl) {
    const titleLineEl = sourceEl.querySelector('.detail-card__titleLine');
    const titleText = titleLineEl?.textContent?.trim();

    if (titleText) {
      return titleText;
    }

    const workName = sourceEl?.dataset?.workName ?? '';
    const manHours = sourceEl?.dataset?.manHours ?? '';

    return [workName, manHours ? `${manHours}分` : '']
      .filter(Boolean)
      .join('_') || 'テストカード';
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
      this.sourceEl?.classList.remove('is-dragging-source');
      this.sourceEl = null;
      this.isFloatingPreview = false;
      return;
    }

    if (this.isFloatingPreview) {
      this.dragPreview.remove();
      this.sourceEl?.classList.remove('is-dragging-source');
    } else {
      this.dragPreview.classList.remove('is-dragging');
      this.dragPreview.style.transform = '';
    }

    this.dragPreview = null;
    this.sourceEl = null;
    this.isFloatingPreview = false;
  }
}