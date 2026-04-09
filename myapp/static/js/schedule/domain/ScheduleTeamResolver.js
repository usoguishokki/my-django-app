export class ScheduleTeamResolver {
    static TARGET_TEAM_NAMES = ['A班', 'B班', 'C班'];
  
    static resolveCurrentAffiliationId(teamSchedules, now = new Date()) {
      if (!Array.isArray(teamSchedules) || teamSchedules.length === 0) {
        return null;
      }
  
      const currentMinutes = this.getMinutesFromDate(now);
  
      const normalizedSchedules = teamSchedules
        .filter((teamSchedule) =>
          this.TARGET_TEAM_NAMES.includes(teamSchedule.affiliationName)
        )
        .map((teamSchedule) => ({
          ...teamSchedule,
          startMinutes: this.parseTimeToMinutes(teamSchedule.startTime),
        }))
        .filter((teamSchedule) => teamSchedule.startMinutes !== null)
        .sort((a, b) => a.startMinutes - b.startMinutes);
  
      if (normalizedSchedules.length === 0) {
        return null;
      }
  
      let matchedSchedule = normalizedSchedules[normalizedSchedules.length - 1];
  
      for (const teamSchedule of normalizedSchedules) {
        if (teamSchedule.startMinutes <= currentMinutes) {
          matchedSchedule = teamSchedule;
          continue;
        }
  
        break;
      }
  
      return matchedSchedule.affiliationId ?? null;
    }
  
    static parseTimeToMinutes(timeText) {
      if (typeof timeText !== 'string') {
        return null;
      }
  
      const [hoursText, minutesText] = timeText.split(':');
      const hours = Number(hoursText);
      const minutes = Number(minutesText);
  
      if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        return null;
      }
  
      return (hours * 60) + minutes;
    }
  
    static getMinutesFromDate(date) {
      return (date.getHours() * 60) + date.getMinutes();
    }
  }