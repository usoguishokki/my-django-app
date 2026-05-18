// static/js/ui/renderers/registrationDrawerTopRenderer.js
import { UIManger } from '../../manager/UIManger.js';
import { renderDrawerTableTop } from './drawerTableTopRenderer.js';

function renderBulkRegistrationMemberDropdown({
  memberId = '',
  memberName = '',
  arrowIconUrl = '/static/img/arrow.svg',
} = {}) {
  const displayName = memberName || '選択してください';

  return `
    <div class="registration-drawer-top__memberField">
      <div
        class="custom-dropdown registration-drawer-top__memberDropdown"
        data-role="bulk-registration-member-dropdown"
        data-state="closed"
      >
        <input
          type="hidden"
          data-role="bulk-registration-member-value"
          value="${UIManger.escapeHtml(String(memberId ?? ''))}"
        >

        <button
          type="button"
          class="custom-dropdown__trigger"
          data-ui-action="schedule:toggle-bulk-registration-member-dropdown"
          aria-haspopup="listbox"
          aria-expanded="false"
        >
          <span
            class="custom-dropdown__triggerText"
            data-role="bulk-registration-member-label"
          >
            ${UIManger.escapeHtml(displayName)}
          </span>

          <img
            class="custom-dropdown__triggerIcon custom-dropdown__triggerIconImage"
            src="${UIManger.escapeHtml(String(arrowIconUrl ?? '/static/img/arrow.svg'))}"
            alt=""
            aria-hidden="true"
          >
        </button>

        <div
          class="custom-dropdown__panel"
          data-role="bulk-registration-member-dropdown-panel"
          hidden
        >
          <div
            class="custom-dropdown__list"
            data-role="bulk-registration-member-dropdown-list"
          ></div>
        </div>
      </div>
    </div>
  `;
}

export function renderRegistrationDrawerTop({
  startDate = '',
  startTime = '',
  endDate = '',
  endTime = '',
  memberId = '',
  memberName = '',
  arrowIconUrl = '/static/img/arrow.svg',
} = {}) {
  return `
    <div class="registration-drawer-top">
      ${renderBulkRegistrationMemberDropdown({ 
        memberId, 
        memberName,
        arrowIconUrl,
       })}

      ${renderDrawerTableTop({
        fields: [
          {
            type: 'range',
            start: {
              type: 'datetime',
              mode: 'split',
              groupLabel: '',
              dateRole: 'start-date',
              dateValue: startDate,
              timeRole: 'start-time',
              timeValue: startTime,
              showIcons: true,
            },
            separator: { type: 'separator', label: '～' },
            end: {
              type: 'datetime',
              mode: 'split',
              groupLabel: '',
              dateRole: 'end-date',
              dateValue: endDate,
              timeRole: 'end-time',
              timeValue: endTime,
              showIcons: true,
            },
          },
        ],
        buttons: [{ action: 'bulkRegister', label: '確定', payload: {} }],
      })}
    </div>
  `;
}