export class ScheduleColumnTemplate {
  static createMemberColumns(members = []) {
    return members.map((member, index) => `
      <div
        class="time-schedule__memberColumn"
        data-member-id="${member.id ?? ''}"
        data-member-index="${index}"
      ></div>
    `).join('');
  }

  static createDayColumns(days = []) {
    return days.map((day, index) => `
      <div
        class="time-schedule__memberColumn"
        data-day-key="${day.key ?? ''}"
        data-day-index="${index}"
      ></div>
    `).join('');
  }
}