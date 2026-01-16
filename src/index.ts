/**
 * Options for generating a race schedule.
 */
export interface ScheduleOptions {
  /** Number of lanes on the track */
  numLanes: number;
  /** Number of heats each racer should participate in */
  heatsPerRacer: number;
}

/**
 * A single heat in the schedule, where each index represents a lane.
 * Contains the racer object or null if the lane is empty.
 */
export type Heat<T> = (T | null)[];

/**
 * The complete race schedule as a 2D array.
 * First dimension is heats, second dimension is lanes.
 */
export type Schedule<T> = Heat<T>[];

/**
 * Generates a race schedule assigning racers to lanes across multiple heats.
 *
 * @param racers - Array of racer objects (can be any shape)
 * @param options - Scheduling options (numLanes, heatsPerRacer)
 * @returns A 2D array where result[heatIndex][laneIndex] is a racer or null
 * @throws Error if inputs are invalid (e.g., numLanes < 1, empty racers)
 *
 * @example
 * ```ts
 * const racers = [{ id: 1, name: 'Car A' }, { id: 2, name: 'Car B' }];
 * const schedule = schedule(racers, { numLanes: 4, heatsPerRacer: 3 });
 * // schedule[0] is the first heat: [racer, racer, null, null]
 * ```
 */
export function schedule<T>(racers: T[], options: ScheduleOptions): Schedule<T> {
  const { numLanes, heatsPerRacer } = options;

  // Input validation
  if (!Array.isArray(racers)) {
    throw new Error('racers must be an array');
  }
  if (racers.length === 0) {
    throw new Error('racers array cannot be empty');
  }
  if (!Number.isInteger(numLanes) || numLanes < 1) {
    throw new Error('numLanes must be a positive integer');
  }
  if (!Number.isInteger(heatsPerRacer) || heatsPerRacer < 1) {
    throw new Error('heatsPerRacer must be a positive integer');
  }

  const totalSlots = racers.length * heatsPerRacer;
  const numHeats = Math.ceil(totalSlots / numLanes);

  const result: Schedule<T> = [];
  for (let i = 0; i < numHeats; i++) {
    const heat: Heat<T> = new Array(numLanes).fill(null);
    result.push(heat);
  }

  // Calculate necessary BYEs and track them separately (not in result array)
  const necessaryByes = (numHeats * numLanes) - totalSlots;
  const byeSlots = new Set<string>(); // Track "heat,lane" keys for BYE positions

  // Helper to get lane indices in priority order: outermost (0, last), then inward.
  function getLanePriority(n: number): number[] {
    const priority: number[] = [];
    let left = 0, right = n - 1;
    while (left <= right) {
      if (left === right) {
        priority.push(left);
      } else {
        priority.push(left, right);
      }
      left++;
      right--;
    }
    return priority;
  }

  // Place BYEs in outer lanes of later heats for balance
  const laneLeft = 0;
  const laneRight = numLanes - 1;
  let leftByes = 0, rightByes = 0;

  let heatIdx = result.length - 1;
  let byesPlaced = 0;
  const laneOrder = getLanePriority(numLanes);

  while (byesPlaced < necessaryByes) {
    // Find which edge (left or right) has fewer BYEs so far
    let chooseEdge: number;
    if (leftByes < rightByes) {
      chooseEdge = laneLeft;
    } else if (rightByes < leftByes) {
      chooseEdge = laneRight;
    } else {
      chooseEdge = (byesPlaced % 2 === 0) ? laneLeft : laneRight;
    }

    // Try assigning on the chosen edge; fallback inward if needed
    let assigned = false;
    for (const idx of laneOrder) {
      if ((chooseEdge === laneLeft && idx !== laneLeft) ||
          (chooseEdge === laneRight && idx !== laneRight)) {
        continue;
      }
      const key = `${heatIdx},${idx}`;
      if (!byeSlots.has(key)) {
        byeSlots.add(key);
        if (idx === laneLeft) leftByes++;
        if (idx === laneRight) rightByes++;
        byesPlaced++;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      for (const idx of laneOrder) {
        const key = `${heatIdx},${idx}`;
        if (!byeSlots.has(key)) {
          byeSlots.add(key);
          if (idx === laneLeft) leftByes++;
          if (idx === laneRight) rightByes++;
          byesPlaced++;
          assigned = true;
          break;
        }
      }
    }

    heatIdx--;
    if (heatIdx < 0) heatIdx = result.length - 1;
  }

  // Helper to check if a slot is a BYE
  const isByeSlot = (heat: number, lane: number) => byeSlots.has(`${heat},${lane}`);


  // Two-phase assignment:
  // Phase 1: Determine (heat, position) for each (racer, round) using round-major order
  // Phase 2: Assign lanes within each heat to maximize lane rotation

  // Build list of available slots per heat (excluding BYEs)
  const heatSlots: number[][] = Array.from({ length: numHeats }, () => []);
  for (let heat = 0; heat < numHeats; heat++) {
    for (let lane = 0; lane < numLanes; lane++) {
      if (!isByeSlot(heat, lane)) {
        heatSlots[heat].push(lane);
      }
    }
  }

  // Phase 1: Collect which racers go in which heat
  const heatAssignments: { racer: number; round: number }[][] = Array.from(
    { length: numHeats },
    () => []
  );

  let slotIdx = 0;
  for (let h = 0; h < heatsPerRacer; h++) {
    for (let r = 0; r < racers.length; r++) {
      // Find which heat this slot belongs to
      let cumulative = 0;
      for (let heat = 0; heat < numHeats; heat++) {
        cumulative += heatSlots[heat].length;
        if (slotIdx < cumulative) {
          heatAssignments[heat].push({ racer: r, round: h });
          break;
        }
      }
      slotIdx++;
    }
  }

  // Phase 2: Assign lanes within each heat with rotation
  for (let heat = 0; heat < numHeats; heat++) {
    const assignments = heatAssignments[heat];
    const availableLanes = [...heatSlots[heat]];

    // Sort by target lane to minimize conflicts (stable sort by including racer as tiebreaker)
    assignments.sort((a, b) => {
      const laneA = (a.racer + a.round) % numLanes;
      const laneB = (b.racer + b.round) % numLanes;
      if (laneA !== laneB) return laneA - laneB;
      return a.racer - b.racer; // Stable tiebreaker
    });

    for (const { racer, round } of assignments) {
      const targetLane = (racer + round) % numLanes;

      // Try to use target lane if available
      let assignedLane: number;
      const targetIdx = availableLanes.indexOf(targetLane);
      if (targetIdx >= 0) {
        assignedLane = targetLane;
        availableLanes.splice(targetIdx, 1);
      } else if (availableLanes.length > 0) {
        // Use first available lane
        assignedLane = availableLanes.shift()!;
      } else {
        continue; // No lanes available (shouldn't happen)
      }

      result[heat][assignedLane] = racers[racer];
    }
  }

  return result;
}

