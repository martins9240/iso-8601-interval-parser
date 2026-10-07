import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseISOInterval, IntervalError } from '../src/index.js';

test('start/duration form yields start, end, and duration', () => {
  const r = parseISOInterval('2024-01-01/P1M');
  assert.equal(r.start.iso, '2024-01-01');
  assert.equal(r.end.iso, '2024-02-01');
  assert.deepEqual(r.duration, {
    years: 0, months: 1, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0,
  });
  assert.equal(r.durationIso, 'P1M');
});

test('duration/end form computes start from end', () => {
  const r = parseISOInterval('P1Y2M/2024-12-31');
  assert.equal(r.end.iso, '2024-12-31');
  assert.equal(r.start.iso, '2023-10-31');
  assert.equal(r.duration.years, 1);
  assert.equal(r.duration.months, 2);
});

test('explicit start/end form produces zero duration with null iso', () => {
  const r = parseISOInterval('2024-01-01/2024-12-31');
  assert.equal(r.start.iso, '2024-01-01');
  assert.equal(r.end.iso, '2024-12-31');
  assert.equal(r.durationIso, null);
  assert.equal(r.duration.months, 0);
});

test('multi-component duration parses each unit', () => {
  const r = parseISOInterval('2024-01-01/P1Y2M3W4D');
  assert.equal(r.start.iso, '2024-01-01');
  assert.equal(r.end.iso, '2025-03-26');
  assert.equal(r.duration.years, 1);
  assert.equal(r.duration.months, 2);
  assert.equal(r.duration.weeks, 3);
  assert.equal(r.duration.days, 4);
});

test('time portion of duration advances the date across midnight', () => {
  const r = parseISOInterval('2024-01-01/PT25H');
  assert.equal(r.start.iso, '2024-01-01');
  assert.equal(r.end.iso, '2024-01-02');
  assert.equal(r.duration.hours, 25);
});

test('weeks-only duration works', () => {
  const r = parseISOInterval('P2W/2024-01-15');
  assert.equal(r.end.iso, '2024-01-15');
  assert.equal(r.start.iso, '2024-01-01');
  assert.equal(r.duration.weeks, 2);
});

test('month rollover: Jan 31 + 1M = Mar 2 (JS rollover)', () => {
  const r = parseISOInterval('2024-01-31/P1M');
  assert.equal(r.end.iso, '2024-03-02');
});

test('leap year: 2024-02-29 + P1Y = 2025-03-01', () => {
  const r = parseISOInterval('2024-02-29/P1Y');
  assert.equal(r.end.iso, '2025-03-01');
});

test('zero duration P0D keeps the same date', () => {
  const r = parseISOInterval('2024-06-15/P0D');
  assert.equal(r.start.iso, '2024-06-15');
  assert.equal(r.end.iso, '2024-06-15');
});

test('invalid duration raises IntervalError', () => {
  assert.throws(() => parseISOInterval('2024-01-01/X1M'), IntervalError);
});

test('invalid date raises IntervalError', () => {
  assert.throws(() => parseISOInterval('not-a-date/P1M'), IntervalError);
});

test('out-of-range date (Feb 30) raises IntervalError', () => {
  assert.throws(() => parseISOInterval('2024-02-30/P1D'), IntervalError);
});

test('missing separator raises IntervalError', () => {
  assert.throws(() => parseISOInterval('P1M'), IntervalError);
});

test('both sides durations raises IntervalError', () => {
  assert.throws(() => parseISOInterval('P1M/P1M'), IntervalError);
});
