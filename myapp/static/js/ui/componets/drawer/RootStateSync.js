// static/js/ui/components/drawer/RootStateSync.js

import { toggleClass } from './drawerDom.js';

export class RootStateSync {
  constructor({ rootEl, rootClassBase = 'page', statePrefix = 'drawer-right' }) {
    this.rootEl = rootEl ?? null;
    this.base = rootClassBase;
    this.pref = statePrefix; // 'drawer-right' / 'drawer-left'
  }

  sync(level, maxLevel) {
    if (!this.rootEl) return;

    const anyOpen = level > 0;
    const base = this.base;
    const pref = this.pref;

    // side-aware のみ
    toggleClass(this.rootEl, `${base}--${pref}-open`, anyOpen);

    for (let i = 1; i <= maxLevel; i += 1) {
      toggleClass(this.rootEl, `${base}--${pref}-level-${i}`, level === i);
    }
  }
}