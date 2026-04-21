import { ScheduleEventLabelBuilder } from './ScheduleEventLabelBuilder.js';
import { ScheduleAxisTemplate } from './ScheduleAxisTemplate.js';
import { ScheduleColumnTemplate } from './ScheduleColumnTemplate.js';
import { ScheduleEventTemplate } from './ScheduleEventTemplate.js';

export class TimeScheduleTemplate {
  static create({
    axisLabels,
    gridLines,
    members,
    events,
    breakBands,
    currentSchedules,
    scheduleHeightPx,
    visibleHours,
  }) {
    return `
      <div class="time-schedule">
        <div
          class="time-schedule__layout"
          style="--time-schedule-height: ${scheduleHeightPx}px; --member-count: ${members.length};"
        >
          <div class="time-schedule__axis">
            <div class="time-schedule__axisHeaderSpacer"></div>
            <div class="time-schedule__axisCurrentSpacer"></div>
            <div class="time-schedule__axisLabels">
              ${ScheduleAxisTemplate.createAxisLabels(axisLabels)}
            </div>
          </div>

          <div class="time-schedule__membersArea">
            <div class="time-schedule__memberHeaderRow">
              ${this.createMemberHeaders(members)}
            </div>

            <div class="time-schedule__currentRow">
              ${this.createCurrentSchedules(members, currentSchedules)}
            </div>

            <div class="time-schedule__grid">
              <div class="time-schedule__lines">
                ${ScheduleAxisTemplate.createGridLines(gridLines)}
              </div>

              <div class="time-schedule__memberColumns">
                ${this.createMemberColumns(members)}
              </div>

              <div class="time-schedule__breakBands">
                ${this.createBreakBands(breakBands)}
              </div>

              <div class="time-schedule__events">
                ${this.createEvents(events, members, visibleHours)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static createMemberHeaders(members) {
    return members.map((member) => `
      <button
        type="button"
        class="time-schedule__memberHeader"
        data-job-title="${member.job_title ?? ''}"
        data-member-id="${member.id ?? ''}"
        data-member-name="${member.name ?? ''}"
        data-ui-action="schedule:open-member-week"
        aria-label="${member.name}の週間予定を開く"
      >
        <span class="time-schedule__memberHeaderName">
          ${member.name}
        </span>
      </button>
    `).join('');
  }

  static createCurrentSchedules(members, currentSchedules = []) {
    return members.map((member) => {
      const current = currentSchedules.find((item) => item.memberId === member.id);
      const currentLabel = current
        ? ScheduleEventLabelBuilder.build(current)
        : '';

      if (!current || !current.hasSchedule) {
        return `
          <div
            class="time-schedule__currentCell is-empty"
            data-status=""
            data-member-id="${member.id ?? ''}"
          >
            <div class="time-schedule__currentMain">予定なし</div>
          </div>
        `;
      }

      return `
        <div
          class="time-schedule__currentCell"
          data-status="${current.status ?? ''}"
          data-member-id="${member.id ?? ''}"
        >
          <div class="time-schedule__currentMeta">
            <span class="time-schedule__currentTime">
              ${current.startTime} - ${current.endTime}
            </span>
            <span class="time-schedule__currentStatus">
              ${current.status}
            </span>
          </div>
          <div class="time-schedule__currentMain">
            ${currentLabel}
          </div>
        </div>
      `;
    }).join('');
  }

  static createMemberColumns(members) {
    return ScheduleColumnTemplate.createMemberColumns(members);
  }

  static createEvents(events, members, visibleHours) {
    if (!events.length) {
      return ScheduleEventTemplate.createEmpty();
    }
  
    const shouldShowEventLabel = visibleHours <= 2;
    const columnCount = members.length;
  
    return events.map((event) => {
      const eventLabel = ScheduleEventLabelBuilder.build(event);
  
      return ScheduleEventTemplate.createEventArticle({
        event,
        columnIndex: event.columnIndex ?? 0,
        columnCount,
        showLabel: shouldShowEventLabel,
        eventLabel,
      });
    }).join('');
  }

  static createBreakBands(breakBands = []) {
    if (!breakBands.length) {
      return '';
    }

    return breakBands.map((band) => `
      <div
        class="time-schedule__breakBand"
        style="
          top: ${band.topPx}px;
          height: ${band.heightPx}px;
        "
        data-break-id="${band.id}"
        data-start-time="${band.startTime}"
        data-end-time="${band.endTime}"
        data-status="${band.status ?? ''}"
      ></div>
    `).join('');
  }

}