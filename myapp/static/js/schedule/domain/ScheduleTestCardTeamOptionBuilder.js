export class ScheduleTestCardTeamOptionBuilder {
    static DISPLAY_TEAM_KEYS = ['A', 'B', 'C'];
  
    static build(teamSchedules = []) {
      if (!Array.isArray(teamSchedules)) {
        return [];
      }
  
      return teamSchedules
        .map((schedule) => this.toOption(schedule))
        .filter((option) => this.isDisplayTeamOption(option))
        .sort((a, b) => this.compareDisplayOrder(a, b));
    }
  
    static toOption(schedule = {}) {
      const key = this.resolveTeamKey(schedule);
  
      return {
        // 表示・識別は A / B / C
        key,
        label: key,
  
        // 内部データは週ごとの最新値
        affiliationId: String(schedule.affiliationId ?? ''),
        shiftPatternId: String(
          schedule.shiftPatternId ??
          schedule.patternId ??
          ''
        ),
        shiftPatternName: String(
          schedule.shiftPatternName ??
          schedule.patternName ??
          ''
        ),
        startTime: String(schedule.startTime ?? ''),
      };
    }
  
    static resolveTeamKey(schedule = {}) {
      return this.normalizeTeamKey(
        schedule.key ??
        schedule.label ??
        schedule.affiliationName ??
        ''
      );
    }
  
    static normalizeTeamKey(value) {
      return String(value ?? '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[Ａ-Ｚ]/g, (char) =>
          String.fromCharCode(char.charCodeAt(0) - 0xfee0)
        )
        .replace(/班$/, '')
        .toUpperCase();
    }
  
    static isDisplayTeamOption(option = {}) {
      return (
        Boolean(option.affiliationId) &&
        ScheduleTestCardTeamOptionBuilder.DISPLAY_TEAM_KEYS.includes(option.key)
      );
    }
  
    static compareDisplayOrder(a, b) {
      return (
        ScheduleTestCardTeamOptionBuilder.DISPLAY_TEAM_KEYS.indexOf(a.key) -
        ScheduleTestCardTeamOptionBuilder.DISPLAY_TEAM_KEYS.indexOf(b.key)
      );
    }
}