import { formatDate } from '../../utils/dateTime.js';

export class ScheduleState {
  constructor(
    baseDate = new Date(),
    initialTeam = '',
    initialAffiliationId = '',
    initialVisibleHours = 2
  ) {
    const formattedDate = formatDate(baseDate);

    this.baseDate = formattedDate;
    this.selectedDate = formattedDate;
    this.selectedTeam = initialTeam;
    this.selectedAffiliationId = initialAffiliationId;
    this.visibleHours = this.normalizeVisibleHours(initialVisibleHours);
    this.teamSchedules = [];
  }

  setBaseDate(date) {
    this.baseDate = date;
  }

  getBaseDate() {
    return this.baseDate;
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

  setVisibleHours(hours) {
    this.visibleHours = this.normalizeVisibleHours(hours);
  }

  getVisibleHours() {
    return this.visibleHours;
  }

  setTeamSchedules(teamSchedules) {
    this.teamSchedules = Array.isArray(teamSchedules) ? teamSchedules : [];
  }

  getTeamSchedules() {
    return this.teamSchedules;
  }

  normalizeVisibleHours(hours) {
    const value = Number(hours);
    const allowedHours = [2, 4, 8];

    return allowedHours.includes(value) ? value : 2;
  }

  moveDay(delta) {
    const current = new Date(`${this.selectedDate}T00:00:00`);
    current.setDate(current.getDate() + delta);
    this.selectedDate = formatDate(current);
  }
}