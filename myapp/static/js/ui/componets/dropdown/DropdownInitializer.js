export class DropdownInitializer {
  constructor({
      dropdowns,
      itemSelector,
      getDropdownConfig,
      getMappedAttr,
      getCleanDropdown,
      applyOptionAttributes,
      syncUniqueValues,
      syncFullOptionsMap,
      updateDropdownOption,
  }) {
      this.dropdowns = dropdowns;
      this.itemSelector = itemSelector;
      this.getDropdownConfig = getDropdownConfig;
      this.getMappedAttr = getMappedAttr;
      this.getCleanDropdown = getCleanDropdown;
      this.applyOptionAttributes = applyOptionAttributes;
      this.syncUniqueValues = syncUniqueValues;
      this.syncFullOptionsMap = syncFullOptionsMap;
      this.updateDropdownOption = updateDropdownOption;
  }

  initialize() {
      Object.keys(this.dropdowns).forEach((dropdownId) => {
          this.initializeDropdown(dropdownId);
      });
  }

  initializeDropdown(dropdownId) {
      const selectEl = this.getCleanDropdown(dropdownId);
      if (!selectEl) return;

      const attr = this.getMappedAttr(dropdownId);
      if (!attr) return;

      const config = this.getDropdownConfig(dropdownId);

      const optionsMap = this.collectOptionsMap(attr);

      this.renderOptions(selectEl, attr, optionsMap);

      this.syncUniqueValues(dropdownId, optionsMap);

      if (config.keepSelectionEvenIfMissing === true) {
          this.syncFullOptionsMap(dropdownId, optionsMap);
      }

      this.updateDropdownOption(dropdownId);
  }

  collectOptionsMap(attr) {
      const optionsMap = new Map();
      const items = document.querySelectorAll(this.itemSelector);

      items.forEach((item) => {
          const value = item.getAttribute(attr);
          if (!value) return;

          const current = optionsMap.get(value) ?? {
              count: 0,
              attributes: { [attr]: value },
          };

          current.count += 1;
          optionsMap.set(value, current);
      });

      return optionsMap;
  }

  renderOptions(selectEl, attr, optionsMap) {
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = '全て';
      selectEl.appendChild(allOpt);

      for (const [value, data] of optionsMap.entries()) {
          const option = document.createElement('option');
          option.value = String(value);
          option.textContent = String(value);

          this.applyOptionAttributes(option, data.attributes);
          selectEl.appendChild(option);
      }
  }
}