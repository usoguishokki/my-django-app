import { UIManger } from './UIManger.js'
export class dropdownManger {
    constructor(dropdowns, tableManager=null, itemSelector=null, callback=null) {
        this.dropdowns = dropdowns;
        this.tableManager = tableManager;
        this.itemSelector = itemSelector;
        this.callback = callback;
    };

    setupDropdowns() {
        for (const [dropdownId, selector] of Object.entries(this.dropdowns)) {
            this.populateDropdownOptions(dropdownId, selector);
            document.getElementById(dropdownId).addEventListener('change', (event) => {
                const attribute = event.target.getAttribute('data-filter-attribute');
                const value = event.target.value;
                this.tableManager.filterConditions[attribute] = value;
                this.tableManager.filterTable();
            })
        }
    }

    populateDropdownOptions(dropdownId, optionsSelector) {
        const dropdown = document.getElementById(dropdownId);
        dropdown.innerHTML = '';//既存のオプションをクリアする

        //'全てのオプションを追加
        dropdown.add(new Option('全て', ''))

        const optionElements = document.querySelectorAll(optionsSelector);

        //ユニークなオプションのリストを生成
        const uniqueOptions = [...new Set([...optionElements]
            .map(el => el.textContent.trim())
            .filter(text => text !== ''))];//空白またはから文字列を除外

        //ドロップダウンのオプションを生成
        uniqueOptions.forEach(optionText => {
            const option = new Option(optionText, optionText);
            dropdown.add(option);
        })
    }

    liInitDropdowns() {
        for (const [dropdownId, attribute] of Object.entries(this.dropdowns)) {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown.value === "") {
                this.liPopulateDropdown(dropdownId, attribute);
            }
        }
    }

    liPopulateDropdown(dropdownId, attribute) {
        const dropdown = document.getElementById(dropdownId);
        
        const values = new Map();
        let totalCount = 0;

        document.querySelectorAll(this.itemSelector).forEach(item => {
            if (!item.classList.contains('hidden')) {
                const value = item.getAttribute(attribute);
                totalCount++;
                if (values.has(value)) {
                    values.set(value, values.get(value) + 1);
                } else {
                    values.set(value, 1);
                }
            }
        });

        dropdown.innerHTML = `<option value="">全て (${totalCount})</option>`;

        values.forEach((count ,value) => {
            const option =document.createElement('option');
            option.value = value;
            option.textContent = `${value} (${count})`;
            dropdown.appendChild(option);
        });
    }

    initEventListeners() {
        for (const dropdownId of Object.keys(this.dropdowns)) {
            const dropdown = document.getElementById(dropdownId);
            dropdown.addEventListener('change', () => this.filterItems())
        }
    }

    filterItems() {
        const filters = {};
        for (const [dropdownId, attribute] of Object.entries(this.dropdowns)) {
            const dropdown = document.getElementById(dropdownId);
            const value = dropdown.value;
            if (value) {
                filters[attribute] = value;
            }
        }

        document.querySelectorAll(this.itemSelector).forEach(item => {
            let isVisible = true;
            for (const [attribute, value] of Object.entries(filters)) {
                if (value && item.getAttribute(attribute) !== value) {
                    isVisible = false;
                    break;
                }
            }
            if (isVisible) {
                UIManger.toggleClass(item, 'hidden', 'remove')
            } else {
                UIManger.toggleClass(item, 'hidden', 'add')
            }
        });

        if(this.callback) {
            this.callback();
        }

        this.liInitDropdowns();
    }
}