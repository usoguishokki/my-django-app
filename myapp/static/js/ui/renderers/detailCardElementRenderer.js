// static/js/ui/renderers/detailCardElementRenderer.js

export function createDetailCardElement({
    className = 'detail-card',
    dataset = {},
    contentTagName = 'div',
    contentClassName = 'click-card__button',
    headerElement = null,
    bodyElement = null,
} = {}) {
    const card = document.createElement('article');
    card.className = className;

    applyDataset(card, dataset);

    const content = document.createElement(resolveContentTagName(contentTagName));
    content.className = contentClassName;

    if (headerElement) {
        content.appendChild(headerElement);
    }

    if (bodyElement) {
        content.appendChild(bodyElement);
    }

    card.appendChild(content);

    return card;
}

function applyDataset(element, dataset = {}) {
    Object.entries(dataset).forEach(([key, value]) => {
        if (value == null) {
            return;
        }

        element.dataset[key] = String(value);
    });
}

function resolveContentTagName(tagName) {
    return tagName === 'button' ? 'button' : 'div';
}