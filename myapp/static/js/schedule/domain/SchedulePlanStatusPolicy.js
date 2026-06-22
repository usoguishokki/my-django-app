export class SchedulePlanStatusPolicy {
  static MOVABLE_PLAN_STATUSES = Object.freeze(['実施待ち', '遅れ']);
  static RETRACTABLE_PLAN_STATUSES = Object.freeze(['実施待ち', '遅れ']);

  static normalize(planStatus) {
    return String(planStatus ?? '').trim();
  }

  static isMovable(planStatus) {
    return this.MOVABLE_PLAN_STATUSES.includes(this.normalize(planStatus));
  }

  static isRetractable(planStatus) {
    return this.RETRACTABLE_PLAN_STATUSES.includes(this.normalize(planStatus));
  }
}