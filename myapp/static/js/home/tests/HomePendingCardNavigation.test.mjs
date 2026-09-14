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


test('pending Home card exposes individual item navigation', () => {
    const dateGroup = {
        date: '2026-09-14',
        items: [{ planId: 42, planTimeLabel: '09:30' }],
    };

    assert.equal(navigationPolicy.shouldPreviewCardListFromMyTaskDateGroup({
        statusKey: 'approval_waiting',
        dateGroup,
    }), true);
    assert.equal(
        navigationPolicy.canOpenCardPageFromMyTaskItem('approval_waiting'),
        true
    );
    assert.equal(
        navigationPolicy.canOpenCardPageFromMyTaskItem('completed'),
        false
    );
});


test('pending item navigation carries the exact Phase 1 contract', async () => {
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


test('pending card restores values through the shared existing-result policy', async () => {
    const existingResultPolicy = await importSource(
        '../../card/work/domain/CardWorkExistingResultPolicy.js',
        "const splitImplementationDateTimeValue = () => ({ date: '2026-09-14', time: '08:45' });"
    );

    const restored = existingResultPolicy.applyExistingCardWorkResult(
        { result: '', practitionerIds: [] },
        {
            implementationDatetime: '2026-09-14T08:45:00',
            result: 'NG',
            implementationContent: 'existing content',
            practitionerIds: ['M001'],
            actualManHours: 20,
            comment: 'existing comment',
        }
    );

    assert.equal(restored.result, 'NG');
    assert.deepEqual(restored.practitionerIds, ['M001']);
    assert.equal(restored.comment, 'existing comment');
});


test('renderer continues to consume backend readOnly state', () => {
    const renderer = readFileSync(
        new URL('../../card/work/ui/CardWorkRenderer.js', import.meta.url),
        'utf8'
    );
    const inputPanel = readFileSync(
        new URL('../../card/work/ui/CardWorkInputPanelRenderer.js', import.meta.url),
        'utf8'
    );

    assert.match(renderer, /const readOnly = Boolean\(plan\?\.readOnly\)/);
    assert.doesNotMatch(renderer, /status\s*===\s*['"]approval_waiting/);
    assert.match(inputPanel, /if \(readOnly\) \{\s*return actions;/);
});


test('pending Home save uses the backend return target', () => {
    const service = readFileSync(
        new URL('../../card/work/application/CardWorkPageService.js', import.meta.url),
        'utf8'
    );

    assert.match(
        service,
        /source === 'home'[\s\S]*?statusKey === 'approval_waiting'[\s\S]*?this\.goToReturnTarget\(\)/
    );
    assert.match(service, /this\.initialState\?\.returnUrl/);
    assert.doesNotMatch(service, /window\.location\.replace\(['"]\/home\//);
});


test('interactive pending card uses a semantic button with canonical plan id', async () => {
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
    globalThis.__createDetailCardElement = detailCardRenderer.createDetailCardElement;

    const { createHomeTaskCardElement } = await importSource(
        '../ui/HomeTaskCardRenderer.js',
        `
        const createDetailItemsElement = () => null;
        const resolveHomeStatusLabel = (_key, status) => status || '';
        const createDetailCardElement = globalThis.__createDetailCardElement;
        `
    );
    const card = createHomeTaskCardElement({
        planId: 42,
        status: '承認待ち',
        statusKey: 'approval_waiting',
    }, {
        interactive: true,
    });

    assert.equal(card.dataset.planId, '42');
    assert.equal(card.children[0].tagName, 'BUTTON');
    assert.equal(card.children[0].type, 'button');
});


test('native button interaction and delegated click preserve mouse and keyboard activation', () => {
    const myTasksRenderer = readFileSync(
        new URL('../ui/HomeMyTasksRenderer.js', import.meta.url),
        'utf8'
    );

    assert.match(myTasksRenderer, /addEventListener\(['"]click['"], handleMyTasksPanelClick\)/);
    assert.match(myTasksRenderer, /canOpenCardPageFromMyTaskItem\(statusGroup\.statusKey\)/);
    assert.match(myTasksRenderer, /openCardPageFromMyTaskItem\(\{/);
});


test('button styling removes native chrome and preserves focus visibility', () => {
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


test('Work Contents keeps its exact navigation and return contract', () => {
    const workContents = readFileSync(
        new URL('../../workContents/workContents.js', import.meta.url),
        'utf8'
    );
    const service = readFileSync(
        new URL('../../card/work/application/CardWorkPageService.js', import.meta.url),
        'utf8'
    );

    assert.match(workContents, /source: 'work_contents'/);
    assert.match(workContents, /scope: 'plan'/);
    assert.match(workContents, /planId/);
    assert.match(service, /source === 'work_contents'[\s\S]*?this\.goToReturnTarget\(\)/);
});
