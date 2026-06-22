import { UIManger } from '../../manager/UIManger.js';

/**
 * View2: PlanDetail cards を描画するHTMLを返す（副作用なし）
 * vm: { title: string, cards: Array<{ device: string, items: Array<{label, value}> }> }
 */
export function renderPlanDetailCardsHTML(vm, options = {}) {
  const title = vm?.title ?? '';
  const cards = Array.isArray(vm?.cards) ? vm.cards : [];

  if (!cards.length) {
    return `
      <p class="planned-maintenance-subview__placeholder">
        ${UIManger.escapeHtml('表示できる明細がありません。')}
      </p>
    `;
  }

  return `
    <div
      class="detail-cards"
      data-title="${UIManger.escapeHtml(title)}"
      data-mode="${UIManger.escapeHtml(options.mode ?? 'view')}"
    >
      ${cards.map((card) => renderPlanDetailCardHTML(card, options)).join('')}
    </div>
  `;
}

function renderPlanDetailCardHTML(card, options = {}) {
  const device = card?.device ?? '対象設備';
  const items = Array.isArray(card?.items) ? card.items : [];

  const sectionId = String(card?.sectionId ?? '');
  const selectedSectionId = String(options.selectedSectionId ?? '');
  const isSelectable = Boolean(options.selectable && sectionId);
  const isSelected = isSelectable && sectionId === selectedSectionId;

  const actionAttrs = isSelectable
    ? `
      data-role="inspection-standard-edit-section"
      data-ui-action="${UIManger.escapeHtml(options.selectAction ?? '')}"
      data-section-id="${UIManger.escapeHtml(sectionId)}"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    `
    : '';

  const className = [
    'detail-card',
    isSelectable ? 'detail-card--selectable' : '',
    isSelected ? 'is-selected' : '',
  ].filter(Boolean).join(' ');

  return `
    <section class="${className}" ${actionAttrs}>
      <header class="detail-card__header">
        <div class="detail-card__title">${UIManger.escapeHtml(device)}</div>
      </header>

      <div class="detail-card__body">
        ${items.map(renderKVItemHTML).join('')}
      </div>
    </section>
  `;
}

function renderKVItemHTML(item) {
  const label = item?.label ?? '';
  const value = item?.value ?? '';

  return `
    <div class="detail-item">
      <div class="detail-item__label">${UIManger.escapeHtml(label)}</div>
      <div class="detail-item__value">${UIManger.escapeHtml(String(value))}</div>
    </div>
  `;
}

/**
 * View3: ExtraDetail（実施情報）を描画するHTMLを返す（副作用なし）
 * vm: { title: string, items: Array<{label, value}> }
 *
 * - 1枚カードで表示（あなたの見た目と揃える）
 * - items だけで構成できるようにする
 */
export function renderExtraDetailHTML(vm) {
    const items = Array.isArray(vm?.items) ? vm.items : [];
  
    if (!items.length) {
      return `
        <p class="planned-maintenance-subview__placeholder">
          ${UIManger.escapeHtml('表示できる実施情報がありません。')}
        </p>
      `;
    }
  
    return `
      <div class="detail-cards">
        <section class="detail-card">
          <div class="detail-card__body">
            ${items.map(renderKVItemHTML).join('')}
          </div>
        </section>
      </div>
    `;
  }
