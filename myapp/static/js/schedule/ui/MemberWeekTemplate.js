import { ScheduleEventLabelBuilder } from './ScheduleEventLabelBuilder.js';
import { ScheduleAxisTemplate } from './ScheduleAxisTemplate.js';
import { ScheduleColumnTemplate } from './ScheduleColumnTemplate.js';
import { ScheduleEventTemplate } from './ScheduleEventTemplate.js';



export class MemberWeekTemplate {
  static create({
    axisLabels,
    gridLines,
    days,
    events,
    scheduleHeightPx,
  }) {
    return `
      <div class="time-schedule time-schedule--memberWeek">
        <div
          class="time-schedule__layout"
          style="--time-schedule-height: ${scheduleHeightPx}px; --member-count: ${days.length};"
        >
          <div class="time-schedule__axis">
            <div class="time-schedule__axisHeaderSpacer"></div>
            <div class="time-schedule__axisLabels">
              ${ScheduleAxisTemplate.createAxisLabels(axisLabels)}
            </div>
          </div>

          <div class="time-schedule__membersArea time-schedule__membersArea--memberWeek">
            <div class="time-schedule__memberHeaderRow">
              ${this.createDayHeaders(days)}
            </div>

            <div class="time-schedule__grid time-schedule__grid--memberWeek">
              <div class="time-schedule__lines">
                ${ScheduleAxisTemplate.createGridLines(gridLines)}
              </div>

              <div class="time-schedule__memberColumns">
                ${this.createDayColumns(days)}
              </div>

              <div class="time-schedule__events">
                ${this.createEvents(events, days)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static createDayHeaders(days) {
    return days.map((day) => `
      <div
        class="time-schedule__memberHeader time-schedule__memberHeader--day"
        data-day-key="${day.key}"
      >
        <span class="time-schedule__memberHeaderName">
          ${day.label}
        </span>
        <span class="time-schedule__memberHeaderSub">
          ${day.dateText}
        </span>
      </div>
    `).join('');
  }

  static createDayColumns(days) {
    return ScheduleColumnTemplate.createDayColumns(days);
  }

  static createEvents(events, days) {
    if (!events.length) {
      return ScheduleEventTemplate.createEmpty();
    }
  
    const columnCount = days.length;
  
    return events.map((event) => {
      const eventLabel = ScheduleEventLabelBuilder.build(event);
  
      return ScheduleEventTemplate.createEventArticle({
        event,
        columnIndex: event.columnIndex ?? 0,
        columnCount,
        showLabel: true,
        eventLabel,
      });
    }).join('');
  }
}