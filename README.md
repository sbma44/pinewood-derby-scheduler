# pinewood-derby-scheduler

[![Node.js CI](https://github.com/sbma44/pinewood-derby-scheduler/actions/workflows/node.js.yml/badge.svg)](https://github.com/sbma44/pinewood-derby-scheduler/actions/workflows/node.js.yml)

A lane assignment scheduler for pinewood derby races. Generates fair race schedules that maximize lane diversity and opponent variety.

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

### Prioritizing Opponents Over Lanes

By default, the scheduler prioritizes lane diversity (each racer uses different lanes). You can switch to prioritize opponent diversity instead:

```ts
const raceSchedule = schedule(racers, {
  numLanes: 4,
  heatsPerRacer: 4,
  prioritize: 'opponents', // maximize unique matchups
});
```

## API

### `schedule<T>(racers: T[], options: ScheduleOptions): Schedule<T>`

Generates a race schedule.

**Parameters:**
- `racers` — Array of racer objects (any shape)
- `options.numLanes` — Number of lanes on the track
- `options.heatsPerRacer` — How many heats each racer participates in
- `options.prioritize` — `'lanes'` (default) or `'opponents'`

**Returns:** A 2D array where `result[heatIndex][laneIndex]` is a racer or `null` (empty lane).

## License

MIT
