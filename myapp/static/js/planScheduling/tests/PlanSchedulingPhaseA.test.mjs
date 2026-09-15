import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


async function importSource(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(dataUrl);
}


const previewPolicy = await importSource(
  '../domain/PlanSchedulingPreviewPolicy.js',
);


function plan(overrides = {}) {
  return {
    planId: 10,
    isPreviewable: true,
    workMinutes: 120,
    current: { slotKey: '2026-09-15:1' },
    ...overrides,
  };
}


function slot(key, workloadMinutes, overrides = {}) {
  return { key, workloadMinutes, isValid: true, ...overrides };
}


test('destination and source previews use waiting-plan minutes', () => {
  const result = previewPolicy.buildWorkloadPreview(
    plan(),
    slot('2026-09-16:2', 360),
    slot('2026-09-15:1', 480),
  );
  assert.deepEqual(result, {
    isSameSlot: false,
    destinationBefore: 360,
    selectedPlan: 120,
    destinationAfter: 480,
    sourceBefore: 480,
    sourceAfter: 360,
  });
  assert.equal(previewPolicy.formatMinutes(result.destinationAfter), '480分');
});


test('current slot cannot be selected as a destination', () => {
  const current = slot('2026-09-15:1', 480);
  const result = previewPolicy.buildWorkloadPreview(plan(), current, current);
  assert.equal(result, null);
});


test('invalid plan, shift, or workload cannot be previewed', () => {
  assert.equal(previewPolicy.buildWorkloadPreview(
    plan({ isPreviewable: false }), slot('x', 0), slot('y', 120),
  ), null);
  assert.equal(previewPolicy.buildWorkloadPreview(
    plan(), slot('x', 0, { isValid: false }), slot('y', 120),
  ), null);
  assert.equal(previewPolicy.buildWorkloadPreview(
    plan(), slot('x', null), slot('y', 120),
  ), null);
});


test('waiting Plans can be filtered by inspection, equipment, or work name', () => {
  const plans = [
    { inspectionNo: 'A-01', equipmentName: 'Pump', workName: 'Seal check' },
    { inspectionNo: 'B-02', equipmentName: 'Motor', workName: 'Grease' },
  ];
  assert.equal(previewPolicy.filterPlanSummaries(plans, 'motor').length, 1);
  assert.equal(previewPolicy.filterPlanSummaries(plans, 'seal').length, 1);
  assert.equal(previewPolicy.filterPlanSummaries(plans, '').length, 2);
});


test('renderer exposes hierarchy and stable selection class contracts', () => {
  const renderer = readFileSync(
    new URL('../ui/PlanSchedulingRenderer.js', import.meta.url),
    'utf8',
  );
  assert.match(renderer, /dateTemplate/);
  assert.match(renderer, /shiftGroup/);
  assert.match(renderer, /slotTemplate/);
  assert.match(renderer, /is-selected-plan/);
  assert.match(renderer, /is-selected-destination/);
  assert.match(renderer, /workloadLabel/);
  assert.match(renderer, /配布待ち/);
});


test('Phase A UI has no mutation request or capacity vocabulary', () => {
  const api = readFileSync(
    new URL('../application/PlanSchedulingApiClient.js', import.meta.url),
    'utf8',
  );
  const template = readFileSync(
    new URL('../../../../templates/planScheduling/plan_scheduling.html', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(api, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(template, /残余能力|利用率|過負荷|capacity|utilization/i);
  assert.doesNotMatch(template, /保存する|更新する/);
});
