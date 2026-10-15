# ISO 8601 Interval Parser

Parses ISO 8601 interval expressions like `2024-01-01/P1M` and `P1Y2M/2024-12-31` into structured start, end, and duration components. Zero runtime dependencies, ESM-only.

## Usage

```js
import { parseISOInterval } from './src/index.js';

const interval = parseISOInterval('2024-01-01/P1M');
console.log(interval.start.iso);   // "2024-01-01"
console.log(interval.end.iso);     // "2024-02-01"
console.log(interval.duration);    // { years:0, months:1, weeks:0, days:0, hours:0, minutes:0, seconds:0 }
console.log(interval.durationIso); // "P1M"
```

`parseISOInterval(input)` returns an object with:

- `start` — `{ iso: string, date: Date }` where `iso` is `YYYY-MM-DD` (UTC) and `date` is a JS Date at UTC midnight.
- `end` — same shape as `start`.
- `duration` — `{ years, months, weeks, days, hours, minutes, seconds }` numeric breakdown. All zero when the interval was given as `<start>/<end>`.
- `durationIso` — the original ISO duration string, or `null` when no duration was supplied.

It throws `IntervalError` (also exported) on malformed input.

## Supported forms

- `<start>/<duration>` — e.g. `2024-01-01/P1M`
- `<duration>/<end>` — e.g. `P1Y2M/2024-12-31`
- `<start>/<end>` — e.g. `2024-01-01/2024-12-31`

Durations follow `P[n]Y[n]M[n]W[n]D[T[n]H[n]M[n]S]`. `P0D` and `P` are accepted as zero durations.

## Why this exists

The use case is serialising and deserialising billing and reporting periods that arrive as ISO 8601 intervals. The trade-off: rather than pulling in a full date-time library (and its transitive deps), this module uses the ECMAScript `Date` for calendar arithmetic and accepts whatever rollover semantics the runtime provides.

## The awkward edge

Adding a month to `2024-01-31` yields `2024-03-02` because JavaScript's `Date.setUTCMonth` rolls overflowing days into the following month. This is the documented, tested behaviour — it matches what a naïve `new Date()` computation does, which is exactly what consumers of this library were doing by hand before. If you need calendar-correct "end of month" semantics, this is not the right library.

Out of scope: recurring intervals (`R/...`), week-only dates (`2024-W01`), ordinal dates (`2024-001`), and time-only endpoints. Two explicit endpoints must both be `YYYY-MM-DD`.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

