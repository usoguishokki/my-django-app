import { ScheduleViewMapper } from './ScheduleViewMapper.js';
import { ScheduleTimelineViewBuilder } from './ScheduleTimelineViewBuilder.js';

export class ScheduleViewModelBuilder {
  static build({ response, minuteHeight, visibleHours, currentSchedules }) {
    const members = response.data?.members ?? [];
    const rawItems = response.data?.items ?? [];
    const breaks = response.data?.breaks ?? [];

    const {
      scheduleHeightPx,
      axisLabels,
      gridLines,
    } = ScheduleTimelineViewBuilder.build({
      minuteHeight,
      visibleHours,
    });

    const memberIndexMap = this.buildMemberIndexMap(members);

    const events = rawItems.map((item) =>
      this.mapEventWithColumnIndex(item, minuteHeight, memberIndexMap)
    );

    const breakBands = breaks.map((item) =>
      ScheduleViewMapper.mapTimedItem(item, minuteHeight)
    );

    return {
      scheduleHeightPx,
      axisLabels,
      gridLines,
      members,
      events,
      breakBands,
      currentSchedules: currentSchedules(members, events),
    };
  }

  static buildMemberIndexMap(members = []) {
    return new Map(
      members.map((member, index) => [member.id, index])
    );
  }

  static mapEventWithColumnIndex(item, minuteHeight, memberIndexMap) {
    const mapped = ScheduleViewMapper.mapTimedItem(item, minuteHeight);

    return {
      ...mapped,
      columnIndex: memberIndexMap.get(item.memberId) ?? 0,
    };
  }
}