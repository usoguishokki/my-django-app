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
              ${this.createAxisLabels(axisLabels)}
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
                ${this.createGridLines(gridLines)}
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

  static createAxisLabels(axisLabels) {
    return axisLabels.map((axis) => `
      <div
        class="time-schedule__axisLabel"
        style="top: ${axis.topPx}px;"
      >
        ${axis.label}
      </div>
    `).join('');
  }

  static createMemberHeaders(members) {
    return members.map((member) => `
      <div
        class="time-schedule__memberHeader"
        data-job-title="${member.job_title ?? ''}"
      >
        <span class="time-schedule__memberHeaderName">
          ${member.name}
        </span>
      </div>
    `).join('');
  }

  static createCurrentSchedules(members, currentSchedules = []) {
    return members.map((member) => {
      const current = currentSchedules.find((item) => item.memberId === member.id);
  
      if (!current || !current.hasSchedule) {
        return `
          <div class="time-schedule__currentCell is-empty" data-status="">
            <div class="time-schedule__currentMain">予定なし</div>
          </div>
        `;
      }
  
      return `
        <div class="time-schedule__currentCell" data-status="${current.status ?? ''}">
          <div class="time-schedule__currentMeta">
            <span class="time-schedule__currentTime">
              ${current.startTime} - ${current.endTime}
            </span>
            <span class="time-schedule__currentStatus">
              ${current.status}
            </span>
          </div>
          <div class="time-schedule__currentMain">
            ${current.machineName}: ${current.workName}
          </div>
        </div>
      `;
    }).join('');
  }

  static createGridLines(axisLabels) {
    return axisLabels.map((axis) => `
      <div
        class="time-schedule__gridLine ${axis.isHour ? 'is-hour' : ''}"
        style="top: ${axis.topPx}px;"
      ></div>
    `).join('');
  }

  static createMemberColumns(members) {
    return members.map(() => `
      <div class="time-schedule__memberColumn"></div>
    `).join('');
  }

  static createEvents(events, members, visibleHours) {
    if (!events.length) {
      return `
        <div class="time-schedule__empty">
          予定がありません。
        </div>
      `;
    }
  
    const shouldShowEventLabel = visibleHours <= 2;
  
    return events.map((event) => {
      const memberIndex = this.findMemberIndex(members, event.memberId);
      const eventLabel = this.buildEventLabel(event);
  
      return `
        <article
          class="time-schedule__event"
          style="
            top: ${event.topPx}px;
            height: ${event.heightPx}px;
            left: calc((100% / var(--member-count)) * ${memberIndex});
            width: calc(100% / var(--member-count));
          "
          data-event-id="${event.id}"
          data-member-id="${event.memberId}"
          data-start-time="${event.startTime}"
          data-end-time="${event.endTime}"
          data-status="${event.status ?? ''}"
        >
          ${shouldShowEventLabel ? `
            <div class="time-schedule__eventTitle">
              ${eventLabel}
            </div>
          ` : ''}
        </article>
      `;
    }).join('');
  }

  static buildEventLabel(event) {
    const machineName = event.machineName ?? '';
    const workName = event.workName ?? event.title ?? '';

    if (machineName && workName) {
      return `${machineName}: ${workName}`;
    }

    if (machineName) {
      return machineName;
    }

    return workName;
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

  static findMemberIndex(members, memberId) {
    const index = members.findIndex((member) => member.id === memberId);
    return index >= 0 ? index : 0;
  }
}