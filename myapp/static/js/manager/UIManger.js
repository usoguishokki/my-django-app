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
     * 無効な値をチェックする関数
     * 
     * @param {any} value -チェックする値
     * @returns {boolean} -値が有効なら true を返し、無効ならfalseを返す
     */
    static isValidValue(value) {
        const invalidValues = [undefined, null, '', 'none', 'None']
        return !invalidValues.includes(value) && !Number.isNaN(value);
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
     * 人名表示用に空白を除去する。
     *
     * DB上の氏名に含まれる半角スペース・全角スペースを取り除き、
     * タイトルや短いラベルで使いやすい表示名に整形する。
     *
     * @static
     * @param {string | number | null | undefined} value
     *   整形対象の値
     *
     * @returns {string}
     *   半角・全角スペースを除去した文字列
     *
     * @example
     * UIManger.normalizePersonName('宮本　英信');
     * // => '宮本英信'
     */
    static normalizePersonName(value) {
        return String(value ?? '')
            .replace(/[ 　]+/g, '')
            .trim();
    }
    
    /**
     * 空の値を除外して文字列を結合する。
     *
     * タイトル・ラベル・サブテキストなど、
     * 複数の表示文字列を安全に連結したい場合に使用する。
     *
     * @static
     * @param {Array<string | number | null | undefined>} values
     *   結合対象の値
     * @param {Object} [options]
     * @param {string} [options.separator=' ']
     *   結合文字
     *
     * @returns {string}
     *   空値を除外して結合した文字列
     *
     * @example
     * UIManger.joinText(['6月4週目', 'A係の進捗']);
     * // => '6月4週目 A係の進捗'
     *
     * @example
     * UIManger.joinText(['07:30', '10分'], { separator: '_' });
     * // => '07:30_10分'
     */
    static joinText(values = [], { separator = ' ' } = {}) {
        if (!Array.isArray(values)) {
            return '';
        }

        return values
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)
            .join(separator);
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

