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


async function importController() {
  const source = readFileSync(
    new URL('../application/PlanSchedulingController.js', import.meta.url),
    'utf8',
  ).replace(
    /import \{[\s\S]*?\} from '\.\.\/domain\/PlanSchedulingPreviewPolicy\.js';/,
    `const PlanSchedulingMode = { NORMAL: 'normal', MOVING: 'moving' };
     const initialInteractionState = () => ({ mode: 'normal', selectedSlotKey: '', movingPlanId: null, destinationSlotKey: '' });
     const beginMove = (state, planId) => ({ ...state, mode: 'moving', movingPlanId: planId, destinationSlotKey: '' });
     const cancelMove = (state) => ({ ...state, mode: 'normal', movingPlanId: null, destinationSlotKey: '' });
     const closeDrawer = initialInteractionState;
     const selectMatrixSlot = (state, key) => state.mode === 'moving'
       ? { ...state, destinationSlotKey: key }
       : { ...state, selectedSlotKey: key, destinationSlotKey: '' };`,
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
  assert.equal(previewPolicy.formatMinutes(1800), '1,800分');
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


test('interaction policy keeps normal slot selection distinct from Move destination selection', () => {
  let interaction = previewPolicy.initialInteractionState();
  interaction = previewPolicy.selectMatrixSlot(interaction, 'source');
  assert.equal(interaction.mode, previewPolicy.PlanSchedulingMode.NORMAL);
  assert.equal(interaction.selectedSlotKey, 'source');

  interaction = previewPolicy.selectMatrixSlot(interaction, 'other-source');
  assert.equal(interaction.selectedSlotKey, 'other-source');

  interaction = previewPolicy.beginMove(interaction, 10);
  interaction = previewPolicy.selectMatrixSlot(interaction, 'destination');
  assert.equal(interaction.mode, previewPolicy.PlanSchedulingMode.MOVING);
  assert.equal(interaction.selectedSlotKey, 'other-source');
  assert.equal(interaction.destinationSlotKey, 'destination');

  interaction = previewPolicy.cancelMove(interaction);
  assert.equal(interaction.mode, previewPolicy.PlanSchedulingMode.NORMAL);
  assert.equal(interaction.selectedSlotKey, 'other-source');
  assert.equal(interaction.movingPlanId, null);
});


test('renderer exposes chart, matrix, drawer, and selection contracts', () => {
  const renderer = readFileSync(
    new URL('../ui/PlanSchedulingRenderer.js', import.meta.url),
    'utf8',
  );
  assert.match(renderer, /dateTemplate/);
  assert.match(renderer, /workloadChartTemplate/);
  assert.match(renderer, /teamWorkloads/);
  assert.match(renderer, /chartSegment/);
  assert.match(renderer, /chartTooltip/);
  assert.match(renderer, /role="tooltip"/);
  assert.match(renderer, /aria-describedby/);
  assert.doesNotMatch(renderer, /title="/);
  assert.match(renderer, /shiftGroup/);
  assert.match(renderer, /slotTemplate/);
  assert.match(renderer, /is-selected-plan/);
  assert.match(renderer, /is-selected-destination/);
  assert.match(renderer, /workloadLabel/);
  assert.match(renderer, /data-action="move"/);
  assert.match(renderer, /data-action="cancel-move"/);
  assert.match(renderer, /renderDrawer/);
  assert.match(renderer, /moveContextTemplate/);
  assert.match(renderer, /renderChartSelection/);
  assert.match(renderer, /data-chart-date/);
  assert.match(renderer, /data-chart-team/);
  assert.doesNotMatch(renderer, /previewTemplate|previewEmpty|destinationPrompt|data-role="preview"/);
  assert.doesNotMatch(renderer, /単位：分|工数（分）|plan-scheduling__yAxis/);
  assert.match(renderer, /基本工数/);
  assert.match(renderer, /必要人数/);
  assert.match(renderer, /計算工数/);
});


test('stacked bars use stable distinct A/B/C colors and contain no text labels', async () => {
  const { PlanSchedulingRenderer, TEAM_COLORS } = await importRenderer();
  assert.deepEqual(
    { ...TEAM_COLORS },
    { 'A班': '#0072B2', 'B班': '#009E73', 'C班': '#D55E00' },
  );
  const renderer = new PlanSchedulingRenderer({});
  const html = renderer.workloadChartTemplate({
    teams: [
      { id: 1, name: 'A班' }, { id: 2, name: 'B班' }, { id: 3, name: 'C班' },
    ],
    dates: [{
      date: '2026-09-16', label: '9/16（水）', totalWorkloadMinutes: 1800,
      totalWorkloadLabel: '1,800分',
      teamWorkloads: [
        { teamId: 1, teamName: 'A班', workloadMinutes: 600, workloadLabel: '600分' },
        { teamId: 2, teamName: 'B班', workloadMinutes: 800, workloadLabel: '800分' },
        { teamId: 3, teamName: 'C班', workloadMinutes: 400, workloadLabel: '400分' },
      ],
    }],
  });
  assert.match(html, /9月16日（水）/);
  assert.match(html, /--plan-scheduling-team-color:#0072B2/);
  assert.match(html, /--plan-scheduling-team-color:#009E73/);
  assert.match(html, /--plan-scheduling-team-color:#D55E00/);
  for (const color of Object.values(TEAM_COLORS)) {
    assert.equal([...html.matchAll(new RegExp(color, 'g'))].length, 2);
  }
  assert.match(html, /aria-describedby="plan-workload-tooltip-0"/);
  assert.match(html, /role="tooltip"/);
  assert.match(html, /A班[\s\S]*600分/);
  assert.match(html, /B班[\s\S]*800分/);
  assert.match(html, /C班[\s\S]*400分/);
  assert.match(html, /合計[\s\S]*1800分/);
  const segments = [...html.matchAll(/<span class="plan-scheduling__chartSegment[^>]*>(.*?)<\/span>/g)];
  assert.equal(segments.length, 3);
  assert.ok(segments.every((match) => match[1] === ''));
  assert.doesNotMatch(html, /chartLegend/);
});


test('chart selection maps a matrix slot to its daily team segment only', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const renderer = new PlanSchedulingRenderer({});
  const chart = {
    dates: ['2026-09-16', '2026-09-17'].map((date) => ({
      date, label: date,
      teamWorkloads: [
        { teamName: 'A班', workloadMinutes: 100, workloadLabel: '100分' },
        { teamName: 'B班', workloadMinutes: 200, workloadLabel: '200分' },
        { teamName: 'C班', workloadMinutes: 300, workloadLabel: '300分' },
      ],
    })),
  };
  const selected = { date: '2026-09-16', shift: { name: '2直' }, team: { name: 'B班' } };
  const html = renderer.workloadChartTemplate(chart, selected);
  const selectedSegments = [...html.matchAll(/plan-scheduling__chartSegment is-selected-chart-segment[^>]*data-chart-date="([^"]+)"[^>]*data-chart-team="([^"]+)"/g)];
  assert.deepEqual(selectedSegments.map((match) => match.slice(1)), [['2026-09-16', 'B班']]);
  assert.equal((html.match(/is-selected-chart-segment/g) || []).length, 1);

  for (const teamName of ['A班', 'B班', 'C班']) {
    const teamHtml = renderer.workloadChartTemplate(chart, {
      date: '2026-09-16', shift: { name: '1直' }, team: { name: teamName },
    });
    assert.match(teamHtml, new RegExp(`is-selected-chart-segment[^>]*data-chart-date="2026-09-16"[^>]*data-chart-team="${teamName}"`));
  }
});


test('chart selection replaces and clears using the authoritative selected slot', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const toggles = [];
  const segments = [
    ['2026-09-16', 'A班'], ['2026-09-16', 'B班'], ['2026-09-17', 'B班'],
  ].map(([chartDate, chartTeam]) => ({
    dataset: { chartDate, chartTeam },
    classList: { toggle: (name, value) => toggles.push([chartDate, chartTeam, name, value]) },
  }));
  const chart = { classList: { toggle: (...args) => toggles.push(['chart', ...args]) } };
  const renderer = new PlanSchedulingRenderer({
    querySelector: (selector) => selector === '[data-role="workload-chart"]' ? chart : null,
    querySelectorAll: () => segments,
  });

  renderer.renderChartSelection({ date: '2026-09-16', team: { name: 'B班' } });
  assert.deepEqual(toggles.filter((entry) => entry.length === 4), [
    ['2026-09-16', 'A班', 'is-selected-chart-segment', false],
    ['2026-09-16', 'B班', 'is-selected-chart-segment', true],
    ['2026-09-17', 'B班', 'is-selected-chart-segment', false],
  ]);
  toggles.length = 0;
  renderer.renderChartSelection({ date: '2026-09-17', team: { name: 'B班' } });
  assert.deepEqual(toggles.filter((entry) => entry.length === 4).map((entry) => entry[3]), [false, false, true]);
  toggles.length = 0;
  renderer.renderChartSelection(null);
  assert.deepEqual(toggles.filter((entry) => entry.length === 4).map((entry) => entry[3]), [false, false, false]);
});


test('chart tooltip and total defensively exclude values outside A/B/C scope', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const html = new PlanSchedulingRenderer({}).workloadChartTemplate({
    dates: [{
      date: '2026-09-16', label: '9/16（水）', totalWorkloadMinutes: 999,
      totalWorkloadLabel: '999分',
      teamWorkloads: [
        { teamName: 'A班', workloadMinutes: 100, workloadLabel: '100分' },
        { teamName: 'B班', workloadMinutes: 200, workloadLabel: '200分' },
        { teamName: 'C班', workloadMinutes: 300, workloadLabel: '300分' },
        { teamName: '連2_A', workloadMinutes: 400, workloadLabel: '400分' },
        { teamName: '連2_B', workloadMinutes: 500, workloadLabel: '500分' },
        { teamName: '常昼', workloadMinutes: 600, workloadLabel: '600分' },
      ],
    }],
  });
  assert.match(html, /600分/);
  assert.doesNotMatch(html, /連2_A|連2_B|常昼|999分/);
});


test('matrix uses the approved chart universe to exclude 常昼 and 連2 teams while retaining 休日', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const renderer = new PlanSchedulingRenderer({});
  const [day] = renderer.matrixDates({
    workloadChart: {
      shiftNames: ['1直', '2直', '3直', '休日'],
      teams: [{ name: 'A班' }, { name: 'B班' }, { name: 'C班' }],
    },
    dates: [{ slots: [
      { shift: { name: '1直' }, team: { name: 'A班' } },
      { shift: { name: '休日' }, team: { name: 'C班' } },
      { shift: { name: '常昼' }, team: { name: 'A班' } },
      { shift: { name: '1直' }, team: { name: '連2_A' } },
      { shift: { name: '2直' }, team: { name: '連2_B' } },
    ] }],
  });
  assert.deepEqual(day.slots.map((item) => item.shift.name), ['1直', '休日']);
});


test('drawer is absent before selection and old lower Plan stack is removed', () => {
  const template = readFileSync(
    new URL('../../../../templates/planScheduling/plan_scheduling.html', import.meta.url),
    'utf8',
  );
  assert.match(template, /data-role="slot-drawer"[^>]*hidden/);
  assert.match(template, /data-action="close-drawer"/);
  assert.doesNotMatch(template, /plan-scheduling__plans/);
  assert.doesNotMatch(template, /selected-slot-label|slot-summary/);
  assert.doesNotMatch(template, /plan-scheduling__legend/);
  assert.doesNotMatch(template, /plan-scheduling__(?:eyebrow|title|description|notice|weekLabel|preview)/);
  assert.doesNotMatch(template, /PLAN SCHEDULING|<h1[^>]*>計画調整<\/h1>|配布待ち計画の工数を、保全週日付直班で確認します。/);
  assert.doesNotMatch(template, /単位：分|計画の「移動」を選ぶと、移動先の工数変化を確認できます。/);
  assert.match(template, /data-role="workload-chart"/);
  assert.match(template, /data-role="date-grid"/);
});


test('Move context is rendered inside the selected drawer without a standalone preview region', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const drawer = { hidden: true };
  const planList = { innerHTML: '' };
  const elements = new Map([
    ['[data-role="slot-drawer"]', drawer],
    ['[data-role="planning-layout"]', { classList: { toggle: () => {} } }],
    ['[data-role="plan-list"]', planList],
    ['[data-role="drawer-date"]', { textContent: '' }],
    ['[data-role="drawer-slot"]', { textContent: '' }],
    ['[data-role="drawer-summary"]', { textContent: '' }],
  ]);
  const renderer = new PlanSchedulingRenderer({
    querySelector: (selector) => elements.get(selector),
  });
  renderer.renderDrawer({
    isMoving: true,
    preview: { selectedPlan: 120, sourceBefore: 360, sourceAfter: 240, destinationBefore: 40, destinationAfter: 160 },
    plan: { inspectionNo: 'CARD-10', workName: 'Seal check', current: { dateLabel: '9/16（水）', shift: { name: '1直' }, team: { name: 'A班' } } },
    destination: { dateLabel: '9/17（木）', shift: { name: '2直' }, team: { name: 'B班' } },
    selectedSlot: { date: '2026-09-16', dateLabel: '9/16（水）', shift: { name: '1直' }, team: { name: 'A班' }, workloadLabel: '360分', planCount: 1 },
    slotPlans: [],
  });
  assert.equal(drawer.hidden, false);
  assert.match(planList.innerHTML, /plan-scheduling__moveContext/);
  assert.match(planList.innerHTML, /data-action="cancel-move"/);
});


test('drawer header identifies and updates the exact selected slot', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const drawer = { hidden: true };
  const planList = { innerHTML: '' };
  const drawerDate = { textContent: '' };
  const drawerSlot = { textContent: '' };
  const drawerSummary = { textContent: '' };
  const toggles = [];
  const elements = new Map([
    ['[data-role="slot-drawer"]', drawer],
    ['[data-role="planning-layout"]', { classList: { toggle: (...args) => toggles.push(args) } }],
    ['[data-role="plan-list"]', planList],
    ['[data-role="drawer-date"]', drawerDate],
    ['[data-role="drawer-slot"]', drawerSlot],
    ['[data-role="drawer-summary"]', drawerSummary],
  ]);
  const renderer = new PlanSchedulingRenderer({
    querySelector: (selector) => elements.get(selector),
  });
  renderer.renderDrawer({
    selectedSlot: {
      date: '2026-09-16', dateLabel: '9/16（水）', shift: { name: '2直' },
      team: { name: 'B班' }, workloadLabel: '720分', planCount: 5,
    },
    slotPlans: [], plan: null,
  });
  assert.equal(drawer.hidden, false);
  assert.equal(drawerDate.textContent, '9月16日（水）');
  assert.equal(drawerSlot.textContent, '2直B班');
  assert.equal(drawerSummary.textContent, '720分 / 5件');

  renderer.renderDrawer({
    selectedSlot: {
      date: '2026-09-17', dateLabel: '9/17（木）', shift: { name: '3直' },
      team: { name: 'C班' }, workloadLabel: '360分', planCount: 2,
    },
    slotPlans: [], plan: null,
  });
  assert.equal(drawerDate.textContent, '9月17日（木）');
  assert.equal(drawerSlot.textContent, '3直C班');
  assert.equal(drawerSummary.textContent, '360分 / 2件');
  assert.deepEqual(toggles, [['has-drawer', true], ['has-drawer', true]]);
});


test('controller supports Move, destination selection, and cancel without mutation', async () => {
  const { PlanSchedulingController } = await importController();
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
      { ...slot('2026-09-15:1', 480), date: '2026-09-15', team: { name: 'A班' }, planIds: [10] },
      { ...slot('2026-09-16:2', 360), date: '2026-09-16', team: { name: 'B班' }, planIds: [] },
    ] }],
  };
  controller.interaction = previewPolicy.selectMatrixSlot(
    previewPolicy.initialInteractionState(),
    '2026-09-15:1',
  );

  const eventFor = (selector, button) => ({
    target: { closest: (query) => query === selector ? button : null },
  });
  controller.handleClick(eventFor('[data-action="move"]', {
    disabled: false, dataset: { planId: '10' },
  }));
  assert.equal(controller.interaction.mode, previewPolicy.PlanSchedulingMode.MOVING);
  assert.equal(controller.interaction.movingPlanId, 10);
  assert.equal(controller.interaction.selectedSlotKey, '2026-09-15:1');
  assert.equal(lastSelection.preview, null);

  controller.handleClick(eventFor('[data-slot-key]', {
    disabled: false, dataset: { slotKey: '2026-09-16:2' },
  }));
  assert.equal(controller.interaction.destinationSlotKey, '2026-09-16:2');
  assert.equal(controller.interaction.selectedSlotKey, '2026-09-15:1');
  assert.deepEqual(lastSelection.preview, { selectedPlan: 120 });
  assert.equal(lastSelection.selectedSlot.key, '2026-09-15:1');
  assert.deepEqual(lastSelection.selectedSlot.team, { name: 'A班' });

  controller.handleClick(eventFor('[data-action="cancel-move"]', {}));
  assert.equal(controller.interaction.mode, previewPolicy.PlanSchedulingMode.NORMAL);
  assert.equal(controller.interaction.movingPlanId, null);
  assert.equal(controller.interaction.destinationSlotKey, '');
  assert.equal(controller.interaction.selectedSlotKey, '2026-09-15:1');
});


test('keyboard-generated slot activation supplies the same chart selection state', async () => {
  const { PlanSchedulingController } = await importController();
  let lastSelection = null;
  const controller = new PlanSchedulingController({
    root: {}, apiClient: {},
    renderer: { renderSelection: (_state, selection) => { lastSelection = selection; } },
    buildPreview: () => null, selectSlotPlans: previewPolicy.plansForSlot,
  });
  controller.state = {
    plans: [],
    dates: [{ slots: [{
      ...slot('2026-09-16:2', 284), date: '2026-09-16', team: { name: 'B班' }, planIds: [],
    }] }],
  };
  controller.handleClick({ target: { closest: (selector) => (
    selector === '[data-slot-key]'
      ? { disabled: false, dataset: { slotKey: '2026-09-16:2' } }
      : null
  ) } });
  assert.equal(lastSelection.selectedSlot.date, '2026-09-16');
  assert.deepEqual(lastSelection.selectedSlot.team, { name: 'B班' });
});


test('drawer close has a dedicated non-modal controller transition', async () => {
  const { PlanSchedulingController } = await importController();
  let lastSelection = null;
  const controller = new PlanSchedulingController({
    root: {}, apiClient: {},
    renderer: { renderSelection: (_state, selection) => { lastSelection = selection; } },
    buildPreview: () => null, selectSlotPlans: previewPolicy.plansForSlot,
  });
  controller.state = { plans: [], dates: [] };
  controller.interaction = previewPolicy.selectMatrixSlot(
    previewPolicy.initialInteractionState(), 'source',
  );
  controller.handleClick({ target: { closest: (selector) => (
    selector === '[data-action="close-drawer"]' ? {} : null
  ) } });
  assert.deepEqual(controller.interaction, previewPolicy.initialInteractionState());
  assert.equal(lastSelection.selectedSlot, undefined);
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
  assert.doesNotMatch(template, /role="dialog"|aria-modal|backdrop/i);
});


test('chart styles have no filled workload track and drawer owns internal scrolling', () => {
  const scss = readFileSync(
    new URL('../../../../static/css/pages/planScheduling.scss', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(scss, /#edf1f4/i);
  assert.match(scss, /\.plan-scheduling__chartBar[^}]*background:\s*transparent/s);
  assert.match(scss, /--plan-scheduling-team-color/);
  assert.doesNotMatch(scss, /chartLegend|team-other/);
  assert.doesNotMatch(scss, /plan-scheduling__yAxis/);
  assert.match(scss, /\.plan-scheduling__planList[^}]*overflow-y:\s*auto/s);
  assert.match(scss, /\.plan-scheduling__chartSegment\.is-selected-chart-segment/);
  assert.match(scss, /has-chart-selection[\s\S]*opacity:\s*\.58/);
});
