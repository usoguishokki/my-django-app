import { UIManger } from '../../../manager/UIManger.js';

export class CustomDropdown {
    constructor(root, options = {}) {
      if (!root) {
        throw new Error('CustomDropdown: root element is required.');
      }
  
      this.root = root;
      this.options = {
        items: [],
        value: null,
        searchable: false,
        placeholder: '選択してください',
        emptyText: '候補がありません',
        searchPlaceholder: '検索',
        onChange: null,
        ...options,
      };
  
      this.items = Array.isArray(this.options.items) ? [...this.options.items] : [];
      this.filteredItems = [...this.items];
      this.selectedValue = this.normalizeValue(this.options.value);
      this.isOpen = false;
      this.focusedIndex = -1;
      this.instanceId = `dropdown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
      this.cacheElements();
      this.ensureStructure();
      this.bindEvents();
      this.syncSelectionFromValue();
      this.render();
    }
  
    normalizeValue(value) {
      return value == null ? '' : String(value);
    }
  
    cacheElements() {
      this.trigger = this.root.querySelector('[data-role="dropdown-trigger"]');
      this.triggerText = this.root.querySelector('[data-role="dropdown-trigger-text"]');
      this.panel = this.root.querySelector('[data-role="dropdown-panel"]');
      this.searchInput = this.root.querySelector('[data-role="dropdown-search"]');
      this.list = this.root.querySelector('[data-role="dropdown-list"]');
      this.hiddenInput = this.root.querySelector('[data-role="dropdown-input"]');
    }

    ensureStructure() {
        if (!this.trigger || !this.triggerText || !this.panel || !this.list) {
          throw new Error('CustomDropdown: required elements are missing.');
        }
      
        if (!this.root.dataset.dropdownId) {
          this.root.dataset.dropdownId = this.instanceId;
        }
      
        if (!this.root.dataset.state) {
          this.root.dataset.state = 'closed';
        }
      
        if (!this.root.dataset.direction) {
          this.root.dataset.direction = 'down';
        }
      
        if (!this.panel.id) {
          this.panel.id = `${this.instanceId}-panel`;
        }
      
        if (!this.list.id) {
          this.list.id = `${this.instanceId}-list`;
        }
      
        this.trigger.setAttribute('type', this.trigger.getAttribute('type') || 'button');
        this.trigger.setAttribute('aria-haspopup', 'listbox');
        this.trigger.setAttribute('aria-expanded', 'false');
        this.trigger.setAttribute('aria-controls', this.panel.id);
      
        this.panel.hidden = true;
        this.list.setAttribute('role', 'listbox');
      
        if (this.searchInput) {
          this.searchInput.setAttribute('autocomplete', 'off');
          this.searchInput.setAttribute('spellcheck', 'false');
        }
    }
  
    bindEvents() {
      this.handleDocumentClick = this.handleDocumentClick.bind(this);
      this.handleWindowResize = this.handleWindowResize.bind(this);
      this.handleTriggerClick = this.handleTriggerClick.bind(this);
      this.handleTriggerKeydown = this.handleTriggerKeydown.bind(this);
      this.handlePanelKeydown = this.handlePanelKeydown.bind(this);
      this.handleSearchInput = this.handleSearchInput.bind(this);
  
      this.trigger.addEventListener('click', this.handleTriggerClick);
      this.trigger.addEventListener('keydown', this.handleTriggerKeydown);
      this.panel.addEventListener('keydown', this.handlePanelKeydown);
  
      if (this.searchInput) {
        this.searchInput.addEventListener('input', this.handleSearchInput);
      }
  
      document.addEventListener('click', this.handleDocumentClick);
      window.addEventListener('resize', this.handleWindowResize);
    }
  
    handleTriggerClick() {
      this.toggle();
    }
  
    handleTriggerKeydown(event) {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          this.toggle();
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (!this.isOpen) {
            this.open();
          }
          this.focusFirstVisibleItem();
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (!this.isOpen) {
            this.open();
          }
          this.focusLastVisibleItem();
          break;
        case 'Escape':
          if (this.isOpen) {
            event.preventDefault();
            this.close();
          }
          break;
        default:
          break;
      }
    }
  
    handlePanelKeydown(event) {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          this.close();
          this.trigger.focus();
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.focusNextItem();
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.focusPreviousItem();
          break;
        case 'Home':
          event.preventDefault();
          this.focusFirstVisibleItem();
          break;
        case 'End':
          event.preventDefault();
          this.focusLastVisibleItem();
          break;
        default:
          break;
      }
    }
  
    handleSearchInput(event) {
      const keyword = event.target.value.trim().toLowerCase();
  
      this.filteredItems = this.items.filter((item) =>
        String(item.label).toLowerCase().includes(keyword)
      );
  
      this.focusedIndex = -1;
      this.renderList();
      this.updateDirection();
    }
  
    handleDocumentClick(event) {
      if (!this.root.contains(event.target)) {
        this.close();
      }
    }
  
    handleWindowResize() {
      if (this.isOpen) {
        this.updateDirection();
      }
    }
  
    render() {
      this.filteredItems = [...this.items];
      this.renderTrigger();
      this.renderList();
    }
  
    renderTrigger() {
      const selectedItem = this.items.find(
        (item) => this.normalizeValue(item.value) === this.selectedValue
      );
  
      this.triggerText.textContent =
        selectedItem?.label || this.options.placeholder || '選択してください';
  
      if (this.hiddenInput) {
        this.hiddenInput.value = this.selectedValue;
      }
    }
  
    renderList() {
        const items = this.filteredItems.length > 0 ? this.filteredItems : [];
      
        if (items.length === 0) {
          this.list.innerHTML = `
            <div class="custom-dropdown__empty" data-role="dropdown-empty">
              ${this.options.emptyText}
            </div>
          `;
          return;
        }
      
        this.list.innerHTML = items
          .map((item, index) => {
            const value = this.normalizeValue(item.value);
            const isSelected = value === this.selectedValue;
      
            return `
              <button
                type="button"
                class="custom-dropdown__option${isSelected ? ' is-selected' : ''}"
                data-role="dropdown-item"
                data-value="${UIManger.escapeHtml(value)}"
                data-index="${index}"
                role="option"
                aria-selected="${isSelected ? 'true' : 'false'}"
              >
                ${UIManger.escapeHtml(item.label)}
              </button>
            `;
          })
          .join('');
      
        this.list.querySelectorAll('[data-role="dropdown-item"]').forEach((button) => {
          button.addEventListener('click', () => {
            this.selectItem(button.dataset.value);
          });
        });
    }
  
    open() {
        if (this.isOpen) {
          return;
        }
      
        this.isOpen = true;
        this.root.dataset.state = 'open';
        this.panel.hidden = false;
        this.trigger.setAttribute('aria-expanded', 'true');
      
        if (this.searchInput) {
          this.searchInput.value = '';
          this.filteredItems = [...this.items];
          this.renderList();
      
          requestAnimationFrame(() => {
            this.searchInput.focus();
            this.updateDirection();
          });
          return;
        }
      
        requestAnimationFrame(() => {
          this.updateDirection();
          this.focusSelectedItemOrFirst();
        });
    }
      
    close() {
        if (!this.isOpen) {
          return;
        }
      
        this.isOpen = false;
        this.root.dataset.state = 'closed';
        this.panel.hidden = true;
        this.trigger.setAttribute('aria-expanded', 'false');
        this.root.dataset.direction = 'down';
        this.focusedIndex = -1;
    }
  
    toggle() {
      if (this.isOpen) {
        this.close();
        return;
      }
  
      this.open();
    }
  
    updateDirection() {
        if (!this.panel || this.panel.hidden) {
          return;
        }
      
        const triggerRect = this.trigger.getBoundingClientRect();
        const panelHeight = this.panel.scrollHeight || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      
        const spaceBelow = viewportHeight - triggerRect.bottom - 12;
        const spaceAbove = triggerRect.top - 12;
        const shouldOpenUp = panelHeight > spaceBelow && spaceAbove > spaceBelow;
      
        this.root.dataset.direction = shouldOpenUp ? 'up' : 'down';
    }
  
    selectItem(value) {
        const normalizedValue = this.normalizeValue(value);
        const selectedItem = this.items.find(
          (item) => this.normalizeValue(item.value) === normalizedValue
        );
      
        if (!selectedItem) {
          return;
        }
      
        const changed = normalizedValue !== this.selectedValue;
      
        if (!changed) {
          this.close();
          return;
        }
      
        this.selectedValue = normalizedValue;
      
        this.renderTrigger();
        this.renderList();
        this.close();
      
        const detail = {
          value: selectedItem.value,
          item: selectedItem,
          changed: true,
        };
      
        this.root.dispatchEvent(
          new CustomEvent('ui:dropdown-change', {
            bubbles: true,
            detail,
          })
        );
      
        if (typeof this.options.onChange === 'function') {
          this.options.onChange(detail);
        }
    }
  
    setItems(items = [], { preserveSelection = true } = {}) {
      const nextItems = Array.isArray(items) ? [...items] : [];
      const previousValue = this.selectedValue;
  
      this.items = nextItems;
      this.filteredItems = [...nextItems];
  
      if (preserveSelection) {
        const hasSelected = this.items.some(
          (item) => this.normalizeValue(item.value) === previousValue
        );
        this.selectedValue = hasSelected ? previousValue : '';
      } else {
        this.selectedValue = '';
      }
  
      this.syncSelectionFromValue();
      this.render();
    }
  
    setValue(value) {
      this.selectedValue = this.normalizeValue(value);
      this.syncSelectionFromValue();
      this.renderTrigger();
      this.renderList();
    }
  
    setDisabled(disabled) {
      this.trigger.disabled = Boolean(disabled);
  
      if (this.searchInput) {
        this.searchInput.disabled = Boolean(disabled);
      }
  
      if (disabled) {
        this.close();
      }
    }
  
    syncSelectionFromValue() {
      const hasSelected = this.items.some(
        (item) => this.normalizeValue(item.value) === this.selectedValue
      );
  
      if (!hasSelected && this.items.length > 0) {
        this.selectedValue = this.normalizeValue(this.items[0].value);
      }
    }
  
    getVisibleButtons() {
      return [...this.list.querySelectorAll('[data-role="dropdown-item"]')];
    }
  
    focusSelectedItemOrFirst() {
      const buttons = this.getVisibleButtons();
  
      if (buttons.length === 0) {
        return;
      }
  
      const selectedIndex = buttons.findIndex(
        (button) => this.normalizeValue(button.dataset.value) === this.selectedValue
      );
  
      if (selectedIndex >= 0) {
        this.focusItemByIndex(selectedIndex);
        return;
      }
  
      this.focusItemByIndex(0);
    }
  
    focusFirstVisibleItem() {
      const buttons = this.getVisibleButtons();
      if (buttons.length === 0) {
        return;
      }
      this.focusItemByIndex(0);
    }
  
    focusLastVisibleItem() {
      const buttons = this.getVisibleButtons();
      if (buttons.length === 0) {
        return;
      }
      this.focusItemByIndex(buttons.length - 1);
    }
  
    focusNextItem() {
      const buttons = this.getVisibleButtons();
      if (buttons.length === 0) {
        return;
      }
  
      const activeElement = document.activeElement;
      const currentIndex = buttons.findIndex((button) => button === activeElement);
      const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, buttons.length - 1);
      this.focusItemByIndex(nextIndex);
    }
  
    focusPreviousItem() {
      const buttons = this.getVisibleButtons();
      if (buttons.length === 0) {
        return;
      }
  
      const activeElement = document.activeElement;
      const currentIndex = buttons.findIndex((button) => button === activeElement);
      const previousIndex =
        currentIndex < 0 ? buttons.length - 1 : Math.max(currentIndex - 1, 0);
      this.focusItemByIndex(previousIndex);
    }
  
    focusItemByIndex(index) {
        const buttons = this.getVisibleButtons();
        const target = buttons[index];
      
        if (!target) {
          return;
        }
      
        this.focusedIndex = index;
        target.focus({ preventScroll: false });
        target.scrollIntoView({ block: 'nearest' });
    }
  
    destroy() {
      this.close();
  
      this.trigger.removeEventListener('click', this.handleTriggerClick);
      this.trigger.removeEventListener('keydown', this.handleTriggerKeydown);
      this.panel.removeEventListener('keydown', this.handlePanelKeydown);
  
      if (this.searchInput) {
        this.searchInput.removeEventListener('input', this.handleSearchInput);
      }
  
      document.removeEventListener('click', this.handleDocumentClick);
      window.removeEventListener('resize', this.handleWindowResize);
    }
  }