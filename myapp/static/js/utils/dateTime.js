// static/js/utils/dateTime.js

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