/**
 * @file PlanSchedulingPreviewPolicy.js
 * @module planScheduling/domain/PlanSchedulingPreviewPolicy
 * @summary 計画移動プレビューの工数を副作用なしで計算する
 * @responsibility (SRP)
 * - 選択計画と移動先スロットの妥当性を判定する
 * - 移動元・移動先のプレビュー工数を計算する
 * @not_responsible
 * - DOM操作、API通信、永続化
 * @inputs
 * - Planとslotのページ状態
 * @outputs
 * - UI表示用プレビュー値
 * @side_effects
 * - なし
 */

export function buildWorkloadPreview(plan, destinationSlot, sourceSlot) {
  if (!plan || !destinationSlot || !plan.isPreviewable || !destinationSlot.isValid) {
    return null;
  }
  if (!Number.isInteger(plan.workMinutes) || plan.workMinutes <= 0) {
    return null;
  }
  if (!Number.isInteger(destinationSlot.workloadMinutes)) {
    return null;
  }

  const isSameSlot = plan.current.slotKey === destinationSlot.key;
  if (isSameSlot) return null;
  const sourceWorkload = sourceSlot?.workloadMinutes;
  const hasValidSourceWorkload = Number.isInteger(sourceWorkload);

  return {
    isSameSlot,
    destinationBefore: destinationSlot.workloadMinutes,
    selectedPlan: plan.workMinutes,
    destinationAfter: destinationSlot.workloadMinutes + plan.workMinutes,
    sourceBefore: hasValidSourceWorkload ? sourceWorkload : null,
    sourceAfter: hasValidSourceWorkload
      ? sourceWorkload - plan.workMinutes
      : null,
  };
}

export function formatMinutes(value) {
  return Number.isInteger(value) ? `${value}分` : '集計不可';
}

export function filterPlanSummaries(plans, query) {
  const normalized = String(query || '').trim().toLocaleLowerCase('ja');
  if (!normalized) return [...plans];
  return plans.filter((plan) => [
    plan.inspectionNo,
    plan.equipmentName,
    plan.workName,
  ].some((value) => String(value || '').toLocaleLowerCase('ja').includes(normalized)));
}
