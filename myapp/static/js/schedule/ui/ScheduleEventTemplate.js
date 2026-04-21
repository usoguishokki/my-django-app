export class ScheduleEventTemplate {
    static createEmpty() {
      return `
        <div class="time-schedule__empty">
          予定がありません。
        </div>
      `;
    }
  
    static createEventArticle({
      event,
      columnIndex = 0,
      columnCount = 1,
      showLabel = true,
      eventLabel = '',
    }) {
      return `
        <article
          class="time-schedule__event"
          style="
            top: ${event.topPx}px;
            height: ${event.heightPx}px;
            left: calc((100% / ${columnCount}) * ${columnIndex});
            width: calc(100% / ${columnCount});
          "
          data-ui-action="schedule:open-plan-detail"
          data-role="schedule-event"
          data-plan-id="${event.id}"
          data-work-name="${event.workName}"
          data-inspection-no="${event.inspectionNo ?? ''}"
          data-member-id="${event.memberId ?? ''}"
          data-start-time="${event.startTime}"
          data-end-time="${event.endTime}"
          data-status="${event.status ?? ''}"
        >
          ${showLabel ? `
            <div class="time-schedule__eventTitle">
              ${eventLabel}
            </div>
          ` : ''}
        </article>
      `;
    }
  }