import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


const loadingManagerSource = readFileSync(
    new URL('../loadingManager.js', import.meta.url),
    'utf8',
);


class ClassList {
    constructor() {
        this.values = new Set();
    }

    add(value) {
        this.values.add(value);
    }

    remove(value) {
        this.values.delete(value);
    }

    contains(value) {
        return this.values.has(value);
    }
}


async function loadManager({ readyState = 'loading' } = {}) {
    const loading = { classList: new ClassList(), style: { display: '' } };
    const parentGrid = { style: { visibility: '' } };
    const listeners = new Map();
    const timers = [];

    globalThis.document = {
        readyState,
        getElementById(id) {
            return { loading, parentGrid }[id] ?? null;
        },
    };
    globalThis.window = {
        addEventListener(type, callback) {
            const callbacks = listeners.get(type) ?? [];
            callbacks.push(callback);
            listeners.set(type, callbacks);
        },
    };
    globalThis.setTimeout = (callback, delay) => {
        const timer = { callback, delay, cleared: false };
        timers.push(timer);
        return timer;
    };
    globalThis.clearTimeout = (timer) => {
        timer.cleared = true;
    };

    const dataUrl = `data:text/javascript;base64,${Buffer.from(
        `${loadingManagerSource}\n// ${Math.random()}`,
    ).toString('base64')}`;

    return {
        loading,
        parentGrid,
        listeners,
        timers,
        manager: await import(dataUrl),
    };
}


test('document load reveals the page without app:ready', async () => {
    const lifecycle = await loadManager();

    lifecycle.manager.initializeLoadingScreen();
    lifecycle.manager.initializeLoadingScreen();

    assert.equal(lifecycle.parentGrid.style.visibility, 'hidden');
    assert.equal(lifecycle.loading.classList.contains('loading-active'), true);
    assert.equal(lifecycle.listeners.get('app:ready').length, 1);
    assert.equal(lifecycle.listeners.get('load').length, 1);

    lifecycle.listeners.get('load')[0]();
    lifecycle.timers.find(({ delay }) => delay === 700).callback();

    assert.equal(lifecycle.parentGrid.style.visibility, 'visible');
    assert.equal(lifecycle.loading.style.display, 'none');
});


test('late initialization reveals an already loaded document', async () => {
    const lifecycle = await loadManager({ readyState: 'complete' });

    lifecycle.manager.initializeLoadingScreen();
    lifecycle.timers.find(({ delay }) => delay === 700).callback();

    assert.equal(lifecycle.listeners.has('load'), false);
    assert.equal(lifecycle.parentGrid.style.visibility, 'visible');
    assert.equal(lifecycle.loading.style.display, 'none');
});


test('base module owns global loading initialization', () => {
    const baseSource = readFileSync(
        new URL('../../base.js', import.meta.url),
        'utf8',
    );

    assert.match(baseSource, /initializeLoadingScreen\(\);/);
});
