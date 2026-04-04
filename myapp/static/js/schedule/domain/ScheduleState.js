export class ScheduleState {
  constructor(baseDate = new Date(), initialTeam = '', initialAffiliationId = '') {
    this.selectedDate = this.formatDate(baseDate);
    this.selectedTeam = initialTeam;
    this.selectedAffiliationId = initialAffiliationId;
  }

  setSelectedAffiliationId(affiliationId) {
    this.selectedAffiliationId = affiliationId ?? '';
  }

  getSelectedAffiliationId() {
    return this.selectedAffiliationId;
  }

  setSelectedDate(date) {
    this.selectedDate = date;
  }

  getSelectedDate() {
    return this.selectedDate;
  }

  setSelectedTeam(team) {
    this.selectedTeam = team;
  }

  getSelectedTeam() {
    return this.selectedTeam;
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