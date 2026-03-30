export class TimeScheduleTemplate {
  static create({ 
    axisLabels,
    gridLines,
    members,
    events,
    currentSchedules,
    scheduleHeightPx,
  }) {
    return `
      <div class="time-schedule">
        <div
          class="time-schedule__layout"
          style="--time-schedule-height: ${scheduleHeightPx}px; --member-count: ${members.length};"
        >
          <div class="time-schedule__axis">
            ${this.createAxisLabels(axisLabels)}
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

              <div class="time-schedule__events">
                ${this.createEvents(events, members)}
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
      <div class="time-schedule__memberHeader">
        ${member.name}
      </div>
    `).join('');
  }

  static createCurrentSchedules(members, currentSchedules = []) {
    return members.map((member) => {
      const current = currentSchedules.find((item) => item.memberId === member.id);

      if (!current || !current.hasSchedule) {
        return `
          <div class="time-schedule__currentCell is-empty">
            <div class="time-schedule__currentTitle">予定なし</div>
          </div>
        `;
      }

      return `
        <div class="time-schedule__currentCell">
          <div class="time-schedule__currentTime">
            ${current.startTime} - ${current.endTime}
          </div>
          <div class="time-schedule__currentTitle">
            ${current.title}
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

  static createEvents(events, members) {
    if (!events.length) {
      return `
        <div class="time-schedule__empty">
          予定がありません。
        </div>
      `;
    }

    return events.map((event) => {
      const memberIndex = this.findMemberIndex(members, event.memberId);

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
        >
          <div class="time-schedule__eventTime">
            ${event.startTime} - ${event.endTime}
          </div>
          <div class="time-schedule__eventTitle">
            ${event.title}
          </div>
        </article>
      `;
    }).join('');
  }

  static findMemberIndex(members, memberId) {
    const index = members.findIndex((member) => member.id === memberId);
    return index >= 0 ? index : 0;
  }
}