/**
 * @file PlanSchedulingApiClient.js
 * @module planScheduling/application/PlanSchedulingApiClient
 * @summary 計画調整の読取と明示的な予定移動API通信を担当する
 * @responsibility (SRP)
 * - 指定日の保全週ページ状態を取得する
 * - 確認済みの予定移動をCSRF保護されたPOSTで送信する
 * @not_responsible
 * - 状態計算、DOM操作、予定移動の業務検証
 * @inputs
 * - fetch実装、対象日
 * @outputs
 * - APIのページ状態
 * @side_effects
 * - GET通信、明示確認後のMove POST通信
 */

export class PlanSchedulingApiError extends Error {
  constructor(message, { status = 0, code = '' } = {}) {
    super(message);
    this.name = 'PlanSchedulingApiError';
    this.status = status;
    this.code = code;
  }
}

const csrfToken = () => (
  globalThis.document?.querySelector?.('[name=csrfmiddlewaretoken]')?.value ||
  globalThis.document?.cookie?.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1] ||
  ''
);

export class PlanSchedulingApiClient {
  constructor(fetcher = window.fetch.bind(window)) {
    this.fetcher = fetcher;
  }

  async fetchWeek(targetDate) {
    const params = new URLSearchParams();
    if (targetDate) params.set('date', targetDate);
    return this.fetchState(`/api/plan-scheduling/week/?${params}`);
  }

  async fetchTimeline() {
    return this.fetchState('/api/plan-scheduling/timeline/');
  }

  async movePlan(payload) {
    const token = csrfToken();
    const response = await this.fetcher('/api/plan-scheduling/move/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { 'X-CSRFToken': token } : {}),
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    let body;
    try {
      body = await response.json();
    } catch (_error) {
      throw new PlanSchedulingApiError(
        '予定移動の応答を確認できませんでした。',
        { status: response.ok ? 0 : response.status },
      );
    }
    if (!response.ok || body.status !== 'success') {
      throw new PlanSchedulingApiError(
        body.message || '予定を移動できませんでした。',
        { status: response.status, code: body.code || '' },
      );
    }
    return body.move;
  }

  async fetchState(url) {
    const response = await this.fetcher(url, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') {
      throw new Error(payload.message || '計画調整データを取得できませんでした。');
    }
    return payload.data;
  }
}
