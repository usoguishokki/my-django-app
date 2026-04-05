import {
    asynchronousCommunication,
    requestFile,
} from '../asyncCommunicator/index.js';
/**
 * ステータス別の行を取得
 * @param {Object} p
 *  - statusKey: 'waiting'|'approval'|'delayed'|'rejected' など英語キー
 *  - holderId?:  文字列（個人で絞るとき）
 *  - affilationId?: 数値（班で絞るとき / waiting を班で見る等）
 *  - thisWeek?:  true|false（今週だけに限定）
 *  - limit?: number, offset?: number
 */
export function fetchWdRows(p = {}) {
    const params = new URLSearchParams();

    const statusKeys = Array.isArray(p.statusKeys)
        ? p.statusKeys
        : (p.statusKey ? [p.statusKey] : []);
    
    statusKeys.forEach(k => params.append("status", k)); 


    if (p.holderId)     params.set("holder_id", p.holderId);
    if (p.affilationId) params.set("affilation_id", String(p.affilationId));
    if (p.thisWeek != null) params.set("this_week", p.thisWeek ? "1" : "0");
    if (p.limit != null)    params.set("limit", String(p.limit));
    if (p.offset != null)   params.set("offset", String(p.offset));
    if (p.week)             params.set("week", p.week);

    return asynchronousCommunication({
        url: `/api/wd/?${params.toString()}`,
        method: "GET",
    }); // => { status:'success', rows:[...], count:number }
}

export function fetchPlanRows(p = {}) {
    const params = new URLSearchParams();
    if (p.week) {
        params.set('week', p.week);
    }

    if (Array.isArray(p.statuses)) {
        p.statuses
            .filter(Boolean)
            .forEach((status) => {
                params.append('status', status);
            });
    }
    return asynchronousCommunication({
        url: `/api/plans/?${params.toString()}`,
        method: 'GET',
    }); // => { status:'success', rows:[...], count: n, selected:{data_alias} }
}

export function fetchUserChange(params = {}) {
    const qs = new URLSearchParams();
    if (params.payload.userId)     qs.set("holder_id", params.payload.userId);
    if (params.payload.affiliation_id) qs.set("affilation_id", params.payload.affiliation_id);
    if (params.payload.status) qs.set("status", params.payload.status);
    if (params.payload.thisWeek != null) qs.set("this_week", String(params.payload.thisWeek ? 1 : 0));
    return asynchronousCommunication({ 
        url: `/api/user_change/?${qs.toString()}`, 
        method: "GET", 
    });
}


/**
 * グループスケジュール取得
 * GET /api/group-schedule/?days=1&center_date=YYYY-MM-DD
 *
 * @param {Object}  p
 * @param {number}  p.days         - 片側の日数（1なら 前後1日ぶんを返す実装想定）
 * @param {string|Date} p.centerDate - 中央日付（省略時は今日）。YYYY-MM-DD 文字列 or Date
 * @returns Promise<{status:'success', rows:Array, window?:{start,end,tz}}>
 */
export function fetchGroupSchedule(p = {}) {
    const params = new URLSearchParams();
  
    const days = Number.isFinite(p.days) ? Number(p.days) : 1;
    params.set("days", String(days));
  
    // center_date は YYYY-MM-DD に整形
    let center = p.centerDate;
    const affiliation_id = p.affiliation_id;
    if (center instanceof Date) {
        center = center.toISOString().slice(0, 10);
    }
    if (typeof center === "string" && center) {
        params.set("center_date", center);
    }

    if (typeof affiliation_id === "string") {
        params.set("affiliation_id", affiliation_id);
    }
  
    return asynchronousCommunication({
        url: `/api/group-schedule/?${params.toString()}`,
        method: "GET",
    }); // => { status:'success', rows:[...], window:{start,end,tz} }
}

/**
 * KPIマトリクス用データ取得
 * 例）GET /api/kpi-matrix/?period_view=month&target_view=team&metric=plan&base_date=YYYY-MM-DD
 *
 * - period_view: 'month' | 'week' | 'day'
 * - target_view: 'team'  | 'individual'
 * - metric:      'plan'  | 'actual' | 'delay' | 'rate' など（今回は 'plan' 固定でOK）
 *
 * @param {Object} p
 * @param {'month'|'week'|'day'} [p.periodView='month']  - 期間の粒度
 * @param {'team'|'individual'}  [p.targetView='team']   - 班 or 個人
 * @param {string|Date}          [p.baseDate=new Date()] - 基準日（会計年度の判定などに使う想定）

 * @param {Object}               [p.filters]             - 追加フィルタ（必要なら JSON で送る）
 *
 * @returns {Promise<{status:'success', matrix:any}>}
 */
export function fetchKpiMatrix(p = {}) {
    const params = new URLSearchParams();
  
    const periodView = p.periodView || "month";      // 'month' | 'week' | 'day'
    const targetView = p.targetView || "team";       // 'team' | 'individual'
  
    params.set("period_view", periodView);
    params.set("target_view", targetView);
  
  
    // base_date は YYYY-MM-DD 文字列に整形（会計年度の判定などに使えるように）
    let base = p.baseDate ?? new Date();
    if (base instanceof Date) {
        base = base.toISOString().slice(0, 10);
    }
    if (typeof base === "string" && base) {
        params.set("base_date", base);
    }
  
    // 将来、query_builders 由来の filters_json を飛ばしたくなったとき用の拡張口
    if (p.filters && typeof p.filters === "object") {
        try {
            params.set("filters", JSON.stringify(p.filters));
        } catch (e) {
            // JSON化に失敗したら送らない（静かに無視）
        }
    }
  
    return asynchronousCommunication({
        url: `/api/kpi-matrix/?${params.toString()}`,
        method: "GET",
    });
}


/**
 * KPIマトリクスのセル詳細取得
 *
 * GET /api/kpi-matrix/cell-detail/?period_view=month&period_key=4&team=A&metric=plan
 *
 * @param {Object} p
 * @param {'month'|'week'}        p.periodView  - 期間粒度（セル側と合わせる）
 * @param {string|number}         p.periodKey   - "4" / "7-2" など（data-period-key）
 * @param {string}                p.team        - "A" / "B" / "C" / "all"（data-team）
 * @param {'plan'|'actual'|
*         'delay'|'recovery'}    p.metric      - data-type
* @param {Object}               [p.filters]    - 追加フィルタ（必要なら JSON で送る）
*
* @returns {Promise<{status:'success', rows:Array}>}
*/
export function fetchKpiCellDetail(p = {}) {
    const params = new URLSearchParams();

    const periodView = p.periodView || 'month';
    const periodKey  = p.periodKey;
    const team       = p.team;
    const metric     = p.metric;

    params.set('period_view', periodView);

    if (periodKey != null) {
        params.set('period_key', String(periodKey));
    }
    if (typeof team === 'string' && team) {
        params.set('team', team);
    }
    if (typeof metric === 'string' && metric) {
        params.set('metric', metric);
    }

    if (p.filters && typeof p.filters === 'object') {
      try {
            params.set('filters', JSON.stringify(p.filters));
      } catch (e) {
            // JSON 化に失敗したら静かに捨てる（他の fetch と同じ方針）
      }
    }

    return asynchronousCommunication({
        url: `/api/kpi-matrix/cell-detail/?${params.toString()}`,
        method: 'GET',
    });
}


/**
 * 計画（Plan）の詳細情報を取得する
 *
 * @function fetchPlanDetail
 * @param {Object} [p={}] - パラメータオブジェクト
 * @param {string|number} p.planId - 取得対象の plan_id（必須）
 * @returns {Promise<any>} 非同期通信の結果（APIのレスポンスJSON）
 *
 * @throws {Error} planId が未指定の場合に例外を投げる
 *
 * @example
 * const res = await fetchPlanDetail({ planId: 123 });
 * // res => { status: 'success', ... }
 */
export function fetchPlanDetail(p = {}) {
    const planId = p.planId;
    if (!planId) throw new Error('planId is required');
  
    return asynchronousCommunication({
      url: `/api/plans/${encodeURIComponent(String(planId))}/detail/`,
      method: 'GET',
    });
}

export function fetchInspectionCardDetail(p = {}) {
    const inspectionNo = p.inspectionNo;
    if (!inspectionNo) throw new Error('inspectionNo is required');
  
    return asynchronousCommunication({
      url: `/api/inspection-cards/${encodeURIComponent(String(inspectionNo))}/detail/`,
      method: 'GET',
    });
}

export function fetchInspectionPlansHistory(p = {}) {
    const inspectionNo = p.inspectionNo;
    if (!inspectionNo) throw new Error('inspectionNo is required');
  
    return asynchronousCommunication({
        url: `/api/inspection-cards/${encodeURIComponent(String(inspectionNo))}/plans/`,
        method: 'GET',
    });
}


/**
 * カード表示用の詳細を取得
 * GET /calendar/?format=json&plan_id=123
 */
export function fetchCalendarCardDetail(p = {}) {
  const planId = p.planId;
  if (!planId) throw new Error('planId is required');

  const qs = new URLSearchParams();
  qs.set('format', 'json');
  qs.set('plan_id', String(planId));

  return asynchronousCommunication({
    url: `/calendar/?${qs.toString()}`,
    method: 'GET',
  });
}

export function fetchRegistration(p = {}) {
    const {
        dateStart,
        dateEnd,
        dataPlanIds = [],
        member,
    } = p;

    if (!dateStart) throw new Error('dateStart is required');
    if (!dateEnd) throw new Error('dateEnd is required');
    if (!member) throw new Error('member is required');

    return asynchronousCommunication({
        url: '/calendar/',
        method: 'POST',
        data: {
            action: 'fetch_registration',
            dateStart,
            dateEnd,
            dataPlanIds,
            member,
        },
    });
}

export function fetchMemberAssignedPlans(p = {}) {
    const { member } = p;
    if (!member) throw new Error('member is required');

    const params = new URLSearchParams();
    params.set('member', member);

    return asynchronousCommunication({
        url: `/api/member-assigned-plans/?${params.toString()}`,
        method: 'GET',
    });
}


export function executePullback(p = {}) {
    const { planId } = p;

    if (!planId) throw new Error('planId is required');

    return asynchronousCommunication({
        url: '/api/pullback/',
        method: 'POST',
        data: {
            planId,
        },
    });
}

export function executeBulkPullback(p = {}) {
    const { planIds = [] } = p;

    if (!Array.isArray(planIds) || !planIds.length) {
        throw new Error('planIds is required');
    }

    return asynchronousCommunication({
        url: '/api/bulk-actions/pullback/',
        method: 'POST',
        data: {
            planIds,
        },
    });
}


export function fetchInspectionStandardMachines(p = {}) {
    const params = new URLSearchParams();

    if (p.keyword) params.set('keyword', p.keyword);

    return asynchronousCommunication({
        url: `/api/csv-download/inspection-standard/machines/?${params.toString()}`,
        method: 'GET',
    });
}

export function executeInspectionStandardDownload(p = {}) {
    const { controlNo } = p;

    if (!controlNo) throw new Error('controlNo is required');

    return requestFile({
        url: '/api/csv-download/inspection-standard/',
        method: 'POST',
        data: {
            control_no: controlNo,
        },
        fallbackFilename: 'inspection_standard.csv',
    });
}

export function executeInspectionPlanResultDownload(p = {}) {
    const {
        planResultOption,
        startMonth,
        endMonth,
    } = p;

    if (!planResultOption) {
        throw new Error('planResultOption is required');
    }

    return requestFile({
        url: '/api/csv-download/inspection-plan-result/',
        method: 'POST',
        data: {
            planResultOption,
            start_month: startMonth,
            end_month: endMonth,
        },
        fallbackFilename: 'inspection_plan_result.csv',
    });
}


export function fetchScheduleDay(p = {}) {
    const params = new URLSearchParams();

    if (p.date) params.set('date', p.date);
    if (p.affiliationId) params.set('affiliationId', p.affiliationId);


    return asynchronousCommunication({
        url: `/api/schedule/day/?${params.toString()}`,
        method: 'GET',
    });
}