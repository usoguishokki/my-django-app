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
  ).replace(
    "import { labelForAttrValue } from '../../ui/formatters/labelFormatters.js';",
    "const labelForAttrValue = (_attr, value) => ({ 0: '月', 1: '火', 2: '水', 3: '木', 4: '金', 5: '土', 6: '日' })[value] ?? String(value);",
  ).replace(
    "import { renderDetailItemsHTML } from '../../ui/renderers/detailItemsRenderer.js';",
    `const renderDetailItemsHTML = (items = []) => Array.isArray(items) && items.length
      ? '<div class="detail-card__detailItems">' + items.map((detail) =>
          '<div class="detail-card__detailItem"><div class="detail-card__detailItemDevice">' + escapeHtml(detail?.applicableDevice || '') +
          '</div><div class="detail-card__detailItemContents">' + escapeHtml(detail?.contents || '') + '</div></div>'
        ).join('') + '</div>'
      : '';`,
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
     const initialInteractionState = () => ({ mode: 'normal', selectedSlotKey: '', selectedSlotContext: null, movingPlanId: null, moveContext: null, destinationSlotKey: '' });
     const beginMove = (state, planId, moveContext = null) => ({ ...state, mode: 'moving', movingPlanId: planId, moveContext, destinationSlotKey: '' });
     const cancelMove = (state) => ({ ...state, mode: 'normal', movingPlanId: null, moveContext: null, destinationSlotKey: '' });
     const closeDrawer = initialInteractionState;
     const selectMatrixSlot = (state, key, selectedSlotContext = null) => state.mode === 'moving'
       ? { ...state, destinationSlotKey: key }
       : { ...state, selectedSlotKey: key, selectedSlotContext, destinationSlotKey: '' };`,
  );
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(dataUrl);
}


const previewPolicy = await importSource(
  '../domain/PlanSchedulingPreviewPolicy.js',
);


test('API client loads the read-only full Chart timeline endpoint', async () => {
  const { PlanSchedulingApiClient } = await importSource(
    '../application/PlanSchedulingApiClient.js',
  );
  let requestedUrl = null;
  const client = new PlanSchedulingApiClient(async (url, options) => {
    requestedUrl = url;
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.method, undefined);
    return {
      ok: true,
      json: async () => ({ status: 'success', data: { dates: [], workloadChart: { dates: [] } } }),
    };
  });

  const state = await client.fetchTimeline();

  assert.equal(requestedUrl, '/api/plan-scheduling/timeline/');
  assert.deepEqual(state, { dates: [], workloadChart: { dates: [] } });
});


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
  assert.match(renderer, /moveSelectingContextTemplate/);
  assert.match(renderer, /placeChartTooltip/);
  assert.match(renderer, /pointerover|focusin|scroll/);
  assert.match(renderer, /renderChartSelection/);
  assert.match(renderer, /data-chart-date/);
  assert.match(renderer, /data-chart-team/);
  assert.doesNotMatch(renderer, /previewTemplate|previewEmpty|destinationPrompt|data-role="preview"/);
  assert.doesNotMatch(renderer, /単位：分|工数（分）|plan-scheduling__yAxis/);
  assert.match(renderer, /detail-card/);
  assert.match(renderer, /renderDetailItemsHTML/);
  assert.match(renderer, /\.\.\/\.\.\/ui\/renderers\/detailItemsRenderer\.js/);
  assert.match(renderer, /labelForAttrValue/);
  assert.match(renderer, /formatPlanCardTitle/);
  assert.match(renderer, /formatPlanCardSubtitle/);
  assert.match(renderer, /formatDelta/);
});


test('drawer Plan cards reuse detail-card content with an independent Move action', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const renderer = new PlanSchedulingRenderer({});
  const plan = {
    planId: 10,
    inspectionNo: 'CARD-10',
    machineName: '成形機2号機',
    workName: '日常点検',
    manHours: 14,
    dayOfWeek: 0,
    interval: 1,
    unit: '週',
    detailItems: [{ applicableDevice: '対象部位', contents: '点検内容' }],
    isPreviewable: true,
    dataQualityIssues: [],
  };
  const html = renderer.planTemplate(plan, null);

  assert.match(html, /<article class="detail-card plan-scheduling__planCard/);
  assert.match(html, /detail-card__titleLine">成形機2号機_日常点検/);
  assert.match(html, /detail-card__titleSub">14分　月　1\/週/);
  assert.match(html, /detail-card__detailItemDevice">対象部位/);
  assert.match(html, /detail-card__detailItemContents">点検内容/);
  assert.doesNotMatch(html, /点検内容はありません。/);
  assert.match(html, /ui-btn ui-btn--sm ui-btn--outline plan-scheduling__moveButton/);
  assert.match(html, /<footer class="plan-scheduling__planCardActions">[\s\S]*data-action="move"[\s\S]*<\/footer>/);
  assert.match(html, /<button[^>]*data-action="move"[^>]*>移動<\/button>/);
  assert.doesNotMatch(html, /click-card__button/);
  assert.doesNotMatch(html, /<button[^>]*>[\s\S]*<button/);
  assert.match(renderer.planTemplate(plan, 10), /plan-scheduling__planCard is-selected-plan/);

  const disabled = renderer.planTemplate({ ...plan, planId: 11, detailItems: [], isPreviewable: false }, null);
  assert.match(disabled, /点検内容はありません。/);
  assert.match(disabled, /data-action="move"[^>]*disabled/);
});


test('stacked bars use stable distinct A/B/C colors and contain no text labels', async () => {
  const { PlanSchedulingRenderer, TEAM_COLORS } = await importRenderer();
  assert.deepEqual(
    { ...TEAM_COLORS },
    { 'A班': '#1C55C8', 'B班': '#00D614', 'C班': '#FFC715' },
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
  assert.match(html, /--plan-scheduling-team-color:#1C55C8/);
  assert.match(html, /--plan-scheduling-team-color:#00D614/);
  assert.match(html, /--plan-scheduling-team-color:#FFC715/);
  for (const color of Object.values(TEAM_COLORS)) {
    assert.equal([...html.matchAll(new RegExp(color, 'g'))].length, 2);
  }
  assert.match(html, /aria-describedby="plan-workload-tooltip-0"/);
  assert.match(html, /data-plan-date="2026-09-16"/);
  assert.match(html, /aria-label="[^"]*9\/16/);
  assert.match(html, /role="tooltip"/);
  assert.doesNotMatch(html, /<\/button><span>9\/16/);
  assert.match(html, /A班[\s\S]*600分/);
  assert.match(html, /B班[\s\S]*800分/);
  assert.match(html, /C班[\s\S]*400分/);
  assert.match(html, /合計[\s\S]*1800分/);
  const segments = [...html.matchAll(/<span class="plan-scheduling__chartSegment[^>]*>(.*?)<\/span>/g)];
  assert.equal(segments.length, 3);
  assert.ok(segments.every((match) => match[1] === ''));
  const legend = renderer.chartLegendTemplate();
  assert.match(legend, /plan-scheduling__chartLegend/);
  assert.match(legend, /A班/);
  assert.match(legend, /B班/);
  assert.match(legend, /C班/);
  assert.match(legend, /--plan-scheduling-team-color:#1C55C8/);
  assert.match(legend, /--plan-scheduling-team-color:#00D614/);
  assert.match(legend, /--plan-scheduling-team-color:#FFC715/);
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


test('chart, maintenance, and matrix tracks share the full ordered timeline', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const renderer = new PlanSchedulingRenderer({});
  const dates = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'];
  const weekDates = dates.slice(1, 3);
  const timelineDates = dates.map((date) => ({
    date, label: date, maintenanceWeekLabel: '9月3週目', slots: [],
  }));
  const chartHtml = renderer.workloadChartTemplate({
    dates: dates.map((date) => ({ date, label: date, teamWorkloads: [] })),
  });
  const matrixHtml = renderer.matrixDates({
    dates: weekDates.map((date) => ({ date, label: date, slots: [] })),
    timelineDates,
    workloadChart: { shiftNames: [] },
  }).map((day) => renderer.dateTemplate(day)).join('');
  const maintenanceWeekHtml = renderer.maintenanceWeekTemplate(
    { label: '9月3週目' },
    timelineDates,
  );
  const chartDates = [...chartHtml.matchAll(/plan-scheduling__chartColumn" data-plan-date="([^"]+)"/g)]
    .map((match) => match[1]);
  const matrixDates = [...matrixHtml.matchAll(/plan-scheduling__dateColumn" data-plan-date="([^"]+)"/g)]
    .map((match) => match[1]);
  const maintenanceWeekDates = [...maintenanceWeekHtml.matchAll(/plan-scheduling__maintenanceWeekCell" data-plan-date="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(chartDates, dates);
  assert.deepEqual(matrixDates, dates);
  assert.deepEqual(maintenanceWeekDates, dates);
  assert.equal((maintenanceWeekHtml.match(/9月3週目/g) || []).length, dates.length);
});


test('final rendered DOM keeps all 413 Matrix tracks on the Chart timeline', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const start = Date.UTC(2026, 1, 9);
  const dates = Array.from({ length: 413 }, (_, index) => new Date(
    start + index * 24 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10));
  const selectedDate = '2026-09-21';
  const selectedIndex = dates.indexOf(selectedDate);
  assert.ok(selectedIndex > 0 && selectedIndex < dates.length - 1);
  const timelineDates = dates.map((date) => ({
    date,
    label: date,
    maintenanceWeekLabel: '保全週',
    slots: [],
  }));
  const weekDates = timelineDates.slice(selectedIndex, selectedIndex + 7);
  const feedback = { textContent: '', classList: { remove: () => {} } };
  const dateGrid = { innerHTML: '' };
  const chartLegend = { innerHTML: '' };
  const maintenanceWeek = { innerHTML: '' };
  const workloadChart = { innerHTML: '' };
  const workspace = { hidden: true, setAttribute: () => {} };
  const loadingSkeleton = { hidden: false };
  const planningLayout = { hidden: true };
  const elements = new Map([
    ['[data-role="feedback"]', feedback],
    ['[data-role="date-grid"]', dateGrid],
    ['[data-role="chart-legend"]', chartLegend],
    ['[data-role="maintenance-week"]', maintenanceWeek],
    ['[data-role="workload-chart"]', workloadChart],
    ['[data-role="workspace"]', workspace],
    ['[data-role="loading-skeleton"]', loadingSkeleton],
    ['[data-role="planning-layout"]', planningLayout],
  ]);
  const renderer = new PlanSchedulingRenderer({
    querySelector: (selector) => elements.get(selector),
    querySelectorAll: () => [],
  });
  renderer.renderSelection = (state, selection) => {
    workloadChart.innerHTML = renderer.workloadChartTemplate(
      state.workloadChart,
      selection,
    );
  };
  renderer.renderState({
    dataQuality: { hasErrors: false, issueCount: 0 },
    dates: weekDates,
    timelineDates,
    workloadChart: {
      shiftNames: [],
      dates: timelineDates.map((day) => ({
        date: day.date,
        label: day.label,
        maintenanceWeekLabel: day.maintenanceWeekLabel,
        teamWorkloads: [],
      })),
    },
  }, {});

  const renderedDates = (html, selector) => [...html.matchAll(
    new RegExp(`${selector}[^>]*data-plan-date="([^"]+)"`, 'g'),
  )].map((match) => match[1]);
  const chartDates = renderedDates(workloadChart.innerHTML, 'plan-scheduling__chartColumn');
  const maintenanceDates = renderedDates(maintenanceWeek.innerHTML, 'plan-scheduling__maintenanceWeekCell');
  const matrixDates = renderedDates(dateGrid.innerHTML, 'plan-scheduling__dateColumn');
  assert.equal(chartDates.length, 413);
  assert.equal(maintenanceDates.length, 413);
  assert.equal(matrixDates.length, 413);
  assert.deepEqual(matrixDates, chartDates);
  assert.deepEqual(maintenanceDates, chartDates);
  for (const date of [dates[0], dates[Math.floor(dates.length / 2)], selectedDate, dates.at(-1)]) {
    assert.ok(chartDates.includes(date));
    assert.ok(maintenanceDates.includes(date));
    assert.ok(matrixDates.includes(date));
  }
});


test('full Matrix exposes valid timeline summaries for on-demand week hydration', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const renderer = new PlanSchedulingRenderer({});
  const summarySlot = (date) => ({
    key: `${date}:1:A`, date, shift: { name: '1直' }, team: { name: 'A班' },
    workloadMinutes: 120, workloadLabel: '120分', isValid: true,
    hasInvalidEffort: false, dataQualityIssues: [], planIds: [], planCount: 0,
  });
  const timelineDates = ['2026-09-14', '2026-09-21'].map((date) => ({
    date, label: date, slots: [summarySlot(date)],
  }));
  const dates = renderer.matrixDates({
    dates: [timelineDates[1]],
    timelineDates,
    workloadChart: { shiftNames: ['1直'] },
  });

  assert.equal(dates[0].slots[0].requiresWeekHydration, true);
  assert.equal(dates[1].slots[0].requiresWeekHydration, false);
  assert.match(renderer.slotTemplate(dates[0].slots[0]), /data-slot-date="2026-09-14"[^>]*data-slot-selectable="true"/);
  assert.doesNotMatch(renderer.slotTemplate(dates[0].slots[0]), /disabled/);
  assert.match(renderer.slotTemplate(dates[1].slots[0]), /data-slot-selectable="true"/);
});


test('Move mode prepends an out-of-week source across every date track', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const renderer = new PlanSchedulingRenderer({});
  const sourceSlot = {
    key: '2026-09-14:1:A', date: '2026-09-14', dateLabel: '9/14（月）',
    shift: { name: '1直' }, team: { name: 'A班' }, workloadMinutes: 120,
    workloadLabel: '120分', isValid: true, dataQualityIssues: [],
  };
  const sourceChartDay = {
    date: '2026-09-14', label: '9/14（月）', totalWorkloadMinutes: 120,
    teamWorkloads: [{ teamName: 'A班', workloadMinutes: 120, workloadLabel: '120分' }],
  };
  const selection = {
    isMoving: true, selectedSlot: sourceSlot, preview: null,
    moveContext: { plan: { current: { date: sourceSlot.date, dateLabel: sourceSlot.dateLabel } }, sourceSlot, chartDay: sourceChartDay, weekLabel: '9月2週目' },
  };
  const destinationDays = ['2026-09-21', '2026-09-22'].map((date) => ({
    date, label: date, slots: [],
  }));
  const matrixDates = renderer.matrixDates({
    workloadChart: { shiftNames: ['1直'] }, dates: destinationDays,
  }, selection);
  const chartHtml = renderer.workloadChartTemplate({
    dates: destinationDays.map((day) => ({ ...day, totalWorkloadMinutes: 0, teamWorkloads: [] })),
  }, selection);
  const maintenanceHtml = renderer.maintenanceWeekTemplate({ label: '9月3週目' }, matrixDates);

  assert.deepEqual(matrixDates.map((day) => day.date), ['2026-09-14', '2026-09-21', '2026-09-22']);
  assert.equal(matrixDates[0].isPinnedMoveSource, true);
  assert.match(renderer.dateTemplate(matrixDates[0]), /移動元/);
  assert.match(chartHtml, /chartColumn is-pinned-move-source" data-plan-date="2026-09-14"/);
  assert.match(chartHtml, /移動元/);
  assert.deepEqual(
    [...maintenanceHtml.matchAll(/data-plan-date="([^"]+)"/g)].map((match) => match[1]),
    ['2026-09-14', '2026-09-21', '2026-09-22'],
  );
  assert.match(maintenanceHtml, /9月2週目/);

  const sourceInDisplayedWeek = renderer.matrixDates({
    workloadChart: { shiftNames: ['1直'] },
    dates: [{ date: sourceSlot.date, label: sourceSlot.dateLabel, slots: [sourceSlot] }],
  }, selection);
  assert.deepEqual(sourceInDisplayedWeek.map((day) => day.date), [sourceSlot.date]);
});


test('normal state rendering retains one date-aligned maintenance-week cell per date', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const feedback = { textContent: '', classList: { remove: () => {} } };
  const dateGrid = { innerHTML: '' };
  const chartLegend = { innerHTML: '' };
  const maintenanceWeek = { innerHTML: '' };
  const workspaceAttributes = new Map();
  const workspace = {
    hidden: true,
    setAttribute: (name, value) => workspaceAttributes.set(name, value),
  };
  const loadingSkeleton = { hidden: false };
  const planningLayout = { hidden: true };
  const elements = new Map([
    ['[data-role="feedback"]', feedback],
    ['[data-role="date-grid"]', dateGrid],
    ['[data-role="chart-legend"]', chartLegend],
    ['[data-role="maintenance-week"]', maintenanceWeek],
    ['[data-role="workspace"]', workspace],
    ['[data-role="loading-skeleton"]', loadingSkeleton],
    ['[data-role="planning-layout"]', planningLayout],
  ]);
  const renderer = new PlanSchedulingRenderer({
    querySelector: (selector) => elements.get(selector),
    querySelectorAll: () => [],
  });
  renderer.renderSelection = () => {};
  renderer.renderState({
    dataQuality: { hasErrors: false, issueCount: 0 },
    week: { label: '9月3週目' },
    dates: [
      { date: '2026-09-14', label: '9/14（月）', slots: [] },
      { date: '2026-09-15', label: '9/15（火）', slots: [] },
    ],
    workloadChart: {
      shiftNames: [],
      dates: [
        { date: '2026-09-14', maintenanceWeekLabel: '9月3週目' },
        { date: '2026-09-15', maintenanceWeekLabel: '9月3週目' },
      ],
    },
  }, {});

  assert.equal(workspace.hidden, false);
  assert.equal(workspaceAttributes.get('aria-busy'), 'false');
  assert.equal(loadingSkeleton.hidden, true);
  assert.equal(planningLayout.hidden, false);
  assert.match(chartLegend.innerHTML, /A班[\s\S]*B班[\s\S]*C班/);
  assert.deepEqual(
    [...maintenanceWeek.innerHTML.matchAll(/data-plan-date="([^"]+)"/g)].map((match) => match[1]),
    ['2026-09-14', '2026-09-15'],
  );
  assert.equal((maintenanceWeek.innerHTML.match(/9月3週目/g) || []).length, 2);
});


test('shared timeline scroll targets stable ISO identity on the single planning viewport', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const columns = [
    { dataset: { planDate: '2026-09-14' }, offsetLeft: 0 },
    { dataset: { planDate: '2026-09-21' }, offsetLeft: 1400 },
  ];
  let scrollOptions = null;
  const viewport = {
    querySelectorAll: (selector) => {
      assert.equal(selector, '.plan-scheduling__chartColumn[data-plan-date]');
      return columns;
    },
    scrollTo: (options) => { scrollOptions = options; },
  };
  const renderer = new PlanSchedulingRenderer({
    querySelector: (selector) => selector === '.plan-scheduling__planningMain' ? viewport : null,
    addEventListener: () => {},
  });
  const matrixWeek = ['2026-09-21', '2026-09-22'];

  assert.equal(renderer.scrollTimelineToDate('2026-09-21'), true);
  assert.deepEqual(scrollOptions, { left: 1390, behavior: 'auto' });
  assert.equal(renderer.scrollTimelineToDate('2026-09-22'), false);
  assert.deepEqual(matrixWeek, ['2026-09-21', '2026-09-22']);
});


test('selected date pin side derives from logical track and shared viewport geometry', async () => {
  const {
    calculateSelectedDatePinOffset,
    deriveSelectedDatePinSide,
  } = await importRenderer();
  const geometry = { trackStart: 600, trackWidth: 190, viewportWidth: 400 };
  assert.equal(deriveSelectedDatePinSide({ ...geometry, scrollLeft: 500 }), 'normal');
  assert.equal(deriveSelectedDatePinSide({ ...geometry, scrollLeft: 600 }), 'left');
  assert.equal(deriveSelectedDatePinSide({ ...geometry, scrollLeft: 600.125 }), 'left');
  assert.equal(deriveSelectedDatePinSide({ ...geometry, scrollLeft: 800 }), 'left');
  assert.equal(deriveSelectedDatePinSide({ ...geometry, scrollLeft: 390 }), 'right');
  assert.equal(deriveSelectedDatePinSide({ ...geometry, scrollLeft: 389.875 }), 'right');
  assert.equal(deriveSelectedDatePinSide({ ...geometry, scrollLeft: 100 }), 'right');
  assert.equal(deriveSelectedDatePinSide({ ...geometry, scrollLeft: 500 }), 'normal');
  assert.equal(calculateSelectedDatePinOffset({
    side: 'left',
    trackStart: 600,
    trackWidth: 190,
    scrollLeft: 800,
    viewportWidth: 400,
  }), 200);
  assert.equal(calculateSelectedDatePinOffset({
    side: 'right',
    trackStart: 600,
    trackWidth: 190,
    scrollLeft: 100,
    viewportWidth: 400,
  }), -290);
});


test('Drawer geometry changes restore the selected ISO anchor after the new layout', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const animationFrames = [];
  const selectedDate = '2026-10-04';
  let logicalTrackStart = 48000;
  let trackWidth = 190;
  let viewportLeft = 12;
  const viewport = {
    scrollLeft: 46961,
    clientWidth: 1494,
    scrollWidth: 82612,
    getBoundingClientRect: () => ({
      left: viewportLeft,
      right: viewportLeft + viewport.clientWidth,
      width: viewport.clientWidth,
    }),
    querySelectorAll: () => [track],
    scrollTo: ({ left }) => { viewport.scrollLeft = left; },
  };
  const track = {
    dataset: { planDate: selectedDate },
    offsetWidth: trackWidth,
    classList: { contains: () => true },
    style: { getPropertyValue: () => '' },
    getBoundingClientRect: () => {
      const left = viewportLeft + logicalTrackStart - viewport.scrollLeft;
      return { left, right: left + trackWidth, width: trackWidth };
    },
  };
  const root = {
    ownerDocument: {
      defaultView: {
        requestAnimationFrame: (callback) => animationFrames.push(callback),
      },
    },
    addEventListener: () => {},
    querySelectorAll: () => [track],
    querySelector: (selector) => (
      selector === '.plan-scheduling__planningMain' ? viewport : null
    ),
  };
  const renderer = new PlanSchedulingRenderer(root);
  let pinRecalculations = 0;
  renderer.updateSelectedDatePin = () => { pinRecalculations += 1; };

  const openAnchor = renderer.captureTimelineAnchor(selectedDate);
  const originalPosition = openAnchor.viewportPosition;
  renderer.timelineLayoutRevision = 1;
  renderer.restoreTimelineAnchorAfterLayout(openAnchor, 1);

  viewportLeft = 421;
  viewport.clientWidth = 1084;
  viewport.scrollWidth = 63278;
  logicalTrackStart = 36000;
  trackWidth = 143;
  animationFrames.shift()();

  assert.notEqual(viewport.scrollLeft, 46961);
  assert.equal(pinRecalculations, 1);
  const openedRect = track.getBoundingClientRect();
  const openedPosition = (
    openedRect.left + (openedRect.width / 2) - viewportLeft
  ) / viewport.clientWidth;
  assert.ok(Math.abs(openedPosition - originalPosition) < 0.001);

  const closeAnchor = renderer.captureTimelineAnchor(selectedDate);
  const drawerScrollLeft = viewport.scrollLeft;
  renderer.timelineLayoutRevision = 2;
  renderer.restoreTimelineAnchorAfterLayout(closeAnchor, 2);
  viewportLeft = 12;
  viewport.clientWidth = 1494;
  viewport.scrollWidth = 82612;
  logicalTrackStart = 48000;
  trackWidth = 190;
  animationFrames.shift()();

  assert.notEqual(viewport.scrollLeft, drawerScrollLeft);
  assert.equal(pinRecalculations, 2);
  const closedRect = track.getBoundingClientRect();
  const closedPosition = (
    closedRect.left + (closedRect.width / 2) - viewportLeft
  ) / viewport.clientWidth;
  assert.ok(Math.abs(closedPosition - closeAnchor.viewportPosition) < 0.001);
});


test('one shared scroll listener pins the same selected date across all three tracks', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const listeners = [];
  const makeTrack = (kind, date, logicalStart) => {
    const classes = new Set();
    const properties = new Map();
    const track = {
      kind,
      dataset: { planDate: date },
      // The offset parent includes the Drawer column; logical geometry must
      // instead be derived from planningMain's own visible boundary.
      offsetLeft: logicalStart + 409,
      offsetWidth: 190,
      classList: {
        toggle: (name, force) => force ? classes.add(name) : classes.delete(name),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
      },
      style: {
        setProperty: (name, value) => properties.set(name, value),
        removeProperty: (name) => properties.delete(name),
        getPropertyValue: (name) => properties.get(name) || '',
      },
      classes,
      properties,
      rectReads: 0,
      interactiveButtonCount: kind === 'matrix' ? 1 : 0,
    };
    track.getBoundingClientRect = () => {
      track.rectReads += 1;
      const offset = Number.parseFloat(
        properties.get('--plan-selected-date-offset'),
      ) || 0;
      const left = 421 + logicalStart - viewport.scrollLeft + offset;
      return { left, right: left + 190, width: 190 };
    };
    return track;
  };
  const selectedDate = '2026-10-04';
  const otherDate = '2026-12-20';
  const tracks = [
    makeTrack('chart', selectedDate, 600),
    makeTrack('maintenance', selectedDate, 600),
    makeTrack('matrix', selectedDate, 600),
    makeTrack('chart', otherDate, 1200),
    makeTrack('maintenance', otherDate, 1200),
    makeTrack('matrix', otherDate, 1200),
  ];
  const viewport = {
    scrollLeft: 500,
    clientWidth: 400,
    rectReads: 0,
    getBoundingClientRect: () => {
      viewport.rectReads += 1;
      return { left: 421, right: 821, width: 400 };
    },
    querySelectorAll: () => tracks.filter((track) => track.kind === 'chart'),
    scrollTo: ({ left }) => { viewport.scrollLeft = left; },
  };
  let trackCollectionQueries = 0;
  const root = {
    addEventListener: (type, handler) => listeners.push({ type, handler }),
    querySelectorAll: (selector) => {
      trackCollectionQueries += 1;
      return selector.includes(',')
        ? tracks
        : tracks.filter((track) => track.classes.has('is-selected-date'));
    },
    querySelector: (selector) => {
      if (selector === '.plan-scheduling__planningMain') return viewport;
      if (selector.includes('.plan-scheduling__chartColumn.is-selected-date')) {
        return tracks.find((track) => (
          track.kind === 'chart' && track.classes.has('is-selected-date')
        )) || null;
      }
      return null;
    },
  };
  const renderer = new PlanSchedulingRenderer(root);
  const scrollListeners = listeners.filter((item) => item.type === 'scroll');
  assert.equal(scrollListeners.length, 1);

  renderer.renderSelectedDateTracks(selectedDate);
  assert.ok(tracks.slice(0, 3).every((track) => track.classes.has('is-selected-date')));
  assert.ok(tracks.slice(0, 3).every((track) => !track.classes.has('is-date-pinned-left')));
  tracks.forEach((track) => { track.rectReads = 0; });
  viewport.rectReads = 0;
  trackCollectionQueries = 0;

  viewport.scrollLeft = 600.25;
  scrollListeners[0].handler({ target: viewport });
  assert.equal(tracks.reduce((total, track) => total + track.rectReads, 0), 0);
  assert.equal(viewport.rectReads, 0);
  assert.equal(trackCollectionQueries, 0);
  assert.ok(tracks.slice(0, 3).every((track) => track.classes.has('is-date-pinned-left')));
  assert.equal(tracks[0].getBoundingClientRect().left, 421);

  viewport.scrollLeft = 800;
  scrollListeners[0].handler({ target: viewport });
  assert.ok(tracks.slice(0, 3).every((track) => track.classes.has('is-date-pinned-left')));
  assert.ok(tracks.slice(0, 3).every((track) => track.properties.get('--plan-selected-date-offset') === '200px'));
  assert.equal(tracks[0].getBoundingClientRect().left, 421);

  viewport.scrollLeft = 850.125;
  scrollListeners[0].handler({ target: viewport });
  assert.ok(tracks.slice(0, 3).every((track) => track.classes.has('is-date-pinned-left')));
  assert.equal(tracks[0].getBoundingClientRect().left, 421);

  viewport.scrollLeft = 599.875;
  scrollListeners[0].handler({ target: viewport });
  assert.ok(tracks.slice(0, 3).every((track) => !track.classes.has('is-date-pinned-left')));
  assert.equal(tracks[0].getBoundingClientRect().left, 421.125);

  viewport.scrollLeft = 389.75;
  scrollListeners[0].handler({ target: viewport });
  assert.ok(tracks.slice(0, 3).every((track) => track.classes.has('is-date-pinned-right')));
  assert.equal(tracks[0].getBoundingClientRect().right, 821);

  viewport.scrollLeft = 100;
  scrollListeners[0].handler({ target: viewport });
  assert.ok(tracks.slice(0, 3).every((track) => track.classes.has('is-date-pinned-right')));
  assert.ok(tracks.slice(0, 3).every((track) => track.properties.get('--plan-selected-date-offset') === '-290px'));
  assert.equal(tracks[0].getBoundingClientRect().right, 821);

  viewport.scrollLeft = 390.125;
  scrollListeners[0].handler({ target: viewport });
  assert.ok(tracks.slice(0, 3).every((track) => !track.classes.has('is-date-pinned-right')));
  assert.equal(tracks[0].getBoundingClientRect().right, 820.875);

  viewport.clientWidth = 200;
  viewport.scrollLeft = 300;
  scrollListeners[0].handler({ target: viewport });
  assert.ok(tracks.slice(0, 3).every((track) => track.classes.has('is-date-pinned-right')));

  viewport.clientWidth = 400;
  assert.equal(renderer.scrollTimelineToDate(selectedDate), true);
  assert.ok(tracks.slice(0, 3).every((track) => !track.classes.has('is-date-pinned-left')));
  assert.ok(tracks.slice(0, 3).every((track) => !track.classes.has('is-date-pinned-right')));

  renderer.renderSelectedDateTracks(otherDate);
  assert.ok(tracks.slice(0, 3).every((track) => !track.classes.has('is-selected-date')));
  assert.ok(tracks.slice(3).every((track) => track.classes.has('is-selected-date')));
  assert.equal(tracks.filter((track) => track.kind === 'matrix').reduce(
    (sum, track) => sum + track.interactiveButtonCount, 0,
  ), 2);
});


test('shared timeline scroll coalesces presentation work into one animation frame', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const listeners = [];
  const frames = [];
  const viewport = {};
  const root = {
    ownerDocument: {
      defaultView: {
        requestAnimationFrame: (callback) => frames.push(callback),
      },
    },
    addEventListener: (type, handler) => listeners.push({ type, handler }),
    querySelector: (selector) => (
      selector === '.plan-scheduling__planningMain' ? viewport : null
    ),
  };
  const renderer = new PlanSchedulingRenderer(root);
  let pinUpdates = 0;
  let tooltipUpdates = 0;
  renderer.updateSelectedDatePin = () => { pinUpdates += 1; };
  renderer.positionActiveChartTooltip = () => { tooltipUpdates += 1; };
  const scrollHandler = listeners.find((item) => item.type === 'scroll').handler;

  scrollHandler({ target: viewport });
  scrollHandler({ target: viewport });

  assert.equal(frames.length, 1);
  assert.equal(pinUpdates, 0);
  frames.shift()();
  assert.equal(pinUpdates, 1);
  assert.equal(tooltipUpdates, 1);
});


test('loading state uses a local accessible skeleton instead of visible loading copy', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const attributes = new Map();
  const feedback = {
    textContent: 'old',
    classList: { remove: () => {} },
  };
  const workspace = {
    hidden: true,
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const skeleton = { hidden: true };
  const layout = { hidden: false };
  const renderer = new PlanSchedulingRenderer({
    addEventListener: () => {},
    querySelector: (selector) => ({
      '[data-role="feedback"]': feedback,
      '[data-role="workspace"]': workspace,
      '[data-role="loading-skeleton"]': skeleton,
      '[data-role="planning-layout"]': layout,
    })[selector] || null,
  });

  renderer.renderLoading();

  assert.equal(feedback.textContent, '');
  assert.equal(workspace.hidden, false);
  assert.equal(attributes.get('aria-busy'), 'true');
  assert.equal(skeleton.hidden, false);
  assert.equal(layout.hidden, true);

  const template = readFileSync(
    new URL('../../../../templates/planScheduling/plan_scheduling.html', import.meta.url),
    'utf8',
  );
  assert.match(template, /data-role="loading-skeleton"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(template, /plan-scheduling__loadingA11y">読み込み中</);
  assert.match(template, /予定を準備しています/);
  assert.doesNotMatch(template, /data-role="chart-timeline"/);
  assert.match(template, /plan-scheduling__planningMain[\s\S]*data-role="workload-chart"[\s\S]*data-role="maintenance-week"[\s\S]*data-role="date-grid"/);
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


test('chart projection transfers workload by date and team using PreviewPolicy values', async () => {
  const { buildChartPresentation } = await importRenderer();
  const chart = {
    dates: [
      {
        date: '2026-09-16', label: '9/16（水）',
        teamWorkloads: [
          { teamName: 'A班', workloadMinutes: 100, workloadLabel: '100分' },
          { teamName: 'B班', workloadMinutes: 284, workloadLabel: '284分' },
          { teamName: 'C班', workloadMinutes: 50, workloadLabel: '50分' },
        ],
      },
      {
        date: '2026-09-17', label: '9/17（木）',
        teamWorkloads: [
          { teamName: 'A班', workloadMinutes: 133, workloadLabel: '133分' },
          { teamName: 'B班', workloadMinutes: 100, workloadLabel: '100分' },
          { teamName: 'C班', workloadMinutes: 0, workloadLabel: '0分' },
        ],
      },
    ],
  };
  const selection = {
    selectedSlot: { date: '2026-09-16', team: { name: 'B班' } },
    plan: { current: { date: '2026-09-16', team: { name: 'B班' } } },
    destination: { date: '2026-09-17', team: { name: 'A班' } },
    preview: { sourceBefore: 284, sourceAfter: 264, destinationBefore: 133, destinationAfter: 153 },
  };
  const presentation = buildChartPresentation(chart, selection);
  const source = presentation.dates[0].teamWorkloads.find((item) => item.teamName === 'B班');
  const destination = presentation.dates[1].teamWorkloads.find((item) => item.teamName === 'A班');

  assert.equal(source.workloadMinutes, 284);
  assert.equal(source.projectedWorkloadMinutes, 264);
  assert.equal(source.change.kind, 'source');
  assert.equal(destination.workloadMinutes, 133);
  assert.equal(destination.projectedWorkloadMinutes, 153);
  assert.equal(destination.change.kind, 'destination');
  assert.equal(presentation.dates[0].projectedTotalWorkloadMinutes, 414);
  assert.equal(presentation.dates[1].projectedTotalWorkloadMinutes, 253);
  assert.equal(presentation.maxTotal, 434);
});


test('chart projection handles same-date/team and transfer edge cases', async () => {
  const { buildChartPresentation } = await importRenderer();
  const chart = {
    dates: [
      { date: '2026-09-16', label: '9/16', teamWorkloads: [
        { teamName: 'A班', workloadMinutes: 100 }, { teamName: 'B班', workloadMinutes: 284 },
      ] },
      { date: '2026-09-17', label: '9/17', teamWorkloads: [
        { teamName: 'A班', workloadMinutes: 20 }, { teamName: 'B班', workloadMinutes: 40 },
      ] },
    ],
  };
  const base = {
    plan: { current: { date: '2026-09-16', team: { name: 'B班' } } },
    preview: { sourceBefore: 284, sourceAfter: 264, destinationBefore: 100, destinationAfter: 120 },
  };

  const sameTeam = buildChartPresentation(chart, {
    ...base, destination: { date: '2026-09-16', team: { name: 'B班' } },
  });
  assert.equal(sameTeam.projection, null);
  assert.deepEqual(
    sameTeam.dates[0].teamWorkloads.map((item) => item.projectedWorkloadMinutes),
    [100, 284],
  );

  const redistributed = buildChartPresentation(chart, {
    ...base, destination: { date: '2026-09-16', team: { name: 'A班' } },
  });
  assert.deepEqual(
    redistributed.dates[0].teamWorkloads.map((item) => item.projectedWorkloadMinutes),
    [120, 264],
  );
  assert.equal(redistributed.dates[0].projectedTotalWorkloadMinutes, 384);

  const sameTeamOtherDate = buildChartPresentation(chart, {
    ...base,
    destination: { date: '2026-09-17', team: { name: 'B班' } },
    preview: { ...base.preview, destinationBefore: 40, destinationAfter: 60 },
  });
  assert.equal(sameTeamOtherDate.dates[0].teamWorkloads[1].projectedWorkloadMinutes, 264);
  assert.equal(sameTeamOtherDate.dates[1].teamWorkloads[1].projectedWorkloadMinutes, 60);
});


test('chart preview expands scale, renders transfer portions, and exposes tooltip deltas', async () => {
  const { PlanSchedulingRenderer, buildChartPresentation } = await importRenderer();
  const chart = {
    dates: [
      { date: '2026-09-16', label: '9/16（水）', teamWorkloads: [
        { teamName: 'A班', workloadMinutes: 0, workloadLabel: '0分' },
        { teamName: 'B班', workloadMinutes: 284, workloadLabel: '284分' },
      ] },
      { date: '2026-09-17', label: '9/17（木）', teamWorkloads: [
        { teamName: 'A班', workloadMinutes: 280, workloadLabel: '280分' },
        { teamName: 'B班', workloadMinutes: 0, workloadLabel: '0分' },
      ] },
    ],
  };
  const selection = {
    selectedSlot: { date: '2026-09-16', team: { name: 'B班' } },
    plan: { current: { date: '2026-09-16', team: { name: 'B班' } } },
    destination: { date: '2026-09-17', team: { name: 'A班' } },
    preview: { sourceBefore: 284, sourceAfter: 264, destinationBefore: 280, destinationAfter: 300 },
  };
  assert.equal(buildChartPresentation(chart, selection).maxTotal, 300);

  const html = new PlanSchedulingRenderer({}).workloadChartTemplate(chart, selection);
  assert.match(html, /has-chart-preview/);
  assert.match(html, /is-preview-source/);
  assert.match(html, /is-preview-removed/);
  assert.match(html, /is-preview-destination/);
  assert.match(html, /is-preview-added/);
  assert.doesNotMatch(html, /class="visually-hidden">20分(?:減少|増加)/);
  assert.doesNotMatch(html, /plan-scheduling__tooltipPreview[\s\S]*?<span class="visually-hidden">/);
  assert.match(html, /284分 → 264分[\s\S]*-20分/);
  assert.match(html, /280分 → 300分[\s\S]*\+20分/);
  assert.match(html, /aria-label="[^"]*移動プレビュー後 264分、20分減少[^"]*"/);
  assert.match(html, /aria-label="[^"]*移動プレビュー後 300分、20分増加[^"]*"/);

  const authoritative = new PlanSchedulingRenderer({}).workloadChartTemplate(chart, {
    selectedSlot: selection.selectedSlot,
    preview: null,
  });
  assert.doesNotMatch(authoritative, /has-chart-preview|is-preview-source|is-preview-destination/);
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
  const chartMarkup = template.split(
    '<section class="plan-scheduling__chart"',
  )[1].split('</section>', 1)[0];
  assert.match(template, /data-role="slot-drawer"[^>]*hidden/);
  assert.match(template, /data-action="close-drawer"/);
  assert.match(template, /css\/components\/drawer\/_drawer\.css/);
  assert.match(template, /plan-scheduling__weekButton/);
  assert.match(template, /<label for="plan-scheduling-date">表示日<\/label>/);
  assert.doesNotMatch(template, /<label for="plan-scheduling-date">確認する日<\/label>/);
  assert.match(template, /plan-scheduling__drawerContent[\s\S]*data-role="move-preview"[^>]*hidden[\s\S]*data-role="plan-list"/);
  assert.match(template, /detail-cards detail-card-list plan-scheduling__planList/);
  assert.doesNotMatch(template, /plan-scheduling__plans/);
  assert.doesNotMatch(template, /selected-slot-label|slot-summary/);
  assert.match(template, /data-role="chart-legend"/);
  assert.equal((template.match(/data-role="chart-legend"/g) || []).length, 1);
  assert.match(template, /data-role="maintenance-week"/);
  assert.doesNotMatch(template, /PLAN SCHEDULING|<h1[^>]*>計画調整<\/h1>|配布待ち計画の工数を、保全週日付直班で確認します。/);
  assert.doesNotMatch(template, /単位：分|計画の「移動」を選ぶと、移動先の工数変化を確認できます。/);
  assert.doesNotMatch(chartMarkup, /data-role="chart-legend"/);
  assert.match(template, /plan-scheduling__matrix[\s\S]*?<\/section>\s*<\/div>\s*<\/div>\s*<div class="plan-scheduling__chartLegendViewport" data-role="chart-legend"><\/div>/);
  assert.match(template, /plan-scheduling__planningMain[\s\S]*data-role="planning-canvas"[\s\S]*plan-scheduling__chart[\s\S]*data-role="date-grid"/);
  assert.match(template, /data-role="workload-chart"/);
  assert.match(template, /data-role="maintenance-week"/);
  assert.match(template, /data-role="date-grid"/);
});


test('chart legend is a compact planning-viewport overlay outside the full timeline', () => {
  const template = readFileSync(
    new URL('../../../../templates/planScheduling/plan_scheduling.html', import.meta.url),
    'utf8',
  );
  const scss = readFileSync(
    new URL('../../../../static/css/pages/planScheduling.scss', import.meta.url),
    'utf8',
  );
  const chartMarkup = template.split(
    '<section class="plan-scheduling__chart"',
  )[1].split('</section>', 1)[0];
  const overlayRule = scss.split(
    '.plan-scheduling [data-role="chart-legend"] {',
  )[1].split('}', 1)[0];

  assert.equal((template.match(/data-role="chart-legend"/g) || []).length, 1);
  assert.doesNotMatch(chartMarkup, /data-role="chart-legend"/);
  assert.match(template, /plan-scheduling__matrix[\s\S]*?<\/section>\s*<\/div>\s*<\/div>\s*<div class="plan-scheduling__chartLegendViewport"/);
  assert.match(overlayRule, /position:\s*absolute/);
  assert.match(overlayRule, /right:\s*11px/);
  assert.match(overlayRule, /width:\s*max-content/);
  assert.match(overlayRule, /height:\s*auto/);
  assert.match(overlayRule, /pointer-events:\s*none/);
  assert.doesNotMatch(overlayRule, /transform|82\d{3}px/);
  assert.match(scss, /\.plan-scheduling__chartTooltip\s*\{[^}]*z-index:\s*4/s);
});


test('Move context occupies a fixed Drawer sibling region while cards hide and restore', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const drawer = { hidden: true };
  const planList = { innerHTML: '', hidden: false, scrollTop: 137 };
  const movePreview = { innerHTML: '', hidden: true };
  const elements = new Map([
    ['[data-role="slot-drawer"]', drawer],
    ['[data-role="planning-layout"]', { classList: { toggle: () => {} } }],
    ['[data-role="plan-list"]', planList],
    ['[data-role="move-preview"]', movePreview],
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
  assert.equal(planList.hidden, true);
  assert.equal(movePreview.hidden, false);
  assert.match(movePreview.innerHTML, /plan-scheduling__moveContext/);
  assert.match(movePreview.innerHTML, /data-action="cancel-move"/);
  assert.doesNotMatch(planList.innerHTML, /plan-scheduling__moveContext/);

  planList.scrollTop = 0;
  renderer.renderDrawer({
    isMoving: false,
    selectedSlot: { date: '2026-09-16', dateLabel: '9/16（水）', shift: { name: '1直' }, team: { name: 'A班' }, workloadLabel: '360分', planCount: 1 },
    slotPlans: [], plan: null,
  });
  assert.equal(movePreview.hidden, true);
  assert.equal(planList.hidden, false);
  assert.equal(planList.scrollTop, 137);
});


test('Move immediately opens the same preview component and progressively fills destination impact', async () => {
  const { PlanSchedulingRenderer } = await importRenderer();
  const renderer = new PlanSchedulingRenderer({});
  const plan = {
    inspectionNo: 'CARD-10', machineName: '成形機2号機', workName: '日常点検', workMinutes: 14,
    current: { dateLabel: '9/16', shift: { name: '2直' }, team: { name: 'B班' } },
  };
  const selecting = renderer.moveContextTemplate({ plan, destination: null, preview: null });
  assert.match(selecting, /移動プレビュー/);
  assert.match(selecting, /9\/16/);
  assert.match(selecting, /2直 \/ B班/);
  assert.match(selecting, /14分/);
  assert.match(selecting, /マトリクスから移動先を選択してください/);
  assert.doesNotMatch(selecting, /工数への影響|284分|270分|-14分|133分|147分|\+14分/);
  assert.match(selecting, /data-action="cancel-move"/);
  assert.match(selecting, /plan-scheduling__cancelButton/);
  assert.doesNotMatch(selecting, /保存|確認|confirm/i);

  const preview = renderer.moveContextTemplate({
    plan,
    destination: { dateLabel: '9/17', shift: { name: '1直' }, team: { name: 'A班' } },
    preview: { sourceBefore: 284, sourceAfter: 270, destinationBefore: 133, destinationAfter: 147 },
  });
  assert.match(preview, /移動プレビュー/);
  assert.match(preview, /移動元/);
  assert.match(preview, /移動先/);
  assert.match(preview, /284分/);
  assert.match(preview, /270分/);
  assert.match(preview, /-14分/);
  assert.match(preview, /133分/);
  assert.match(preview, /147分/);
  assert.match(preview, /\+14分/);
  assert.match(preview, /プレビューのみ。保存・更新は行われません。/);
  assert.doesNotMatch(preview, /data-action="(?:save|confirm|submit)/);
});


test('chart tooltip overlays the matrix top while horizontally clamped', async () => {
  const { placeChartTooltip } = await importRenderer();
  const boundsRect = { left: 100, top: 100, right: 700, bottom: 500 };
  const matrixRect = { left: 100, top: 450, right: 700, bottom: 900 };
  const tooltipRect = { width: 190, height: 140 };

  const normal = placeChartTooltip({
    horizontalAnchorRect: { left: 300, top: 200, width: 44, bottom: 260 }, matrixRect, tooltipRect, boundsRect,
  });
  assert.equal(normal.left, 227);
  assert.equal(normal.top, 450);

  const shortBar = placeChartTooltip({
    horizontalAnchorRect: { left: 300, top: 108, width: 44, bottom: 250 }, matrixRect, tooltipRect, boundsRect,
  });
  assert.equal(shortBar.left, 227);
  assert.equal(shortBar.top, 450);

  const tallBar = placeChartTooltip({
    horizontalAnchorRect: { left: 300, top: 108, width: 44, bottom: 420 }, matrixRect, tooltipRect, boundsRect,
  });
  assert.equal(tallBar.top, 450);

  const leftCollision = placeChartTooltip({
    horizontalAnchorRect: { left: 90, top: 300, width: 44, bottom: 360 }, matrixRect, tooltipRect, boundsRect,
  });
  assert.equal(leftCollision.left, 108);
  assert.equal(leftCollision.top, 450);

  const rightCollisionAfterHorizontalScroll = placeChartTooltip({
    horizontalAnchorRect: { left: 680, top: 200, width: 44, bottom: 260 }, matrixRect, tooltipRect, boundsRect,
  });
  assert.equal(rightCollisionAfterHorizontalScroll.left, 502);
  assert.equal(rightCollisionAfterHorizontalScroll.top, 450);
});


test('chart tooltip visibility is bar-owned and requires successful positioning', async () => {
  const scss = readFileSync(
    new URL('../../../../static/css/pages/planScheduling.scss', import.meta.url),
    'utf8',
  );
  const css = readFileSync(
    new URL('../../../../static/css/pages/planScheduling.css', import.meta.url),
    'utf8',
  );

  for (const stylesheet of [scss, css]) {
    assert.match(stylesheet, /\.plan-scheduling__chartTooltip\s*\{[^}]*position:\s*fixed[^}]*opacity:\s*0[^}]*pointer-events:\s*none/s);
    assert.doesNotMatch(stylesheet, /\.plan-scheduling__chartColumn:(?:hover|focus-within)\s+\.plan-scheduling__chartTooltip/);
    assert.doesNotMatch(stylesheet, /bottom:\s*28px/);
    assert.match(stylesheet, /\.plan-scheduling__chartBar:hover\s*~\s*\.plan-scheduling__chartTooltip\.is-positioned[\s\S]*?opacity:\s*1/s);
    assert.match(stylesheet, /\.plan-scheduling__chartBar:focus\s*~\s*\.plan-scheduling__chartTooltip\.is-positioned[\s\S]*?opacity:\s*1/s);
  }

  const { PlanSchedulingRenderer } = await importRenderer();
  const positioned = [];
  const tooltip = {
    classList: { add: (name) => positioned.push(name) },
    style: {},
    dataset: {},
    getBoundingClientRect: () => ({ width: 190, height: 140 }),
  };
  const column = { querySelector: () => tooltip };
  const chartBar = {
    isConnected: true,
    closest: (selector) => selector === '.plan-scheduling__chartBar' ? chartBar :
      selector === '.plan-scheduling__chartColumn' ? column : null,
    getBoundingClientRect: () => ({ left: 300, top: 200, width: 44, bottom: 260 }),
  };
  const matrix = { getBoundingClientRect: () => ({ left: 100, top: 450, right: 700, bottom: 900 }) };
  const renderer = new PlanSchedulingRenderer({
    querySelector: (selector) => selector === '.plan-scheduling__matrix' ? matrix :
      selector === '.plan-scheduling__planningMain' ? { getBoundingClientRect: () => ({ left: 100, top: 100, right: 700, bottom: 500 }) } : null,
  });

  renderer.showChartTooltip({ target: column });
  assert.equal(renderer.activeChartBar, null);
  assert.deepEqual(positioned, []);

  renderer.showChartTooltip({ target: chartBar });
  assert.equal(renderer.activeChartBar, chartBar);
  assert.deepEqual(positioned, ['is-positioned']);
  assert.equal(tooltip.style.top, '450px');
  assert.equal(tooltip.style.left, '227px');

  renderer.hideChartTooltip({ target: chartBar, relatedTarget: null });
  assert.equal(renderer.activeChartBar, null);
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
    ['[data-role="move-preview"]', { innerHTML: '', hidden: true }],
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
  assert.equal(controller.interaction.moveContext.plan.planId, 10);
  assert.equal(controller.interaction.moveContext.sourceSlot.key, '2026-09-15:1');
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
  assert.equal(lastSelection.preview, null);
});


test('current-week slot selection reuses detailed state without another week request', async () => {
  const { PlanSchedulingController } = await importController();
  const selectedSlot = {
    ...slot('2026-09-21:1', 240), date: '2026-09-21', dateLabel: '9/21',
    shift: { name: '1直' }, team: { name: 'A班' }, planIds: [20], planCount: 1,
  };
  const selectedPlan = plan({ planId: 20, current: { slotKey: selectedSlot.key } });
  let fetchCount = 0;
  let renderedSelection = null;
  const controller = new PlanSchedulingController({
    root: {},
    apiClient: { fetchWeek: async () => { fetchCount += 1; } },
    renderer: {
      renderSelection: (_state, selection) => { renderedSelection = selection; },
    },
    buildPreview: () => null,
    selectSlotPlans: previewPolicy.plansForSlot,
  });
  controller.state = {
    plans: [selectedPlan],
    dates: [{ date: selectedSlot.date, slots: [selectedSlot] }],
  };

  await controller.handleClick({ target: { closest: (selector) => (
    selector === '[data-slot-key]'
      ? { disabled: false, dataset: { slotKey: selectedSlot.key, slotDate: selectedSlot.date } }
      : null
  ) } });

  assert.equal(fetchCount, 0);
  assert.equal(renderedSelection.selectedSlot, selectedSlot);
  assert.deepEqual(renderedSelection.slotPlans, [selectedPlan]);
});


test('distant timeline slot hydrates its existing week, preserves scroll, and can start Move', async () => {
  const { PlanSchedulingController } = await importController();
  const currentDate = '2026-09-21';
  const targetDate = '2027-02-15';
  const targetSlot = {
    ...slot(`${targetDate}:2`, 360), date: targetDate, dateLabel: '2/15',
    shift: { name: '2直' }, team: { name: 'B班' }, planIds: [30], planCount: 1,
    workloadLabel: '360分', dataQualityIssues: [],
  };
  const targetPlan = plan({
    planId: 30,
    current: {
      slotKey: targetSlot.key, date: targetDate, dateLabel: targetSlot.dateLabel,
      shift: targetSlot.shift, team: targetSlot.team,
    },
  });
  const timelineDates = [
    { date: currentDate, slots: [] },
    { date: targetDate, slots: [{ ...targetSlot, planIds: [] }] },
  ];
  const timelineChart = {
    shiftNames: ['2直'],
    dates: timelineDates.map((day) => ({ date: day.date, label: day.date, teamWorkloads: [] })),
  };
  const weekState = {
    plans: [targetPlan],
    dates: [{ date: targetDate, label: targetDate, slots: [targetSlot] }],
    week: { label: '2月3週目' },
    workloadChart: { shiftNames: ['2直'], dates: [] },
    dataQuality: { hasErrors: false, issueCount: 0 },
  };
  const requestedDates = [];
  const viewport = { scrollLeft: 24680 };
  let renderedState = null;
  let renderedSelection = null;
  let scrollCalls = 0;
  const controller = new PlanSchedulingController({
    root: {},
    apiClient: {
      fetchWeek: async (date) => {
        requestedDates.push(date);
        return weekState;
      },
    },
    renderer: {
      renderState: (state, selection) => {
        renderedState = state;
        renderedSelection = selection;
      },
      renderSelection: (_state, selection) => { renderedSelection = selection; },
      scrollTimelineToDate: () => { scrollCalls += 1; },
      planningMain: viewport,
    },
    buildPreview: previewPolicy.buildWorkloadPreview,
    selectSlotPlans: previewPolicy.plansForSlot,
  });
  controller.timelineDates = timelineDates;
  controller.timelineChart = timelineChart;
  controller.state = {
    plans: [],
    dates: [{ date: currentDate, slots: [] }],
    timelineDates,
    workloadChart: timelineChart,
  };

  const eventFor = (selector, button) => ({
    target: { closest: (query) => query === selector ? button : null },
  });
  await controller.handleClick(eventFor('[data-slot-key]', {
    disabled: false,
    dataset: { slotKey: targetSlot.key, slotDate: targetDate },
  }));

  assert.deepEqual(requestedDates, [targetDate]);
  assert.equal(renderedState.timelineDates, timelineDates);
  assert.equal(renderedState.workloadChart, timelineChart);
  assert.equal(renderedSelection.selectedSlot, targetSlot);
  assert.deepEqual(renderedSelection.slotPlans, [targetPlan]);
  assert.equal(viewport.scrollLeft, 24680);
  assert.equal(scrollCalls, 0);

  controller.handleClick(eventFor('[data-action="move"]', {
    disabled: false, dataset: { planId: '30' },
  }));
  assert.equal(controller.interaction.mode, previewPolicy.PlanSchedulingMode.MOVING);
  assert.equal(controller.interaction.moveContext.sourceSlot, targetSlot);
  assert.equal(renderedSelection.plan, targetPlan);
});


test('distant hydration never presents the previous Drawer date as the new selection', async () => {
  const { PlanSchedulingController } = await importController();
  const { PlanSchedulingRenderer } = await importRenderer();
  const previousSlot = {
    ...slot('2026-12-20:1', 120), date: '2026-12-20', dateLabel: '12/20',
    shift: { name: '1直' }, team: { name: 'A班' }, planIds: [], planCount: 0,
    workloadLabel: '120分', dataQualityIssues: [],
  };
  const targetSlot = {
    ...slot('2026-10-04:2', 360), date: '2026-10-04', dateLabel: '10/4',
    shift: { name: '2直' }, team: { name: 'B班' }, planIds: [40], planCount: 1,
    workloadLabel: '360分', dataQualityIssues: [],
  };
  const targetPlan = plan({
    planId: 40,
    current: {
      slotKey: targetSlot.key, date: targetSlot.date, dateLabel: targetSlot.dateLabel,
      shift: targetSlot.shift, team: targetSlot.team,
    },
    dataQualityIssues: [],
  });
  const drawer = { hidden: false, setAttribute: () => {} };
  const drawerDate = { textContent: '12/20' };
  const drawerSlot = { textContent: '1直A班' };
  const drawerSummary = { textContent: '120分 / 0件' };
  const planList = { hidden: false, innerHTML: 'previous plans', scrollTop: 0 };
  const movePreview = { hidden: true, innerHTML: '' };
  const planningLayout = { classList: { toggle: () => {} } };
  const elements = new Map([
    ['[data-role="slot-drawer"]', drawer],
    ['[data-role="drawer-date"]', drawerDate],
    ['[data-role="drawer-slot"]', drawerSlot],
    ['[data-role="drawer-summary"]', drawerSummary],
    ['[data-role="plan-list"]', planList],
    ['[data-role="move-preview"]', movePreview],
    ['[data-role="planning-layout"]', planningLayout],
  ]);
  const view = new PlanSchedulingRenderer({
    addEventListener: () => {},
    querySelector: (selector) => elements.get(selector) || null,
  });
  let resolveWeek;
  const weekPromise = new Promise((resolve) => { resolveWeek = resolve; });
  const controller = new PlanSchedulingController({
    root: {},
    apiClient: { fetchWeek: () => weekPromise },
    renderer: {
      renderSlotHydrationPending: () => view.renderSlotHydrationPending(),
      renderState: (_state, selection) => view.renderDrawer(selection),
      renderSelection: (_state, selection) => view.renderDrawer(selection),
      renderInteractionError: (message) => { throw new Error(message); },
    },
    buildPreview: () => null,
    selectSlotPlans: previewPolicy.plansForSlot,
  });
  controller.state = {
    plans: [],
    dates: [{ date: previousSlot.date, slots: [previousSlot] }],
    workloadChart: { dates: [], shiftNames: [] },
  };
  controller.interaction = previewPolicy.selectMatrixSlot(
    previewPolicy.initialInteractionState(),
    previousSlot.key,
    { slot: previousSlot, slotPlans: [] },
  );

  const pendingSelection = controller.handleClick({ target: { closest: (selector) => (
    selector === '[data-slot-key]'
      ? { disabled: false, dataset: { slotKey: targetSlot.key, slotDate: targetSlot.date } }
      : null
  ) } });
  assert.equal(drawer.hidden, false);
  assert.equal(drawerDate.textContent, '読み込み中');
  assert.notEqual(drawerDate.textContent, '12/20');
  assert.doesNotMatch(planList.innerHTML, /previous plans/);

  resolveWeek({
    plans: [targetPlan],
    dates: [{ date: targetSlot.date, slots: [targetSlot] }],
    workloadChart: { dates: [], shiftNames: ['2直'] },
    dataQuality: { hasErrors: false, issueCount: 0 },
  });
  await pendingSelection;

  assert.match(drawerDate.textContent, /10.*4/);
  assert.equal(drawerSlot.textContent, '2直B班');
  assert.equal(drawerSummary.textContent, '360分 / 1件');
  assert.match(planList.innerHTML, /data-plan-card-id="40"/);
});


test('a stale distant-week response cannot replace a newer slot click', async () => {
  const { PlanSchedulingController } = await importController();
  const resolvers = new Map();
  const makeWeek = (date) => {
    const hydratedSlot = {
      ...slot(`${date}:1`, 120), date, dateLabel: date,
      shift: { name: '1直' }, team: { name: 'A班' }, planIds: [], planCount: 0,
    };
    return {
      hydratedSlot,
      state: {
        plans: [], dates: [{ date, slots: [hydratedSlot] }],
        workloadChart: { dates: [], shiftNames: ['1直'] },
        dataQuality: { hasErrors: false, issueCount: 0 },
      },
    };
  };
  let renderedSelection = null;
  const controller = new PlanSchedulingController({
    root: {},
    apiClient: { fetchWeek: (date) => new Promise((resolve) => resolvers.set(date, resolve)) },
    renderer: {
      renderState: (_state, selection) => { renderedSelection = selection; },
    },
    buildPreview: () => null,
    selectSlotPlans: () => [],
  });
  controller.timelineDates = [];
  controller.state = { plans: [], dates: [], workloadChart: { dates: [], shiftNames: [] } };
  const first = makeWeek('2026-10-05');
  const second = makeWeek('2027-01-11');
  const click = (item) => controller.handleClick({ target: { closest: (selector) => (
    selector === '[data-slot-key]'
      ? { disabled: false, dataset: { slotKey: item.hydratedSlot.key, slotDate: item.hydratedSlot.date } }
      : null
  ) } });

  const firstClick = click(first);
  const secondClick = click(second);
  resolvers.get(second.hydratedSlot.date)(second.state);
  await secondClick;
  resolvers.get(first.hydratedSlot.date)(first.state);
  await firstClick;

  assert.equal(renderedSelection.selectedSlot, second.hydratedSlot);
  assert.equal(controller.state.dates[0].date, second.hydratedSlot.date);
});


test('initial load combines full shared timeline summaries with current week interaction state', async () => {
  const { PlanSchedulingController } = await importController();
  const input = { value: '' };
  const form = { addEventListener: () => {} };
  const weekChart = { shiftNames: [], dates: [{ date: '2026-09-14' }] };
  const timelineChart = {
    shiftNames: [],
    dates: [{ date: '2026-02-09' }, { date: '2027-03-28' }],
  };
  const timelineDates = [
    { date: '2026-02-09', slots: [] },
    { date: '2027-03-28', slots: [] },
  ];
  let renderedState = null;
  let scrolledDate = null;
  const controller = new PlanSchedulingController({
    root: {
      addEventListener: () => {},
      querySelector: (selector) => ({
        '[data-role="week-form"]': form,
        '[data-role="target-date"]': input,
      })[selector] || null,
    },
    apiClient: {
      fetchWeek: async () => ({
        plans: [], dates: [{ date: '2026-09-14', slots: [] }],
        workloadChart: weekChart, dataQuality: { hasErrors: false, issueCount: 0 },
      }),
      fetchTimeline: async () => ({ dates: timelineDates, workloadChart: timelineChart }),
    },
    renderer: {
      renderLoading: () => {},
      renderError: (message) => { throw new Error(message); },
      renderState: (state) => { renderedState = state; },
      scrollTimelineToDate: (date) => { scrolledDate = date; },
    },
    buildPreview: () => null,
    selectSlotPlans: () => [],
  });

  await controller.init();

  assert.equal(renderedState.dates.length, 1);
  assert.equal(renderedState.workloadChart, timelineChart);
  assert.equal(renderedState.timelineDates, timelineDates);
  assert.equal(scrolledDate, input.value);
});


test('controller retains the authoritative move source when the displayed week changes', async () => {
  const { PlanSchedulingController } = await importController();
  const sourceSlot = {
    ...slot('2026-09-14:1', 120), date: '2026-09-14', dateLabel: '9/14（月）',
    team: { name: 'A班' }, planIds: [10],
  };
  const sourcePlan = plan({
    current: { slotKey: sourceSlot.key, date: sourceSlot.date, dateLabel: sourceSlot.dateLabel },
  });
  const moveContext = {
    plan: sourcePlan,
    sourceSlot,
    chartDay: { date: sourceSlot.date, label: sourceSlot.dateLabel, teamWorkloads: [] },
    weekLabel: '9月2週目',
  };
  let renderedSelection = null;
  const controller = new PlanSchedulingController({
    root: {},
    apiClient: {
      fetchWeek: async () => ({
        plans: [], dates: [{ slots: [] }], workloadChart: { dates: [], shiftNames: [] },
      }),
    },
    renderer: {
      renderLoading: () => {},
      renderState: (_state, selection) => { renderedSelection = selection; },
      renderError: (message) => { throw new Error(message); },
    },
    buildPreview: () => null,
    selectSlotPlans: () => [],
  });
  controller.interaction = previewPolicy.beginMove(
    previewPolicy.initialInteractionState(), sourcePlan.planId, moveContext,
  );

  await controller.load('2026-09-21');

  assert.equal(controller.interaction.mode, previewPolicy.PlanSchedulingMode.MOVING);
  assert.equal(controller.interaction.moveContext, moveContext);
  assert.equal(renderedSelection.plan, sourcePlan);
  assert.equal(renderedSelection.source, sourceSlot);
});


test('week submit preserves the Drawer and pinned Move source through the live controller path', async () => {
  const { PlanSchedulingController } = await importController();
  const { PlanSchedulingRenderer } = await importRenderer();
  const sourceSlot = {
    key: '2026-09-14:1:A', date: '2026-09-14', dateLabel: '9/14（月）',
    shift: { name: '1直' }, team: { name: 'A班' }, workloadMinutes: 120,
    workloadLabel: '120分', isValid: true, dataQualityIssues: [], planIds: [10],
  };
  const sourcePlan = plan({
    current: { slotKey: sourceSlot.key, date: sourceSlot.date, dateLabel: sourceSlot.dateLabel },
  });
  const sourceWeek = {
    plans: [sourcePlan],
    dates: [{ date: sourceSlot.date, label: sourceSlot.dateLabel, slots: [sourceSlot] }],
    week: { label: '9月2週目' },
    workloadChart: {
      shiftNames: ['1直'],
      dates: [{
        date: sourceSlot.date, label: sourceSlot.dateLabel, totalWorkloadMinutes: 120,
        teamWorkloads: [{ teamName: 'A班', workloadMinutes: 120, workloadLabel: '120分' }],
      }],
    },
  };
  const destinationDates = Array.from({ length: 7 }, (_, index) => {
    const date = `2026-09-${String(21 + index).padStart(2, '0')}`;
    return { date, label: date, slots: [] };
  });
  const destinationWeek = {
    plans: [], dates: destinationDates, week: { label: '9月3週目' },
    workloadChart: {
      shiftNames: ['1直'],
      dates: destinationDates.map((day) => ({
        ...day, totalWorkloadMinutes: 0, teamWorkloads: [],
      })),
    },
  };
  const fullTimelineChart = {
    shiftNames: ['1直'],
    dates: [
      sourceWeek.workloadChart.dates[0],
      ...destinationWeek.workloadChart.dates,
      { date: '2026-10-01', label: '10/1（木）', maintenanceWeekLabel: '10月1週目', totalWorkloadMinutes: 0, teamWorkloads: [] },
    ],
  };
  const fullTimelineDates = [
    sourceWeek.dates[0],
    ...destinationDates,
    { date: '2026-10-01', label: '10/1（木）', maintenanceWeekLabel: '10月1週目', slots: [] },
  ];
  const view = new PlanSchedulingRenderer({});
  const input = { value: '2026-09-21' };
  let finalRender = null;
  let lastSelection = null;
  let scrolledDate = null;
  const controller = new PlanSchedulingController({
    root: { querySelector: (selector) => selector === '[data-role="target-date"]' ? input : null },
    apiClient: { fetchWeek: async () => destinationWeek },
    renderer: {
      renderLoading: () => {},
      renderError: (message) => { throw new Error(message); },
      renderSelection: (_state, selection) => { lastSelection = selection; },
      scrollTimelineToDate: (date) => { scrolledDate = date; },
      renderState: (state, selection) => {
        const displayDates = view.matrixDates(state, selection);
        const chartDates = view.chartWithPinnedMoveSource(state.workloadChart, selection).dates;
        finalRender = {
          selection,
          drawerOpen: Boolean(selection.selectedSlot),
          matrixDates: displayDates,
          chartHtml: view.workloadChartTemplate(state.workloadChart, selection),
          maintenanceHtml: view.maintenanceWeekTemplate(null, chartDates),
        };
      },
    },
    buildPreview: previewPolicy.buildWorkloadPreview,
    selectSlotPlans: previewPolicy.plansForSlot,
  });
  controller.state = sourceWeek;
  controller.timelineChart = fullTimelineChart;
  controller.timelineDates = fullTimelineDates;
  const eventFor = (selector, button) => ({
    target: { closest: (query) => query === selector ? button : null },
  });
  controller.handleClick(eventFor('[data-slot-key]', {
    disabled: false, dataset: { slotKey: sourceSlot.key },
  }));
  assert.equal(controller.interaction.selectedSlotContext.slot, sourceSlot);
  assert.deepEqual(controller.interaction.selectedSlotContext.slotPlans, [sourcePlan]);
  controller.handleClick(eventFor('[data-action="move"]', {
    disabled: false, dataset: { planId: '10' },
  }));
  let prevented = false;
  await controller.handleWeekSubmit({ preventDefault: () => { prevented = true; } });

  assert.equal(prevented, true);
  assert.equal(scrolledDate, '2026-09-21');
  assert.equal(finalRender.drawerOpen, true);
  assert.equal(finalRender.selection.moveContext.sourceSlot, sourceSlot);
  assert.equal(finalRender.selection.selectedSlot, sourceSlot);
  assert.deepEqual(finalRender.matrixDates.map((day) => day.date), [
    sourceSlot.date, ...destinationDates.map((day) => day.date), '2026-10-01',
  ]);
  assert.match(finalRender.chartHtml, /data-plan-date="2026-10-01"/);
  assert.equal(finalRender.matrixDates.some((day) => day.date === '2026-10-01'), true);
  assert.doesNotMatch(finalRender.chartHtml, /chartColumn is-pinned-move-source/);
  assert.equal((finalRender.chartHtml.match(/data-plan-date="2026-09-14"/g) || []).length, 1);
  assert.deepEqual(
    [...finalRender.maintenanceHtml.matchAll(/data-plan-date="([^"]+)"/g)].map((match) => match[1]),
    [sourceSlot.date, ...destinationDates.map((day) => day.date), '2026-10-01'],
  );

  controller.handleClick(eventFor('[data-action="cancel-move"]', {}));
  assert.equal(controller.interaction.moveContext, null);
  assert.equal(lastSelection.selectedSlot, sourceSlot);
  assert.deepEqual(lastSelection.slotPlans, [sourcePlan]);
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
  assert.equal(lastSelection.preview, null);
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
  assert.match(scss, /\.plan-scheduling \[data-role="chart-legend"\]\s*\{[^}]*position:\s*absolute[^}]*z-index:\s*3[^}]*right:\s*11px[^}]*width:\s*max-content[^}]*height:\s*auto[^}]*pointer-events:\s*none/s);
  assert.match(scss, /\.plan-scheduling__chartLegendSwatch\s*\{[^}]*background:\s*var\(--plan-scheduling-team-color\)/s);
  assert.doesNotMatch(scss, /team-other/);
  assert.doesNotMatch(scss, /plan-scheduling__yAxis/);
  assert.match(scss, /\.plan-scheduling__planList[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
  assert.match(scss, /\.plan-scheduling__planList[^}]*overflow-y:\s*auto/s);
  assert.match(scss, /\.plan-scheduling__dateForm[^}]*justify-content:\s*flex-start/s);
  assert.match(scss, /\.plan-scheduling__drawerContent[^}]*flex:\s*1\s+1\s+auto[^}]*min-height:\s*0/s);
  assert.match(scss, /\.plan-scheduling__movePreviewRegion[^}]*flex:\s*1\s+1\s+auto/s);
  assert.match(scss, /\.plan-scheduling__planList\[hidden\][\s\S]*\.plan-scheduling__movePreviewRegion\[hidden\]\s*\{\s*display:\s*none/s);
  assert.match(scss, /\.plan-scheduling__weekButton[^}]*min-height:\s*38px[^}]*border-radius:\s*8px/s);
  assert.match(scss, /\.plan-scheduling__moveButton[^}]*min-height:\s*38px[^}]*border-radius:\s*8px/s);
  assert.match(scss, /\.plan-scheduling__cancelMove[^}]*min-height:\s*38px[^}]*border-radius:\s*8px/s);
  assert.doesNotMatch(scss, /\.plan-scheduling__planList\s*\{[^}]*display:\s*grid/s);
  assert.match(scss, /\.plan-scheduling__planCard[^}]*flex:\s*0\s+0\s+auto/s);
  assert.match(scss, /\.plan-scheduling__planCard[^}]*max-height:\s*270px/s);
  assert.match(scss, /\.plan-scheduling__planCard\s+\.detail-card__body[^}]*max-height:\s*140px/s);
  assert.match(scss, /\.plan-scheduling__planCard:hover\s+\.detail-card__body[\s\S]*overflow-y:\s*auto/s);
  assert.match(scss, /\.plan-scheduling__chartSegment\.is-selected-chart-segment/);
  assert.match(scss, /has-chart-selection[\s\S]*opacity:\s*\.35/);
  assert.match(scss, /has-chart-selection[\s\S]*filter:\s*saturate\(\.3\)/);
  assert.match(scss, /\.plan-scheduling__planningMain[^}]*overflow-x:\s*auto[^}]*overflow-y:\s*hidden/s);
  assert.match(scss, /\.plan-scheduling__planningMain[^}]*height:\s*100%/s);
  assert.match(scss, /\.plan-scheduling__planningCanvas[^}]*--plan-date-column-width:\s*190px/s);
  assert.match(scss, /\.plan-scheduling__planningCanvas[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/s);
  assert.match(scss, /\.plan-scheduling__chart\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto[^}]*padding-top:\s*30px/s);
  assert.doesNotMatch(scss, /\.plan-scheduling__chartTimeline\s*\{/);
  assert.doesNotMatch(scss, /\.plan-scheduling__chartLegend\s*\{[^}]*width:\s*(?:100%|max-content)/s);
  assert.match(scss, /\.plan-scheduling__chartColumn\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/s);
  assert.doesNotMatch(scss, /\.plan-scheduling__chartColumn\s*>\s*span/);
  assert.match(scss, /\.plan-scheduling__maintenanceWeek[^}]*grid-auto-columns:\s*var\(--plan-date-track\)[^}]*grid-auto-flow:\s*column[^}]*gap:\s*var\(--plan-date-column-gap\)/s);
  assert.match(scss, /\.plan-scheduling__maintenanceWeek[^}]*padding:\s*6px\s+0[^}]*border-block:\s*1px\s+solid/s);
  assert.match(scss, /\.plan-scheduling__chartColumns[^}]*padding:\s*12px\s+0\s+0/s);
  assert.match(scss, /\.plan-scheduling__chartColumns[^}]*grid-auto-columns:\s*var\(--plan-date-track\)/s);
  assert.match(scss, /\.plan-scheduling__dateGrid[^}]*grid-auto-columns:\s*var\(--plan-date-track\)/s);
  assert.match(scss, /\.plan-scheduling__planningLayout\.has-drawer\s+\.plan-scheduling__planningCanvas[^}]*--plan-date-track:\s*max\(90px,\s*calc\(\(100cqw\s*-\s*82px\)\s*\/\s*7\)\)/s);
  assert.doesNotMatch(scss, /grid-template-columns:\s*repeat\((?:7|8),\s*var\(--plan-date-track\)\)/s);
  assert.match(scss, /\.plan-scheduling__chartColumn\.is-pinned-move-source/);
  assert.match(scss, /\.plan-scheduling__dateColumn\.is-pinned-move-source/);
  assert.match(scss, /\.plan-scheduling__chartPlot[^}]*overflow:\s*visible/s);
  assert.match(scss, /\[data-role="workload-chart"\][^}]*height:\s*100%/s);
  assert.match(scss, /\.plan-scheduling__chartPlot[^}]*height:\s*100%/s);
  assert.match(scss, /\.plan-scheduling__chartColumns[^}]*height:\s*100%/s);
  assert.match(scss, /\.plan-scheduling__chartColumns[^}]*box-sizing:\s*border-box/s);
  assert.match(scss, /\.plan-scheduling__chartBar\s*\{[^}]*height:\s*100%/s);
  assert.match(scss, /\.plan-scheduling__dateGrid[^}]*overflow-x:\s*visible[^}]*overflow-y:\s*auto/s);
  assert.match(scss, /\.plan-scheduling__planningLayout\.has-drawer[^}]*clamp\(380px,\s*26vw,\s*440px\)/s);
  assert.match(scss, /\.plan-scheduling__planCardActions[^}]*justify-content:\s*flex-end/s);
  assert.match(scss, /\.plan-scheduling__chartPlot\.has-chart-preview/);
  assert.match(scss, /\.plan-scheduling__chartTooltip\s*\{[^}]*position:\s*fixed/s);
  assert.match(scss, /\.plan-scheduling__chartColumn\.is-selected-date,[\s\S]*\.plan-scheduling__maintenanceWeekCell\.is-selected-date,[\s\S]*\.plan-scheduling__dateColumn\.is-selected-date/s);
  assert.match(scss, /\.is-date-pinned-left[\s\S]*transform:\s*translateX\(var\(--plan-selected-date-offset\)\)/s);
  assert.match(scss, /\.is-date-pinned-right[\s\S]*transform:\s*translateX\(var\(--plan-selected-date-offset\)\)/s);
  assert.match(scss, /\.is-preview-removed/);
  assert.match(scss, /\.is-preview-added/);
  assert.match(scss, /prefers-reduced-motion:\s*reduce/);
  assert.match(scss, /prefers-reduced-motion:[\s\S]*\.plan-scheduling__skeletonMatrix i[^}]*animation:\s*none/s);
  assert.match(scss, /\.plan-scheduling__skeletonCanvas[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/s);
  assert.doesNotMatch(scss, /justify-content:\s*space-around/);
});
