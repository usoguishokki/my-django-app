import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';


async function importBrowserModule(relativePath, transform = (source) => source) {
  const source = transform(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(dataUrl);
}


const { CustomDropdown } = await importBrowserModule(
  '../../ui/componets/customDropdown/CustomDropdown.js',
  (source) => source.replace(
    "import { UIManger } from '../../../manager/UIManger.js';",
    'const UIManger = { escapeHtml: (value) => String(value) };'
  )
);
const {
  buildInspectionStandardFiltersFromItem,
  buildInspectionStandardMachineItems,
} = await importBrowserModule('../domain/InspectionStandardEquipmentOptions.js');


globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};


function createDropdown(items) {
  const changes = [];
  const events = [];
  const dropdown = Object.create(CustomDropdown.prototype);

  Object.assign(dropdown, {
    items,
    filteredItems: [...items],
    selectedValue: '',
    selectedValues: new Set(),
    isMultiple: false,
    isOpen: true,
    focusedIndex: -1,
    options: {
      placeholder: '選択してください',
      openOnFocus: true,
      onChange: (detail) => changes.push(detail),
    },
    root: {
      dispatchEvent: (event) => events.push(event),
    },
    renderTrigger() {},
    renderList() {},
    updateDirection() {},
    close() {
      this.isOpen = false;
    },
  });

  return { dropdown, changes, events };
}


const equipmentItems = [
  { value: 'C-003', label: '成形3号機', meta: { machine: '成形3号機', controlNo: 'C-003' } },
  { value: 'C-013', label: '成形13号機', meta: { machine: '成形13号機', controlNo: 'C-013' } },
  { value: 'P-001', label: 'Packing A', meta: { machine: 'Packing A', controlNo: 'P-001' } },
];


test('rendered equipment selector exposes the editable input as its visible trigger', () => {
  const template = readFileSync(
    new URL('../../../../templates/inspectionStandards/inspectionStandards.html', import.meta.url),
    'utf8'
  );
  const equipmentStart = template.indexOf('id="controlNameDropdown"');
  const nextControlStart = template.indexOf('id="controlNoDropdown"');
  const equipmentMarkup = template.slice(equipmentStart, nextControlStart);
  const inputIndex = equipmentMarkup.indexOf('id="controlNameSearch"');
  const panelIndex = equipmentMarkup.indexOf('data-role="dropdown-panel"');

  assert.ok(equipmentStart >= 0);
  assert.ok(inputIndex >= 0);
  assert.ok(inputIndex < panelIndex, 'editable input must not be hidden inside the panel');
  assert.match(equipmentMarkup, /type="search"/);
  assert.match(equipmentMarkup, /data-role="dropdown-trigger"/);
  assert.match(equipmentMarkup, /data-searchable-input="true"/);
  assert.doesNotMatch(equipmentMarkup, /<button/);
});


test('typing a partial equipment name filters candidates case-insensitively', () => {
  const { dropdown } = createDropdown(equipmentItems);

  dropdown.handleSearchInput({ target: { value: '3号' } });
  assert.deepEqual(
    dropdown.filteredItems.map((item) => item.value),
    ['C-003', 'C-013']
  );

  dropdown.handleSearchInput({ target: { value: 'packing' } });
  assert.deepEqual(
    dropdown.filteredItems.map((item) => item.value),
    ['P-001']
  );

  dropdown.handleSearchInput({ target: { value: '存在しない設備' } });
  assert.equal(dropdown.filteredItems.length, 0);

  dropdown.handleSearchInput({ target: { value: '' } });
  assert.equal(dropdown.filteredItems.length, equipmentItems.length);
});


test('focusing the equipment selector opens its candidate list', () => {
  const { dropdown } = createDropdown(equipmentItems);
  let opened = false;
  dropdown.open = () => {
    opened = true;
  };

  dropdown.handleTriggerFocus();

  assert.equal(opened, true);
});


test('selecting a candidate preserves its control number as the submitted value', () => {
  const { dropdown, changes, events } = createDropdown(equipmentItems);

  dropdown.selectItem('C-013');

  assert.equal(dropdown.selectedValue, 'C-013');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].value, 'C-013');
  assert.equal(changes[0].item.meta.machine, '成形13号機');
  assert.equal(events[0].detail.value, 'C-013');
});


test('an unmatched arbitrary value cannot become a selection', () => {
  const { dropdown, changes, events } = createDropdown(equipmentItems);

  dropdown.selectItem('任意入力設備');

  assert.equal(dropdown.selectedValue, '');
  assert.equal(changes.length, 0);
  assert.equal(events.length, 0);
});


test('editing selected equipment invalidates its previous control number', () => {
  const { dropdown, changes } = createDropdown(equipmentItems);
  const attributes = {};
  const input = {
    value: '任意入力設備',
    setAttribute(name, value) {
      attributes[name] = value;
    },
  };
  dropdown.isInlineSearch = true;
  dropdown.searchInput = input;
  dropdown.hiddenInput = { value: 'C-003' };
  dropdown.selectedValue = 'C-003';

  dropdown.handleSearchInput({ target: input });

  assert.equal(input.value, '任意入力設備');
  assert.equal(dropdown.selectedValue, '');
  assert.equal(dropdown.hiddenInput.value, '');
  assert.equal(attributes['aria-invalid'], 'true');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].item, null);
});


test('ArrowDown and Enter select the focused filtered candidate', () => {
  const { dropdown } = createDropdown(equipmentItems.slice(0, 2));
  const previousDocument = globalThis.document;
  const selectedValues = [];
  const buttons = dropdown.items.map((item) => ({
    dataset: { value: item.value },
    focus() {
      globalThis.document.activeElement = this;
    },
    scrollIntoView() {},
  }));

  globalThis.document = { activeElement: null };
  dropdown.getVisibleButtons = () => buttons;
  dropdown.selectItem = (value) => selectedValues.push(value);
  dropdown.focusTriggerWithoutOpening = () => {};

  dropdown.handlePanelKeydown({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(globalThis.document.activeElement, buttons[0]);

  dropdown.handlePanelKeydown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(selectedValues, ['C-003']);

  globalThis.document = previousDocument;
});


test('ArrowUp navigates backward and Escape closes the candidate list', () => {
  const { dropdown } = createDropdown(equipmentItems.slice(0, 2));
  const previousDocument = globalThis.document;
  let triggerFocused = false;
  const buttons = dropdown.items.map((item) => ({
    dataset: { value: item.value },
    focus() {
      globalThis.document.activeElement = this;
    },
    scrollIntoView() {},
  }));

  globalThis.document = { activeElement: buttons[1] };
  dropdown.getVisibleButtons = () => buttons;
  dropdown.focusTriggerWithoutOpening = () => {
    triggerFocused = true;
  };

  dropdown.handlePanelKeydown({ key: 'ArrowUp', preventDefault() {} });
  assert.equal(globalThis.document.activeElement, buttons[0]);

  dropdown.handlePanelKeydown({ key: 'Escape', preventDefault() {} });
  assert.equal(dropdown.isOpen, false);
  assert.equal(triggerFocused, true);

  globalThis.document = previousDocument;
});


test('equipment item mapping keeps the existing controlNo backend contract', () => {
  const items = buildInspectionStandardMachineItems([
    { machine: '同名設備', controlNo: 'C-101' },
    { machine: '同名設備', controlNo: 'C-102' },
  ]);

  assert.deepEqual(items.map((item) => item.value), ['', 'C-101', 'C-102']);
  assert.deepEqual(
    items.map((item) => item.label),
    ['選択を解除', '同名設備', '同名設備']
  );
  assert.equal(buildInspectionStandardFiltersFromItem(items[2]).controlNo, 'C-102');
  assert.deepEqual(
    buildInspectionStandardFiltersFromItem(items[0]),
    { machine: '', controlNo: '' }
  );
});


test('the explicit clear option removes an existing equipment selection', () => {
  const items = buildInspectionStandardMachineItems([
    { machine: '成形3号機', controlNo: 'C-003' },
  ]);
  const { dropdown, changes } = createDropdown(items);
  dropdown.selectedValue = 'C-003';

  dropdown.selectItem('');

  assert.equal(dropdown.selectedValue, '');
  assert.deepEqual(changes[0].item.meta, { machine: '', controlNo: '' });
});
