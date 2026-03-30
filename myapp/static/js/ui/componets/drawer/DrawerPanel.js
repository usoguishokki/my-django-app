// static/js/ui/components/drawer/DrawerPanel.js
import { onceAnimationEnd, setAriaHidden, setInert } from './drawerDom.js';
import { bindUIActions } from '../actions/UIActionDispatcher.js';
import { bindToggleEvents } from '../buttons/ToggleButton.js';

export class DrawerPanel {
  constructor(panelEl, { actions = {} } = {}) {
    if (!panelEl) throw new Error('[DrawerPanel] panelEl is required');

    this.el = panelEl;
    this.key = panelEl.dataset.panel;

    this.titleEl = panelEl.querySelector('[data-role="title"]');
    this.emptyEl = panelEl.querySelector('[data-role="empty"]');

    this.tableTopEl = panelEl.querySelector('[data-role="tableTop"]')

    this.tableEl = panelEl.querySelector('[data-role="table"]');
    this.bodyEl = panelEl.querySelector('[data-role="body"]');
    this.tableWrapEl = panelEl.querySelector('.drawer__tableWrap');

    // ★ 一回だけbind（委譲なのでHTML差し替えでも効く）
    this._unbinders = [];
    this._bindInteractions(actions);
  }

  _bindInteractions(actions) {
    const actionRoot = this.el; // panel 全体で受ける
    if (!actionRoot) return;
  
    // Toggle UI（table 内のトグルを対象）
    if (this.tableEl) {
      this._unbinders.push(bindToggleEvents(this.tableEl));
    }
  
    // UI Action dispatch（tableTop / body / table をまとめて拾う）
    this._unbinders.push(bindUIActions(actionRoot, actions));
  }

  destroy() {
    this._unbinders.forEach((fn) => fn?.());
    this._unbinders = [];
  }

  isOpen() {
    return this.el.classList.contains('is-open');
  }

  open({ animate = true } = {}) {
    const wasOpen = this.isOpen();

    this.el.classList.remove('is-closing', 'is-opening');
    this.el.classList.add('is-open');

    setAriaHidden(this.el, false);
    setInert(this.el, false);

    if (animate && !wasOpen) {
      this.el.classList.add('is-opening');
      onceAnimationEnd(this.el, () => {
        this.el.classList.remove('is-opening');
      });
    }
  }

  close({ animate = true } = {}) {
    setAriaHidden(this.el, true);
    setInert(this.el, true);
    this.clearTableTop();
    this.clearBody();
    this.clearTable();
    this.el.classList.remove('is-opening');
    if (!this.isOpen()) {
      this.el.classList.remove('is-closing');
      return;
    }
    if (!animate) {
      this.el.classList.remove('is-open', 'is-closing');
      this.resetViewModifiers();
      return;
    }
    this.el.classList.add('is-closing');

    onceAnimationEnd(this.el, () => {
      this.el.classList.remove('is-open', 'is-closing');
      this.resetViewModifiers();
    });


  }

  // ===== view helpers =====
  setTitle(text) { if (this.titleEl) this.titleEl.textContent = text ?? ''; };
  showEmpty(text) { if (!this.emptyEl) return; this.emptyEl.style.display = 'block'; if (text != null) this.emptyEl.textContent = text; };
  hideEmpty() { if (!this.emptyEl) return; this.emptyEl.style.display = 'none'; };

  setTableTopHtml(html) {
    if (this.tableTopEl) this.tableTopEl.innerHTML = html ?? '';
  }
  
  showTableTop() {
    if (this.tableTopEl) this.tableTopEl.style.display = 'block';
  }
  
  hideTableTop() {
    if (this.tableTopEl) this.tableTopEl.style.display = 'none';
  }
  
  clearTableTop() {
    if (this.tableTopEl) this.tableTopEl.innerHTML = '';
  }



  clearTable() { if (this.tableEl) this.tableEl.innerHTML = ''; }
  setTableHtml(html) { if (this.tableEl) this.tableEl.innerHTML = html ?? ''; }
  showTable() {
    if (this.tableWrapEl) this.tableWrapEl.style.display = 'block';
    if (this.bodyEl) this.bodyEl.style.display = 'none';
    this.hideEmpty();
  }

  clearBody() { if (this.bodyEl) this.bodyEl.innerHTML = ''; }
  setBodyHtml(html) { if (this.bodyEl) this.bodyEl.innerHTML = html ?? ''; }
  showBody() { 
    if (this.tableWrapEl) this.tableWrapEl.style.display = 'none'; 
    if (this.bodyEl) this.bodyEl.style.display = 'block'; this.hideEmpty(); 
  }
  

  setWide(isWide) { this.el.classList.toggle('drawer--wide', !!isWide); };

  /**
   * table に modifier を付ける（例：行クリック無効化など）
   * @param {string|string[]|null} mods 例) 'drawer__table--no-rowclick'
   */
  setTableModifier(mods) {
    if (!this.tableEl) return;

    // このPanelで管理するmodifierだけ掃除（他のクラスを壊さない）
    const managedPrefix = 'drawer__table--';
    [...this.tableEl.classList].forEach((c) => {
      if (c.startsWith(managedPrefix)) this.tableEl.classList.remove(c);
    });

    if (!mods) return;
    const list = Array.isArray(mods) ? mods : [mods];
    list.filter(Boolean).forEach((c) => this.tableEl.classList.add(c));
  }

  
  resetViewModifiers() { 
    this.el.classList.remove('drawer--wide'); 
    this.setTableModifier(null);
  }
}