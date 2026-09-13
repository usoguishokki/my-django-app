import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


async function importBrowserModule(relativePath, {
  prelude = '',
  exportClass = '',
  stripBootstrap = false,
} = {}) {
  let source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '');

  if (exportClass && !source.includes(`export class ${exportClass}`)) {
    source = source.replace(
      `class ${exportClass}`,
      `export class ${exportClass}`
    );
  }

  if (stripBootstrap) {
    source = source.slice(0, source.indexOf("document.addEventListener('DOMContentLoaded'"));
  }

  const dataUrl = `data:text/javascript;base64,${Buffer.from(`${prelude}\n${source}`).toString('base64')}`;
  return import(dataUrl);
}


const applicationPrelude = `
  const ModalManger = globalThis.__cardAddModalManager;
  const UIManger = { escapeHtml: (value) => String(value) };
  const initializeLoadingScreen = () => {};
  class EmptyService { constructor() {} }
  class inspectionStandardManager extends EmptyService {}
  class DrawerStack extends EmptyService {}
  class SectionEditSession extends EmptyService { reset() {} getSelectedSectionId() { return null; } }
  class InspectionStandardCardAddSubmitService extends EmptyService {}
  class InspectionStandardEditPanelService extends EmptyService {}
  class InspectionStandardEditSubmitService extends EmptyService {}
  class InspectionStandardEditFlowService extends EmptyService {}
  class InspectionStandardTableService extends EmptyService {}
  class InspectionStandardCardAddDrawerService extends EmptyService {}
  class InspectionStandardDetailDrawerService extends EmptyService {}
  class InspectionStandardFilterService extends EmptyService {}
  class InspectionStandardDrawerHeaderService extends EmptyService {}
  class InspectionStandardHistoryPageService extends EmptyService {}
  class InspectionStandardHistoryDetailDrawerService extends EmptyService {}
  const bindUIActions = () => () => {};
  const bindInspectionStandardIntegerInputRestrictions = () => () => {};
  const INSPECTION_STANDARD_DRAWER_ACTIONS = new Proxy({}, { get: (_, key) => String(key) });
  const INSPECTION_STANDARD_DRAWER_MODES = {};
  const renderInspectionStandardCardAddDetailItemHTML = () => '';
  const renderInspectionStandardCardAddConfirmHTML = () => '<div></div>';
  const validateInspectionStandardCardAddRequiredFields = () => globalThis.__cardAddValidation;
`;

globalThis.__cardAddModalManager = {
  showConfirmModal: async () => true,
  showModal() {},
};
globalThis.__cardAddValidation = { isValid: true };

const previousDocument = globalThis.document;
globalThis.document = {
  addEventListener() {},
  getElementById() { return null; },
};

const { inspectionStandards } = await importBrowserModule(
  '../inspectionStandards.js',
  {
    prelude: applicationPrelude,
    exportClass: 'inspectionStandards',
    stripBootstrap: true,
  }
);

globalThis.document = previousDocument;


const submitPrelude = `
  const ModalManger = { showModal() {} };
  const UIManger = { escapeHtml: (value) => String(value) };
  const executeInspectionStandardCardCreate = (payload) => globalThis.__executeCardAdd(payload);
  const buildInspectionStandardCardAddCommonValues = (values) => values;
  const buildInspectionStandardCardAddDetailValues = (values) => values;
  const collectInspectionStandardChangeReason = () => 'reason';
  const validateInspectionStandardChangeReason = () => ({ isValid: true });
`;

const { InspectionStandardCardAddSubmitService } = await importBrowserModule(
  '../application/add/InspectionStandardCardAddSubmitService.js',
  {
    prelude: submitPrelude,
    exportClass: 'InspectionStandardCardAddSubmitService',
  }
);


function createButton() {
  const attributes = {};

  return {
    attributes,
    disabled: false,
    textContent: '確定',
    dataset: {},
    classList: { toggle() {} },
    setAttribute(name, value) {
      attributes[name] = value;
    },
  };
}


function createApplication() {
  const activeDocument = globalThis.document;
  globalThis.document = {
    getElementById() { return null; },
  };

  const app = new inspectionStandards();
  globalThis.document = activeDocument;

  app.addCardButton = createButton();
  return app;
}


function prepareSubmitFlow(app, responseFactory) {
  const formEl = {};
  const submitButton = {
    closest(selector) {
      return selector === '[data-role="inspection-standard-card-add-form"]'
        ? formEl
        : null;
    },
  };
  let requestCount = 0;

  app._collectAddCardCommonEntries = () => [];
  app._collectAddCardDetailItems = () => [{ entries: [] }];
  app.cardAddSubmitService = {
    async create() {
      requestCount += 1;
      return responseFactory();
    },
  };
  app.drawers = {
    openToLevel(level) {
      app.__lastDrawerLevel = level;
    },
    panel() {
      return {
        setBodyHtml() {
          app.__setBodyCount = (app.__setBodyCount ?? 0) + 1;
        },
      };
    },
  };
  app.filterService = {
    async reloadCurrentSelection() {
      app.__reloadCount = (app.__reloadCount ?? 0) + 1;
    },
  };

  return {
    submitButton,
    getRequestCount: () => requestCount,
  };
}


test('template exposes exactly one initially disabled add-card control', () => {
  const template = readFileSync(
    new URL('../../../../templates/inspectionStandards/inspectionStandards.html', import.meta.url),
    'utf8'
  );
  const matches = template.match(/data-role="inspection-standard-add-card-button"/g) ?? [];
  const buttonStart = template.lastIndexOf('<button', template.indexOf(matches[0]));
  const buttonEnd = template.indexOf('</button>', buttonStart);
  const markup = template.slice(buttonStart, buttonEnd);

  assert.equal(matches.length, 1);
  assert.match(markup, /\bdisabled\b/);
  assert.match(markup, /aria-disabled="true"/);
});


test('eligible selection enables add-card and missing prerequisites keep it disabled', () => {
  const app = createApplication();

  app.cardAddContext = { machine: '成形3号機', controlNo: 'C-003' };
  app._syncAddCardButtonWithContext();

  assert.equal(app.canAddCard, true);
  assert.equal(app.addCardButton.disabled, false);
  assert.equal(app.addCardButton.attributes['aria-disabled'], 'false');

  app.cardAddContext = null;
  app._syncAddCardButtonWithContext();

  assert.equal(app.canAddCard, false);
  assert.equal(app.addCardButton.disabled, true);
  assert.equal(app.addCardButton.attributes['aria-disabled'], 'true');
});


test('active request disables submit and restores it after success', async () => {
  let resolveRequest;
  let requestCount = 0;
  globalThis.__executeCardAdd = () => {
    requestCount += 1;
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };
  const service = new InspectionStandardCardAddSubmitService();
  const button = createButton();
  const request = service.create({
    button,
    formEl: {},
    context: { controlNo: 'C-003' },
    detailItems: [{ entries: [] }],
  });

  assert.equal(requestCount, 1);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, '登録中...');

  resolveRequest({ success: true, card: { inspectionNo: 'C-003-01' } });
  await request;

  assert.equal(button.disabled, false);
  assert.equal(button.textContent, '確定');
});


test('successful adds return to ready and can run consecutively without duplicate flows', async () => {
  const app = createApplication();
  app.cardAddContext = { machine: '成形3号機', controlNo: 'C-003' };
  app._syncAddCardButtonWithContext();
  const flow = prepareSubmitFlow(app, () => ({ success: true }));
  let openCount = 0;
  app.cardAddDrawerService = {
    async open() { openCount += 1; },
  };

  await app._submitAddCard({ element: flow.submitButton });
  assert.equal(app.canAddCard, true);
  assert.equal(app.addCardButton.disabled, false);
  assert.equal(app.__lastDrawerLevel, 0);
  assert.equal(app.__reloadCount, 1);
  assert.equal(app.__setBodyCount ?? 0, 0);
  assert.equal(flow.getRequestCount(), 1);

  app._openAddCardDrawer();
  assert.equal(openCount, 1);

  await app._submitAddCard({ element: flow.submitButton });
  assert.equal(flow.getRequestCount(), 2);
  assert.equal(app.canAddCard, true);
  assert.equal(app.__lastDrawerLevel, 0);
  assert.equal(app.__reloadCount, 2);
});


test('failed submission restores retry state and preserves eligible add-card state', async () => {
  let rejectRequest;
  globalThis.__executeCardAdd = () => new Promise((resolve, reject) => {
    rejectRequest = reject;
  });
  const service = new InspectionStandardCardAddSubmitService();
  const button = createButton();
  const request = service.create({
    button,
    formEl: {},
    context: { controlNo: 'C-003' },
    detailItems: [{ entries: [] }],
  });

  assert.equal(button.disabled, true);
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    rejectRequest(new Error('simulated failure'));
    assert.equal(await request, null);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(button.disabled, false);

  const app = createApplication();
  app.cardAddContext = { machine: '成形3号機', controlNo: 'C-003' };
  app._syncAddCardButtonWithContext();
  const flow = prepareSubmitFlow(app, () => null);

  await app._submitAddCard({ element: flow.submitButton });

  assert.equal(flow.getRequestCount(), 1);
  assert.equal(app.canAddCard, true);
  assert.equal(app.addCardButton.disabled, false);
  assert.equal(app.__reloadCount ?? 0, 0);
});
