const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const asset = name => fs.readFileSync(path.join(__dirname, '../static/js/nagakusa', name), 'utf8');

function browser(framed = true) {
    const handlers = {};
    const sent = [];
    const window = {
        location: { origin: 'https://host.example' },
        crypto: { randomUUID: () => 'request-1' },
        setTimeout: () => 1, clearTimeout() {},
        addEventListener: (name, fn) => { handlers[name] = fn; },
    };
    window.parent = framed ? { postMessage: (...args) => sent.push(args) } : window;
    const context = vm.createContext({ window });
    return { window, context, handlers, sent };
}

test('standalone opens configured Host in isolated new tab; frame keeps local route', () => {
    for (const framed of [false, true]) {
        const b = browser(framed);
        const link = { href: '/ai-chat/', dataset: { hostPluginUrl: 'https://host.example/plugins/nika/' } };
        b.context.document = { querySelectorAll: () => [link] };
        vm.runInContext(asset('entry.js'), b.context);
        assert.equal(link.href, framed ? '/ai-chat/' : link.dataset.hostPluginUrl);
        assert.equal(link.target, framed ? undefined : '_blank');
        assert.equal(link.rel, framed ? undefined : 'noopener noreferrer');
    }
});

test('missing configuration preserves safe local link', () => {
    const b = browser(false);
    const link = { href: '/ai-chat/', dataset: {} };
    b.context.document = { querySelectorAll: () => [link] };
    vm.runInContext(asset('entry.js'), b.context);
    assert.equal(link.href, '/ai-chat/');
});

function chat(framed = true, enabled = true) {
    const b = browser(framed);
    const elements = {};
    for (const name of ['status', 'messages', 'form', 'input', 'send']) {
        elements[name] = { value: '', children: [], listeners: {},
            append(item) { this.children.push(item); },
            addEventListener(name, fn) { this.listeners[name] = fn; } };
    }
    b.context.document = {
        querySelector: () => ({ dataset: { chatEnabled: enabled ? "true" : "false" }, querySelector: selector => elements[selector.slice(11, -1)] }),
        createElement: () => ({}),
    };
    vm.runInContext(asset('hostAiBridge.js'), b.context);
    vm.runInContext(asset('chat.js'), b.context);
    b.elements = elements;
    b.submit = (message = 'hello') => { elements.input.value = message; return elements.form.listeners.submit({ preventDefault() {} }); };
    b.reply = data => b.handlers.message({ origin: b.window.location.origin, source: b.window.parent,
        data: { type: 'nagakusa:interop:response', version: 1, action: 'ai.send_message', request_id: 'request-1', ...data } });
    return b;
}

test('standalone guard disables input and rejects even synthetic submit', async () => {
    const b = chat(false);
    assert.equal(b.elements.input.disabled, true);
    assert.equal(b.elements.send.disabled, true);
    await b.submit();
    assert.equal(b.elements.messages.children.length, 0);
    await assert.rejects(b.window.NagakusaAiBridge.sendMessage({ message: 'hello' }), /bridge_unavailable/);
});

test('production answer wins over legacy fields and conversation is reused', async () => {
    const b = chat();
    const pending = b.submit();
    b.reply({ ok: true, result: { assistant_message: '<b>Host answer</b>', message: 'legacy', conversation_id: 'conversation-1' } });
    await pending;
    assert.equal(b.elements.messages.children[1].textContent, '<b>Host answer</b>');
    assert.equal(b.elements.messages.children[1].innerHTML, undefined);
    const next = b.submit();
    assert.equal(b.sent[1][0].payload.conversation_id, 'conversation-1');
    b.reply({ ok: true, result: { assistant_message: 'next' } });
    await next;
});

test('natural Japanese question remains visible and unchanged across the Host bridge', async () => {
    const question = '成形3号機のPJ1の樹脂漏れについて教えて';
    const b = chat();
    const pending = b.submit(question);
    assert.equal(b.elements.messages.children[0].textContent, question);
    assert.equal(b.sent[0][0].payload.message, question);
    assert.equal(b.sent[0][0].payload.source_screen, 'nika_ai_chat');
    assert.equal(Object.keys(b.sent[0][0].payload.context_snapshot).length, 0);
    assert.equal(b.sent[0][0].payload.message.includes('plugin_search_rag_documents'), false);
    b.reply({ ok: true, result: { assistant_message: '回答', conversation_id: 'conversation-1' } });
    await pending;
    const followUp = '過去に同じ故障はありましたか';
    const next = b.submit(followUp);
    assert.equal(b.elements.messages.children[2].textContent, followUp);
    assert.equal(b.sent[1][0].payload.message, followUp);
    assert.equal(b.sent[1][0].payload.conversation_id, 'conversation-1');
    b.reply({ ok: true, result: { assistant_message: '該当するInstructionCardの根拠を確認できませんでした。' } });
    await next;
});

test('legacy message and content are still displayed', async () => {
    for (const key of ['message', 'content']) {
        const b = chat();
        const pending = b.submit();
        b.reply({ ok: true, result: { [key]: 'old answer' } });
        await pending;
        assert.equal(b.elements.messages.children[1].textContent, 'old answer');
    }
});

test('structured Host error reaches Chat without stack or extra fields', async () => {
    const b = chat();
    const pending = b.submit();
    b.reply({ ok: false, error: { code: 'permission_denied', message: 'Access is not granted.', retryable: false, stack: 'PRIVATE_STACK' } });
    await pending;
    assert.equal(b.elements.messages.children[1].textContent, 'Access is not granted.');
    const errorPromise = b.window.NagakusaAiBridge.sendMessage({ message: 'hello' }).catch(e => e);
    b.reply({ ok: false, error: { code: 'busy', message: 'Try later.', retryable: true, retry_after_seconds: 12 } });
    const error = await errorPromise;
    assert.equal(error.code, 'busy');
    assert.equal(error.message, 'Try later.');
    assert.equal(error.retryable, true);
    assert.equal(error.retry_after_seconds, 12);
});

test('foreign origin, source and correlation cannot supply an answer', async () => {
    const b = chat();
    const pending = b.submit();
    const data = { type: 'nagakusa:interop:response', version: 1, action: 'ai.send_message', request_id: 'request-1', ok: true, result: { assistant_message: 'wrong' } };
    b.handlers.message({ origin: 'https://other.example', source: b.window.parent, data });
    b.handlers.message({ origin: b.window.location.origin, source: {}, data });
    b.reply({ ...data, request_id: 'other' });
    assert.equal(b.elements.messages.children.length, 1);
    b.reply({ ok: true, result: { assistant_message: 'correct' } });
    await pending;
    assert.equal(b.elements.messages.children[1].textContent, 'correct');
});


test('Starter object assistant_message takes priority over legacy strings', async () => {
    const b = chat();
    const pending = b.submit();
    b.reply({ ok: true, result: { assistant_message: { role: 'assistant', content: '?????' }, message: 'legacy', content: 'older', conversation_id: 'owned-conversation' } });
    await pending;
    assert.equal(b.elements.messages.children[1].textContent, '?????');
});

test('disabled configured mode prevents framed chat submissions', async () => {
    const b = chat(true, false);
    await b.submit();
    assert.equal(b.elements.input.disabled, true);
    assert.equal(b.sent.length, 0);
});

test('HTTP browser without randomUUID uses Starter cryptographic UUID fallback', async () => {
    const b = browser();
    b.window.crypto = { getRandomValues: bytes => bytes.fill(7) };
    vm.runInContext(asset('hostAiBridge.js'), b.context);
    const pending = b.window.NagakusaAiBridge.sendMessage({ message: 'hello' });
    const request = b.sent[0][0];
    assert.match(request.request_id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    assert.equal(b.sent[0][1], b.window.location.origin);
    assert.deepEqual(Object.keys(request.payload).sort(), ['context_snapshot', 'message', 'source_screen']);
    b.handlers.message({ origin: b.window.location.origin, source: b.window.parent, data: {
        type: 'nagakusa:interop:response', version: 1, action: 'ai.send_message', request_id: request.request_id,
        ok: true, result: { assistant_message: 'ok' },
    } });
    await pending;
});
