/**
 * @file planSchedulingPage.js
 * @module planScheduling/pages/planSchedulingPage
 * @summary 計画調整ページの依存を組み立てて起動する
 * @responsibility (SRP)
 * - ページ依存の生成と初期化
 * @not_responsible
 * - 業務計算、HTML生成、API実装
 * @inputs
 * - ページroot
 * @outputs
 * - 起動済みcontroller
 * @side_effects
 * - DOMContentLoaded時の初期化
 */

import {
  buildWorkloadPreview,
  filterPlanSummaries,
} from '../domain/PlanSchedulingPreviewPolicy.js';
import { PlanSchedulingApiClient } from '../application/PlanSchedulingApiClient.js';
import { PlanSchedulingController } from '../application/PlanSchedulingController.js';
import { PlanSchedulingRenderer } from '../ui/PlanSchedulingRenderer.js';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('[data-role="plan-scheduling-root"]');
  if (!root) return;
  const controller = new PlanSchedulingController({
    root,
    apiClient: new PlanSchedulingApiClient(),
    renderer: new PlanSchedulingRenderer(root),
    buildPreview: buildWorkloadPreview,
    filterPlans: filterPlanSummaries,
  });
  controller.init();
});
