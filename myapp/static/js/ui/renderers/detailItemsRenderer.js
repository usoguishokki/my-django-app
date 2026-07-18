// static/js/ui/renderers/detailItemsRenderer.js
import { UIManger } from '../../manager/UIManger.js';

export function createDetailItemsElement(detailItems = []) {
    if (!Array.isArray(detailItems) || detailItems.length === 0) {
        return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'detail-card__detailItems';

    detailItems.forEach((detail) => {
        wrapper.appendChild(createDetailItemElement(detail));
    });

    return wrapper;
}

function createDetailItemElement(detail) {
    const row = document.createElement('div');
    row.className = 'detail-card__detailItem';

    const device = document.createElement('div');
    device.className = 'detail-card__detailItemDevice';
    device.textContent = detail?.applicableDevice || '';

    const contents = document.createElement('div');
    contents.className = 'detail-card__detailItemContents';
    contents.textContent = detail?.contents || '';

    row.appendChild(device);
    row.appendChild(contents);

    return row;
}

export function renderDetailItemsHTML(detailItems = []) {
    if (!Array.isArray(detailItems) || detailItems.length === 0) {
        return '';
    }

    return `
        <div class="detail-card__detailItems">
            ${detailItems.map(renderDetailItemHTML).join('')}
        </div>
    `;
}

function renderDetailItemHTML(detail) {
    return `
        <div class="detail-card__detailItem">
            <div class="detail-card__detailItemDevice">
                ${UIManger.escapeHtml(detail?.applicableDevice || '')}
            </div>
            <div class="detail-card__detailItemContents">
                ${UIManger.escapeHtml(detail?.contents || '')}
            </div>
        </div>
    `;
}