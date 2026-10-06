/**
 * Public API entry point for the ISO 8601 interval parser.
 *
 * Exports a single function, `parseISOInterval`, and a companion
 * `IntervalError` for callers who want to branch on parser failures.
 */
export { parseISOInterval, IntervalError } from './core.js';
