export class ScheduleBulkRegistrationPayloadService {
    constructor({
      getRoot,
      getMemberId,
    } = {}) {
      this.getRoot = getRoot;
      this.getMemberId = getMemberId;
    }
  
    buildPayload() {
      const root = this.getRoot?.() ?? null;
  
      if (!root) {
        return this.createInvalidResult([
          '一括登録画面が見つかりません。',
        ]);
      }
  
      const startDate = this.readInputValue(root, 'start-date');
      const startTime = this.readInputValue(root, 'start-time');
      const endDate = this.readInputValue(root, 'end-date');
      const endTime = this.readInputValue(root, 'end-time');
  
      const member = String(this.getMemberId?.() ?? '').trim();
  
      const dateStart = this.buildDateTimeValue({
        date: startDate,
        time: startTime,
      });
  
      const dateEnd = this.buildDateTimeValue({
        date: endDate,
        time: endTime,
      });
  
      const dataPlanIds = this.collectEnabledPlanIds(root);
  
      const errors = this.validate({
        member,
        startDate,
        startTime,
        endDate,
        endTime,
        dateStart,
        dateEnd,
        dataPlanIds,
      });
  
      if (errors.length > 0) {
        return this.createInvalidResult(errors);
      }
  
      return {
        isValid: true,
        payload: {
          member,
          dateStart,
          dateEnd,
          dataPlanIds,
        },
        errors: [],
        message: '',
      };
    }
  
    readInputValue(root, role) {
      return String(
        root.querySelector(`[data-role="${role}"]`)?.value ?? ''
      ).trim();
    }
  
    buildDateTimeValue({
      date = '',
      time = '',
    } = {}) {
      if (!date || !time) {
        return '';
      }
  
      return `${date}T${time}`;
    }
  
    collectEnabledPlanIds(root) {
      return Array.from(root.querySelectorAll('tr[data-plan-id]'))
        .filter((row) => this.isRegistrationTargetRow(row))
        .map((row) => String(row.dataset.planId ?? '').trim())
        .filter(Boolean);
    }
  
    isRegistrationTargetRow(row) {
      if (!row) {
        return false;
      }
  
      if (row.dataset.registerState === 'off') {
        return false;
      }
  
      const toggle = row.querySelector('[data-ui-action="toggle-register"]');
  
      if (!toggle) {
        return true;
      }
  
      return toggle.dataset.checked !== '0'
        && toggle.getAttribute('aria-pressed') !== 'false';
    }
  
    validate({
      member,
      startDate,
      startTime,
      endDate,
      endTime,
      dateStart,
      dateEnd,
      dataPlanIds,
    }) {
      const errors = [];
  
      if (!member) {
        errors.push('実施者を選択してください。');
      }
  
      if (!startDate || !startTime) {
        errors.push('開始日時を入力してください。');
      }
  
      if (!endDate || !endTime) {
        errors.push('終了日時を入力してください。');
      }
  
      if (!Array.isArray(dataPlanIds) || dataPlanIds.length === 0) {
        errors.push('登録対象の点検カードを1件以上選択してください。');
      }
  
      if (dateStart && dateEnd) {
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
  
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          errors.push('日時の形式が正しくありません。');
        } else if (end <= start) {
          errors.push('終了日時は開始日時より後にしてください。');
        }
      }
  
      return errors;
    }
  
    createInvalidResult(errors = []) {
      return {
        isValid: false,
        payload: null,
        errors,
        message: errors.join('\n'),
      };
    }
}