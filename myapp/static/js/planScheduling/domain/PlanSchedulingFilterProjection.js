/**
 * @file PlanSchedulingFilterProjection.js
 * @module planScheduling/domain/PlanSchedulingFilterProjection
 * @summary Projects the loaded Plan Scheduling timeline through local filters.
 * @responsibility Date/slot filtering and Chart aggregation from timeline summaries.
 * @not_responsible DOM interaction, API loading, persistence, or Plan mutation.
 */

import { formatMinutes } from './PlanSchedulingPreviewPolicy.js';

export const PLAN_SCHEDULING_FILTER_OPTIONS = Object.freeze({
  weekdays: Object.freeze(['月', '火', '水', '木', '金', '土', '日']),
  shifts: Object.freeze(['1直', '2直', '3直', '休日']),
  teams: Object.freeze(['A班', 'B班', 'C班']),
});

const WEEKDAYS_BY_UTC_DAY = Object.freeze(['日', '月', '火', '水', '木', '金', '土']);

export const emptyPlanSchedulingFilter = () => ({
  weekdays: [],
  shifts: [],
  teams: [],
});

const normalizedValues = (values, allowed) => {
  const selected = new Set(Array.isArray(values) ? values : []);
  return allowed.filter((value) => selected.has(value));
};

export const normalizePlanSchedulingFilter = (filter = {}) => ({
  weekdays: normalizedValues(filter.weekdays, PLAN_SCHEDULING_FILTER_OPTIONS.weekdays),
  shifts: normalizedValues(filter.shifts, PLAN_SCHEDULING_FILTER_OPTIONS.shifts),
  teams: normalizedValues(filter.teams, PLAN_SCHEDULING_FILTER_OPTIONS.teams),
});

export const planSchedulingFilterCount = (filter) => {
  const normalized = normalizePlanSchedulingFilter(filter);
  return normalized.weekdays.length + normalized.shifts.length + normalized.teams.length;
};

const dateWeekday = (isoDate) => {
  const [year, month, day] = String(isoDate || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  return WEEKDAYS_BY_UTC_DAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};

const permits = (selected, value) => selected.length === 0 || selected.includes(value);

const normalizedFilterIncludesDate = (filter, isoDate) =>
  permits(filter.weekdays, dateWeekday(isoDate));

const normalizedFilterIncludesSlot = (filter, slot) =>
  normalizedFilterIncludesDate(filter, slot?.date) &&
  permits(filter.shifts, slot?.shift?.name) &&
  permits(filter.teams, slot?.team?.name);

export const filterIncludesDate = (filter, isoDate) => {
  const normalized = normalizePlanSchedulingFilter(filter);
  return normalizedFilterIncludesDate(normalized, isoDate);
};

export const filterIncludesSlot = (filter, slot) => {
  const normalized = normalizePlanSchedulingFilter(filter);
  return normalizedFilterIncludesSlot(normalized, slot);
};

const projectDates = (dates, filter, allowedShifts, allowedTeams) => (dates || [])
  .filter((day) => normalizedFilterIncludesDate(filter, day.date))
  .map((day) => ({
    ...day,
    slots: (day.slots || []).filter((slot) => (
      allowedShifts.has(slot?.shift?.name) &&
      allowedTeams.has(slot?.team?.name) &&
      normalizedFilterIncludesSlot(filter, slot)
    )),
  }));

const chartTeamNames = (chart, filter) => {
  const configured = (chart?.teams || [])
    .map((team) => team.name)
    .filter((name) => PLAN_SCHEDULING_FILTER_OPTIONS.teams.includes(name));
  const available = configured.length ? configured : PLAN_SCHEDULING_FILTER_OPTIONS.teams;
  return filter.teams.length
    ? available.filter((name) => filter.teams.includes(name))
    : available;
};

const projectChart = (chart, timelineDates, filter) => {
  const chartDays = new Map((chart?.dates || []).map((day) => [day.date, day]));
  const teamsByName = new Map((chart?.teams || []).map((team) => [team.name, team]));
  const teamNames = chartTeamNames(chart, filter);
  const dates = timelineDates.map((day) => {
    const original = chartDays.get(day.date) || day;
    const teamWorkloads = teamNames.map((teamName) => {
      const slots = day.slots.filter((slot) => slot.team?.name === teamName);
      const hasInvalidEffort = slots.some((slot) => (
        slot.hasInvalidEffort || !Number.isInteger(slot.workloadMinutes)
      ));
      const workloadMinutes = hasInvalidEffort
        ? null
        : slots.reduce((total, slot) => total + slot.workloadMinutes, 0);
      return {
        teamId: teamsByName.get(teamName)?.id ?? slots[0]?.team?.id,
        teamName,
        workloadMinutes,
        workloadLabel: formatMinutes(workloadMinutes),
        hasInvalidEffort,
      };
    });
    const hasInvalidEffort = teamWorkloads.some((item) => item.hasInvalidEffort);
    const totalWorkloadMinutes = hasInvalidEffort
      ? null
      : teamWorkloads.reduce((total, item) => total + item.workloadMinutes, 0);
    return {
      ...original,
      date: day.date,
      label: day.label || original.label,
      maintenanceWeekLabel: day.maintenanceWeekLabel || original.maintenanceWeekLabel || '',
      teamWorkloads,
      totalWorkloadMinutes,
      totalWorkloadLabel: formatMinutes(totalWorkloadMinutes),
      hasInvalidEffort,
    };
  });
  return {
    ...(chart || {}),
    shiftNames: filter.shifts.length ? [...filter.shifts] : [...(chart?.shiftNames || [])],
    teams: teamNames.map((name) => teamsByName.get(name) || { id: null, name }),
    dates,
  };
};

export const projectPlanSchedulingState = (state, activeFilter = {}) => {
  if (!state) return state;
  const filter = normalizePlanSchedulingFilter(activeFilter);
  if (planSchedulingFilterCount(filter) === 0) return state;
  const configuredShifts = state.workloadChart?.shiftNames || [];
  const configuredTeams = (state.workloadChart?.teams || []).map((team) => team.name);
  const allowedShifts = new Set(
    configuredShifts.length ? configuredShifts : PLAN_SCHEDULING_FILTER_OPTIONS.shifts,
  );
  const allowedTeams = new Set(
    configuredTeams.length ? configuredTeams : PLAN_SCHEDULING_FILTER_OPTIONS.teams,
  );
  const timelineSource = state.timelineDates || state.dates || [];
  const timelineDates = projectDates(timelineSource, filter, allowedShifts, allowedTeams);
  const dates = projectDates(state.dates || [], filter, allowedShifts, allowedTeams);
  return {
    ...state,
    dates,
    timelineDates,
    workloadChart: projectChart(state.workloadChart, timelineDates, filter),
  };
};

export const nextFilteredDate = (sourceDates, filteredDates, anchorDate) => {
  const surviving = new Set((filteredDates || []).map((day) => day.date));
  const source = sourceDates || [];
  const anchorIndex = source.findIndex((day) => day.date === anchorDate);
  if (anchorIndex < 0) return filteredDates?.[0]?.date || '';
  for (let index = anchorIndex + 1; index < source.length; index += 1) {
    if (surviving.has(source[index].date)) return source[index].date;
  }
  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    if (surviving.has(source[index].date)) return source[index].date;
  }
  return '';
};
