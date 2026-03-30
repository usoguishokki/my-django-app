import { ChartSetup } from  './chartSetup.js'
import { UIManger } from '../manager/UIManger.js'
import { formatDate, toDateTimeLocalString, } from '../utils/dateTime.js';
import { UtilityManager } from '../manager/UtilityManager.js'

import { isValidDate, addMinutesToDate, addMinutesToDateTimeLocal } from '../utils/dateTime.js'

import { TableManager } from '../manager/TableManger.js'
import Gantt from '../frappeGantt/NewFrappeGantt.js'
import { $ } from '../frappeGantt/svg_utils.js'
import date_utils from '../frappeGantt/data_utils.js';
import { HomeColumnManager } from './homeMappingConfig.js'
import { 
    initializeLoadingScreen, 
    showLoadingScreen,
    withTableSkeleton, 
    swapSkeletonToRows, 
    withGanttSkeleton, 
    swapSkeletonToGantt, 
    unmountGanttSkeleton,
    withMobileListSkeleton,
    swapSkeletonToMobileList,
} from '../manager/loadingManager.js';

import { fetchWdRows, fetchGroupSchedule, fetchUserChange } from "../api/fetchers.js";

// --- 外側セグメントの定義（色は以前のものを踏襲）
const OUTER_SEGMENTS = [
    { label: "実施待ち", key: "pending",  color: "rgb(0, 204, 102)" },
    { label: "承認待ち", key: "approval", color: "rgb(255, 215, 0)" },
    { label: "差戻し",   key: "rejected", color: "rgb(255, 153, 153)" },
    { label: "遅れ",     key: "delayed",  color: "rgb(221, 53, 53)" },
];



const SSR_IDS = {
    summary: "ssr-summary",
    holders: "ssr-holders",
    progress: "ssr-progress",
    initialRows: "ssr-list-initial",
    team_member_map: "ssr-team_member_map",
    meta: "ssr-meta",
};
  
const EVENTS = {
    appReady: "app:ready",
    userChange: "user:change",
    statusChange: "status:change",
};

const SCOPE_BY_STATUS = {
    waiting:  "affiliation",
    pending:  "holder",
    approval: "holder",
    delayed:  "holder",
    rejected: "holder",
    all: "holder"
};

const STATUS_DICTIONARY = {
    pending:  { ja: "実施待ち", id: "btnPending" },
    approval: { ja: "承認待ち", id: "btnApproval" },
    rejected: { ja: "差戻し",   id: "btnRejected" },
    delayed:  { ja: "遅れ",     id: "btnDelayed" },
    //waiting:  { ja: "配布待ち", id: "btnWaiting" },
};

/** 逆引き: ボタンID → 英語キー */
const BUTTON_ID_TO_KEY = Object.fromEntries(
    Object.entries(STATUS_DICTIONARY).map(([key, v]) => [v.id, key])
);

/** ボタンID → 英語キー（共通ユーティリティ） */
function getStatusFromButton(btn) {
    return BUTTON_ID_TO_KEY[btn?.id] ?? null;     // STATUS_DICTIONARY から生成した逆引き
};

/** 英語キー → 日本語ラベル */
function statusJa(key) {
    return STATUS_DICTIONARY[key]?.ja ?? key;
}

/** 日本語ラベル → 英語キー*/
const JA_TO_KEY = Object.fromEntries(
    Object.entries(STATUS_DICTIONARY).map(([key, v]) => [String(v.ja || "").trim(), key])
);

/** 逆引き: 日本語ラベル → ボタンID */
const JA_TO_ID = Object.fromEntries(
    Object.entries(STATUS_DICTIONARY).map(([key, v]) => [v.ja, v.id])
);

function getKeyFromJa(jaLabel) {
    return JA_TO_KEY[String(jaLabel || "").trim()] ?? null;
}

/** 日本語ラベル → ボタンID（ユーティリティ関数） */
function getIdFromJa(jaLabel) {
    return JA_TO_ID[jaLabel] ?? null;
}

/** option要素 → state に格納するペイロードへ */
function optionPayload(opt) {
    if (!opt) return null;
    const ds = opt.dataset || {};
    return {
        value:        opt.value ?? "",
        userId:       (ds.userId ?? "").trim(),
        userName:     (ds.userName ?? opt.textContent ?? "").trim(),
        affiliation:  (ds.affilation ?? ds.affiliation ?? "").trim(), // typo両対応
        affiliation_id: ds.belongs_id,
        shiftStart:   ds.shiftStart ?? null, // "YYYY-MM-DDTHH:mm"（画面側で必要に応じてDateに）
        shiftEnd:     ds.shiftEnd ?? null,
        filterLabel: ds.filterLabel,
    };
}

/* ボタン内 .count と data-count 更新 (3桁区切り) */
function setBtnCount(btnId, value) {
    const btn = UtilityManager.$id(btnId);
    if (!btn) return;

    btn.setAttribute("data-count", value);

    const span = btn.querySelector(".count");
    if (span) span.textContent = UtilityManager.fmt(value);
}

/** rgb() を少しずつ色相/明度シフトして系列色を作る */
function shiftColor(rgbStr, index) {
    const m = rgbStr.match(/\d+/g);
    if (!m) return rgbStr;
    let [r, g, b] = m.map(Number).map(v => v / 255);
  
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = 0; s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    // シフト量（系列ごとに少し色相を回す＋明度を微調整）
    const h2 = (h + (index + 1) * 12) % 360;
    const s2 = Math.max(0, Math.min(100, Math.round(s * 100) - 4));
    const l2 = Math.max(0, Math.min(100, Math.round(l * 100) + (index % 3 === 0 ? -6 : -2)));
    return `hsl(${h2}deg ${s2}% ${l2}%)`;
}

/** 内側データ（保持者別）を組み立てる */
function buildInnerHolders(holders) {
    const innerData = [];
    const innerLabels = [];
    const innerColors = [];
    const innerOuterMap = []; // 内側インデックス→どの外側セグメントに属するか
  
    OUTER_SEGMENTS.forEach((seg, outerIndex) => {
        let k = 0; // 同一外側セグメント内での色バリエーション用
        holders.forEach(h => {
            const v = Number(h?.[seg.key] ?? 0);
            if (v > 0) {
                const label = h?.holder_name || "未割当";
                innerData.push(v);
                innerLabels.push(label);
                innerColors.push(shiftColor(seg.color, k++));
                innerOuterMap.push({ outerIndex, holder_id: h.holder_id });
            }
        });
    });
    return { innerData, innerLabels, innerColors, innerOuterMap };
}

/** 外側＋内側の2データセット構成を作る */
function getTwoRingConfig(summary, holders) {
    const outerValues = OUTER_SEGMENTS.map(s => Number(summary?.[s.key] ?? 0));
    const outerRawLabels = OUTER_SEGMENTS.map(s => s.label);
    const outerDecorated = OUTER_SEGMENTS.map((s, i) => `${s.label}(${outerValues[i]})`);
    const outerColors = OUTER_SEGMENTS.map(s => s.color);
    const totalIncomplete = outerValues.reduce((a, b) => a + b, 0);
  
    const { innerData, innerLabels, innerColors, innerOuterMap } = buildInnerHolders(holders);
  
    const chartData = {
        labels: outerDecorated,
        datasets: [
            // 外側
            {
                data: outerValues,
                backgroundColor: outerColors,
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 4,
                segmentLabels: outerRawLabels,
            },
            // 内側
            {
                data: innerData,
                backgroundColor: innerColors,
                borderColor: "#fff",
                borderWidth: 1,
                cutout: "55%",         // 内側リング
                segmentLabels: innerLabels,
            },
        ],
    };
  
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "80%",            // 外側リング
        plugins: {
            legend: {
                position: "right",
                labels: { usePointStyle: true },
                // 外側の凡例クリックで、対応する内側セグメントをまとめてトグル
                onClick: (e, li, legend) => {
                    const ci = legend.chart;
                    const outerIndex = li.index;
                    // 外側の見え方をトグル
                    ci.toggleDataVisibility(outerIndex);
  
                    // 内側（dataset=1）で outerIndex に紐づく要素の hidden を同期
                    const innerMeta = ci.getDatasetMeta(1);
                    innerOuterMap.forEach((map, i) => {
                        if (map.outerIndex === outerIndex) {
                            const el = innerMeta.data[i];
                            el.hidden = !el.hidden;
                        }
                    });
                    ci.update();
                },
            },
            tooltip: {
                callbacks: {
                    title: () => "",
                    label: (tt) => {
                        // 外側
                        if (tt.datasetIndex === 0) {
                            const base = outerRawLabels[tt.dataIndex];
                            const val = tt.dataset.data[tt.dataIndex] ?? 0;
                            return `${base}: ${val}`;
                        }
                        // 内側
                        const holderName = tt.dataset.segmentLabels?.[tt.dataIndex] ?? '';
                        const val = tt.dataset.data?.[tt.dataIndex] ?? 0;
                        const outerIdx = innerOuterMap[tt.dataIndex]?.outerIndex ?? 0;
                        const outerLabel = outerRawLabels[outerIdx];
                        return `${outerLabel}: ${holderName}: ${val}`;
                    },
                },
            },
            centerText: {
                text: String(totalIncomplete), // 中央テキストは未完了合計
                fontSize: "1.5rem",
                fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
                color: "#111",
            },
        },
    };
  
    return { chartData, chartOptions };
}

function createInitialState() {
    return {
        // SSR で hydrate するデータ
        summary: {},
        holders: [],
        progress: {},
        initialRows: [],
        meta: { affilation_id: null },   // ここは shape を固定
  
        // UI/利用者コンテキスト
        employeeId: "",
        selectMemberId: "",
        teamMemberMap: {},
        activeUser: null,                // { userId, userName, affiliation_id, ... } を想定
        activeStatus: {                  // 参照が多いのでデフォルトを入れておくと安心
            key: "pending",
            ja: "実施待ち",
            buttonId: "btnPending",
        },
  
        // DOM リファレンス（保持場所は state 内でも this.els でもOK）
        els: {},
  
        // キャッシュ & フラグ
        cache: new Map(),
        initialRendered: false,
    };
}

/* =========================
 * Home クラス（state に集約）
 * ========================= */
class Home {
    constructor() {
        this.state = createInitialState();
        this._statusSelectInited = false;
        this._statusSelectAbort = null
        this.homeColumnManager = new HomeColumnManager();


        this.ganttSetUpInstance = new GanttSetUp(this);
        this.donut = null;
    }

    _lockItemList(on) {
        const wrap = document.getElementById('itemList');
        const { statusButtons } = this.state.els || {};
        if (!wrap) return;

        //アクセシビリティ
        wrap.setAttribute('aria-busy', on? 'true': 'false');

        //近代ブラウザならinertで完全無効化(フォーカスも含め)
        try { wrap.inert = !!on; } catch (_) {}

        //フラグ&クラス
        this.state.isTableLoading = !!on;
        wrap.classList.toggle('is-loading', !!on);
        wrap.classList.toggle('disable-events', !!on)

        //ステータスボタンはdisabled付与で確実に無効化
        statusButtons?.forEach(btn => {
            btn.disabled = !!on;
            btn.classList.toggle('tooltip-hidden', !!on);
        });
    }

    bindStatusButtonEvents() {
        const { statusButtons } = this.state.els;
        if (!statusButtons?.length) return;

        statusButtons.forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                if (this.state.isTableLoading) return;
                this.setActiveStatusButton(btn, { emit: true, fetch: true });
            });
        });

        const preset = statusButtons.find(b => b.classList.contains("active")) || statusButtons[0];
        if (preset) this.setActiveStatusButton(preset, { emit: false, fetch: false });
    }

    /* ---- Block 1: 状態の構築/DOM キャッシュ ---- */
    hydrate() {
        // JSON 一回だけ読む
        this.state.summary     = UtilityManager.readJSONSafe(SSR_IDS.summary)     ?? {};
        this.state.holders     = UtilityManager.readJSONSafe(SSR_IDS.holders)     ?? [];
        this.state.progress    = UtilityManager.readJSONSafe(SSR_IDS.progress)    ?? {};
        this.state.initialRows = UtilityManager.readJSONSafe(SSR_IDS.initialRows) ?? [];
        this.state.teamMemberMap = UtilityManager.readJSONSafe(SSR_IDS.team_member_map) ?? [];
        this.state.meta        = UtilityManager.readJSONSafe(SSR_IDS.meta);


        // DOM も一回だけ取る
        this.state.els = {
            select: UtilityManager.$id("statusSelect"),
            employee: UtilityManager.$id("employeeName"),
            donutCanvasId: "myDonutChart",
            donutRootId: "itemProgress",
            denominator: UtilityManager.$id("denominator1"),
            molecule: UtilityManager.$id("molecule2"),
            statusButtons: Array.from(document.querySelectorAll(".buttons-container .filter-btn")),
            tableBody: document.querySelector("#myTable tbody"),
            tableSelector: UtilityManager.$id("myTable"),
            itemList: UtilityManager.$id('itemList'),
            subTitle:  UtilityManager.$id("subTitle"),
            mobilContent: UtilityManager.$id("mobileContent"),
            tasikTine: UtilityManager.$id("taskTimeLine"),
            mobileList: UtilityManager.$id("mobileList"),
            progress: UtilityManager.$id("progress"),
            modalThisWeek: UtilityManager.$id('modalThisWeek'),
            modalDelay: UtilityManager.$id('modalDelay'),
        };
        // ログインユーザID（空白対策）
        this.state.employeeId = String(this.state.els.employee?.dataset?.employeeId ?? "").trim();
        this.state.isTableLoading = false;
        this.state.ui = { viewportMode: null };

    }

    /** キャッシュキー生成 */
    keyFor(statusKey, scope, { holderId, affilationId, thisWeek }) {
        return `${statusKey}|${scope}|h=${holderId ?? ""}|a=${affilationId ?? ""}|w=${thisWeek ? 1 : 0}`;
    }

    _getStatusSelectFilterLabel() {
        const { filterLabel } = this.state.activeUser ?? null;
        let holderId = this.state.activeUser?.userId ?? this.state.employeeId ?? null;
        let affilationId = this.state.meta?.affilation_id || null;
        switch (filterLabel) {
            case 'teamOnly':
                holderId = null
                break;
            case 'userOnly':
                affilationId = null
                break;
        }
        return { holderId, affilationId }
    }

    /** APIパラメータ組み立て（status に応じて holder / affiliation を付与） */
    buildFetchParams(statusKeys) {
        const { holderId, affilationId } = this._getStatusSelectFilterLabel();

        // 後方互換: statusKeys が文字列なら配列化
        const keys = Array.isArray(statusKeys) ? statusKeys : [statusKeys]

        const normalizedKeys  = [...new Set(keys)]
            .map(String)
            .map(s => s.trim())
            .filter(Boolean)
            .sort();

        const scope = normalizedKeys .join(",");
        const params = { statusKeys: normalizedKeys , holderId, affilationId };

        return { scope, params };
    }

    async loadRowsForStatus(statusKey, opts = {}) {
        return this.showStatus(statusKey, opts);
    }

    // cacheKey と params をまとめて算出
    _getCacheKeyAndParams(statusKeys) {
        const { scope, params } = this.buildFetchParams(statusKeys);

        const normalized = Array.isArray(params.statusKeys)
            ? [...params.statusKeys].sort()
            : [params.statusKeys];

        const cacheKey = this.keyFor("status", scope, { ...params, statusKeys: normalized });

        return { cacheKey, params: { ...params, statusKeys: normalized } };
    }

    // UIロック（ボタン/表を操作不可に）
    _lockItemList(on) {
        const { itemList, statusButtons }  = this.state.els;
        itemList.classList.toggle('is-loading', on);
        (statusButtons || []).forEach(b => b.disabled = !!on);
    }

    // SSR 初回行を cache にプライム（描画はしない）
    _primeFromSSRIfNeeded(statusKey) {
        if (statusKey !== "pending") return false;
        if (!this.state.initialRows?.length) return false;
        if (this.state.initialRendered) return true;
        const { cacheKey } = this._getCacheKeyAndParams(statusKey);
        if (!this.state.cache.has(cacheKey)) {
            this.state.cache.set(cacheKey, this.state.initialRows);
        }

        //初回描画フラグだけ管理
        this.state.initialRendered = true;
        return true;
    }

    // 行を用意（SSRプライム→キャッシュ→fetch→キャッシュ保存）
    async _ensureRows(statusKey, { force = false } = {}) {
        this._primeFromSSRIfNeeded(statusKey);

        const { cacheKey, params } = this._getCacheKeyAndParams(statusKey);

        if (!force && this.state.cache.has(cacheKey)) {
            return this.state.cache.get(cacheKey);
        }

        const res = await fetchWdRows(params);
        const rows = res?.rows ?? [];
        this.state.cache.set(cacheKey, rows);
        return rows;
    }

    _renderRows(rows, { mode = "replace" } = {}) {
        this.replaceTable(rows, { mode });
    }

    async _swapSkeletonToRows(tableEl, rows, { duration = 400 } = {}) {
        await swapSkeletonToRows(
            tableEl,
            () => this._renderRows(rows, { mode: "replace" }),
            { duration }
        );
    }

    async showStatus(statusKey, { force = false, mode = "replace" } = {}) {
        const { tableSelector } = this.state.els;

        const { cacheKey } = this._getCacheKeyAndParams(statusKey);
        const hasSSR = (statusKey === "pending" && this.state.initialRows?.length && !this.state.initialRendered);
        const hasCache = (!force && this.state.cache.has(cacheKey));
        const needSkel = (!hasSSR || hasCache); // どちらも無ければスケルトンを出す

        this._lockItemList(true);
        try {
            if (needSkel) {
                //取得中はスケルトン
                await withTableSkeleton(tableSelector, async () => {
                    const rows = await this._ensureRows(statusKey, { force });
                    await this._swapSkeletonToRows(tableSelector, rows, { duration: 400 });
                }, { rows: 10 });
            } else {
                const rows = await this._ensureRows(statusKey, { force });
                this._renderRows(rows, { mode });
            }
        } catch (e) {
            console.error("showStatus error:", e);
        } finally {
            this._lockItemList(false);
        }
    }

    /** 非同期取得後のテーブル反映の中核
    *  - mode='replace'：全量差し替え（通常のステータス切替はこれ）
    *  - mode='append' ：追記（ページング等）
    *  - mode='upsert' ：同一IDは置換、なければ追加（差分更新APIのとき）
    */
    replaceTable(rows, { mode = "replace" } = {}) {
        if (!this.tableManager) return

        //今の選択ステータスに合わせてフィルタ条件を更新
        this.setupTableConditions(
            { "data-status": this.state.activeStatus?.ja },
            "filterVisbleRow"
        );

        // TableManager 側の行操作 API を優先的に呼ぶ
        if (mode === "append" && typeof this.tableManager.appendRows === "function") {
            this.tableManager.appendRows(rows);
        } else if (mode === "upsert" && typeof this.tableManager.upsertRows === "function") {
            this.tableManager.upsertRows(rows);
        } else if (mode === "replace" && typeof this.tableManager.replaceRows === "function") {
            this.tableManager.replaceRows(rows);
        } else {
            // ★ 後方互換: もし replaceRows 未実装なら従来の createTableRow を使って全差し替え
            this.tableManager.clearTbody(this.tableManager.table, "");
            this.tableManager.createTableRow(rows);
            this.tableManager.homeFilterTable();
        }

        // 列の出し分け（必要なら）
        this._toggleColumnVisible("label", this.state.activeStatus?.ja);

        // スクロールを先頭へ（任意）
        const scroller = document.getElementById("tableScroll");
        if (scroller) scroller.scrollTop = 0;
    }

    removeTable(ids) {
        if (!this.tableManager) return
        this.setupTableConditions(
            { "data-status": this.state.activeStatus?.ja },
            "filterVisbleRow"
        );

        if (typeof this.tableManager.removeRowsByIds === "function") {
            this.tableManager.removeRowsByIds(ids);
        }

        // 列の出し分け（必要なら）
        this._toggleColumnVisible("label", this.state.activeStatus?.ja);

        // スクロールを先頭へ（任意）
        const scroller = document.getElementById("tableScroll");
        if (scroller) scroller.scrollTop = 0;
    }

    /** 選択中optionをstateへ反映し、必要ならイベント発火 */
    setActiveSelectOption(opt, { emit = true } = {}) {
        const { select } = this.state.els;
        if (!select || !opt) return;
  
        // DOM反映
        select.value = opt.value;
  
        // state保持
        const payload = optionPayload(opt);
        this.state.activeUser = payload;         // ← ここに保持（init時/変更時で更新）
  
        // カスタムイベント発火（他処理が購読できる）
        if (emit) {
            window.dispatchEvent(new CustomEvent("user:change", { detail: payload }));
        }
    }
    /**
     * 所属(A/B/C班)opyionにdata-shift-start / data-shift-endを一度だけ注入
     *  -所属内は全員同じ start/end という前提 → 最初に見つかった個人の値を採用
     *  -既に埋まっている所属の option は上書きしない
     */
    _seedAffiliationShiftTimeOnce(selectEl) {
        if (this.affiliationShiftSeeded) return;
        this._affiliationShiftSeeded = true;

        const opts = Array.from(selectEl.options);

        //所属→(start, end) を最初の個人から拾う(両方そらっている個人の採用)
        const affToShift = new Map();

        for (const o of opts) {
            const userId = (o.dataset.userId ?? "").trim();
            if(!userId) continue;

            const aff = (o.dataset.affilation ?? o.dataset.affiliation ?? "").trim()
            if (!aff || affToShift.has(aff)) continue;

            const s = (o.dataset.shiftStart ?? "").trim();
            const e = (o.dataset.shiftEnd ?? "").trim();
            if(!s || !e) continue //片方欠けなら不採用(次の個人で補う)

            // 文字列としてそのまま保存("YYYY-MM-DDTHH:mm"前提)
            affToShift.set(aff, {start: s, end: e });

            //所属 option (data-user-idなし)に空欄なら埋める(各1回のみ)
            for (const o of opts) {
                const isAffOption = !(o.dataset.userId ?? "").trim();
                if (!isAffOption) continue;

                const aff = (o.dataset.affilation ?? o.dataset.affiliation ?? "").trim();
                const shift = affToShift.get(aff);
                if(!shift) continue;

                const hasStart = (o.dataset.shiftStart ?? "").trim().length > 0;
                const hasEnd = (o.dataset.shiftEnd ?? "").trim().length > 0;
                if (hasStart && hasEnd) continue;

                o.dataset.shiftStart = shift.start;
                o.dataset.shiftEnd = shift.end;

            }
        }
    }

    /* ---- Block 2: セレクト初期化 ---- */
    initStatusSelect() {
        const { select, employee } = this.state.els;
        const { viewportMode } = this.state.ui
        if (!select || !employee) return;

        //所属optionへシフト時刻を一度だけ注入
        this._seedAffiliationShiftTimeOnce(select);

        const employeeId = this.state.employeeId;

        // 1) user-id 一致
        let optByUser = Array.from(select.options).find(o =>
            String(o.dataset.userId ?? "").trim() === employeeId
        );

        if (optByUser) {
            if (viewportMode==='desktop' && optByUser.dataset.jobTitle==='班長') {
                const teamId = optByUser.dataset.belongs_id
                optByUser = select.querySelector(
                    `option[data-filter-label="teamOnly"][data-belongs_id="${CSS.escape(teamId)}"]`
                );
            }
            this.setActiveSelectOption(optByUser, {emit: false})
        } else {
            // 2) 所属フォールバック（affiliation/affilation 両対応）
            const aff = (employee.dataset.affiliation ?? employee.dataset.affilation ?? "").trim();
            const optByAff = aff
                ? Array.from(select.options).find(o => 
                    (o.dataset.affilation ?? o.dataset.affiliation ?? "") === aff
                 )
                : null;

            if (optByAff) {
                this.setActiveSelectOption(optByAff, { emit: false });
            } else {
                // 3) どれも無ければ先頭
                const first = select.options[0];
                if (first) this.setActiveSelectOption(first, { emit: false });
            }
        }
        // 変更イベント：選択変更でstate更新＆通知
        select.addEventListener("change", () => {
            const opt = select.options[select.selectedIndex];
            this.setActiveSelectOption(opt, { emit: true });
        });
    }

    _invalidateHolderScopeCache() {
        const keys = Array.from(this.state.cache.keys());
        keys.forEach(k => {
          // 例: "pending|holder|h=22259|a=123|w=0"
          if (k.includes("|holder|")) this.state.cache.delete(k);
        });
    }

    upDateState(res) {
        this.state.summary = res?.summary ?? [];
        this.state.holders = res?.holders_summary ?? [];
        this.state.progress = res?.progress ?? [];
        this.state.teamMemberMap = res?.team_member_map ?? [];
        this.state.meta.affilation_id = res?.meta.affilation_id ?? {};
    }

    upDateChart() {
        const { summary, holders } = this.state;
        const { chartData, chartOptions } = getTwoRingConfig(summary, holders);
        this.donut.chartUpdate(chartData, chartOptions);
    }

    //ユーザー切替時の処理
    async onActiveUserChanged(payload) {
        payload.status = this.state.activeStatus["ja"]
        const res = await fetchUserChange({payload});
        this.upDateState(res);

        const { me_this_all, group_week, group_this_all } = this.state.progress;
        let statusCountValue;
        if (me_this_all) {
            statusCountValue = me_this_all 
        } else {
            statusCountValue = group_this_all
        }
        
        this.renderPersonalProgress()
    
        this.upDateChart();
        for (const [key, value] of Object.entries(statusCountValue)) {
            if (STATUS_DICTIONARY[key]) {
                const statusJa = STATUS_DICTIONARY[key].ja
                this.clearDatasetKey(statusJa); //ステータスボタンのカウントを0にする
                this.statusButtonrecalculation(STATUS_DICTIONARY[key].ja, value); //ステータスボタンのカウントを更新する
            }
        }

        //グループスケジュールの更新
        this.ganttSetUpInstance?.clear();
        this.startGroupScheduleFetch()


        //キャッシュ無効化（holder スコープのみ）
        this._invalidateHolderScopeCache();
        //テーブル更新（api_wd_rows 呼び出し経由で再取得 → 反映）
        //現在アクティブなステータスで強制リロード
        await this.showStatus(this.state.activeStatus.key, { force: true, mode: "replace" });
        
    }

    //select 変更（＝ setActiveSelectOption が emit:true）で飛ぶイベントを購読
    async _bindUserChange() {
        window.addEventListener("user:change", async (e) => {
            const payload = e.detail;
            await this.onActiveUserChanged(payload)
        });
    }

    /* ---- Block 3: ドーナツ描画 ---- */
    renderDonut() {
        const { summary, holders, els } = this.state;
        this.donut = new ChartSetup(els.donutRootId, els.donutCanvasId);
        const { chartData, chartOptions } = getTwoRingConfig(summary, holders);
        this.donut.createDonutChart(chartData, chartOptions);
    }

    /* ---- Block 4: personalProgress 反映 ---- */
    renderPersonalProgress() {
        const p = this.state.progress;
        const groupTotal = UtilityManager.num(p?.group_this_week?.remaining);
        const pending = UtilityManager.num(p?.me_this_all?.pending);

        UtilityManager.setText("denominator1", groupTotal);
        UtilityManager.setText("molecule2",    pending);

        this.state.els.denominator.setAttribute("data-count", groupTotal);
        this.state.els.molecule.setAttribute("data-count", pending);
    }

    /* ---- Block 5: ステータスボタン初期表示 ---- */
    initStatusButtons() {
        const { progress, activeUser } = this.state;
        if (activeUser.filterLabel==='teamOnly') {
            setBtnCount("btnWaiting",  UtilityManager.num(progress?.group_this_week?.waiting));
            // 個人側
            setBtnCount("btnPending",  UtilityManager.num(progress?.group_this_all?.pending));
            setBtnCount("btnApproval", UtilityManager.num(progress?.group_this_all?.approval));
            setBtnCount("btnDelayed",  UtilityManager.num(progress?.group_this_all?.delayed));
            setBtnCount("btnRejected", UtilityManager.num(progress?.group_this_all?.rejected));

        } else {
            setBtnCount("btnWaiting",  UtilityManager.num(progress?.group_this_week?.waiting));
            // 個人側
            setBtnCount("btnPending",  UtilityManager.num(progress?.me_this_all?.pending));
            setBtnCount("btnApproval", UtilityManager.num(progress?.me_this_all?.approval));
            setBtnCount("btnDelayed",  UtilityManager.num(progress?.me_this_all?.delayed));
            setBtnCount("btnRejected", UtilityManager.num(progress?.me_this_all?.rejected));
        }
        //const myRow = holders.find(h => String(h?.holder_id ?? "") === employeeId) || {};

        // 組（班）側

    }

    clearDatasetKey(statusJa) {
        const buttonId = getIdFromJa(statusJa);
        setBtnCount(buttonId, 0);
    }

    statusButtonrecalculation(statusJa, value) {
        const buttonId = getIdFromJa(statusJa);
        const btn = UtilityManager.$id(buttonId);
        const count = Number(btn.dataset.count) + value
        setBtnCount(buttonId, count);
    }

    PersonalProgresscalculation(value) {
        const molecule = this.state.els.molecule
        const count = Number(molecule.getAttribute("data-count")) + value;
        UtilityManager.setText("molecule2", count);
        molecule.setAttribute("data-count", count);
    }

    //スケルトンを出す対象と見込み行数などを算出（UI責務）
    _getGanttSkeletonTarget() {
        const wrap = document.querySelector('#groupSchedule .gantt-container-parent');

        const leftWidth = '180';

        const skeletonRows = (this.state.teamMemberMap && Object.keys(this.state.teamMemberMap).length) || 6;
        
        return {
            wrap,
            skeletonOpts: { rows: skeletonRows, leftWidth, barHeight: 20, padding: 8},
        };
    }

    //取得に必要な
    _buildGroupScheduleParams({ days= 1, centerDate = null } = {}) {
        const center = formatDate(centerDate, "YYYY-MM-DD" || new Date(), "YYYY-MM-DD");
        const affiliationId = this.state.activeUser?.affiliation_id ?? this.state.meta?.affilation_id ?? null;
        return { days, center: center, affiliation_id: affiliationId };
    }

    async _fetchGroupScheduleData(params) {
        const res = await fetchGroupSchedule(params);
        const rows = res?.rows ?? [];
        const win = res?.window ?? null;

        const memberList =
        (Array.isArray(res?.member) && res.member.length
            ? res.member
            : (this.state.teamMemberList || []));


        const memberMap = Object.fromEntries(
            memberList.map((member) => [member.member_id, member.name])
        );

        const sStr = this.state.activeUser?.shiftStart;
        const eStr = this.state.activeUser?.shiftEnd;
        const shiftStart = addMinutesToDate(new Date(sStr), -120);
        const shiftEnd = addMinutesToDate(new Date(eStr), 120);

        return { rows, memberMap, memberList, win, shiftStart, shiftEnd };
    }

    _renderGroupSchedule( { rows, memberMap, memberList, win, shiftStart, shiftEnd }) {
        this.ganttSetUpInstance.update({ rows, memberMap, memberList, window: win, shiftStart, shiftEnd })
    }

    _setGanttLoading(root, on) {
        const scop = root.closest('#groupSchedule');
        //const header = scop.querySelector('.gantt-header-container');
        const parent = scop.querySelector('.gantt-container-parent');
        parent.classList.toggle('loading', on)
    }

    async loadGroupScheduleWithSkeleton(opts = {}) {
        const { wrap, skeletonOpts } = this._getGanttSkeletonTarget();
        const params = this._buildGroupScheduleParams(opts);
        
        await withGanttSkeleton(wrap, async () => {
            this._setGanttLoading(wrap, true); 
            try {
                const payload = await this._fetchGroupScheduleData(params);
                await swapSkeletonToGantt(
                    wrap,
                    () => this._renderGroupSchedule(payload),
                    { duration: 260 }
                );
            } finally {
                unmountGanttSkeleton(wrap);
            } 
        }, skeletonOpts);
    }

    startGroupScheduleFetch() {
        const run = () => this.loadGroupScheduleWithSkeleton({ days: 1 });
        if ('requestIdleCallback' in window) {
            requestIdleCallback(run, { time: 1500 });
        } else {
            requestAnimationFrame(() => setTimeout(run, 0));
        }
    }

      /* ---- Block 6: 仕上げ ---- */
    finalize() {

        window.dispatchEvent(new Event(EVENTS.appReady));
    }

    /** active を付け替え（必要ならイベント発火） */
    setActiveStatusButton(btn, { emit = true, fetch = true } = {}) {
        const { statusButtons } = this.state.els;
        if (!btn || !statusButtons?.length) return;
  
        statusButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // 辞書から英語キーと日本語ラベルを取得
        const key = getStatusFromButton(btn);  // 例: "pending"
        const ja  = statusJa(key);

        this.state.activeStatus = { key, ja, buttonId: btn.id };

        //サブタイトルの更新
        this.state.els.subTitle.textContent = ja;
                    
        // 他処理が拾えるようにカスタムイベント発火
        if (emit && key) {
            window.dispatchEvent(new CustomEvent("status:change", {
                detail: { key, ja, buttonId: btn.id }  // ← 両方渡すと後で便利
            }));
        }

        if (fetch && key) {
            this.loadRowsForStatus(key, { force: false })
        }
    }
    
    initSetupTable() {
        const onRowClick = (row) => {
            const planId = row.getAttribute('data-plan-id');
            const url = UIManger._updateUrlQuery(
                { planId, filterLabel: 'getOne'},
                { base: '/card/', history: false }
            );
            window.location.assign(url.toString());
        };

        this.tableManager = new TableManager('myTable', {
            onRowClick,
            isDraggable: false,
            filterRunner: "home",
        }, null, this.homeColumnManager);
        this.getStatusConfig();
        

        // 初期は SSR 行を「差し替え」で投入
        this.loadRowsForStatus("pending", { force: false });
        this._toggleColumnVisible('label' ,this.state.activeStatus.ja);
    }

    ganttSetup(){
        this.ganttSetUpInstance.init()
    }

    renderProgress() {
        const p = this.state.progress;
        const pending = UtilityManager.num(p?.me_this_all?.pending);
        const delayed = UtilityManager.num(p?.me_this_all?.delayed);

        UtilityManager.setText('modalThisWeekText', pending);
        UtilityManager.setText('modalDelayText', delayed);
    }

    _getMobileListEl() {
        const host = document.getElementById('taskTimeLine');
        if (!host) return null;

        let { mobileList } = this.state.els;
        if (!mobileList) {
            mobileList = document.createElement('div');
            mobileList.id = 'mobileList';
            mobileList.className = 'mobile-list';
            host.appendChild(mobileList);
        }
        return mobileList;
    }

    _buildTasksTimeLine(listEl ,rows = []) {
        const frag = document.createDocumentFragment();
        rows.forEach(item => {
            const planId = item['plan__plan_id'];
            const controlName = item['plan__inspection_no__control_no__machine'] ?? '';
            const workName = item['plan__inspection_no__wark_name'] ?? '';
            const manHour = item['plan__inspection_no__man_hours'] ?? '';
            const planTime = item['plan__plan_time'] ?? '';
            const endDate = addMinutesToDate(planTime, manHour);

            const display = {
                monthDay: planTime ? formatDate(planTime, 'MM.DD') : '',
                startText: planTime ? formatDate(planTime, 'HH:mm') : '',
                endText: endDate ? formatDate(endDate, 'HH:mm') : '',
            };

            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.dataset.planId = planId;

            card.innerHTML = `
                <div class="card-line1">
                    <span class="start-time">${controlName}</span>
                    <span class="value">${workName}</span>
                </div>
                <div class="card-line2">
                    <time class="month-day" datetime="${UIManger.esc(display.monthDay)}">${UIManger.esc(display.monthDay)}</time>
                    <span class="space"></span>
                    <time class="start-time" datetime="${UIManger.esc(display.startText)}">${UIManger.esc(display.startText)}</time>
                    <span class="dash"> - </span>
                    <time class="end-time" datetime="${UIManger.esc(display.endText)}">${UIManger.esc(display.endText)}</time>
                </div>
                `;
            // クリックでカード詳細へ
            card.addEventListener('click', () => {
                if(!planId) return;
                const url = UIManger._updateUrlQuery(
                    { planId, filterLabel: 'getOne'},
                    { base: '/card/', history: false }
                );
                window.location.assign(url.toString());
            })
            
            frag.appendChild(card);

        });
        listEl.innerHTML = '';
        listEl.replaceChildren(frag);
    }

    async setupMobileTaskTimeLine() {
        const listEl = this._getMobileListEl();//既存の#taskTimeLineセクション配下に#mobileListを1回だけ作る
        try {
            const rows = await withMobileListSkeleton(listEl, () => this.loadMobileList(), { rows: 8 }); //リストのロード
            await swapSkeletonToMobileList(listEl, () => {
                this._buildTasksTimeLine(listEl, rows);
            }, { duration: 240 });
        } catch (e) {
            console.error('[mobile] load error:', e);
            // スケルトン撤去してエラー表示
            listEl.removeAttribute('aria-busy');
            listEl.innerHTML = '<div class="error">読み込みに失敗しました</div>';
        }

    }

    mobileLayout() {
        const { mobilContent } = this.state.els
        UIManger.toggleClass(mobilContent, 'display-none', 'remove')
    }

    initSetupProgressUl() {
        const { progress, modalThisWeek, modalDelay  } = this.state.els
        const baseUrl = progress?.dataset.cardUrl || '/card/';

        const go = (params) => {
            const { activeUser } = this.state;
            const merged = {
                ...params,
                holderId: activeUser?.userId ?? undefined,
                affilationId: activeUser?.affilationId ?? undefined,
                filterLabel: activeUser?.filterLabel ?? undefined
            }
            showLoadingScreen();
            const url = UIManger._updateUrlQuery(merged, { base: baseUrl, history: false });
            window.location.assign(url.toString());
        };

        modalThisWeek.addEventListener('click', () => {
            go({ thisWeek: 1, status:'実施待ち' });
        });

        modalDelay.addEventListener('click', () => {
            go({ thisWeek: 0, status: '遅れ' })
        });
    }



    //共通
    _initCommon() {
        this.initStatusSelect();      // セレクト初期化
        this._bindUserChange();       //select変更＝user:change を購読

    }

    async loadMobileList() {
        const { params } = this._getCacheKeyAndParams(["delayed", "pending"]);
        const res = await fetchWdRows(params);
        return Array.isArray(res?.rows) ? res.rows : [];
    }

    // モバイルだけ
    _initMobile() {
        this.mobileLayout();
        this.initSetupProgressUl();
        this.renderProgress(); //モバイル進捗のロード
        this.setupMobileTaskTimeLine();
    }

    //テーブルだけ
    _initDesktop() {
        this.renderDonut();           // ドーナツ描画
        this.renderPersonalProgress();// 「組残り」「個人残り」
        this.initStatusButtons();     // ステータスボタン
        this.bindStatusButtonEvents(); // クリックで active 切替 + status:change 発火
        this.initSetupTable() //テーブルのセットアップ
        this.startGroupScheduleFetch()//グループスケジュールの作成
    }


    init() {
        this.hydrate();               // JSON/DOM を一度だけ読んで state
        const mode = UIManger.detectInitialViewportMode(); // 'mobile' | 'tablet' | 'desktop'
        this.state.ui.viewportMode = mode;

        this._initCommon()

        // モード別の初期化
        if (UIManger.isMobile(mode)) {
            this._initMobile();
        } else {
            this._initDesktop();
        }


        this.finalize();              // ローディング解除 & イベント
    }

    getStatusConfig() {
        this.statusConfig = this.homeColumnManager.statusConfig;
    }

    handlePageShow() {
        this.removeAcitveClass()
    }

    getCardForm(status ,element) {
       const url = `/card/?${status}`;
       window.location.href = url
    };

    clickaddStyle(element) {
        const targetElment = element;
        UIManger.toggleClass(targetElment, 'active', 'add');
    }

    removeAcitveClass() {
        const modalThisWeek = document.getElementById('modalThisWeek');
        const modalDelay = document.getElementById('modalDelay');
        UIManger.toggleClass(modalThisWeek, 'active', 'remove');
        UIManger.toggleClass(modalDelay, 'active', 'remove');
    }

    updateScrollTable() {
        this.tableScroll = document.getElementById('tableScroll');
    }

    /** 今の表示条件に対応する cacheKey を取得 */
    _getActiveCacheKey() {
        const statusKey = this.state.activeStatus?.key;
        const { cacheKey } = this._getCacheKeyAndParams(statusKey) ?? {};
        return cacheKey ?? null;
    }

    /** rows/レコードから plan_id を数値で取り出す (両方のキーに対応) */
    _getRowId(row) {
        return Number(row?.plan_id ?? row?.plan__plan_id ?? row?.id ?? NaN);
    }
    /**
     * 内部ヘルパー: cacheKey の実体（string）を安全に取り出す
     * @param {string | {cacheKey?: string}} cacheKey
     * @returns {string|undefined}
     */
    _getCacheKeyString(cacheKey) {
        return typeof cacheKey === 'string' ? cacheKey : cacheKey?.cacheKey;
    }

    /**
     * 指定キーの配列キャッシュを取得（なければ空配列）
     * 「読み取り専用」のつもりなら、呼び出し側で破壊的操作しないこと。
     * @param {string | {cacheKey?: string}} cacheKey
     * @returns {any[]} rows
     */
    _cacheGet(cacheKey) {
        const key = this._getCacheKeyString(cacheKey);
        if (!key) return [];
        return this.state.cache.get(key) ?? [];
    }

    /**
     * 指定キーに rows 配列を保存（全置換）
     * @param {string | {cacheKey?: string}} cacheKey
     * @param {any[]} rows
     */
    _cacheSet(cacheKey, rows) {
        const key = this._getCacheKeyString(cacheKey);
        if (!key) return;
        this.state.cache.set(key, rows);
    }

    /**
     * 指定キーのキャッシュから、ids に一致する行を削除
     * @param {string | {cacheKey?: string}} cacheKey
     * @param {number[]|string[]} ids
     */
    _cacheRemove(cacheKey, ids=[]) {
        if (!ids.length) return;
        const key = this._getCacheKeyString(cacheKey);
        if (!key) return;
      
        const idset = new Set(ids.map(Number));
        const next = this._cacheGet(key).filter(r => !idset.has(this._getRowId(r)));
        this._cacheSet(key, next);
    }

    /**
     * 指定キーのキャッシュに newRows を ID で upsert（同一IDは置換、未登録IDは追加）
     * @param {string | {cacheKey?: string}} cacheKey
     * @param {any[]} newRows
     */
    _cacheUpsert(cacheKey, newRows=[]) {
        if (!newRows.length) return;
        const key = this._getCacheKeyString(cacheKey);
        if (!key) return;
      
        const byId = new Map();
        // 既存 -> 先に入れることで、新規が同一IDなら後勝ちで上書きになる
        this._cacheGet(key).forEach(r => byId.set(this._getRowId(r), r));
        // 新規 -> 同一IDなら上書き、なければ追加
        newRows.forEach(r => byId.set(this._getRowId(r), r));
      
        this._cacheSet(key, Array.from(byId.values()));
    }

    /**
     * テーブル更新の意思決定（decision）に基づき、アクティブなキャッシュを同期
     * @param {{action: 'remove'|'upsert'|'noop', ids:number[], rows?:any[]}} decision
     */ 
    _syncActiveCacheAfterDecision(decision) {
        const cacheKey = this._getCacheKeyAndParams?.(decision.upDateStatus);
        if (!cacheKey || !decision) return;
      
        if (decision.action === 'remove') {
          this._cacheRemove(cacheKey, decision.ids);
        } else if (decision.action === 'upsert') {
          this._cacheUpsert(cacheKey, decision.rows);
        }
        // 'noop' の場合は何もしない
    }

    /**
     * 更新内容から「remove / upsert / noop」を導く
     * ルール:
     *  - afterHolderName が現在のアクティブユーザーなら、そのユーザーの一覧からは削除（remove）
     *  - beforeHolderName が現在のアクティブユーザー:
     *      - 表示中ステータスと data.status が一致 かつ rows がある → upsert（置換/追加）
     *      - それ以外 → remove（該当一覧から外す）
     *     - どちらでもなければ noop
     *
     * @param {{
     *   planId: string|number,
     *   rows?: any[],
     *   status?: string,             // 例: '実行中' など
     *   beforeHolderName?: string,
     *   afterHolderName?: string
     * }} data
     * @returns {{ action: 'remove'|'upsert'|'noop', ids:number[], rows?:any[] }}
     */
    _deriveUpdateDecision(data) {
        const activeUser = this.state.activeUser?.userName;
        const activeJa   = this.state.activeStatus?.ja;
        const planId     = Number(data?.planId);
        const hasRows    = Array.isArray(data?.rows) && data.rows.length > 0;
      
        // 移動後の担当者 = 今見ているユーザー → 既に相手側へ移ったので、こちらの一覧からは削除
        if (data?.afterHolderName === activeUser) {
          return { action: 'remove', ids: [planId] };
        }
      
        // 移動前の担当者 = 今見ているユーザー
        if (data?.beforeHolderName === activeUser) {
          // さらに状態（ステータス）が現在のビューと一致 & 行データがある → upsert（表示内容を最新に更新）
          if (data?.status === activeJa && hasRows) {
            return { action: 'upsert', ids: [planId], rows: data.rows };
          }
          // そうでなければ、現在のビューからは外す（見えなくなる）
          return { action: 'remove', ids: [planId] };
        }
      
        // どちらの担当者視点でもなければ何もしない
        return { action: 'noop', ids: [planId] };
    }

    scrollToTargetRow = (visibleRows) => {
        const now = new Date();
        this.updateScrollTable();
        const targetRow = this.findTargetRow(visibleRows, now);
        if (targetRow) {
            this.tableManager.scrollToRow(this.tableScroll, targetRow);
        }
    };

    findTargetRow = (rows, now) => {
        for (const row of rows) {
            const startTimeStr = row.getAttribute('data-start-time');
            const startTime = new Date(startTimeStr);
            if (!isNaN(startTimeStr)) continue;
            if(startTime > now) {
                return row;
            }
        }
        return null;
    }

    mobileAjustHeight() {
        const lHeaderElement = document.querySelector('.l-header');
        this.lHeaderHight = lHeaderElement.getBoundingClientRect().height;
        const windowHeight = UIManger.getScreenHeight();
        const tableContenerHeight = this.tableScroll.getBoundingClientRect().top;
        const tableHight = windowHeight - tableContenerHeight;
        this.tableScroll.style.maxHeight = `${tableHight}px`;
    }

    setupTableConditions(filterConditions, filterPattern) {
        if (UIManger.isValidValue(filterConditions)) {
            this.tableManager.filterConditions = {};
            this.tableManager.filterConditions = { ...filterConditions };
            this.tableManager.options.filterPattern = filterPattern;
            const { userId, affiliation } = this.state.activeUser
            if (UIManger.isValidValue(userId)) {
                this.tableManager.filterConditions['data-holder-member-id'] = userId;
                this.tableManager.filterConditions['affiliation'] = affiliation;
            } else if (affiliation) {
                this.tableManager.filterConditions['affiliation'] = affiliation 
            }
        }
    }

    shouldCalculateEndDay(rows) {
        rows.forEach(row => {
            this.appendWorkNameToControlName(row);
            this.appendEndTimeToStartTime(row);            
        });
    }

    appendWorkNameToControlName(row) {
        const workNameText = row.getAttribute('data-work-name');
        const controlNameSpan = row.querySelector('.control-name-line-break');
        if (controlNameSpan) {
            const br = document.createElement('br');
            br.classList.add('margin-br');
            controlNameSpan.appendChild(br);
            controlNameSpan.appendChild(document.createTextNode(workNameText));
        }
    }

    appendEndTimeToStartTime(row) {
        const startTime = row.getAttribute('data-start-time');
        const manHour = row.getAttribute('data-man-hour');

        if (isValidDate(startTime)) {
            const endTime = addMinutesToDateTimeLocal(startTime, manHour);
            const endTimeISO = toDateTimeLocalString(endTime);
            const endTimeText = formatDate(endTimeISO, 'H:i');

            const startTimeSpan = row.querySelector('.start-time-line-break');
            if (startTimeSpan) {
                const br = document.createElement('br');
                br.classList.add('margin-br');
                startTimeSpan.appendChild(br);
                startTimeSpan.appendChild(document.createTextNode(endTimeText));
            }
        }
    }

    _toggleColumnVisible(property, value) {
        const statusColumnsConfig = Object.values(this.statusConfig).find(config => config[property] === value) || null;
        this.tableManager.toggleColumnVisible(statusColumnsConfig.columnsStyle);
        return statusColumnsConfig
    }

    progressTextUpdate() {
        const modalThisWeekTextContent = document.getElementById('modalThisWeekText');
        const modalDelayTextContent = document.getElementById('modalDelayText');
        const countBtnPending = document.querySelector('#btnPending .count');
        const countbtnDelayed = document.querySelector('#btnDelayed .count');
        if (countBtnPending) {
            const countBtnPendingText =  countBtnPending.textContent;
            const covCountBtnPendingText = countBtnPendingText.replace(/[()]/g, '');
            modalThisWeekTextContent.textContent = covCountBtnPendingText;
        }
        if (countbtnDelayed) {
            const countbtnDelayedText = countbtnDelayed.textContent;
            const covcovCountBtnPendingText = countbtnDelayedText.replace(/[()]/g, '');
            modalDelayTextContent.textContent = covcovCountBtnPendingText;
        }
    }

}

class GanttSetUp {
    constructor(homeInstance) {
        this.home = homeInstance;
        this.el = UtilityManager.$id('gantt');
        this.rows = [];
        this.memberMap = {};
        this.window = null;           
        this.shiftStart = null;       
        this.shiftEnd = null;         
        this.options = null;
        this.tasks = [];
        this.gantt = null;
        this.updatePeding = false;
        this.isScrolling;
    }

    /**
    * 外部からデータを注入して、オプション準備→描画まで
    */
    update({ rows = [], memberMap = {}, memberList = [],window = null, shiftStart = null, shiftEnd = null } = {}) {
        this.rows = Array.isArray(rows) ? rows : [];
        this.memberList = memberList
        this.memberMap = memberMap || {};
        this.shiftStart = shiftStart;
        this.shiftEnd   = shiftEnd;
        this.options = this.makeOptions();
        this.tasks = this.buildTasks(rows, memberMap);
        this.createGanttContent();
        this.scrollToPosition();
    }

    makeOptions() {
        return {
            header_height: 50,
            bar_height: 20,
            view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month', 'Time'],
            view_mode: 'Time',
            date_format: 'YYYY-MM-DDTHH:mm',
            shift_start: this.shiftStart,
            shift_end: this.shiftEnd,
            popup_trigger: 'mouseover',
            members: this.memberMap,
            memberList: this.memberList,
        }
    }


    buildTasks(rows, memberMap) {
        const tasks = [];
        const startWin = this.shiftStart;
        const endWin   = this.shiftEnd;
    
        rows.forEach(row => {
            const startStr = row?.['plan__plan_time'];
            if (!startStr) return;

            const start = new Date(startStr);
            if (Number.isNaN(start.getTime())) return;
    
            // シフト窓内判定（[startWin, endWin)）
            if (startWin && endWin && (start < startWin || start >= endWin)) return;

            const holderId = String(row?.['holder_member_id'] ?? '').trim();
            if (!holderId) return;
            if (!Object.prototype.hasOwnProperty.call(memberMap, holderId)) return;
    
            const machine = row?.['plan__inspection_no__control_no__machine'] || '';
            const work    = row?.['plan__inspection_no__wark_name'] || '';
            const manHourStr = row?.['plan__inspection_no__man_hours'];
            const holder  = row?.['holder_name'] || '';
            const id      = row?.['plan__plan_id'];

            const manHour = parseInt(manHourStr, 10);
            if (!Number.isFinite(manHour) || manHour <= 0) return;

            const end =     date_utils.add(start, manHour, 'minute')
    
            tasks.push({
                id: String(id),
                name: `${machine}_${work}`.replace(/^_+|_+$/g, ''), // 余分な _ を除去
                start,
                end,
                assignee: holder, // ライブラリに合わせて 'resource' 等に変更
                // 必要なら追加のメタ
                custom: {
                    status: row?.['status'],
                    holderId: String(row?.['holder_member_id'] ?? ''),
                    timeZone: row?.['plan__inspection_no__time_zone'] ?? '',
                    comment: row?.['plan__comment'] ?? '',
                }
          });
        });
    
        return tasks;
    }

    makeAssigneeNames() {
        if (!this.gantt) return;

        const old = document.querySelector('.assignee-names');
        if (old) old.remove();

        //担当者の名前をHTMLに追加
        //const assigneeNames = Object.keys(this.gantt.assigneeRows);
        
        //const assigneeNames = Object.values(this.memberMap);

        const assigneeNames = this.memberList.map((member) => member.name);

        //担当者名を表示するためのdiv要素を作成
        const assigneeNamesDiv = document.createElement('div');
        assigneeNamesDiv.className = 'assignee-names';

        const nameDivHeight = this.gantt.options.bar_height + this.gantt.options.padding;
        assigneeNamesDiv.style.width = `${this.gantt.gantt_offset_width}px`;

        assigneeNames.forEach((assignee, index) => {
            const nameDiv = document.createElement('div');
            nameDiv.classList.add('assignee-name');
            nameDiv.setAttribute('data-row-number', index);
            nameDiv.style.height = `${nameDivHeight}px`;
            nameDiv.style.lineHeight = `${nameDivHeight}px`;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = assignee;
            nameDiv.appendChild(nameSpan);


            assigneeNamesDiv.appendChild(nameDiv);
        });
        const assigneeContainer = document.querySelector('.assignee-container');                     
        assigneeContainer.appendChild(assigneeNamesDiv);
        this.ganttHeaderText = document.querySelectorAll('.gantt-header text');
    }

    createGantt() {
        const statusDeps = {
            DICT: STATUS_DICTIONARY,  // { pending:{ja:'実施待ち', id:'btnPending'}, ... }
            JA_TO_KEY,                // { '実施待ち':'pending', ... }
            // 省略可：上書きしたいヘルパがあれば
            helpers: {
                statusJa: (k) => STATUS_DICTIONARY[k]?.ja ?? k,
                getKeyFromJa: (ja) => JA_TO_KEY[ja] ?? null,
            }
        };
        return new Gantt('#gantt', this.tasks, this.options, { home: this.home, GanttSetUpInstance: this,  status: statusDeps });
    }

    createGanttContent() {
        this.gantt = this.createGantt();
        this.makeAssigneeNames();
        this.computeInitialSize();
        this.initaGanttdjustGridHeight();
        this.attachEvnetListeners();    
    }

    computeInitialSize(){
        this.row2Rect = document.querySelector('.row2').getBoundingClientRect();
        const groupScheduleTitle = document.getElementById('groupScheduleTitle')
        this.groupScheduleTitleHeight = UIManger.calculateBoxModelDimensions(groupScheduleTitle, ['marginTop', 'marginBottom']);
        this.groupScheduleTitleHeight = this.groupScheduleTitleHeight + groupScheduleTitle.offsetHeight;
        this.ganttHeaderContainerRect = document.querySelector('.gantt-header-container').getBoundingClientRect();

        const headerGrid = document.querySelector('.gantt-header-grid');
        const headerGridRect = headerGrid.getBoundingClientRect();
        this.headerGridBottomY = headerGridRect.top + headerGridRect.height;
    }

    initaGanttdjustGridHeight() {
        const ganttContainerParent = document.querySelector('.gantt-container-parent');
        const ganttContainerMaxHeight = this.row2Rect.height - (this.groupScheduleTitleHeight + this.ganttHeaderContainerRect.height);
        ganttContainerParent.style.maxHeight = `${ganttContainerMaxHeight}px`
    
        const gantt = document.getElementById('ganttSvg');
        const assigneeNames = document.querySelectorAll('.assignee-name');

        const headerGrid = document.getElementById('ganttHeaderGrid');

        //ヘッダーの高さ
        const headerHeight = headerGrid?.getBoundingClientRect().height || 0;

        //行数
        const rowCount = assigneeNames.length;
        
        //最初の行の高さを取得
        let rowHeight = 0;
        if (rowCount > 0) {
            const rect = assigneeNames[0].getBoundingClientRect();
            rowHeight = rect.height;
        }

        //高さ設定
        const totalHeight = headerHeight + (rowCount * rowHeight);
        if (totalHeight > ganttContainerMaxHeight) {
            gantt.style.height = `${ganttContainerMaxHeight}`
        } else {
            gantt.style.height = `${totalHeight}px`;
        }
    }

    //イベントリスナーをアタッチするメソッド
    attachEvnetListeners() {
        let lastScrollTop = this.el.scrollTop;
        let lastScrollLeft = this.el.scrollLeft;
        $.on(this.el , 'scroll', () => {
            let scrollDirection = '';
            let currentScrollTop = this.el.scrollTop;
            let currentScrollLeft = this.el.scrollLeft;

            if (currentScrollTop !== lastScrollTop) {
                scrollDirection = 'vertical'
            } else if (currentScrollLeft !== lastScrollLeft) {
                scrollDirection = 'horizontal';
            }
            if (scrollDirection) {
                this.requestUpdate(scrollDirection);
            }
            lastScrollTop = this.el.scrollTop;
            lastScrollLeft = this.el.scrollLeft;
        });
    }

    //更新をリクエストするメソッド
    requestUpdate(scrollDirection) {
        //更新が既に保留されている場合は、何もしない
        if(this.updatePending) {
            return;
        }
        this.updatePending = true;

        //次に描画前に更新をスケジュールする
        requestAnimationFrame(() => {
            this.updatePositions(scrollDirection);
            this.updatePending = false;
        });
    }

    updatePositions(scrollDirection) {
        clearTimeout(this.isScrolling);
        switch (scrollDirection) {
            case 'vertical':
                this.updateAssigneeContainerPosition(this.el.scrollTop);
                this.isScrolling = setTimeout(() => {
                    const currentScrollTop = this.el.scrollTop;
                    const nearstRowStart = Math.round(currentScrollTop / this.rowHeight) * this.rowHeight
                    this.el.scrollTop = nearstRowStart;
                }, 66);
                break;

            
            //横スクロールが発生したか検出
            case 'horizontal':
                this.isScrolling = setTimeout(() => {
                    const currentScrollLeft = this.el.scrollLeft;
                    this.updateGanttHeaderPosition(currentScrollLeft);
                    this.lastScrollLeft = currentScrollLeft;
                }, 22);
                break;
        }
    }

    //assignee-containerの縦位置を更新するメソッド
    updateAssigneeContainerPosition(scrollTop) {
        const ganttContainerParentRect = document.querySelector('.gantt-container-parent').getBoundingClientRect();
        const assigneeContainer = document.querySelector('.assignee-container');
        assigneeContainer.style.transform = `translateY(${-scrollTop}px)`;
        const assigneeNames = document.querySelectorAll('.assignee-name');
        assigneeNames.forEach(name => {
            const nameRect = name.getBoundingClientRect();
            let rowNumber = name.getAttribute('data-row-number');
            let element = document.querySelector(`.grid-row[data-row-number="${rowNumber}"]`);
            if (nameRect.bottom < this.headerGridBottomY) {
                UIManger.toggleClass([element, name], 'display-none', 'add');
            } else {
                UIManger.toggleClass([element, name], 'display-none', 'remove');
            }
            if (nameRect.bottom > (ganttContainerParentRect.top + ganttContainerParentRect.height)) {
                UIManger.toggleClass([element, name], 'display-none', 'add');
            }
        })   
    }

    //gantt-header-containerの横位置を更新するメソッド
    updateGanttHeaderPosition(scrollLeft) {
        const ganttHeaderContainer = document.querySelector('.gantt-header-container');
        ganttHeaderContainer.style.transform = `translateX(${-scrollLeft}px)`;

        const dayTextElement = document.getElementById('dayText');
        dayTextElement.textContent = ''
        const dataDictionary = {};
        let textDay = ''

        //transformの値からtranlateXの値を取得
        const transformXValue = ganttHeaderContainer.style.transform;
        const translateX = parseInt(transformXValue.replace('translateX(', '').replace('px)', ''), 10);
        const widthXMin = translateX - this.gantt.gantt_offset_width;
        const widthXMax = widthXMin - this.el.offsetWidth;

        this.ganttHeaderText.forEach((textElements) => {
            const xPosition = parseInt(textElements.getAttribute('x'), 10);
            if (xPosition <= Math.abs(widthXMin) || xPosition > Math.abs(widthXMax)) {
                UIManger.toggleClass([textElements], 'display-none', 'add');
            } else {
                UIManger.toggleClass([textElements], 'display-none', 'remove')
                textDay = textElements.getAttribute('data-day');
                if (textDay && !(textDay in dataDictionary)) {
                    dataDictionary[textDay] = true;
                    let currentText = dayTextElement.textContent;
                    if (currentText) {
                        dayTextElement.textContent = `${currentText} - ${textDay}`;
                    } else {
                        dayTextElement.textContent = textDay;
                    }
                }
            }
        });
    }

    scrollToPosition() {
        if (this.el) {
            this.el.scrollTo({
                left: this.gantt.containerXCoorinate -250,
                behavior: 'smooth'
            });
        }
    }

    upDateGantt(data) {
        if (data.afterHolderName === this.home.state.activeUser.userName) {
            this.home.statusButtonrecalculation(data.status, -1);
            this.home.PersonalProgresscalculation(-1);
        } else if (data.beforeHolderName === this.home.state.activeUser.userName) {
            this.home.statusButtonrecalculation(data.status, 1);
            this.home.PersonalProgresscalculation(1);

        }
    }

    clear() {
        this.updatePending = false;
        if (this._scrollHandler && this.el) {
          this.el.removeEventListener('scroll', this._scrollHandler);
          this._scrollHandler = null;
        }
        if (this._resizeHandler) {
          window.removeEventListener('resize', this._resizeHandler);
          this._resizeHandler = null;
        }
        if (this._rafId) cancelAnimationFrame(this._rafId), (this._rafId = null);
        if (this.isScrolling) clearTimeout(this.isScrolling), (this.isScrolling = null);
    
        // 3) ヘッダーviewport (.gantt-header-viewport) を除去
        //    生成時は .gantt-container-parent の親直下に挿入している想定
        try {
          const parent = document.querySelector('#groupSchedule .gantt-container-parent');
          const host = parent?.parentNode || null;
          const headerViewport = host?.querySelector(':scope > .gantt-header-viewport');
          headerViewport?.remove();
        } catch (_) {}
    
        // 4) #groupSchedule を“初期の素の構造”に戻す
        const root = document.getElementById('groupSchedule');
        if (root) {
          root.innerHTML = `
            <h4 id="groupScheduleTitle" class="grid-title t-left">グループスケジュール 
                <span>(<span id="dayText"></span>)</span>
                <span id="workContenxt"></span>
            </h4>
            <div class="gantt-container-parent">
                <div class="assignee-container"></div>
                <div id="gantt"></div>
            </div>
          `.trim();
        }
    
        // 5) 参照を初期状態へ（次回 init/update に備える）
        this.$svg = null;
        this.$container = null;
        this.popup_wrapper = null;
        this.ganttHeader = null;
        this.ganttHeaderContainer = null;
        this.ganttContainerParent = null;
    
        this.el = document.getElementById('gantt'); // 新しく再取得
        this.rows = [];
        this.tasks = [];
        this.memberMap = {};
        this.gantt = null;

    }
}

document.addEventListener("DOMContentLoaded", () => {
    try {
        initializeLoadingScreen();
        
        const app = new Home();
        app.init();
    } catch (err) {
        console.error("[home] init failed:", err)
    }
})
