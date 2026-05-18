import {
  fetchScheduleDay,
  fetchScheduleMemberWeek,
  fetchInspectionCardDetail,
  fetchScheduleTestCardsWeek,
  fetchScheduleTestCardTeamOptions,
  executeBulkRegistration,
  executeScheduleBulkEventRetract,
} from '../../../api/fetchers.js';

export class ScheduleDataService {
  fetchDay(params) {
    return fetchScheduleDay(params);
  }

  fetchMemberWeek({ date, memberId }) {
    return fetchScheduleMemberWeek({
      date,
      memberId,
    });
  }

  fetchTestCardsWeek({
    date = null,
    dateAlias = '',
    shiftPatternId = '',
  } = {}) {
    return fetchScheduleTestCardsWeek({
      date,
      dateAlias,
      shiftPatternId,
    });
  }

  fetchTestCardTeamOptions({
    date = null,
    dateAlias = '',
  } = {}) {
    return fetchScheduleTestCardTeamOptions({
      date,
      dateAlias,
    });
  }

  fetchInspectionCardDetail({ inspectionNo }) {
    return fetchInspectionCardDetail({
      inspectionNo,
    });
  }

  executeBulkRegistration(params = {}) {
    return executeBulkRegistration(params);
  }

  executeScheduleBulkEventRetract(params = {}) {
    return executeScheduleBulkEventRetract(params);
  }
}