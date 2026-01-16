# pinewood-derby-scheduler

A minimal TypeScript library for generating lane assignments for pinewood derby races.

## Installation

```bash
npm install pinewood-derby-scheduler
```

## Usage

```typescript
import { schedule } from 'pinewood-derby-scheduler';

// Define your racers (any object shape works)
const racers = [
  { id: 1, name: 'Lightning McQueen' },
  { id: 2, name: 'The King' },
  { id: 3, name: 'Chick Hicks' },
  { id: 4, name: 'Doc Hudson' },
  { id: 5, name: 'Mater' },
  { id: 6, name: 'Sally' },
];

// Generate the schedule
const raceSchedule = schedule(racers, {
  numLanes: 4,      // Number of lanes on your track
  heatsPerRacer: 4, // How many times each racer should race
});

// raceSchedule is a 2D array: [heat][lane]
// Each slot contains a racer object or null (empty lane)

raceSchedule.forEach((heat, heatIndex) => {
  console.log(`Heat ${heatIndex + 1}:`);
  heat.forEach((racer, laneIndex) => {
    const name = racer ? racer.name : '(empty)';
    console.log(`  Lane ${laneIndex + 1}: ${name}`);
  });
});
```

## API

### `schedule<T>(racers: T[], options: ScheduleOptions): Schedule<T>`

Generates a race schedule assigning racers to lanes across multiple heats.

#### Parameters

- `racers` - Array of racer objects (can be any shape)
- `options.numLanes` - Number of lanes on the track (positive integer)
- `options.heatsPerRacer` - Number of heats each racer should participate in (positive integer)

#### Returns

A 2D array where `result[heatIndex][laneIndex]` is either a racer object or `null` (for empty lanes).

#### Throws

- If `racers` is not an array or is empty
- If `numLanes` is not a positive integer
- If `heatsPerRacer` is not a positive integer

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests once (CI mode)
npm run test:run

# Build the library
npm run build

# Start the demo site
npm run site:dev

# Build the demo site
npm run site:build
```

## License

MIT

