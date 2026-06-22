// static/js/utils/dateTime.js
const JAPANESE_WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/**
 * 0埋め
 * @param {number} n
 * @param {number} [len=2]
 */
export const pad = (n, len = 2) => String(n).padStart(len, '0');

/**
 * Date -> 任意フォーマット文字列（簡易）
 * tokens: YYYY, MM, DD, HH, mm, ss
 * @param {Date|string|number|null|undefined} input
 * @param {string} format
 * @param {{utc?:boolean}} [opt]
 */
export function formatDate(input, format = 'YYYY-MM-DD', { utc = false } = {}) {
  const dt = input instanceof Date ? input : new Date(input ?? Date.now());
  const get = (m) => (utc ? dt[`getUTC${m}`]() : dt[`get${m}`]());

  const year = get('FullYear');
  const month = get('Month') + 1;
  const day = get('Date');
  const hour = get('Hours');
  const minute = get('Minutes');
  const second = get('Seconds');

  return format
    .replace('YYYY', String(year))
    .replace('MM', pad(month))
    .replace('DD', pad(day))
    .replace('HH', pad(hour))
    .replace('mm', pad(minute))
    .replace('ss', pad(second));
}

/**
 * 日付文字列 -> datetime-local (YYYY-MM-DDTHH:mm)
 * @param {string|Date|number} value
 */
export function toDateTimeLocalString(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatDate(d, 'YYYY-MM-DDTHH:mm');
}

/**
 * datetime-local を「形式として正しい」＆「実在する日時」か判定
 * @param {string} value
 */
export function isValidDateTimeLocal(value) {
  if (!value || typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;

  // round-trip で実在チェック
  return toDateTimeLocalString(d) === value;
}

/**
 * ISO末尾の 'Z' を取り除く
 * @param {string} s
 */
export function removeTrailingZ(s) {
  const str = String(s ?? '');
  return str.endsWith('Z') ? str.slice(0, -1) : str;
}

/**
 * split -> datetime-local を作る
 * @param {{date?:string, time?:string}} param0
 */
export function joinDateTimeLocal({ date = '', time = '' } = {}) {
  if (!date || !time) return '';
  return `${date}T${time}`;
}

/**
 * datetime-local -> split
 * @param {string} value
 */
export function splitDateTimeLocal(value = '') {
  const s = String(value || '');
  const [date, time] = s.split('T');
  return { date: date ?? '', time: time ?? '' };
}

export function addMinutes(dateOrString, minutes) {
    const d = dateOrString instanceof Date ? new Date(dateOrString) : new Date(dateOrString);
    if (Number.isNaN(d.getTime())) return null;
    d.setMinutes(d.getMinutes() + Number(minutes || 0));
    return d;
  }
  
/**
 * datetime-local / ISO / Date / timestamp を受け取り、
 * 分を加算した Date を返す
 * @param {string|Date|number} dtLike
 * @param {number} minutes
 * @returns {Date|null}
 */
export function addMinutesToDate(dtLike, minutes) {
  const d = parseUiDateTimeLike(dtLike);
  if (!d) return null;

  d.setMinutes(d.getMinutes() + Number(minutes || 0));
  return d;
}

/**
 * datetime-local / ISO文字列を受け取り、UI向け datetime-local 文字列を返す
 * @param {string|Date|number} dtLike
 * @param {number} minutes
 * @returns {string}
 */
export function addMinutesToDateTimeLocal(dtLike, minutes) {
  const d = addMinutesToDate(dtLike, minutes);
  return d ? toDateTimeLocalString(d) : '';
}

/**
 * Date.parse ベースのゆるい日付判定
 * @param {string} value
 */
export function isValidDate(value) {
  const ts = Date.parse(value);
  return !Number.isNaN(ts);
}

/**
 * datetime-local文字列を厳密に Date へ変換
 * @param {string} value
 * @returns {Date|null}
 */
export function parseDateTimeLocal(value) {
  if (typeof value !== 'string') return null;

  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);

  const d = new Date(year, month - 1, day, hour, minute, 0, 0);

  // 実在チェック
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day ||
    d.getHours() !== hour ||
    d.getMinutes() !== minute
  ) {
    return null;
  }

  return d;
}

/**
 * datetime-local または ISO文字列を Date に変換
 * - "2026-03-10T13:25"
 * - "2026-03-10T13:25:00.000Z"
 * の両方を受け付ける
 * @param {string|Date|number} value
 * @returns {Date|null}
 */
export function parseUiDateTimeLike(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }

  // まず datetime-local として厳密に解釈
  if (typeof value === 'string') {
    const local = parseDateTimeLocal(value);
    if (local) return local;
  }

  // 次に ISO / timestamp としてゆるく解釈
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function addMonths(dateLike, months) {
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + Number(months || 0));
  return d;
}

export function addDays(dateLike, days) {
  const d = dateLike instanceof Date ? new Date(dateLike) : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

/**
 * HH:mm -> 総分
 * @param {string} time
 * @returns {number|null}
 */
export function timeStringToMinutes(time) {
  if (typeof time !== 'string') return null;

  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return (hour * 60) + minute;
}

/**
 * 総分 -> HH:mm
 * 24時間で丸める
 * @param {number} totalMinutes
 * @returns {string}
 */
export function minutesToTimeString(totalMinutes) {
  const normalized =
    ((Number(totalMinutes || 0) % (24 * 60)) + (24 * 60)) % (24 * 60);

  const hh = String(Math.floor(normalized / 60)).padStart(2, '0');
  const mm = String(normalized % 60).padStart(2, '0');

  return `${hh}:${mm}`;
}

export function getJsDay(dateLike) {
  const d = parseUiDateTimeLike(dateLike);
  if (!d) return null;
  return d.getDay();
}

/**
 * 日付表示を compact 表示へ変換する
 *
 * examples:
 * - "2026-05-04" -> "05-04"
 * - "2026/5/4" -> "05-04"
 * - "2026-05-04 - 2026-05-10" -> "05-04 - 05-10"
 * - "2026/5/4 ～ 2026/5/10" -> "05-04 ～ 05-10"
 * - Date -> "05-04"
 *
 * @param {string|Date|number|null|undefined} value
 * @param {{separator?: string}} [options]
 * @returns {string}
 */
export function formatCompactDateLabel(value, { separator = '-' } = {}) {
  if (value == null) {
    return '';
  }

  if (value instanceof Date || typeof value === 'number') {
    return formatDate(value, `MM${separator}DD`);
  }

  const text = String(value).trim();

  return text.replace(
    /\b\d{4}[-/](\d{1,2})[-/](\d{1,2})\b/g,
    (_, month, day) => {
      return `${pad(month)}${separator}${pad(day)}`;
    }
  );
}

/**
 * input[type="date"] 用に YYYY-MM-DD へ整形する
 *
 * @param {string|Date|number|null|undefined} value
 * @returns {string}
 */
export function normalizeDateInputValue(value) {
  if (value == null) {
    return '';
  }

  if (value instanceof Date) {
    return formatDate(value, 'YYYY-MM-DD');
  }

  const text = String(value).trim();

  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);

  if (!match) {
    return '';
  }

  const [, year, month, day] = match;

  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * 日付を日本語表記に変換する
 *
 * examples:
 * - "2026-06-10" -> "2026年06月10日"
 * - "2026/6/3" -> "2026年06月03日"
 * - "2026-06-10T14:20:30" -> "2026年06月10日"
 * - Date -> "2026年06月10日"
 *
 * @param {string|Date|number|null|undefined} value
 * @returns {string}
 */
export function formatJapaneseDateLabel(value) {
  const dateValue = normalizeDateInputValue(value);

  if (!dateValue) {
    return '';
  }

  const [year, month, day] = dateValue.split('-');

  return `${year}年${month}月${day}日`;
}

/**
 * YYYY-MM-DD / YYYY/MM/DD 形式の日付をローカルDateに変換する
 *
 * @param {string|Date|number|null|undefined} value
 * @returns {Date|null}
 */
export function parseDateOnlyToLocalDate(value) {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dateValue = normalizeDateInputValue(value);

  if (!dateValue) {
    return null;
  }

  const date = new Date(`${dateValue}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 日付から曜日ラベルを取得する
 *
 * @param {string|Date|number|null|undefined} value
 * @returns {string}
 */
export function formatJapaneseWeekdayLabel(value) {
  const date = parseDateOnlyToLocalDate(value);

  if (!date) {
    return '';
  }

  return JAPANESE_WEEKDAY_LABELS[date.getDay()] ?? '';
}

/**
 * タイトル横に表示する曜日ラベルを取得する
 *
 * examples:
 * - "2026-05-04" -> "(月)"
 * - "2026-05-04 - 2026-05-10" -> "(月〜日)"
 *
 * @param {string|Date|number|null|undefined} value
 * @returns {string}
 */
export function formatTitleWeekdayLabel(value) {
  if (value == null) {
    return '';
  }

  if (value instanceof Date || typeof value === 'number') {
    const weekday = formatJapaneseWeekdayLabel(value);

    return weekday ? `(${weekday})` : '';
  }

  const text = String(value).trim();

  const dateTexts = [
    ...text.matchAll(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g),
  ].map((match) => match[0]);

  if (!dateTexts.length) {
    return '';
  }

  const firstWeekday = formatJapaneseWeekdayLabel(dateTexts[0]);

  if (!firstWeekday) {
    return '';
  }

  if (dateTexts.length === 1) {
    return `(${firstWeekday})`;
  }

  const lastWeekday = formatJapaneseWeekdayLabel(
    dateTexts[dateTexts.length - 1]
  );

  if (!lastWeekday || firstWeekday === lastWeekday) {
    return `(${firstWeekday})`;
  }

  return `(${firstWeekday}〜${lastWeekday})`;
}




/**
 * input[type="time"] 用に HH:mm へ整形する
 *
 * examples:
 * - "6:30" -> "06:30"
 * - "06:30:00" -> "06:30"
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function normalizeTimeInputValue(value) {
  const text = String(value ?? '').trim();

  const match = text.match(/^(\d{1,2}):(\d{1,2})/);

  if (!match) {
    return '';
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return '';
  }

  return `${pad(hours)}:${pad(minutes)}`;
}

/**
 * input[type="date"] 用の日付に日数を加算する
 *
 * @param {string|Date|number|null|undefined} value
 * @param {number} days
 * @returns {string}
 */
export function addDaysToDateInputValue(value, days = 0) {
  const dateValue = normalizeDateInputValue(value);

  if (!dateValue) {
    return '';
  }

  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));

  return formatDate(date, 'YYYY-MM-DD');
}

/**
 * input[type="time"] 用の値を分に変換する
 *
 * @param {string|null|undefined} value
 * @returns {number|null}
 */
export function timeInputValueToMinutes(value) {
  const timeValue = normalizeTimeInputValue(value);

  if (!timeValue) {
    return null;
  }

  const [hours, minutes] = timeValue.split(':').map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * 終了時刻が翌日になるか判定する
 *
 * @param {string|null|undefined} startTime
 * @param {string|null|undefined} endTime
 * @returns {boolean}
 */
export function isNextDayTimeRange(startTime, endTime) {
  const startMinutes = timeInputValueToMinutes(startTime);
  const endMinutes = timeInputValueToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  return endMinutes <= startMinutes;
}