export class CustomDropdown {
    constructor({
        rootEl,
        hiddenInputEl,
        triggerEl,
        triggerTextEl,
        panelEl,
        searchInputEl,
        listEl,
        emptyEl = null,
        placeholder = '選択してください',
        allValue = 'all',
    }) {
        this.rootEl = rootEl;
        this.hiddenInputEl = hiddenInputEl;
        this.triggerEl = triggerEl;
        this.triggerTextEl = triggerTextEl;
        this.panelEl = panelEl;
        this.searchInputEl = searchInputEl;
        this.listEl = listEl;
        this.emptyEl = emptyEl;

        this.placeholder = placeholder;
        this.allValue = allValue;

        this.items = [];
        this.filteredItems = [];
        this.selectedItem = null;

        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleTriggerClick = this.handleTriggerClick.bind(this);
        this.handleSearchInput = this.handleSearchInput.bind(this);
    }

    init() {
        if (!this.rootEl || !this.hiddenInputEl || !this.triggerEl || !this.triggerTextEl || !this.panelEl || !this.listEl) {
            return;
        }

        this.bindEvents();
        this.renderTriggerPlaceholder();
        this.renderList();
    }

    bindEvents() {
        this.triggerEl.addEventListener('click', this.handleTriggerClick);

        if (this.searchInputEl) {
            this.searchInputEl.addEventListener('input', this.handleSearchInput);
        }

        document.addEventListener('click', this.handleDocumentClick);
    }

    destroy() {
        this.triggerEl?.removeEventListener('click', this.handleTriggerClick);
        this.searchInputEl?.removeEventListener('input', this.handleSearchInput);
        document.removeEventListener('click', this.handleDocumentClick);
    }

    handleTriggerClick() {
        if (this.triggerEl.disabled) return;

        if (this.isOpen()) {
            this.close();
            return;
        }

        this.open();
    }

    handleSearchInput() {
        const keyword = (this.searchInputEl?.value ?? '').trim().toLowerCase();

        if (!keyword) {
            this.filteredItems = [...this.items];
        } else {
            this.filteredItems = this.items.filter((item) =>
                String(item.label ?? '').toLowerCase().includes(keyword)
            );
        }

        this.renderList();
    }

    handleDocumentClick(event) {
        if (!this.rootEl) return;
        if (this.rootEl.contains(event.target)) return;
        this.close();
    }

    isOpen() {
        return this.rootEl?.dataset.state === 'open';
    }

    open() {
        if (!this.rootEl || !this.panelEl || !this.triggerEl) return;

        this.updateDirection();
        this.rootEl.dataset.state = 'open';
        this.panelEl.hidden = false;
        this.triggerEl.setAttribute('aria-expanded', 'true');

        if (this.searchInputEl) {
            this.searchInputEl.value = '';
            this.filteredItems = [...this.items];
            this.renderList();
            this.searchInputEl.focus();
        }
    }

    close() {
        if (!this.rootEl || !this.panelEl || !this.triggerEl) return;

        this.rootEl.dataset.state = 'closed';
        this.panelEl.hidden = true;
        this.triggerEl.setAttribute('aria-expanded', 'false');
    }

    updateDirection() {
        if (!this.rootEl || !this.triggerEl) return;

        const rect = this.triggerEl.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const estimatedPanelHeight = 340;

        this.rootEl.dataset.direction = spaceBelow < estimatedPanelHeight ? 'up' : 'down';
    }

    setDisabled(disabled) {
        if (this.hiddenInputEl) {
            this.hiddenInputEl.disabled = disabled;
        }

        if (this.triggerEl) {
            this.triggerEl.disabled = disabled;
        }

        if (disabled) {
            this.close();
        }
    }

    setItems(items = []) {
        this.items = Array.isArray(items) ? [...items] : [];
        this.filteredItems = [...this.items];

        const currentValue = this.hiddenInputEl?.value ?? '';
        this.selectedItem = this.items.find((item) => String(item.value) === String(currentValue)) ?? null;

        this.renderTrigger();
        this.renderList();
    }

    setValue(value) {
        const normalized = String(value ?? '');
        const found = this.items.find((item) => String(item.value) === normalized) ?? null;

        this.selectedItem = found;

        if (this.hiddenInputEl) {
            this.hiddenInputEl.value = found ? String(found.value ?? '') : '';
        }

        this.renderTrigger();
        this.renderList();
    }

    getValue() {
        return this.hiddenInputEl?.value ?? '';
    }

    getSelectedItem() {
        return this.selectedItem;
    }

    renderTrigger() {
        if (!this.triggerTextEl) return;

        if (!this.selectedItem) {
            this.renderTriggerPlaceholder();
            return;
        }

        this.triggerTextEl.textContent = this.selectedItem.label ?? this.placeholder;
        this.triggerTextEl.classList.remove('is-placeholder');
    }

    renderTriggerPlaceholder() {
        if (!this.triggerTextEl) return;

        this.triggerTextEl.textContent = this.placeholder;
        this.triggerTextEl.classList.add('is-placeholder');
    }

    renderList() {
        if (!this.listEl) return;

        this.listEl.innerHTML = '';

        if (!this.filteredItems.length) {
            if (this.emptyEl) this.emptyEl.hidden = false;
            return;
        }

        if (this.emptyEl) this.emptyEl.hidden = true;

        this.filteredItems.forEach((item) => {
            const li = document.createElement('li');

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'custom-dropdown__option';
            button.textContent = item.label ?? '';

            if (this.selectedItem && String(this.selectedItem.value) === String(item.value)) {
                button.classList.add('is-selected');
            }

            Object.entries(item.attributes ?? {}).forEach(([attr, attrValue]) => {
                button.setAttribute(attr, String(attrValue ?? ''));
            });

            button.addEventListener('click', () => {
                this.selectedItem = item;
            
                if (this.hiddenInputEl) {
                    this.hiddenInputEl.value = String(item.value ?? '');
                }
            
                this.renderTrigger();
                this.renderList();
                this.close();
            
                this.rootEl?.dispatchEvent(new CustomEvent('ui:dropdown-change', {
                    bubbles: true,
                    detail: {
                        value: String(item.value ?? ''),
                        label: item.label ?? '',
                        item,
                    },
                }));
            });

            li.appendChild(button);
            this.listEl.appendChild(li);
        });
    }
}