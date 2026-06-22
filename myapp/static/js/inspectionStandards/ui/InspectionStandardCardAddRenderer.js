// static/js/inspectionStandards/ui/InspectionStandardCardAddRenderer.js

import { UIManger } from '../../manager/UIManger.js';

export function renderInspectionStandardCardAddPlaceholderHTML({
  context = {},
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  return `
    <div class="inspection-standard-card-add">
      <div class="inspection-standard-card-add__lead">
        新しい点検カードを追加します。
      </div>

      <dl class="inspection-standard-card-add__summary">
        <div class="inspection-standard-card-add__summaryRow">
          <dt>設備名</dt>
          <dd>${esc(context.machine || '-')}</dd>
        </div>

        <div class="inspection-standard-card-add__summaryRow">
          <dt>管理番号</dt>
          <dd>${esc(context.controlNo || '-')}</dd>
        </div>
      </dl>

      <div class="inspection-standard-card-add__placeholder">
        カード追加フォームは次のステップで実装します。
      </div>
    </div>
  `;
}

export function renderInspectionStandardCardAddConfirmHTML({
  context = {},
  commonEntries = [],
  detailItems = [],
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  return `
    <div class="inspection-standard-confirm inspection-standard-card-add-confirm">
      <div class="inspection-standard-confirm__header">
        <div class="inspection-standard-confirm__title">
          カード登録内容の確認
        </div>

        <div class="inspection-standard-confirm__lead">
          この内容で登録します。よろしいですか?
        </div>
      </div>

      <div class="inspection-standard-confirm__section">
        <div class="inspection-standard-confirm__sectionTitle">
          対象設備
        </div>

        <div class="inspection-standard-card-add-confirm__summary">
          ${renderCardAddConfirmRowHTML({
            label: '設備名',
            value: context.machine || '-',
          })}
          ${renderCardAddConfirmRowHTML({
            label: '管理番号',
            value: context.controlNo || '-',
          })}
        </div>
      </div>

      <div class="inspection-standard-confirm__section">
        <div class="inspection-standard-confirm__sectionTitle">
          共通項目
        </div>

        <div class="inspection-standard-card-add-confirm__summary">
          ${commonEntries
            .map((entry) => renderCardAddConfirmRowHTML({
              label: entry.label,
              value: entry.displayValue || entry.value || '-',
            }))
            .join('')}
        </div>
      </div>

      <div class="inspection-standard-confirm__section">
        <div class="inspection-standard-card-add-confirm__sectionTitleRow">
          <div class="inspection-standard-confirm__sectionTitle">
            点検項目 ${esc(detailItems.length)}件
          </div>
                
          ${detailItems.length > 1
            ? `
              <span
                class="inspection-standard-card-add-confirm__scrollNotice"
                data-role="inspection-standard-card-add-confirm-scroll-notice"
              >
                点検項目を最後まで確認すると登録できます。
              </span>
            `
            : ''
          }
        </div>
        
        <div
          class="inspection-standard-card-add-confirm__detailList"
          data-role="inspection-standard-card-add-confirm-detail-list"
          data-require-scroll="${detailItems.length > 1 ? 'true' : 'false'}"
        >
          ${detailItems
            .map((item, index) => renderCardAddConfirmDetailItemHTML({
              item,
              index,
            }))
            .join('')}
        </div>
      </div>
    </div>
  `;
}

function renderCardAddConfirmDetailItemHTML({
  item = {},
  index = 0,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));
  const itemNo = Number(index) + 1;
  const entries = Array.isArray(item.entries) ? item.entries : [];

  return `
    <section class="inspection-standard-card-add-confirm__detailItem">
      <div class="inspection-standard-card-add-confirm__detailTitle">
        点検項目 ${esc(itemNo)}
      </div>

      <div class="inspection-standard-card-add-confirm__summary">
        ${entries
          .map((entry) => renderCardAddConfirmRowHTML({
            label: entry.label,
            value: entry.displayValue || entry.value || '-',
          }))
          .join('')}
      </div>
    </section>
  `;
}

function renderCardAddConfirmRowHTML({
  label,
  value,
} = {}) {
  const esc = (v) => UIManger.escapeHtml(String(v ?? ''));

  return `
    <div class="inspection-standard-card-add-confirm__row">
      <div class="inspection-standard-card-add-confirm__label">
        ${esc(label)}
      </div>

      <div class="inspection-standard-card-add-confirm__value">
        ${esc(value || '-')}
      </div>
    </div>
  `;
}