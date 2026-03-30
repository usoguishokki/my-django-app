// ui/components/ClickCard.js
export class ClickCard {
    constructor({ cardEl, contentSelector = '.click-card__content' }) {
      if (!cardEl) throw new Error('ClickCard: cardEl is required');
  
      this.cardEl = cardEl;
      this.contentEl = cardEl.querySelector(contentSelector);
      if (!this.contentEl) throw new Error(`ClickCard: content element not found: ${contentSelector}`);
  
      this.isOpen = false;
      this.offset = { x: 12, y: 12 };
      this.viewportPadding = 8;
    }
  
    open({ x, y, html }) {
      if (typeof html === 'string') this.contentEl.innerHTML = html;
  
      this._ensureMeasurable();
      this._moveTo(x, y);
  
      this.cardEl.classList.remove('u-hidden');
      this.cardEl.setAttribute('aria-hidden', 'false');
      this.isOpen = true;
    }
  
    close() {
      this.cardEl.classList.add('u-hidden');
      this.cardEl.setAttribute('aria-hidden', 'true');
      this.isOpen = false;
    }
  
    toggle(payload) {
      if (this.isOpen) this.close();
      else this.open(payload);
    }
  
    _ensureMeasurable() {
      // hiddenだとサイズが取れない環境向け：一瞬だけ表示状態にして測る
      if (this.cardEl.classList.contains('u-hidden')) {
        this.cardEl.classList.remove('u-hidden');
        // open() で再表示するので、ここでは “測れる状態” を作るだけ
      }
    }
  
    _moveTo(x, y) {
      const rect = this.cardEl.getBoundingClientRect();
  
      const maxX = window.innerWidth - rect.width - this.viewportPadding;
      const maxY = window.innerHeight - rect.height - this.viewportPadding;
  
      const left = Math.min(x + this.offset.x, maxX);
      const top = Math.min(y + this.offset.y, maxY);
  
      this.cardEl.style.left = `${Math.max(this.viewportPadding, left)}px`;
      this.cardEl.style.top = `${Math.max(this.viewportPadding, top)}px`;
    }
}