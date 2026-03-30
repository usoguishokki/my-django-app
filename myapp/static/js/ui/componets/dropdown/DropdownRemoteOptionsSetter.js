export class DropdownRemoteOptionsSetter {
    constructor({ getCleanDropdown, applyOptionAttributes }) {
        this.getCleanDropdown = getCleanDropdown;
        this.applyOptionAttributes = applyOptionAttributes;
    }

    setOptions(
        dropdownId,
        items = [],
        {
            placeholderLabel = '選択してください',
            includePlaceholder = true,
            includeAll = false,
            allLabel = '全て',
            allValue = 'all',
            allAttributes = {},
            mapItemToOption = (item) => ({
                value: item?.value ?? '',
                label: item?.label ?? '',
                attributes: {},
            }),
            restorePreviousValue = true,
        } = {}
    ) {
        const currentSelect = document.getElementById(dropdownId);
        if (!currentSelect) return;

        const prevValue = restorePreviousValue ? (currentSelect.value ?? '') : '';

        const select = this.getCleanDropdown(dropdownId);
        if (!select) return;

        if (includePlaceholder) {
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = placeholderLabel;
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            select.appendChild(placeholderOption);
        }

        if (includeAll) {
            const allOption = document.createElement('option');
            allOption.value = String(allValue);
            allOption.textContent = allLabel;
            this.applyOptionAttributes(allOption, allAttributes);
            select.appendChild(allOption);
        }

        items.forEach((item) => {
            const { value, label, attributes = {} } = mapItemToOption(item);

            const option = document.createElement('option');
            option.value = String(value ?? '');
            option.textContent = label ?? '';
            this.applyOptionAttributes(option, attributes);
            select.appendChild(option);
        });

        if (restorePreviousValue) {
            const hasPrev = Array.from(select.options).some((opt) => opt.value === prevValue);
            select.value = hasPrev ? prevValue : '';
        }
    }
}