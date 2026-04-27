import {
  fetchScheduleDay,
  fetchScheduleMemberWeek,
  fetchInspectionCardDetail,
  fetchScheduleTestCardsWeek,
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

  fetchInspectionCardDetail({ inspectionNo }) {
    return fetchInspectionCardDetail({
      inspectionNo,
    });
  }
}