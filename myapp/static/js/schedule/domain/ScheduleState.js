export class ScheduleState {
  constructor(baseDate = new Date()) {
    this.selectedDate = this.formatDate(baseDate);
  }

  setSelectedDate(date) {
    this.selectedDate = date;
  }

  getSelectedDate() {
    return this.selectedDate;
  }

  moveDay(delta) {
    const current = new Date(`${this.selectedDate}T00:00:00`);
    current.setDate(current.getDate() + delta);
    this.selectedDate = this.formatDate(current);
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}