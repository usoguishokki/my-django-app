export class UIManger {
    constructor() {}

    static breakpoints = {
        xs: 576,
        sm: 768,
        md: 992,
        lg: 1200,
        xl: 1400
    };

    //画面の高さを取得する関数
    static getScreenHeight() {
        return window.innerHeight;
    }

    //画面の横幅を取得する関数
    static getScreenWidth() {
        return window.innerWidth;
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
        return style.display !== 'none' && style.visibility !== 'hidden';
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
     * 指定されたパターンに一致するクラスを要素から削除する静的メソッド
     * @param {HTMLElement} element -クラスを削除するHTML要素
     * @param {RegExg} pattern - クラス名をテストする正規表現パターン
     */
    static removeClassesByPattern(element, pattern) {
        element.classList.forEach(className => {
            if (pattern.test(className)) {
                element.classList.remove(className);
            }
        })
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
    static addActionElement = (parentSelector, tag, className, text, eventListener = null) => {
        const element = UIManger.createElement(tag, { 'class': className }, text);
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
    };

    /**
     * 指定されたセレクトボックス要素のオプションから、指定されたユーザーIDに一致するものを選択状態にします。
     * @param {string} selectElementId -セレクトボックスの要素ID
     * @param {string | number} userId -選択状態にするユーザーのID
     */
    static selectUserProfile(selectElementId, userId) {
        const selectElement = document.getElementById(selectElementId);
        if (selectElement) {
            for (let i = 0; i < selectElement.options.length; i++) {
                if (selectElement.options[i].value == userId) {
                    selectElement.selectedIndex = i;
                    return selectElement;
                }
            }
        }
        return null;
    }

    /**
     * 任意の要素に指定されたイベントリスナーを追加します。
     * @param {HTMLElement} elemet -イベントリスナーを追加する
     * @param {string} eventType -イベントの種類(例: 'change', 'click')
     * @param {Function} handler -イベント発生に呼び出せるハンドラ関数
     */
    static addEventListenerToElement(element, eventType, handler) {
        if (element) {
            element.addEventListener(eventType, handler);
        }
    }

    /**
     * 任意の要素から指定されたイベントリスナーを削除します。
     * @param {HTMLElement} element -イベントリスナーを削除する要素
     * @param {string} eventType -イベントの種類(例: 'change', 'click')
     * @param {Function} handler -削除するイベントリスナーのハンドラー関数
     */

    static removeEventListenerFromElement(element, eventType, handler) {
        if (element) {
            element.removeEventListener(eventType, handler);
        }
    }

    /**
    * 日付文字列を "Y-m-d\\TH:i" 形式にフォーマットします。
    *
    * この関数は日付文字列を受け取り、Dateオブジェクトに変換し、
    * その後、特定の文字列形式 "Y-m-d\\TH:i" にフォーマットします。
    * 出力形式には年、月、日、時間、分が含まれ、
    * 一桁の月、日、時間、分はゼロパディングされます。
    *
    * @param {string} dateString - フォーマットする入力の日付文字列。
    * @returns {string} - "Y-m-d\\TH:i" 形式のフォーマットされた日付文字列。
    */
    static formatDateStringToISO = (dateString) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    /**
     * 与えられた日付文字列をカスタム形式 'm-d h:i'に変換します。
     * 
     * @param {string} dateString - フォーマットの日付文字列。Dateコンストラクタで認識される形式である必要があります。
     * @returns {string} 'm-d h:i'形式の日付文字列
     * 
     * @example
     * const iputDate = "2023-05-28T14:45:00Z"
     * const formatteDate = convertDateToCusttomFormat(inputDate);
     * console.log(formatteDate); //出力 "05-28 14:45"
     */
    static convertDateToCustomFormat(dateString) {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();

        //必要に応じて月、日、時、分をゼロ埋め;
        const paddedMonth = String(month).padStart(2, '0');
        const paddedDay = String(day).padStart(2, '0');
        const paddedHours = String(hours).padStart(2, '0');
        const paddedMinutes = String(minutes).padStart(2, '0');

        return `${paddedMonth}-${paddedDay} ${paddedHours}:${paddedMinutes}`;
    }

    /**
    * 日付文字列に指定された分数を加算し、新しい日付文字列を返します。
    * 
    * @param {string} dateString - 元の日付文字列。ISO形式で指定します（例: "2024-05-27T14:45"）。
    * @param {string} minutesToAdd - 加算する分数。文字列形式で指定します（例: "10"）。
    * @returns {string} 加算後の日付文字列。元の日付形式と同じ形式で返します。
    * 
    * @example
    * const inputDate = "2024-05-27T14:45";
    * const minutes = "10";
    * const newDate = addMinutesToDate(inputDate, minutes);
    * console.log(newDate); // 出力: "2024-05-27T14:55"
    */
    static addMinutesToDate(dateString, minutesToAdd) {
        const date = new Date(dateString);
        const minutes = parseInt(minutesToAdd, 10);
        date.setMinutes(date.getMinutes() + minutes);
        //const covDate = UIManger.formatDateStringToISO(date);
        //return covDate;
        return date
    }

    /**
     * 指定されたフォーマットに基づいて日付データを返す関数
     * 
     * @param {string} dateString -日付文字列(例: '2024-10-24-16:10')
     * @param {string} format -フォーマット文字列(例: 'H:i')
     * @returns {string} -指定されたフォーマットの日付文字部分を返す
     */
    static formatDate(dateString, format) {
        const date = new Date(dateString.trim());
        const formatMap = {
            'Y': date.getFullYear(),
            'm': ('0' + (date.getMonth() + 1)).slice(-2),
            'd': ('0' + date.getDate()).slice(-2),
            'H': ('0' + date.getHours()).slice(-2),
            'i': ('0' + date.getMinutes()).slice(-2),
            's': ('0' + date.getSeconds()).slice(-2)
        };
        return format.replace(/Y|m|d|H|i|s/g, match => formatMap[match]);
    }

    /**
     * 指定された日付文字列が有効な日付かどうかをチェックします。
     * 
     * この関数は `Date.parse` を使用して入力文字列をタイムスタンプに解析します。
     * 解析が成功し、結果のタイムスタンプが `NaN` でない場合、この関数は
     * 入力文字列が有効な日付を表していると判断して `true` を返します。それ以外の場合は `false` を返します。
     * 
     * 
     * @param {string} dateString - 検証する日付文字列。
     * @returns {boolean} -日付文字列が有効な日付の場合'true'そうでない場合'false'を返します。
     */
    static isValidDate(dateString) {
        const timestamp = Date.parse(dateString);
        return !isNaN(timestamp);
    }

    /**
     * 'Z'を削除する関数
     * 
     * @param {string} dataStr - 'Z'を取り除く対象の日付文字列
     * @returns {string} - 'Z'が取り除かれた日付文字列。'Z'がなかった場合は元の文字列を返す
     */

    static removeZFromISODate(dateStr) {
            // 'Z'が存在する場合のみ取り除く
        if (dateStr.endsWith('Z')) {
            return dateStr.slice(0, -1);
        }
        // 'Z'がない場合はそのまま返す
        return dateStr;
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
     * 指定された属性値を持つ要素の複数の属性値を変更する関数
     * 
     * @param {NodeList} parentElement -親要素
     * @param {string} attribute -検索する属性名
     * @param {string} currentValue -現在の属性値
     * @param {string} newValue -変更する新しい属性値
     */
    static changeMulitipeElementsAttributeValue = (elements, attribute, targetValue, updates) => {
        elements.forEach(el => {
            if (el.getAttribute(attribute) === targetValue) {
                for (const [attr, newValue] of Object.entries(updates)) {
                    if (UIManger.isValidValue(newValue)) {
                        el.setAttribute(attr, newValue);
                    }
                }
            }
        });
    };

    /**
     * 指定された条件に基づいて属性をフィルタリングする関数
     * 
     * @param {HTMLElement} element -対象要素
     * @param {string} attributeName -検索する属性名
     * @param {string} attributeValue - フィルタリング条件となる属性値
     * @returns {Object} -条件に一致する属性を持つオブジェクト 
     */

    static getFilterAttributes(element, attributeName, attributeValue) {
        const result = {};
        const attrValue = element.getAttribute(attributeName);
            
        if (attrValue === attributeValue) {
            result[attributeName] = attrValue;
        }
        
        return result;
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

    /**
     * RGB色の色相を変更する関数
     * 
     * @param {string} color - RGB形式の色文字列 (例: 'rgb(51, 112, 173)')
     * @param {number} degree - 色相を変更する度合い。正の値で色相を進め、負の値で色相を戻す。
     * @param {number} saturationShift - 彩度を変更する度合い。
     * @param {number} lightnessShift - 明度を変更する度合い。
     * @returns {string} - 変更後のRGB色文字列 (例: 'rgb(102, 153, 204)')
     */
    static shiftHue(color, degree, saturationShift = 0, lightnessShift = 0) {
        const rgbToHsl = (rgb) => {
            let r = parseInt(rgb.slice(4, rgb.indexOf(','))) / 255;
            let g = parseInt(rgb.slice(rgb.indexOf(',') + 1, rgb.lastIndexOf(','))) / 255;
            let b = parseInt(rgb.slice(rgb.lastIndexOf(',') + 1, rgb.indexOf(')'))) / 255;
            let max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;

            if (max == min) {
                h = s = 0; // 無彩色
            } else {
                let d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }

            return { h: h * 360, s: s, l: l };
        }

        const hslToRgb = (hsl) => {
            let r, g, b;
            let h = hsl.h / 360;
            let s = hsl.s;
            let l = hsl.l;

            if (s == 0) {
                r = g = b = l; // 無彩色
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                }

                let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                let p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }

            return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        }

        const hsl = rgbToHsl(color);
        hsl.h = (hsl.h + degree) % 360;
        if (hsl.h < 0) hsl.h += 360;
        hsl.s = Math.min(1, Math.max(0, hsl.s + saturationShift));
        hsl.l = Math.min(1, Math.max(0, hsl.l + lightnessShift));
        return hslToRgb(hsl);
    }

    static toCamelCase(attr) {
        return attr
            .replace(/^data-/, '')
            .replace(/-([a-z])/g, (match, letter) => letter.toUpperCase())
    }
}