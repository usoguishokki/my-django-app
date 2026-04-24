import { UIManger } from '../../manager/UIManger.js';
import { labelForAttrValue, formatJsDayToDowLabel } from '../formatters/labelFormatters.js';
import { getJsDay } from '../../utils/dateTime.js';

function formatDayOfWeek(dayOfWeek, planDate) {
  if (dayOfWeek !== '' && dayOfWeek != null) {
    return labelForAttrValue('data-plan-week-of-day', dayOfWeek);
  }

  const jsDay = getJsDay(planDate);
  if (jsDay == null) {
    return '';
  }

  return formatJsDayToDowLabel(jsDay);
}

function formatManHours(manHours) {
  if (manHours === '' || manHours == null) {
    return '';
  }

  return `${manHours}分`;
}

function formatPeriod(interval, unit) {
  if (interval == null || interval === '' || unit == null || unit === '') {
    return '';
  }

  return `${interval}/${unit}`;
}

function formatTitleLine1(item) {
  const machineName = item?.machineName ?? '';
  const workName = item?.workName ?? '';

  return [machineName, workName].filter(Boolean).join('_');
}

function formatTitleLine2(item) {
  const manHours = formatManHours(item?.manHours);
  const dayOfWeek = formatDayOfWeek(item?.dayOfWeek, item?.planDate);
  const period = formatPeriod(item?.interval, item?.unit);

  return [manHours, dayOfWeek, period].filter(Boolean).join('_');
}

function renderDetailItemsHTML(detailItems = []) {
    if (!Array.isArray(detailItems) || detailItems.length === 0) {
      return `
        <p class="detail-card__emptyMessage">
          ${UIManger.escapeHtml('内容はありません。')}
        </p>
      `;
    }
  
    return `
      <div class="detail-card__detailItems">
        ${detailItems
          .map(
            (detail) => `
              <div class="detail-card__detailItem">
                <div class="detail-card__detailItemDevice">
                  ${UIManger.escapeHtml(detail?.applicableDevice ?? '')}
                </div>
                <div class="detail-card__detailItemContents">
                  ${UIManger.escapeHtml(detail?.contents ?? '')}
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    `;
}

function renderTestCardHTML(item) {
  return `
    <article
      class="detail-card click-card"
      data-plan-id="${UIManger.escapeHtml(item?.planId)}"
    >
      <button
        type="button"
        class="click-card__button"
        data-ui-action="schedule:select-test-card"
        data-plan-id="${UIManger.escapeHtml(item?.planId)}"
      >
        <header class="detail-card__header">
          <div class="detail-card__title">
            <div class="detail-card__titleLine">
              ${UIManger.escapeHtml(formatTitleLine1(item))}
            </div>
            <div class="detail-card__titleSub">
              ${UIManger.escapeHtml(formatTitleLine2(item))}
            </div>
          </div>
        </header>

        <div class="detail-card__body">
            ${renderDetailItemsHTML(item?.detailItems)}
        </div>
      </button>
    </article>
  `;
}

export function renderScheduleTestCardsHTML(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return `
      <p class="ui-empty-message">
        ${UIManger.escapeHtml('表示できる点検カードはありません。')}
      </p>
    `;
  }

  return `
    <div class="detail-cards detail-card-list">
      ${items.map((item) => renderTestCardHTML(item)).join('')}
    </div>
  `;
}