const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../static/js', name), 'utf8');

async function modules(root) {
    const context = vm.createContext({ URL, URLSearchParams });
    const helper = new vm.SourceTextModule(read('pluginUrls.js'), {
        context, initializeImportMeta(meta) { meta.url = root + 'static/js/pluginUrls.js'; },
    });
    await helper.link(() => {});
    await helper.evaluate();
    const requests = [];
    const api = new vm.SyntheticModule(['asynchronousCommunication', 'requestFile'], function () {
        this.setExport('asynchronousCommunication', options => requests.push(options));
        this.setExport('requestFile', () => { throw new Error('Unexpected file request'); });
    }, { context });
    const fetchers = new vm.SourceTextModule(read('api/fetchers.js'), { context });
    await fetchers.link(name => name.includes('pluginUrls') ? helper : api);
    await fetchers.evaluate();
    return { helper: helper.namespace, fetchers: fetchers.namespace, requests };
}

test('actual module resolves assets/API/navigation beneath its own mount', async () => {
    for (const root of ['http://133.222.52.74:8010/', 'https://nagakusa-dx.toyota-shokki.co.jp/plugins/nika/frame/', 'https://host.example/plugins/other/frame/']) {
        const { helper, fetchers, requests } = await modules(root);
        for (const target of ['/login/', '/home/', '/ai-chat/', '/static/img/Nika.png']) {
            assert.equal(helper.pluginUrl(target), root + target.slice(1));
        }
        fetchers.fetchHomeOverallProgress();
        fetchers.fetchHomeMyTeamProgress();
        fetchers.fetchHomeMyTasks();
        fetchers.fetchHomeMyTeamDayDetail({ date: '2026-09-09' });
        fetchers.fetchHomeAssignMemberOptions();
        assert.equal(requests.length, 5);
        for (const request of requests) {
            assert.ok(request.url.startsWith(root + 'api/'));
            assert.equal(request.method, 'GET');
        }
    }
});

test('browser resolves upstream-depth relative links for nested documents', () => {
    for (const mount of ['http://133.222.52.74:8010/', 'https://nagakusa-dx.toyota-shokki.co.jp/plugins/nika/frame/']) {
        for (const [page, prefix] of [['login/', '../'], ['home/', '../'], ['ai-chat/', '../'], ['card/work/', '../../']]) {
            for (const target of ['static/css/base.css', 'static/js/nagakusa/chat.js', 'static/img/Nika.png', 'login/', 'ai-chat/']) {
                assert.equal(new URL(prefix + target, mount + page).href, mount + target);
            }
        }
    }
});
