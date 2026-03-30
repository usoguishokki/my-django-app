/* ========== Mobile List Skeleton ========== */

const _randW = (i) => {
    const widths = ["skeleton-w-40", "skeleton-w-60", "skeleton-w-80"];
    return widths[i % widths.length];
};



const wait = (ms) => new Promise(r => setTimeout(r, ms));



let _loadingClosing = false;
let _loadingClosed  = false;

/**
 * ローディング画面・表示
 */
export const showLoadingScreen = () => {
    const loading = document.getElementById('loading');
    const parentGrid = document.getElementById('parentGrid');
    if (!loading || !parentGrid) return;

    loading.style.display = '';
    loading.classList.remove('loading-hidden');
    loading.classList.add('loading-active');

    parentGrid.style.visibility = 'hidden';

    _loadingClosed = false;
}

/**
 * ローディング画面・非表示(app:ready で呼ぶ)
 */
export const hideLoadingScreen = () => {
    const loading = document.getElementById('loading');
    const parentGrid = document.getElementById('parentGrid');
    if (!loading || !parentGrid) return;
    if (_loadingClosing || _loadingClosed) return;

    _loadingClosing = true;

    loading.classList.remove('loading-active');
    loading.classList.add('loading-hidden');
  
    setTimeout(() => {
        loading.style.display = 'none';
        parentGrid.style.visibility = 'visible';
        _loadingClosed = true;
        _loadingClosing = false;
    }, 700);
};


export const resetLoadingState = () => {
    _loadingClosing = false;
    _loadingClosed = false;
};


export const forceHideLoadingScreen = () => {
    const loading = document.getElementById('loading');
    const parentGrid = document.getElementById('parentGrid');
    if (!loading || !parentGrid) return;

    loading.classList.remove('loading-active');
    loading.classList.add('loading-hidden');
    loading.style.display = 'none';
    parentGrid.style.visibility = 'visible';

    _loadingClosing = false;
    _loadingClosed = true;
};



/**
 * 初期化：app:ready を一度だけ待ち、閉じる。
 * ついでに window.load をフェイルセーフで待つ（画像等の読込が遅延しても閉じられるように）。
 */
export const initializeLoadingScreen = () => {
    const loading = document.getElementById('loading');
    const parentGrid = document.getElementById('parentGrid');
    if (!loading || !parentGrid) {
        console.error('ローディング要素が見つかりません');
        return;
    }

    resetLoadingState();
    showLoadingScreen();

    window.addEventListener('app:ready', hideLoadingScreen, { once: true });

    window.addEventListener('load', () => {
        const loading = document.getElementById('loading');
        if (!loading) return;
        if (loading.classList.contains('loading-hidden')) return;
        if (loading.style.display !== 'none') hideLoadingScreen();
    }, { once: true });

    setTimeout(() => {
        if (loading.style.display !== 'none') hideLoadingScreen();
    }, 10000);
};


export const setupLoadingOnLinkClick = (selector = 'a.loading-link') => {
    const loading = document.getElementById('loading');
    if (!loading) return;

    document.querySelectorAll(selector).forEach(anchor => {
        anchor.addEventListener('click', event => {
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || anchor.target === '_blank') return;
            showLoadingScreen();
        });
    });
}
 

/**
 * テーブル用スケルトン行を生成して表示する
 * @param {HTMLTableElement} tableEl
 * @param {{rows?:number, minCols?:number}} options
 */
export function createTableSkeleton(tableEl, { rows = 8, minCols = 1 } = {}) {
    if (!tableEl) return;
    const tbody = tableEl.tBodies?.[0];
    const cols  = tableEl.tHead?.rows?.[0]?.cells?.length || minCols;
    if (!tbody) return;
  
    // 置き換え
    tbody.innerHTML = "";
  
    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");
      tr.className = "skeleton-row";
  
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        td.className = "skeleton-cell";
  
        const block = document.createElement("div");
        // 見た目に変化をつけるため幅をランダム化
        const widths = ["skeleton-w-40", "skeleton-w-60", "skeleton-w-80"];
        block.className = `skeleton-block ${widths[(r + c) % widths.length]}`;
  
        td.appendChild(block);
        tr.appendChild(td);
      }
  
      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
  }
  
/**
* スケルトンを表示している間に非同期処理（fetcher）を待つ
* 表示だけ担当。置き換えは別関数（swapSkeletonToRows）で。
*/
export async function withTableSkeleton(tableEl, fetcher, { rows = 8 } = {}) {
    createTableSkeleton(tableEl, { rows });
    return await fetcher();
}
  
/**
* スケルトン → 実データへクロスフェードで切り替える
* @param {HTMLTableElement} tableEl
* @param {Function} replacer 実データに置き換える処理（tbody.innerHTML を作るなど）
* @param {{duration?:number, easing?:string}} options
*/
export async function swapSkeletonToRows(
    tableEl,
    replacer,
    { duration = 220, easing = "ease" } = {}
) {
    if (!tableEl) { replacer?.(); return; }
    const tbody = tableEl.tBodies?.[0];
    if (!tbody) { replacer?.(); return; }
  
    // スケルトンをフェードアウト
    tbody.style.transition = `opacity ${duration}ms ${easing}`;
    tbody.style.opacity = "0";
    await new Promise(r => setTimeout(r, duration));
  
    // 実データへ置き換え（ユーザー側の処理）
    replacer?.();
  
    // 再描画強制（reflow）
    void tbody.offsetHeight;
  
    // 実データをフェードイン
    tbody.style.transition = `opacity ${duration}ms ${easing}`;
    tbody.style.opacity = "1";
    await new Promise(r => setTimeout(r, duration));
  
    // 後始末
    tbody.style.transition = "";
}


/** ガント領域にスケルトンを描画 */
export function mountGanttSkeleton(rootEl, {
    rows = 6, leftWidth = 120, barHeight = 20, padding = 8
} = {}) {
    if (!rootEl) return {};
    // 既存スケルトンを撤去
    unmountGanttSkeleton(rootEl);
  
    // 左（担当者名）
    const left = document.createElement('div');
    left.className = 'assignee-skeleton';
    left.style.width = `${leftWidth}px`;
    left.style.top = 'var(--gantt-skel-head-h)'; // 右のヘッダ高さと揃える
  
    for (let i = 0; i < rows; i++) {
        const r = document.createElement('div');
        r.className = 'assignee-skel-row';
        const b = document.createElement('div');
        b.className = 'assignee-skel-block';
        r.appendChild(b);
        left.appendChild(r);
    }
  
    // 右（タイムライン）
    const overlay = document.createElement('div');
    overlay.className = 'gantt-skeleton-overlay';
    // CSS で left: var(--gantt-skel-left-w) を使うが、保険で inline もセット可能
    overlay.style.left = `var(--gantt-skel-left-w)`;
  
    const header = document.createElement('div');
    header.className = 'gantt-skel-header';
    const headerBlock = document.createElement('div');
    headerBlock.className = 'skeleton-block';
    header.appendChild(headerBlock);
  
    const body = document.createElement('div');
    body.className = 'gantt-skel-body';
  
    for (let i = 0; i < rows; i++) {
        const row = document.createElement('div');
        row.className = 'gantt-skel-row';
        // 1〜2本のバーを仮で入れる

        // ★ バーは常に100%（横幅いっぱい）
        const bar = document.createElement('div');
        bar.className = 'gantt-skel-bar';
        bar.style.width = '100%';
        bar.style.marginLeft = '0';
        row.appendChild(bar);
        body.appendChild(row);

    }
  
    overlay.appendChild(header);
    overlay.appendChild(body);
  
    // ルートに取り付け
    rootEl.appendChild(left);
    rootEl.appendChild(overlay);
  
    // loading クラスで本体を不可視化（CSS 側で opacity:0 / pointer-events:none）
    rootEl.classList.add('loading');
  
    return { overlay, left };
}


/**
* モバイルリスト用のスケルトンを生成・設置
* @param {HTMLElement} listEl #mobileList などスクロール領域の直下
* @param {{rows?:number}} options
*/
export function mountMobileListSkeleton(listEl, { rows = 8 } = {}) {
    if (!listEl) return;
    // 一旦クリア
    listEl.innerHTML = "";
    listEl.setAttribute("aria-busy", "true");
  
    const frag = document.createDocumentFragment();
    for (let i = 0; i < rows; i++) {
        const card = document.createElement("div");
        card.className = "mobile-card skeleton-card";
  
        card.innerHTML = `
            <div class="card-line1">
                <span class="skeleton-block ${_randW(i)}"></span>
            </div>
            <div class="card-line2">
                <span class="skeleton-block skeleton-w-40"></span>
            </div>
        `;
        frag.appendChild(card);
    }
    listEl.appendChild(frag);
}
  
export function unmountMobileListSkeleton(listEl) {
    if (!listEl) return;
    listEl.removeAttribute("aria-busy");
    listEl.innerHTML = "";
}

/**
* スケルトンを表示しつつ取得待ち（置換は呼び出し側で行う）
* @param {HTMLElement} listEl
* @param {() => Promise<any>} fetcher
* @param {{rows?:number}} options
*/
export async function withMobileListSkeleton(listEl, fetcher, { rows = 8 } = {}) {
    mountMobileListSkeleton(listEl, { rows });
    return await fetcher();
}

/**
* スケルトン → 実データへクロスフェードで切替
* @param {HTMLElement} listEl
* @param {() => void} render 実カードへ差し替える処理（innerHTMLなど）
* @param {{duration?:number, easing?:string}} options
*/
export async function swapSkeletonToMobileList(
    listEl,
    render,
    { duration = 220, easing = "ease" } = {}
) {
    if (!listEl) { render?.(); return; }
  
    // フェードアウト
    listEl.style.transition = `opacity ${duration}ms ${easing}`;
    listEl.style.opacity = "0";
    await new Promise(r => setTimeout(r, duration));
  
    // 実描画
    render?.();
  
    // reflow
    void listEl.offsetHeight;
  
    // フェードイン
    listEl.style.transition = `opacity ${duration}ms ${easing}`;
    listEl.style.opacity = "1";
    await new Promise(r => setTimeout(r, duration));
  
    // 後始末
    listEl.style.transition = "";
}



export function unmountGanttSkeleton(rootEl) {
    if (!rootEl) return;
    rootEl.querySelector('.assignee-skeleton')?.remove();
    rootEl.querySelector('.gantt-skeleton-overlay')?.remove();
    rootEl.classList.remove('loading');
}


/** スケルトン表示中に非同期処理を待つ（置き換えは別関数で） */
export async function withGanttSkeleton(rootEl, fetcher, opts) {
    mountGanttSkeleton(rootEl, opts);
    return await fetcher();
}

/** スケルトン → 実データへクロスフェード切替 */
export async function swapSkeletonToGantt(rootEl, render, { duration = 240, easing = "ease" } = {}) {
    if (!rootEl) { render?.(); return; }
    const overlay = rootEl.querySelector('.gantt-skeleton-overlay');
    const left = rootEl.querySelector('.assignee-skeleton');
    
    const gantt = rootEl.querySelector('#gantt');
    const names = rootEl.querySelector('.assignee-container');

    //) スケルトンをフェードアウト

    [overlay, left].forEach(el => {
        el.style.transition = `opacity ${duration}ms ${easing}`;
        el.style.opacity = '0';
    });

    await wait(duration);

    //) 実描画
    render?.();

      //) 本体をフェードイン（loading を外して CSS の opacity:0 を解除）
    [gantt, names].forEach(el => {
        if (!el) return;
        el.style.transition = `opacity ${duration}ms ${easing}`;
    });
    rootEl.classList.remove('loading');
    void (gantt?.offsetHeight); void (names?.offsetHeight);
    [gantt, names].forEach(el => { if (el) el.style.opacity = '1'; });
    await wait(duration);
}