/**
 * @file PlanSchedulingMaintenanceWeekProjection.js
 * @module planScheduling/domain/PlanSchedulingMaintenanceWeekProjection
 * @summary Builds the read-only maintenance-week presentation from daily summaries.
 * @responsibility Stable week grouping and filtered weekly Chart/Matrix aggregation.
 * @not_responsible DOM interaction, API loading, Drawer detail, or Move state.
 */

import { formatMinutes } from './PlanSchedulingPreviewPolicy.js';
import {
  PLAN_SCHEDULING_FILTER_OPTIONS,
  filterIncludesDate,
  normalizePlanSchedulingFilter,
  projectPlanSchedulingState,
} from './PlanSchedulingFilterProjection.js';

export const PLAN_SCHEDULING_VIEW_MODE = Object.freeze({
  DAY: 'day',
  MAINTENANCE_WEEK: 'maintenanceWeek',
});

const HOLIDAY_SHIFT = '休日';
const FISCAL_START_LABEL = '4月1週目';
const FISCAL_END_LABEL = '3月4週目';

const aggregateSlots = (slots) => {
  const hasInvalidEffort = slots.some((slot) => (
    slot.hasInvalidEffort || !Number.isInteger(slot.workloadMinutes)
  ));
  const workloadMinutes = hasInvalidEffort
    ? null
    : slots.reduce((total, slot) => total + slot.workloadMinutes, 0);
  return {
    workloadMinutes,
    workloadLabel: formatMinutes(workloadMinutes),
    hasInvalidEffort,
  };
};

export const groupCanonicalMaintenanceWeeks = (dates = []) => {
  const groups = [];
  dates.forEach((day) => {
    const label = day.maintenanceWeekLabel || '';
    const current = groups.at(-1);
    if (!current || current.label !== label) {
      groups.push({
        key: day.date,
        date: day.date,
        label,
        firstDate: day.date,
        lastDate: day.date,
        dates: [day],
      });
      return;
    }
    current.lastDate = day.date;
    current.dates.push(day);
  });
  return groups;
};

const fiscalStartYearForDate = (isoDate) => {
  const [year, month] = String(isoDate || '').split('-').map(Number);
  if (!year || !month) return null;
  return month >= 4 ? year : year - 1;
};

const groupContainsMonth = (group, year, month) => (group.dates || []).some((day) => {
  const [dateYear, dateMonth] = String(day.date || '').split('-').map(Number);
  return dateYear === year && dateMonth === month;
});

export const maintenanceWeeksForFiscalRange = (groups = [], anchorDate) => {
  const fiscalStartYear = fiscalStartYearForDate(anchorDate);
  if (!fiscalStartYear) return [];
  const startIndex = groups.findIndex((group) => (
    group.label === FISCAL_START_LABEL && groupContainsMonth(group, fiscalStartYear, 4)
  ));
  const endIndex = groups.findIndex((group, index) => (
    index >= startIndex &&
    group.label === FISCAL_END_LABEL &&
    groupContainsMonth(group, fiscalStartYear + 1, 3)
  ));
  if (startIndex < 0 || endIndex < startIndex) return [];
  return groups.slice(startIndex, endIndex + 1);
};

const configuredNames = (values, fallback) => values?.length ? values : fallback;

const weeklyTeamNames = (chart) => configuredNames(
  (chart?.teams || []).map((team) => team.name),
  PLAN_SCHEDULING_FILTER_OPTIONS.teams,
);

const weeklyShiftNames = (chart) => configuredNames(
  chart?.shiftNames,
  PLAN_SCHEDULING_FILTER_OPTIONS.shifts,
);

const chartDayForWeek = (group, contributingDates, teamNames, shiftNames, teamsByName) => {
  const slots = contributingDates.flatMap((day) => day.slots || []).filter((slot) => (
    shiftNames.includes(slot.shift?.name) && teamNames.includes(slot.team?.name)
  ));
  const teamWorkloads = teamNames.map((teamName) => ({
    teamId: teamsByName.get(teamName)?.id ?? slots.find(
      (slot) => slot.team?.name === teamName,
    )?.team?.id,
    teamName,
    ...aggregateSlots(slots.filter((slot) => slot.team?.name === teamName)),
  }));
  const hasInvalidEffort = teamWorkloads.some((item) => item.hasInvalidEffort);
  const totalWorkloadMinutes = hasInvalidEffort
    ? null
    : teamWorkloads.reduce((total, item) => total + item.workloadMinutes, 0);
  return {
    date: group.key,
    label: group.label,
    maintenanceWeekLabel: group.label,
    firstDate: contributingDates[0].date,
    lastDate: contributingDates.at(-1).date,
    isMaintenanceWeek: true,
    teamWorkloads,
    totalWorkloadMinutes,
    totalWorkloadLabel: formatMinutes(totalWorkloadMinutes),
    hasInvalidEffort,
  };
};

const matrixSlotsForWeek = (
  group,
  contributingDates,
  holidayDates,
  teamNames,
  shiftNames,
  allowedTeams,
) => {
  const slots = contributingDates.flatMap((day) => day.slots || []);
  const holidaySlots = holidayDates.flatMap((day) => day.slots || []);
  const shiftOrder = new Map(shiftNames.map((name, index) => [name, index]));
  const teamOrder = new Map(teamNames.map((name, index) => [name, index]));
  const actualPairs = new Map();
  slots.forEach((slot) => {
    const shiftName = slot.shift?.name;
    const teamName = slot.team?.name;
    if (shiftName === HOLIDAY_SHIFT || !shiftOrder.has(shiftName) || !teamOrder.has(teamName)) {
      return;
    }
    const key = `${shiftName}\u0000${teamName}`;
    if (!actualPairs.has(key)) actualPairs.set(key, { shiftName, teamName, slots: [] });
    actualPairs.get(key).slots.push(slot);
  });
  const weeklySlots = [...actualPairs.values()]
    .sort((left, right) => (
      shiftOrder.get(left.shiftName) - shiftOrder.get(right.shiftName) ||
      teamOrder.get(left.teamName) - teamOrder.get(right.teamName)
    ))
    .map(({ shiftName, teamName, slots: pairSlots }) => ({
      key: `${group.key}:${shiftName}:${teamName}`,
      shiftName,
      teamName,
      isHolidayAggregate: false,
      ...aggregateSlots(pairSlots),
    }));
  if (!shiftOrder.has(HOLIDAY_SHIFT)) return weeklySlots;
  const allowedHolidaySlots = holidaySlots.filter((slot) => (
    slot.shift?.name === HOLIDAY_SHIFT && allowedTeams.has(slot.team?.name)
  ));
  if (!allowedHolidaySlots.length) return weeklySlots;
  return [...weeklySlots, {
    key: `${group.key}:holiday`,
    shiftName: HOLIDAY_SHIFT,
    teamName: '',
    isHolidayAggregate: true,
    ...aggregateSlots(allowedHolidaySlots),
  }];
};

export const projectMaintenanceWeeks = (state, activeFilter = {}, anchorDate = '') => {
  if (!state) return state;
  const filter = normalizePlanSchedulingFilter(activeFilter);
  const canonicalDates = state.timelineDates || state.dates || [];
  const canonicalGroups = groupCanonicalMaintenanceWeeks(canonicalDates);
  const groups = anchorDate
    ? maintenanceWeeksForFiscalRange(canonicalGroups, anchorDate)
    : canonicalGroups;
  const dayProjection = projectPlanSchedulingState(state, filter);
  const projectedDatesByDate = new Map(
    (dayProjection.timelineDates || []).map((day) => [day.date, day]),
  );
  const chart = dayProjection.workloadChart || {};
  const teamNames = weeklyTeamNames(chart);
  const shiftNames = weeklyShiftNames(chart);
  const teamsByName = new Map((chart.teams || []).map((team) => [team.name, team]));
  const allowedTeams = new Set(configuredNames(
    (state.workloadChart?.teams || []).map((team) => team.name),
    PLAN_SCHEDULING_FILTER_OPTIONS.teams,
  ));
  const weeks = groups.map((group) => {
    const holidayDates = group.dates.filter((day) => filterIncludesDate(filter, day.date));
    const contributingDates = holidayDates.map(
      (day) => projectedDatesByDate.get(day.date),
    ).filter(Boolean);
    if (!contributingDates.length) return null;
    const chartDay = chartDayForWeek(
      group,
      contributingDates,
      teamNames,
      shiftNames,
      teamsByName,
    );
    return {
      ...group,
      date: group.key,
      maintenanceWeekLabel: group.label,
      firstVisibleDate: contributingDates[0].date,
      lastVisibleDate: contributingDates.at(-1).date,
      visibleDates: contributingDates.map((day) => day.date),
      isMaintenanceWeek: true,
      slots: matrixSlotsForWeek(
        group,
        contributingDates,
        holidayDates,
        teamNames,
        shiftNames,
        allowedTeams,
      ),
      chartDay,
    };
  }).filter(Boolean);
  return {
    ...dayProjection,
    viewMode: PLAN_SCHEDULING_VIEW_MODE.MAINTENANCE_WEEK,
    timelineDates: weeks,
    workloadChart: {
      ...chart,
      shiftNames,
      teams: teamNames.map((name) => teamsByName.get(name) || { id: null, name }),
      dates: weeks.map((week) => week.chartDay),
    },
  };
};

export const maintenanceWeekForDate = (weeks = [], isoDate) => weeks.find(
  (week) => (week.dates || []).some((day) => day.date === isoDate),
);

export const maintenanceWeekByKey = (weeks = [], key) => weeks.find(
  (week) => week.key === key || week.date === key,
);
