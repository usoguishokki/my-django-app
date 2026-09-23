import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

async function importSource(path, replacements = []) {
  let source = readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const [before, after] of replacements) source = source.replace(before, after);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const dateStub = 'const getJsDay = (value) => value ? new Date(`${value}T12:00:00Z`).getUTCDay() : null;';

test('weekday filter uses serialized current weekday, not separate master weekday', async () => {
  const { ScheduleTestCardCaseFilter } = await importSource(
    '../domain/ScheduleTestCardCaseFilter.js',
    [["import { getJsDay } from '../../utils/dateTime.js';", dateStub]],
  );
  const moved = {
    planId: 81480, planDate: '2026-10-12',
    dayOfWeek: 0, standardDayOfWeek: 5,
  };
  assert.deepEqual(ScheduleTestCardCaseFilter.filter([moved], '0'), [moved]);
  assert.deepEqual(ScheduleTestCardCaseFilter.filter([moved], '5'), []);
});

test('card text uses current weekday and shift; bulk candidates use filtered items', async () => {
  const { renderScheduleTestCardsHTML } = await importSource(
    '../../ui/renderers/scheduleTestCardsRenderer.js',
    [
      ["import { UIManger } from '../../manager/UIManger.js';",
        'const UIManger = { escapeHtml: (value) => String(value ?? "") };'],
      ["import { labelForAttrValue, formatJsDayToDowLabel } from '../formatters/labelFormatters.js';",
        "const labelForAttrValue = (_key, value) => ['月','火','水','木','金','土','日'][value]; const formatJsDayToDowLabel = (day) => ['日','月','火','水','木','金','土'][day];"],
      ["import { getJsDay } from '../../utils/dateTime.js';", dateStub],
      [/import \{\s*renderDetailItemsHTML,\s*\} from '\.\/detailItemsRenderer\.js';/,
        'const renderDetailItemsHTML = () => "";'],
    ],
  );
  const html = renderScheduleTestCardsHTML([{
    planId: 81480, planDate: '2026-10-12', dayOfWeek: 0,
    standardDayOfWeek: 5, assignedAffiliationId: 2,
    currentShiftName: '1直', workName: 'Inspection',
  }]);
  assert.match(html, /月_1直/);
  assert.doesNotMatch(html, /土_1直/);
  assert.match(html, /data-assigned-affiliation-id="2"/);
});

test('week loader sends current affiliation to server and retains one card source', async () => {
  const { ScheduleTestCardDataService } = await importSource(
    '../application/testCards/ScheduleTestCardDataService.js',
  );
  let requested;
  const card = { planId: 81480, planDate: '2026-10-12', assignedAffiliationId: 2 };
  const service = new ScheduleTestCardDataService({
    dataService: { fetchTestCardsWeek: async (params) => {
      requested = params;
      return { data: { items: [card], activeDateAlias: '10月3週目' } };
    } },
    getSelectedDate: () => '2026-10-12',
    getSelectedDateAlias: () => '10月3週目',
    getSelectedShiftPatternId: () => 7,
    getSelectedAffiliationId: () => 2,
  });
  await service.loadWeek();
  assert.equal(requested.affiliationId, 2);
  assert.deepEqual(service.getItems(), [card]);
});
