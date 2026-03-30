// static/js/ui/components/drawer/DrawerStack.js

import { clamp, setAriaHidden } from './drawerDom.js';
import { DrawerPanel } from './DrawerPanel.js';
import { RootStateSync } from './RootStateSync.js';

export class DrawerStack {
  constructor({
    stackEl,
    rootEl = null,
    order = ['cell', 'plan', 'extra'],
    rootClassBase = 'page',
    onClose = null,
    enableEscapeClose = true,

    side = 'right',
    stackClassBase = 'drawer-stack',
    rootStatePrefix = null,
    actionsByPanel = {},
  }) {
    if (!stackEl) throw new Error('[DrawerStack] stackEl is required');

    this.stackEl = stackEl;
    this.order = Array.isArray(order) ? order : ['cell', 'plan', 'extra'];
    this.onClose = typeof onClose === 'function' ? onClose : null;

    this.side = side;
    this.stackClassBase = stackClassBase;
    this.rootStatePrefix = rootStatePrefix ?? `drawer-${side}`;

    this.actionsByPanel = actionsByPanel;
    this.panels = this._collectPanels(stackEl);

    this.rootSync = new RootStateSync({
      rootEl: rootEl,
      rootClassBase: rootClassBase,
      statePrefix: this.rootStatePrefix,
    });

    this._applyStaticClasses();
    this._bindDelegatedClose();
    if (enableEscapeClose) this._bindEscapeClose();

    // 初期状態を「閉」に正規化
    this.openToLevel(0, { animate: false });
  }

  // -------------------------
  // setup
  // -------------------------
  _applyStaticClasses() {
    this.stackEl.classList.add(this.stackClassBase);
    this.stackEl.classList.add(`${this.stackClassBase}--${this.side}`);
  }

  _collectPanels(stackEl) {
    const map = new Map();
    const panelEls = stackEl.querySelectorAll('[data-panel]');
  
    panelEls.forEach((el) => {
      const key = el.dataset.panel;
  
      const actionsForPanel = this.actionsByPanel?.[key] ?? {};
  
      const p = new DrawerPanel(el, { actions: actionsForPanel });
      map.set(p.key, p);
    });
  
    return map;
  }

  _bindDelegatedClose() {
    this.stackEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="close"]');
      if (!btn) return;

      const panelEl = btn.closest('[data-panel]');
      const key = panelEl?.dataset?.panel;
      if (!key) return;

      // 拡張ポイント
      if (this.onClose) {
        this.onClose({ key, stack: this });
        return;
      }

      // default：押したパネル以降を閉じる
      this.closeFrom(key);
    });
  }

  _bindEscapeClose() {
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.getOpenLevel() === 0) return;
      this.openToLevel(0);
    });
  }

  // -------------------------
  // public API
  // -------------------------
  panel(key) {
    return this.panels.get(key) || null;
  }

  getOpenLevel() {
    let level = 0;
    for (const key of this.order) {
      const p = this.panels.get(key);
      if (!p || !p.isOpen()) break;
      level += 1;
    }
    return level;
  }

  openToLevel(level, { animate = true } = {}) {
    const max = this.order.length;
    const lvl = clamp(level, 0, max);

    this.order.forEach((key, idx) => {
      const p = this.panels.get(key);
      if (!p) return;

      const shouldOpen = idx < lvl;
      if (shouldOpen) p.open({ animate });
      else p.close({ animate });
    });

    // stack自体のaria（必要なら）
    setAriaHidden(this.stackEl, lvl === 0);

    // rootクラス同期
    this.rootSync.sync(lvl, max);
  }

  openPanels(keys = [], { animate = true } = {}) {
    const openSet = new Set(Array.isArray(keys) ? keys : []);
  
    this.order.forEach((key) => {
      const p = this.panels.get(key);
      if (!p) return;
  
      if (openSet.has(key)) {
        p.open({ animate });
      } else {
        p.close({ animate });
      }
    });
  
    const openCount = openSet.size;
  
    setAriaHidden(this.stackEl, openCount === 0);
    this.rootSync.sync(openCount, this.order.length);
  }

  closeFrom(key, { animate = true } = {}) {
    const idx = this.order.indexOf(key);
    if (idx === -1) return;
  
    const remainOpenKeys = this.order.filter((panelKey, panelIdx) => {
      if (panelIdx >= idx) return false; // 指定パネル以降は閉じる
      const panel = this.panels.get(panelKey);
      return panel?.isOpen();
    });
  
    this.openPanels(remainOpenKeys, { animate });
  }

  /**
   * 汎用スケルトン（OCP）
   */
  openSkeleton(
    key,
    { title = '', empty = 'データを読み込んでいます…', level = null } = {}
  ) {
    const p = this.panel(key);
    if (!p) return;

    const idx = this.order.indexOf(key);
    const targetLevel =
      level != null ? level : clamp(idx + 1, 1, this.order.length);

    this.openToLevel(targetLevel);
    if (title) p.setTitle(title);
    p.showEmpty(empty);
    p.clearTable();
    p.clearBody?.();
    p.showTable?.();
  }

  /**
   * 互換API（既存呼び出しを壊さない）
   */
  openCellSkeleton(label = '') {
    this.openSkeleton('cell', {
      title: `${label}（読み込み中…）`,
      empty: 'データを読み込んでいます…',
      level: 1,
    });
  }
}