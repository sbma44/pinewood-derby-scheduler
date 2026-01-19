# pinewood-derby-scheduler

[![Node.js CI](https://github.com/sbma44/pinewood-derby-scheduler/actions/workflows/node.js.yml/badge.svg)](https://github.com/sbma44/pinewood-derby-scheduler/actions/workflows/node.js.yml)

A lane assignment scheduler for pinewood derby races. Generates fair race schedules that optimize for lane diversity, opponent variety, and fast race setup.

Live demo: [https://pinewood.tomlee.space](https://pinewood.tomlee.space/)

## Installation

```bash
npm install pinewood-derby-scheduler
```

## Usage

```ts
import { schedule } from 'pinewood-derby-scheduler';

// Define your racers (can be any shape)
const racers = [
  { id: 1, name: 'Lightning' },
  { id: 2, name: 'Thunder' },
  { id: 3, name: 'Rocket' },
  { id: 4, name: 'Blaze' },
  { id: 5, name: 'Storm' },
];

// Generate a schedule
const raceSchedule = schedule(racers, {
  numLanes: 4,      // 4-lane track
  heatsPerRacer: 3, // each car races 3 times
});

// raceSchedule is a 2D array: [heat][lane]
raceSchedule.forEach((heat, i) => {
  console.log(`Heat ${i + 1}:`, heat.map(r => r?.name ?? '(empty)'));
});
```

## Scheduling Criteria

The scheduler optimizes for three criteria, which you can prioritize in any order:

| Criterion | Description |
|-----------|-------------|
| `'lanes'` | **Lane diversity** — Each racer uses different lanes across their heats |
| `'opponents'` | **Opponent diversity** — Each racer faces different opponents |
| `'turnover'` | **Turnover** — Minimize cars appearing in consecutive heats (faster race setup) |

### Setting Priorities

Pass an array to `prioritize` to control the relative importance of each criterion. The first item has highest priority:

```ts
// Prioritize fast race setup, then opponent variety, then lane diversity
const raceSchedule = schedule(racers, {
  numLanes: 4,
  heatsPerRacer: 4,
  prioritize: ['turnover', 'opponents', 'lanes'],
});
```

```ts
// Prioritize lane diversity (default behavior)
const raceSchedule = schedule(racers, {
  numLanes: 4,
  heatsPerRacer: 4,
  prioritize: ['lanes', 'opponents', 'turnover'],
});
```

```ts
// Prioritize opponent variety above all else
const raceSchedule = schedule(racers, {
  numLanes: 4,
  heatsPerRacer: 4,
  prioritize: ['opponents', 'lanes', 'turnover'],
});
```

All three criteria are always considered; the priority order controls their relative weights (first = 1000, second = 100, third = 10).

### Backward Compatibility

The old single-string format still works:

```ts
// These are equivalent:
prioritize: 'lanes'
prioritize: ['lanes', 'opponents', 'turnover']

// These are equivalent:
prioritize: 'opponents'
prioritize: ['opponents', 'lanes', 'turnover']
```

## API

### `schedule<T>(racers: T[], options: ScheduleOptions): Schedule<T>`

Generates a race schedule.

**Parameters:**
- `racers` — Array of racer objects (any shape)
- `options.numLanes` — Number of lanes on the track
- `options.heatsPerRacer` — How many heats each racer participates in
- `options.prioritize` — Priority order for scheduling criteria
  - Single criterion: `'lanes'` | `'opponents'` (backward compatible)
  - Array of criteria: `['lanes', 'opponents', 'turnover']` (any order)
  - Default: `['lanes', 'opponents', 'turnover']`

**Returns:** A 2D array where `result[heatIndex][laneIndex]` is a racer or `null` (empty lane).

### Types

```ts
type ScheduleCriterion = 'lanes' | 'opponents' | 'turnover';

interface ScheduleOptions {
  numLanes: number;
  heatsPerRacer: number;
  prioritize?: ScheduleCriterion | ScheduleCriterion[];
}

type Heat<T> = (T | null)[];
type Schedule<T> = Heat<T>[];
```

## License

MIT
