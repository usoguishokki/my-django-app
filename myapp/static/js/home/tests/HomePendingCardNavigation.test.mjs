import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


async function importSource(relativePath, prelude = '') {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(`${prelude}\n${source}`).toString('base64')}`;
  return import(dataUrl);
}


const navigationPolicy = await importSource(
  '../domain/HomeCardNavigationPolicy.js'
);


test('pending card is previewed and exposes item navigation', () => {
  const dateGroup = {
    date: '2026-09-14',
    items: [{ planId: 42, planTimeLabel: '09:30' }],
  };

  assert.equal(
    navigationPolicy.shouldPreviewCardListFromMyTaskDateGroup({
      statusKey: 'approval_waiting',
      dateGroup,
    }),
    true
  );
  assert.equal(
    navigationPolicy.canOpenCardPageFromMyTaskItem('approval_waiting'),
    true
  );
});


test('pending item navigation carries the canonical plan identity', async () => {
  globalThis.__openedCard = null;
  const navigator = await importSource(
    '../navigation/HomeCardPageNavigator.js',
    'const openCardWorkPage = (options) => { globalThis.__openedCard = options; };'
  );

  navigator.openCardPageFromMyTaskItem({
    statusKey: 'approval_waiting',
    date: '2026-09-14',
    planId: '42',
  });

  assert.deepEqual(globalThis.__openedCard, {
    source: 'home',
    scope: 'my_tasks',
    statusKey: 'approval_waiting',
    date: '2026-09-14',
    planId: '42',
  });
});


test('approved card is not exposed as an editable Home item', () => {
  assert.equal(
    navigationPolicy.canOpenCardPageFromMyTaskItem('completed'),
    false
  );
});


test('pending result stays editable while completed result stays read-only', async () => {
  const editPolicy = await importSource(
    '../../card/work/domain/CardWorkEditPolicy.js'
  );
  const existingResultPolicy = await importSource(
    '../../card/work/domain/CardWorkExistingResultPolicy.js'
  );

  assert.equal(editPolicy.canEditCardWorkResult('承認待ち'), true);
  assert.equal(editPolicy.canEditCardWorkResult('完了'), false);
  assert.equal(
    existingResultPolicy.shouldRestoreExistingCardWorkResult('承認待ち'),
    true
  );
});


test('saving a pending Home edit returns to Home without dropping local status state', async () => {
  const { CardWorkPageService } = await importSource(
    '../../card/work/application/CardWorkPageService.js'
  );
  let returnedHome = false;
  const context = {
    initialState: {
      source: 'home',
      statusKey: 'approval_waiting',
    },
    draftsByPlanId: new Map([['42', { comment: 'draft' }]]),
    goToHomeDashboard() {
      returnedHome = true;
    },
    goToWorkContents() {
      assert.fail('pending Home edit must not use the work-contents return path');
    },
  };

  CardWorkPageService.prototype.handleResultRegistered.call(context, {
    planId: '42',
    response: {
      planId: 42,
      planStatus: '承認待ち',
    },
  });

  assert.equal(returnedHome, true);
  assert.equal(context.draftsByPlanId.has('42'), false);
});


test('existing Home status navigation behavior remains intact', () => {
  assert.equal(
    navigationPolicy.canOpenCardPageFromMyTaskItem('in_progress'),
    true
  );
  assert.equal(
    navigationPolicy.canOpenCardPageFromMyTaskDateGroup({
      statusKey: 'sent_back',
      dateGroup: {
        date: '2026-09-14',
        items: [{ planTimeLabel: '10:00' }],
      },
    }),
    true
  );
});


test('interactive Home task card uses a semantic button', async () => {
  class Element {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.dataset = {};
      this.textContent = '';
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }
  }

  globalThis.document = {
    createElement(tagName) {
      return new Element(tagName);
    },
  };
  const detailCardRenderer = await importSource(
    '../../ui/renderers/detailCardElementRenderer.js'
  );
  globalThis.__createDetailCardElement = (
    detailCardRenderer.createDetailCardElement
  );

  const prelude = `
    const createDetailItemsElement = () => null;
    const resolveHomeStatusLabel = (_key, status) => status || '';
    const createDetailCardElement = globalThis.__createDetailCardElement;
  `;
  const { createHomeTaskCardElement } = await importSource(
    '../ui/HomeTaskCardRenderer.js',
    prelude
  );
  const card = createHomeTaskCardElement({
    planId: 42,
    status: '承認待ち',
    statusKey: 'approval_waiting',
  }, {
    interactive: true,
  });

  assert.equal(card.dataset.planId, '42');
  assert.match(card.className, /home-task-card--approval_waiting/);
  assert.equal(card.children[0].tagName, 'BUTTON');
  assert.equal(card.children[0].type, 'button');
  assert.equal(
    card.children[0].children[0].children[1].textContent,
    '承認待ち'
  );
});


test('Home card button styling neutralizes native chrome and preserves focus visibility', () => {
  const stylesheet = readFileSync(
    new URL('../../../css/pages/home_dashboard.scss', import.meta.url),
    'utf8'
  );

  assert.match(
    stylesheet,
    /\.home-task-card > \.click-card__button\s*\{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?appearance: none;[\s\S]*?font: inherit;/
  );
  assert.match(
    stylesheet,
    /\.home-task-card > \.click-card__button:focus-visible\s*\{[\s\S]*?outline: 3px solid/
  );
});
