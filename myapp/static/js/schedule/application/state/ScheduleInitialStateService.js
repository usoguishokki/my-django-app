import { UtilityManager } from '../../../manager/UtilityManager.js';
import { ScheduleDateResolver } from '../../domain/ScheduleDateResolver.js';

export class ScheduleInitialStateService {
  constructor({ state }) {
    this.state = state;
  }

  syncInitialScheduleDate(now = new Date()) {
    const resolvedDate = ScheduleDateResolver.resolveScheduleDate(now);

    this.state.setBaseDate(resolvedDate);
    this.state.setSelectedDate(resolvedDate);
  }

  syncBaseDateIfNeeded(now = new Date()) {
    const resolvedDate = ScheduleDateResolver.resolveScheduleDate(now);

    if (this.state.getBaseDate() === resolvedDate) {
      return false;
    }

    this.state.setBaseDate(resolvedDate);
    return true;
  }

  resetSelectedDateToBaseDate() {
    this.state.setSelectedDate(this.state.getBaseDate());
  }

  syncInitialAffiliationId() {
    const affiliationId =
      UtilityManager.$id('employeeName')?.dataset?.affiliation_id ?? '';

    if (!affiliationId) {
      return;
    }

    this.state.setSelectedAffiliationId(affiliationId);
  }
}