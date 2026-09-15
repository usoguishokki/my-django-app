import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


async function importSource(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(dataUrl);
}


async function importRenderer() {
  const source = readFileSync(
    new URL('../ui/PlanSchedulingRenderer.js', import.meta.url),
    'utf8',
  ).replace(
    "import { formatMinutes } from '../domain/PlanSchedulingPreviewPolicy.js';",
    "const formatMinutes = (value) => Number.isInteger(value) ? `${value}分` : '集計不可';",
  );
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
  assert.equal(previewPolicy.buildWorkloadPreview(
    plan(), slot('x', 120), slot('y', null),
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


test('exact slot membership is selected from authoritative plan ids', () => {
  const plans = [{ planId: 10 }, { planId: 11 }, { planId: 12 }];
  assert.deepEqual(
    previewPolicy.plansForSlot(plans, { planIds: [11, 12] }),
    [{ planId: 11 }, { planId: 12 }],
  );
  assert.deepEqual(previewPolicy.plansForSlot(plans, null), []);
});


test('renderer exposes stacked chart, hierarchy, holiday, and selection contracts', () => {
  const renderer = readFileSync(
    new URL('../ui/PlanSchedulingRenderer.js', import.meta.url),
    'utf8',
  );
  assert.match(renderer, /dateTemplate/);
  assert.match(renderer, /workloadChartTemplate/);
  assert.match(renderer, /teamWorkloads/);
  assert.match(renderer, /chartSegment/);
  assert.match(renderer, /shiftGroup/);
  assert.match(renderer, /slotTemplate/);
  assert.match(renderer, /is-selected-plan/);
  assert.match(renderer, /is-selected-destination/);
  assert.match(renderer, /workloadLabel/);
  assert.match(renderer, /data-action="move"/);
  assert.match(renderer, /data-action="cancel-move"/);
  assert.match(renderer, /基本工数/);
  assert.match(renderer, /必要人数/);
  assert.match(renderer, /計算工数/);
});


test('matrix uses chart shift universe to exclude 常昼 and retain 休日', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const renderer = new PlanSchedulingRenderer({});
  const [day] = renderer.matrixDates({
    workloadChart: { shiftNames: ['1直', '2直', '3直', '休日'] },
    dates: [{ slots: [
      { shift: { name: '1直' } },
      { shift: { name: '休日' } },
      { shift: { name: '常昼' } },
    ] }],
  });
  assert.deepEqual(day.slots.map((item) => item.shift.name), ['1直', '休日']);
});


test('workspace renders no Plan cards before matrix slot selection', () => {
  const renderer = readFileSync(
    new URL('../ui/PlanSchedulingRenderer.js', import.meta.url),
    'utf8',
  );
  const initialBranch = renderer.slice(
    renderer.indexOf('if (!slot)'),
    renderer.indexOf("this.root.querySelector('[data-role=\"selected-slot-label\"]')", renderer.indexOf('if (!slot)') + 20),
  );
  assert.match(initialBranch, /計画マトリクスから班を選択してください/);
  assert.doesNotMatch(initialBranch, /planTemplate/);
});


test('controller supports Move, destination selection, and cancel without mutation', async () => {
  const { PlanSchedulingController } = await importSource(
    '../application/PlanSchedulingController.js',
  );
  let lastSelection = null;
  const controller = new PlanSchedulingController({
    root: {},
    apiClient: {},
    renderer: { renderSelection: (_state, selection) => { lastSelection = selection; } },
    buildPreview: (movingPlan, destination) => (
      movingPlan && destination ? { selectedPlan: movingPlan.workMinutes } : null
    ),
    selectSlotPlans: previewPolicy.plansForSlot,
  });
  controller.state = {
    plans: [plan()],
    dates: [{ slots: [
      { ...slot('2026-09-15:1', 480), planIds: [10] },
      { ...slot('2026-09-16:2', 360), planIds: [] },
    ] }],
  };
  controller.selectedSlotKey = '2026-09-15:1';

  const eventFor = (selector, button) => ({
    target: { closest: (query) => query === selector ? button : null },
  });
  controller.handleClick(eventFor('[data-action="move"]', {
    disabled: false, dataset: { planId: '10' },
  }));
  assert.equal(controller.selectedPlanId, 10);
  assert.equal(lastSelection.preview, null);

  controller.handleClick(eventFor('[data-slot-key]', {
    disabled: false, dataset: { slotKey: '2026-09-16:2' },
  }));
  assert.equal(controller.destinationSlotKey, '2026-09-16:2');
  assert.deepEqual(lastSelection.preview, { selectedPlan: 120 });

  controller.handleClick(eventFor('[data-action="cancel-move"]', {}));
  assert.equal(controller.selectedPlanId, null);
  assert.equal(controller.destinationSlotKey, '');
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
  const renderer = readFileSync(
    new URL('../ui/PlanSchedulingRenderer.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(api, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(template, /残余能力|利用率|過負荷|capacity|utilization/i);
  assert.doesNotMatch(template, /保存する|更新する/);
  assert.doesNotMatch(`${template}\n${renderer}`, /残余能力|利用率|過負荷|空き|capacity|utilization|overload/i);
  assert.doesNotMatch(renderer, /変更する/);
});
