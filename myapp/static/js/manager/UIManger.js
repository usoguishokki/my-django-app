export class UIManger {
    constructor() {}


    /**
    * 現在がモバイルかを判定（引数 mode があればそれを、なければ CSS を参照）
    * @param {string} [mode] 'mobile' | 'tablet' | 'desktop'
    * @returns {boolean}
    */
    static isMobile(mode) {
        const m = mode || UIManger.readCurrentBreakpoint();
        return m === 'mobile';
    }

    /**
    * 現在のブレークポイント名を CSS 変数 --current-bp から取得
    *（Sass のメディアクエリが決めた値を JS が読むだけ：ズレが起きない）
    *
    * 期待値: 'mobile' | 'tablet' | 'desktop'
    *
    * @param {Object} [opt]
    * @param {string} [opt.fallback='desktop']  CSS が未適用などで読めないときの代替
    * @returns {string} 'mobile' | 'tablet' | 'desktop' のいずれか
    */
    static readCurrentBreakpoint({ fallback = 'desktop' } = {}) {
        // SSR安全策
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return fallback;
        }
        const cs = getComputedStyle(document.documentElement);
        // 値は "'mobile'" のように引用符付きになることがあるので除去
        const raw = cs.getPropertyValue('--current-bp');
        const val = (raw || '').replace(/["']/g, '').trim();
        return val || fallback;
    }

    /**
    * 初回だけのモード判定ヘルパー。
    * Sass 側の @media で設定された --current-bp を読み取り、その値を返す。
    * アプリの init() 冒頭で 1 回だけ呼び、以後は固定運用する想定。
    *
    * 例:
    *   const mode = UIManger.detectInitialViewportMode();
    *   this._applyMode(mode);
    *
    * @param {Object} [opt]
    * @param {string} [opt.fallback='desktop']  読み取れない場合の代替
    * @returns {string} 'mobile' | 'tablet' | 'desktop'
    */
    static detectInitialViewportMode(opt) {
        return UIManger.readCurrentBreakpoint(opt);
    }

    //画面の高さを取得する関数
    static getScreenHeight() {
        return window.innerHeight;
    }
    
    //余白を計算
    static getStyleNumericValue(element, property) {
        const value = window.getComputedStyle(element)[property];
        return parseFloat(value) || 0
    }

    //要素の利用可能な高さを計算するメソッド
    static calculateBoxModelDimensions(element, properties = []) {
        if (!element) return 0;

        //指定されたcssプロパティの値を合計する
        const totalPropertiesValue = properties.reduce((total, property) => {
            return total + UIManger.getStyleNumericValue(element, property);
        }, 0);

        return totalPropertiesValue
    }

    /**
    * 指定された要素が表示されているかどうかを判定します。
    * @param {HTMLElement} element - 表示状態を確認する対象のDOM要素。
    * @returns {boolean} - 要素が表示されている場合は `true`、表示されていない場合は `false` を返します。
    */
    static isElementVisible = (element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none';
    }

    /**
     * 指定された要素(または要素の配列)に対してクラスを追加または削除します。
     * @param {HTMLElement | HTMLElement[]} elements - クラスを追加/削除する対象のDOM要素または要素の配列
     * @param {string} className - 追加する削除するクラス名
     * @param {string} acion - 実行するアクション('add'または'remove')
     */
    static toggleClass(elements, className, action) {
        const elementsArray = Array.isArray(elements) ? elements : [elements];
        const classNames = Array.isArray(className) ? className : [className];

        elementsArray.forEach(element => {
            classNames.forEach(cls =>{
                if (element == null) {
                    debugger
                } 
                element.classList[action](cls);
            });
        });
    }


    /**
    * 指定されたタグ名、属性、およびテキストを使用して新しいHTML要素を作成します。
    * @param {string} tag - 作成する要素のタグ名
    * @param {Object} attributes - 要素に適用する属性のオブジェクト (例: {'class': 'my-class', 'id': 'myId'})
    * @param {string|null} text - 要素に設定するテキストコンテンツ。テキストが不要な場合はnullを使用
    * @returns {HTMLElement} - 指定された仕様で作成された新しいHTML要素
    */
    static createElement = (tag, attributes, text) => {
        const element = document.createElement(tag);
        if (attributes) {
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
        }
        if (text) {
            element.textContent = text;
        }
        return element;
    };

    /**
    * 指定されたセレクタに一致する親要素に子要素を追加します。
    * @param {string} parentSelector - 子要素を追加する親要素のセレクタ
    * @param {HTMLElement} child - 追加する子要素
    */
    static appendToParent = (parentSelector, child) => {
        const parent = document.querySelector(parentSelector);
        if (parent) {
            parent.appendChild(child);
        }
    };

    /**
    * 指定された親要素に、指定されたタグ、クラス、およびテキストを持つ新しい要素を追加します。
    * @param {string} parentSelector - 新しい要素を追加する親要素のセレクタ
    * @param {string} tag - 新しい要素のタグ名
    * @param {string|null} className - 新しい要素に適用するクラス名。クラスが不要な場合はnullを使用
    * @param {string|null} text - 新しい要素に設定するテキスト。テキストが不要な場合はnullを使用
    * @param {Function} eventListener -要素に追加するイベントリスナ(クリックイベント)
    */
    static addActionElement = (parentSelector, tag, className, idName, text, eventListener = null) => {
        const element = UIManger.createElement(tag, { 'class': className, 'id': idName}, text);
        if (eventListener) {
            element.addEventListener('click', eventListener);
        }
        UIManger.appendToParent(parentSelector, element);
        return element
    };

    /**
     * 指定されたセレクタに一致する要素をドキュメントから削除します
     * @param {string} selector -削除する要素のセレクタ
     */
    static removeElement = (selector) => {
        const element = document.querySelector(selector);
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    /**
     * 無効な値をチェックする関数
     * 
     * @param {any} value -チェックする値
     * @returns {boolean} -値が有効なら true を返し、無効ならfalseを返す
     */
    static isValidValue(value) {
        const invalidValues = [undefined, null, '', 'none', 'None']
        return !invalidValues.includes(value) && !Number.isNaN(value);
    }

    

    /**
     * デバウンス関数
     * スロットリングされた関数を返します。
     * 指定された時間間隔内に複数回呼び出された場合でも、
     * 最初の呼び出しのみを実行します。
     * 
     * @param {Function} func -実行する関数
     * @param {number} limit -間隔時間(ミリ秒)
     * @returns {Function} スロットリングされた関数
     * 
     * @example
     * window.addEventLisener('scroll', UIManger.throttle(() => {
     *      console.log('スクロールイベント');
     * }, 100))
     */
    static throttle(func, limit) {
        let inThrottle;
        return  (...args) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 軽量エスケープ（XSS/崩れ防止） 
    static esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, m => (
            ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m]
        ));
    }

    /**
    * URL クエリを共通的に更新する
    * @param {Object} updates { key: value } 形式。
    *   - undefined / null / ""（keepEmpty=false時）は削除
    *   - boolean は encodeBoolean で 1/0 か "true"/"false" に
    *   - 配列は ?key=a&key=b... に展開
    * @param {Object} [opt]
    * @param {"replace"|"push"|false} [opt.history="replace"]  履歴を更新するか
    * @param {"numeric"|"string"} [opt.encodeBoolean="numeric"] true→"1" or "true"
    * @param {boolean} [opt.keepEmpty=false] 空文字を残すか
    * @param {string}  [opt.base=location.href] 基準URL
    * @returns {URL} 更新後の URL オブジェクト
    */
    static _updateUrlQuery(
        updates,
        { history: hist = "replace", encodeBoolean = "numeric", keepEmpty = false, base = location.href } = {}
    ) {
        const url = new URL(base, location.origin);
        const sp = url.searchParams;
  
        for (const [k, v] of Object.entries(updates || {})) {
            if (v == null || (v === "" && !keepEmpty)) {
                sp.delete(k);
                continue;
            }
            if (Array.isArray(v)) {
                sp.delete(k);
                v.forEach(val => sp.append(k, String(val)));
                continue;
            }
            if (typeof v === "boolean") {
                sp.set(k, encodeBoolean === "numeric" ? (v ? "1" : "0") : String(v));
                continue;
            }
            sp.set(k, String(v));
        }
  
        if (hist === "replace") {
            history.replaceState({ query: Object.fromEntries(sp) }, "", url);
        } else if (hist === "push") {
            history.pushState({ query: Object.fromEntries(sp) }, "", url);
        }
        return url;
    }


    static _overlayClickHandler = null;
    static _prevBodyOverflow = '';
    /**
    * 共通オーバレイを表示
    * @param {Object} opts
    * @param {number} [opts.zIndex=900]  モーダルより1段低く
    * @param {number} [opts.opacity=0.35]  フェード濃さ
    * @param {boolean} [opts.closeOnClick=true]  背景クリックで閉じるか
    * @param {function} [opts.onClick=null]  クリック時の追加処理
    * @param {boolean} [opts.lockScroll=true]  bodyスクロールをロック
    */
    static showOverlay({
        zIndex = 900,
        opacity = 0.35,
        closeOnClick = true,
        onClick = null,
        lockScroll = true,
    } = {}) {
        const el = document.getElementById('screenDim');
        // 動的スタイル
        el.style.zIndex = String(zIndex);
        el.style.opacity = String(opacity);
        el.classList.add('is-active'); // CSSで pointer-events/visibility を制御

        if (lockScroll) {
            this._prevBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }

        // 既存ハンドラを外してから登録（多重発火防止）
        if (this._overlayClickHandler) el.removeEventListener('pointerdown', this._overlayClickHandler);

        this._overlayClickHandler = (e) => {
            if (typeof onClick === 'function') onClick(e);
            if (closeOnClick) this.hideOverlay();
        };
        el.addEventListener('pointerdown', this._overlayClickHandler);
    }

    /** 共通オーバレイを非表示 */
    static hideOverlay() {
        const el = document.getElementById('screenDim');
        el.classList.remove('is-active');
        el.style.zIndex = '-1';
        el.style.opacity = '';

        if (this._overlayClickHandler) {
            el.removeEventListener('pointerdown', this._overlayClickHandler);
            this._overlayClickHandler = null;
        }

        document.body.style.overflow = this._prevBodyOverflow || '';
    }

    static showSpinner({
        container,
        id = 'calendarSpinner',
        size = 'lg',
        title = '読み込み中…',
        sub = 'データを取得しています',
        delayMs = 150,
    } = {}) {
        if (document.getElementById(id)) return;
      
        const host =
          container instanceof Element
            ? container
            : (typeof container === 'string' ? document.querySelector(container) : null);
        if (!host) return;
      
        const cs = getComputedStyle(host);
        if (!cs.position || cs.position === 'static') {
          host.dataset.__spinnerPrevPos = host.style.position || '';
          host.style.position = 'relative';
        }
      
        // overlayを先に作る（ここが白フラッシュ防止の肝）
        const overlay = document.createElement('div');
        overlay.className = 'spinner-overlay';
        overlay.id = id;
        overlay.setAttribute('aria-busy', 'true');
      
        const card = document.createElement('div');
        card.className = 'spinner-card';
      
        const spinner = document.createElement('div');
        spinner.className = `spinner spinner--${size}`;
      
        const text = document.createElement('div');
        text.className = 'spinner-text';
        text.innerHTML = `<div class="title">${title}</div><div class="sub">${sub}</div>`;
      
        card.appendChild(spinner);
        card.appendChild(text);
        overlay.appendChild(card);
        host.appendChild(overlay);
      
        // overlayフェードインは即
        requestAnimationFrame(() => overlay.classList.add('is-active'));
      
        // カードだけ遅延表示（チラつき防止）
        const timerKey = `__spinnerTimer_${id}`;
        host.dataset[timerKey] = String(setTimeout(() => {
          card.classList.add('is-visible');
          delete host.dataset[timerKey];
        }, delayMs));
    }
      
    static hideSpinner({ id = 'calendarSpinner' } = {}) {
        const overlay = document.getElementById(id);
      
        // delay中にhideされた場合：タイマー取消
        const host = overlay?.parentElement;
        if (host) {
          const timerKey = `__spinnerTimer_${id}`;
          const t = host.dataset[timerKey];
          if (t) {
            clearTimeout(Number(t));
            delete host.dataset[timerKey];
          }
        }
      
        if (!overlay) return;
      
        const parent = overlay.parentElement;
        if (parent && Object.prototype.hasOwnProperty.call(parent.dataset, '__spinnerPrevPos')) {
          parent.style.position = parent.dataset.__spinnerPrevPos;
          delete parent.dataset.__spinnerPrevPos;
        }
      
        overlay.remove();
    }

    /**
     * HTMLエスケープ処理
     *
     * 外部データ（APIレスポンス / DB値 / ユーザー入力など）を
     * innerHTML に安全に挿入するためのユーティリティ。
     *
     * @static
     * @param {string | number | null | undefined} value
     *   エスケープ対象の値
     *
     * @returns {string}
     *   HTMLとして解釈されない安全な文字列
     *
     * @example
     * UIManger.escapeHtml('<script>alert(1)</script>');
     * // => '&lt;script&gt;alert(1)&lt;/script&gt;'
     *
     * @example
     * element.innerHTML = UIManger.escapeHtml(apiResponse.text);
     *
     * @remarks
     * - textContent を使う場合は不要
     * - innerHTML + 外部データ の場合は必ず使用する
     */
    static escapeHtml(value) {
      if (value == null) return '';
    
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
}

