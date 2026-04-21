export class ScheduleEditSummaryService {
  constructor({ getSelectedDate, getMemberNameById, elements }) {
    this.getSelectedDate = getSelectedDate;
    this.getMemberNameById = getMemberNameById;
    this.elements = elements;
  }

  buildEventSummaryFromElement(eventEl) {
    if (!eventEl) {
      return null;
    }

    return {
      planId: eventEl.dataset.planId ?? '',
      workName: eventEl.dataset.workName ?? '',
      memberId: eventEl.dataset.memberId ?? '',
      startTime: eventEl.dataset.startTime ?? '',
      endTime: eventEl.dataset.endTime ?? '',
      inspectionNo: eventEl.dataset.inspectionNo ?? '',
      planDate: this.getSelectedDate(),
    };
  }

  syncBefore(eventInfo) {
    this.renderSummary(this.elements?.editBeforeSummary, eventInfo, {
      editableMember: false,
    });
  }

  syncAfter(eventInfo) {
    this.renderSummary(this.elements?.editAfterSummary, eventInfo, {
      editableMember: true,
    });
  }

  resetBefore() {
    this.syncBefore(null);
  }

  resetAfter() {
    this.syncAfter(null);
  }

  resetAll() {
    this.syncBefore(null);
    this.syncAfter(null);
  }

  renderSummary(summaryEl, eventInfo, { editableMember = false } = {}) {
    if (!summaryEl) {
      return;
    }

    if (!eventInfo) {
      summaryEl.classList.add('is-empty');
      summaryEl.innerHTML = this.buildEmptySummaryHtml({ editableMember });
      return;
    }

    const memberName = this.getMemberNameById(eventInfo.memberId);

    summaryEl.classList.remove('is-empty');
    summaryEl.innerHTML = this.buildFilledSummaryHtml({
      workName: eventInfo.workName,
      memberName,
      memberId: eventInfo.memberId,
      dateText: eventInfo.planDate || this.getSelectedDate(),
      startTime: eventInfo.startTime || '',
      endTime: eventInfo.endTime || '',
      editableMember,
    });
  }

  buildEmptySummaryHtml({ editableMember = false } = {}) {
    return `
      <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--work">
        <span class="schedule-page__editSummaryLabel">作業名:</span>
        <span class="schedule-page__editSummaryValue">-</span>
      </div>
  
      <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--member">
        <span class="schedule-page__editSummaryLabel">実施者:</span>
        ${
          editableMember
            ? `
              <div
                class="custom-dropdown schedule-page__editMemberDropdown"
                data-role="edit-member-dropdown"
                data-state="closed"
              >
                <input
                  type="hidden"
                  value=""
                  data-role="edit-member-dropdown-value"
                >
  
                <button
                  type="button"
                  class="custom-dropdown__trigger"
                  data-role="edit-member-dropdown-trigger"
                  aria-expanded="false"
                >
                  <span
                    class="custom-dropdown__triggerText is-placeholder"
                    data-role="edit-member-dropdown-trigger-text"
                  >
                    選択してください
                  </span>
                  <span class="custom-dropdown__triggerIcon" aria-hidden="true">▾</span>
                </button>
  
                <div
                  class="custom-dropdown__panel"
                  data-role="edit-member-dropdown-panel"
                  hidden
                >
                  <div
                    class="custom-dropdown__list"
                    data-role="edit-member-dropdown-list"
                  ></div>
                </div>
              </div>
            `
            : `
              <span class="schedule-page__editSummaryValue">-</span>
            `
        }
      </div>
  
      <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--date">
        <span class="schedule-page__editSummaryLabel">日付:</span>
        <span class="schedule-page__editSummaryValue">-</span>
      </div>
  
      <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--time">
        <span class="schedule-page__editSummaryLabel">時間:</span>
        <span class="schedule-page__editSummaryValue">-</span>
      </div>
    `;
  }

  buildFilledSummaryHtml({
    workName = '',
    memberName = '',
    dateText = '',
    startTime = '',
    endTime = '',
    editableMember = false,
    memberId = '',
  }) {
    return `
      <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--work">
        <span class="schedule-page__editSummaryLabel">作業名:</span>
        <span class="schedule-page__editSummaryValue">${workName || '-'}</span>
      </div>
  
      <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--member">
        <span class="schedule-page__editSummaryLabel">実施者:</span>
        ${
          editableMember
            ? `
              <div
                class="custom-dropdown schedule-page__editMemberDropdown"
                data-role="edit-member-dropdown"
                data-state="closed"
              >
                <input
                  type="hidden"
                  value="${memberId || ''}"
                  data-role="edit-member-dropdown-value"
                >
  
                <button
                  type="button"
                  class="custom-dropdown__trigger"
                  data-role="edit-member-dropdown-trigger"
                  data-ui-action="schedule:open-edit-member-dropdown"
                  aria-expanded="false"
                >
                  <span
                    class="custom-dropdown__triggerText"
                    data-role="edit-member-dropdown-trigger-text"
                  >
                    ${memberName || '選択してください'}
                  </span>
                  <span class="custom-dropdown__triggerIcon" aria-hidden="true">▾</span>
                </button>
  
                <div
                  class="custom-dropdown__panel"
                  data-role="edit-member-dropdown-panel"
                  hidden
                >
                  <div
                    class="custom-dropdown__list"
                    data-role="edit-member-dropdown-list"
                  ></div>
                </div>
              </div>
            `
            : `
              <span class="schedule-page__editSummaryValue">${memberName || '-'}</span>
            `
        }
      </div>
  
      ${
        editableMember
          ? `
            <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--date">
              <span class="schedule-page__editSummaryLabel">日付:</span>
              <input
                type="date"
                class="ui-input schedule-page__editDateInput"
                data-role="edit-date"
                value="${dateText || ''}"
              >
            </div>
  
            <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--time">
              <span class="schedule-page__editSummaryLabel">時間:</span>
              <input
                type="time"
                class="ui-input schedule-page__editTimeInput"
                data-role="edit-time"
                value="${startTime || ''}"
              >
            </div>
          `
          : `
            <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--date">
              <span class="schedule-page__editSummaryLabel">日付:</span>
              <span class="schedule-page__editSummaryValue">
                ${dateText || '-'}
              </span>
            </div>
  
            <div class="schedule-page__editSummaryRow schedule-page__editSummaryRow--time">
              <span class="schedule-page__editSummaryLabel">時間:</span>
              <span class="schedule-page__editSummaryValue">
                ${startTime && endTime ? `${startTime} - ${endTime}` : '-'}
              </span>
            </div>
          `
      }
    `;
  }

  formatDateTime(startTime, endTime, planDate = '') {
    const dateText = planDate || this.getSelectedDate();
    return `${dateText} ${startTime} - ${endTime}`;
  }
}