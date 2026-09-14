import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


async function importBrowserModule(relativePath, transform = (source) => source) {
    const source = transform(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
    const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    return import(dataUrl);
}


globalThis.window = {
    location: {
        origin: 'https://nika.example.test',
    },
};


const { buildCardWorkPageUrl } = await importBrowserModule(
    '../navigation/CardWorkPageNavigator.js'
);

const { buildCardWorkResultPayload } = await importBrowserModule(
    '../domain/CardWorkResultPayloadPolicy.js',
    (source) => source.replace(
        /import \{[\s\S]*?\} from '\.\/CardWorkInputStatePolicy\.js';/,
        "const buildImplementationDateTimeValue = () => '2026-09-14T09:30';"
    )
);

const { applyExistingCardWorkResult } = await importBrowserModule(
    '../domain/CardWorkExistingResultPolicy.js',
    (source) => source.replace(
        /import \{[\s\S]*?\} from '\.\/CardWorkInputStatePolicy\.js';/,
        "const splitImplementationDateTimeValue = () => ({ date: '2026-09-14', time: '09:30' });"
    )
);


test('Home navigation uses the supported source/scope and canonical plan_id', () => {
    const url = new URL(buildCardWorkPageUrl({
        source: 'home',
        scope: 'my_tasks',
        statusKey: 'in_progress',
        date: '2026-09-14',
        planId: 41,
    }));

    assert.equal(url.pathname, '/card-work/');
    assert.equal(url.searchParams.get('source'), 'home');
    assert.equal(url.searchParams.get('scope'), 'my_tasks');
    assert.equal(url.searchParams.get('plan_id'), '41');
});


test('Work Contents navigation uses the unified exact-plan contract', () => {
    const url = new URL(buildCardWorkPageUrl({
        source: 'work_contents',
        scope: 'plan',
        planId: '52',
    }));

    assert.equal(url.pathname, '/card-work/');
    assert.equal(url.searchParams.get('source'), 'work_contents');
    assert.equal(url.searchParams.get('scope'), 'plan');
    assert.equal(url.searchParams.get('plan_id'), '52');
});


test('unsupported or incomplete navigation contracts are rejected', () => {
    assert.equal(buildCardWorkPageUrl({ source: 'home', scope: 'plan', planId: 1 }), '');
    assert.equal(buildCardWorkPageUrl({ source: 'work_contents', scope: 'plan' }), '');
    assert.equal(buildCardWorkPageUrl({ source: 'home', scope: 'my_tasks' }), '');
});


test('save payload carries source, scope, and canonical plan identity', () => {
    const payload = buildCardWorkResultPayload({
        source: 'work_contents',
        scope: 'plan',
        plan: { planId: 63 },
        inputState: {
            result: 'OK',
            practitionerIds: ['M001'],
            actualManHours: 10,
        },
    });

    assert.equal(payload.source, 'work_contents');
    assert.equal(payload.scope, 'plan');
    assert.equal(payload.planId, '63');
});


test('existing result restoration is source-neutral', () => {
    const restored = applyExistingCardWorkResult(
        { result: 'OK', practitionerIds: ['DEFAULT'] },
        {
            implementationDatetime: '2026-09-14T09:30:00',
            result: 'NG',
            implementationContent: 'restored',
            practitionerIds: ['M002'],
            actualManHours: 18,
            comment: 'existing',
        }
    );

    assert.equal(restored.result, 'NG');
    assert.deepEqual(restored.practitionerIds, ['M002']);
    assert.equal(restored.actualManHours, 18);
    assert.equal(restored.comment, 'existing');
});


test('renderer consumes backend readOnly state and removes save controls', () => {
    const renderer = readFileSync(
        new URL('../ui/CardWorkRenderer.js', import.meta.url),
        'utf8'
    );
    const panel = readFileSync(
        new URL('../ui/CardWorkInputPanelRenderer.js', import.meta.url),
        'utf8'
    );

    assert.match(renderer, /const readOnly = Boolean\(plan\?\.readOnly\)/);
    assert.doesNotMatch(renderer, /plan\?\.status\s*===/);
    assert.match(panel, /if \(readOnly\) \{\s*return actions;/);
    assert.match(panel, /textarea\.readOnly = readOnly/);
    assert.match(panel, /trigger\.disabled = readOnly/);
});


test('page service uses backend selected plan and return target', () => {
    const service = readFileSync(
        new URL('../application/CardWorkPageService.js', import.meta.url),
        'utf8'
    );

    assert.match(service, /this\.initialState\?\.selectedPlanId/);
    assert.match(service, /this\.initialState\?\.returnUrl/);
    assert.match(service, /this\.getCurrentPlan\(\)\?\.readOnly/);
    assert.doesNotMatch(service, /readInitialCardWorkPlanIdFromUrl/);
});


test('Work Contents and Home both delegate URL construction to the shared navigator', () => {
    const workContents = readFileSync(
        new URL('../../../workContents/workContents.js', import.meta.url),
        'utf8'
    );
    const homeNavigator = readFileSync(
        new URL('../../../home/navigation/HomeCardPageNavigator.js', import.meta.url),
        'utf8'
    );

    assert.match(workContents, /source: 'work_contents'/);
    assert.match(workContents, /scope: 'plan'/);
    assert.doesNotMatch(workContents, /base: '\/card\/'/);
    assert.match(homeNavigator, /CardWorkPageNavigator\.js/);
});


test('pending-approval Home navigation stays owned by the Home policy', () => {
    const policy = readFileSync(
        new URL('../../../home/domain/HomeCardNavigationPolicy.js', import.meta.url),
        'utf8'
    );

    assert.match(policy, /['"]approval_waiting['"]/);
});
