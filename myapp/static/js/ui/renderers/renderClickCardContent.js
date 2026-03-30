import { fetchInspectionCardDetail } from '../../api/fetchers.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * rowEl から planId を取り、/calendar/ へ fetch してカードHTMLを返す
 * buildContent として Binder から呼ばれる
 */
export async function renderClickCardContent(rowEl) {
  const inspectionNo = rowEl.dataset.planInspectionNo; // data-plan-inspection-no
  if (!inspectionNo) return `<div>inspection_no が見つかりません</div>`;

  const res = await fetchInspectionCardDetail({ inspectionNo  });

  // asynchronousCommunication の返り値に合わせて分岐
  if (!res || res.status !== 'success') {
    return `<div>取得に失敗しました</div>`;
  }

  // ここはサーバの返却仕様に合わせて後で拡張
  const d = res.detail ?? res.data ?? res;

  return `
    <div class="click-card__title">詳細</div>
    <div class="click-card__meta">
      <div class="click-card__row">
        <span class="click-card__key">plan_id</span>
        <span class="click-card__val">${escapeHtml(planId)}</span>
      </div>
      <div class="click-card__row">
        <span class="click-card__key">内容</span>
        <span class="click-card__val">${escapeHtml(JSON.stringify(d))}</span>
      </div>
    </div>
  `;
}