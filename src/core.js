/**
 * Parse a subset of ISO 8601 interval expressions into their start, end, and
 * duration components.
 *
 * Scope (deliberately narrow):
 *   - Start/duration form:  <start>/<duration>   e.g. "2024-01-01/P1M"
 *   - Duration/end form:    <duration>/<end>     e.g. "P1Y2M/2024-12-31"
 *   - <start>/<end> form:   "2024-01-01/2024-12-31" (both endpoints explicit)
 *
 * Supported durations: combinations of P[n]Y[n]M[n]W[n]D (date) and T[n]H[n]M[n]S
 * (time). "P0D" is a valid zero duration.
 *
 * Not supported (out of scope, documented in README):
 *   - Recurring intervals (R/)
 *   - Week-only dates like "2024-W01"
 *   - Ordinal dates like "2024-001"
 *   - Time-only intervals (no date portion on a calendar endpoint)
 *
 * Duration arithmetic uses the ECMAScript Date object so that month lengths,
 * leap years, and DST are handled by the runtime. Adding a month to
 * 2024-01-31 yields 2024-03-02 (JavaScript rollover), which is the documented
 * and tested behaviour.
 */

/**
 * Raised when an interval string cannot be parsed.
 */
export class IntervalError extends Error {
  /**
   * @param {string} message Human-readable description of the parse failure.
   */
  constructor(message) {
    super(message);
    this.name = 'IntervalError';
  }
}

/**
 * @typedef {Object} ISODate
 * @property {string} iso  Original ISO 8601 string for this endpoint.
 * @property {Date}   date A JS Date at UTC midnight for that calendar day.
 */

/**
 * @typedef {Object} DurationParts
 * @property {number} years
 * @property {number} months
 * @property {number} weeks
 * @property {number} days
 * @property {number} hours
 * @property {number} minutes
 * @property {number} seconds
 */

/**
 * @typedef {Object} ParsedInterval
 * @property {ISODate}        start          Calendar start of the interval.
 * @property {ISODate}        end            Calendar end of the interval.
 * @property {DurationParts}  duration       Numeric breakdown of the duration.
 * @property {string|null}    durationIso    ISO duration string, or null when
 *   the interval was expressed with two explicit endpoints.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DURATION_RE =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/**
 * Parse "YYYY-MM-DD" into a Date at UTC midnight.
 *
 * Uses Date.UTC rather than new Date(y, m-1, d) because the latter interprets
 * two-digit years in the 1900–2099 range and is sensitive to the runtime's
 * local timezone, which would make month arithmetic non-deterministic in tests.
 */
function parseDate(iso) {
  const m = DATE_RE.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const u = new Date(ms);
  const out = u.getUTCFullYear() === y &&
    u.getUTCMonth() === mo - 1 &&
    u.getUTCDate() === d;
  return out ? u : null;
}

/**
 * Parse "P[nY][nM][nW][nD][T[nH][nM][nS]]" into structured parts.
 * "P0D" and "P" are both treated as a zero duration so that an interval like
 * "2024-06-01/2024-06-01" is expressible with a duration if needed.
 */
function parseDuration(iso) {
  const m = DURATION_RE.exec(iso);
  if (!m) return null;
  const parts = {
    years: m[1] ? Number(m[1]) : 0,
    months: m[2] ? Number(m[2]) : 0,
    weeks: m[3] ? Number(m[3]) : 0,
    days: m[4] ? Number(m[4]) : 0,
    hours: m[5] ? Number(m[5]) : 0,
    minutes: m[6] ? Number(m[6]) : 0,
    seconds: m[7] ? Number(m[7]) : 0,
  };
  const any =
    parts.years || parts.months || parts.weeks || parts.days ||
    parts.hours || parts.minutes || parts.seconds;
  if (!any && iso !== 'P0D' && iso !== 'P') return null;
  return parts;
}

/**
 * Apply a parsed duration to a Date, returning a new Date.
 * Years and months use setUTCMonth to defer month-length handling to the
 * runtime (so Jan 31 + 1M = Mar 2 in JS's rollover semantics). Weeks/days are
 * added via milliseconds for determinism, and the sub-day units are applied
 * to the local-of-UTC fields for consistency with the date math.
 */
function applyDuration(date, dur) {
  const out = new Date(date.getTime());
  if (dur.years || dur.months) {
    out.setUTCFullYear(out.getUTCFullYear() + dur.years);
    out.setUTCMonth(out.getUTCMonth() + dur.months);
  }
  if (dur.weeks) out.setUTCDate(out.getUTCDate() + dur.weeks * 7);
  if (dur.days) out.setUTCDate(out.getUTCDate() + dur.days);
  if (dur.hours) out.setUTCHours(out.getUTCHours() + dur.hours);
  if (dur.minutes) out.setUTCMinutes(out.getUTCMinutes() + dur.minutes);
  if (dur.seconds) out.setUTCSeconds(out.getUTCSeconds() + dur.seconds);
  return out;
}

/**
 * @param {Date} d
 * @returns {string} "YYYY-MM-DD" (UTC fields).
 */
function toISODate(d) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/**
 * Parse an ISO 8601 interval expression.
 *
 * @param {string} input  Interval string with exactly one "/" separator.
 * @returns {ParsedInterval}
 * @throws {IntervalError}
 */
export function parseISOInterval(input) {
  if (typeof input !== 'string') {
    throw new IntervalError('input must be a string');
  }
  const trimmed = input.trim();
  if (!trimmed) throw new IntervalError('input is empty');
  const slash = trimmed.indexOf('/');
  if (slash === -1) {
    throw new IntervalError('interval must contain a "/" separator');
  }
  if (trimmed.indexOf('/', slash + 1) !== -1) {
    throw new IntervalError('interval may contain at most one "/"');
  }
  const left = trimmed.slice(0, slash);
  const right = trimmed.slice(slash + 1);

  const leftIsDur = left.startsWith('P');
  const rightIsDur = right.startsWith('P');

  if (leftIsDur && rightIsDur) {
    throw new IntervalError('both sides cannot be durations');
  }

  let startDate;
  let endDate;
  let duration;
  let durationIso;

  if (leftIsDur) {
    duration = parseDuration(left);
    if (!duration) throw new IntervalError(`invalid duration: ${left}`);
    durationIso = left;
    const end = parseDate(right);
    if (!end) throw new IntervalError(`invalid end date: ${right}`);
    endDate = end;
    startDate = new Date(end.getTime());
    startDate.setUTCFullYear(startDate.getUTCFullYear() - duration.years);
    startDate.setUTCMonth(startDate.getUTCMonth() - duration.months);
    if (duration.weeks) startDate.setUTCDate(startDate.getUTCDate() - duration.weeks * 7);
    if (duration.days) startDate.setUTCDate(startDate.getUTCDate() - duration.days);
    if (duration.hours) startDate.setUTCHours(startDate.getUTCHours() - duration.hours);
    if (duration.minutes) startDate.setUTCMinutes(startDate.getUTCMinutes() - duration.minutes);
    if (duration.seconds) startDate.setUTCSeconds(startDate.getUTCSeconds() - duration.seconds);
  } else if (rightIsDur) {
    duration = parseDuration(right);
    if (!duration) throw new IntervalError(`invalid duration: ${right}`);
    durationIso = right;
    const start = parseDate(left);
    if (!start) throw new IntervalError(`invalid start date: ${left}`);
    startDate = start;
    endDate = applyDuration(start, duration);
  } else {
    const start = parseDate(left);
    const end = parseDate(right);
    if (!start) throw new IntervalError(`invalid start date: ${left}`);
    if (!end) throw new IntervalError(`invalid end date: ${right}`);
    startDate = start;
    endDate = end;
    duration = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
    durationIso = null;
  }

  return {
    start: { iso: toISODate(startDate), date: startDate },
    end: { iso: toISODate(endDate), date: endDate },
    duration,
    durationIso,
  };
}
