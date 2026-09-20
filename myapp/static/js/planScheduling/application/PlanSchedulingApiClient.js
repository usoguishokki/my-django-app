/**
 * @file PlanSchedulingApiClient.js
 * @module planScheduling/application/PlanSchedulingApiClient
 * @summary 計画調整の読取専用API通信を担当する
 * @responsibility (SRP)
 * - 指定日の保全週ページ状態を取得する
 * @not_responsible
 * - 状態計算、DOM操作、データ更新
 * @inputs
 * - fetch実装、対象日
 * @outputs
 * - APIのページ状態
 * @side_effects
 * - GET通信
 */

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
