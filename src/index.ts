/**
 * Options for generating a race schedule.
 */
export interface ScheduleOptions {
  /** Number of lanes on the track */
  numLanes: number;
  /** Number of heats each racer should participate in */
  heatsPerRacer: number;
  /**
   * What to prioritize when scheduling:
   * - 'lanes': Prioritize lane diversity (each racer uses different lanes). Default.
   * - 'opponents': Prioritize opponent diversity (each racer faces different opponents).
   * Both are considered; this controls which gets higher weight.
   */
  prioritize?: 'lanes' | 'opponents';
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
  const { numLanes, heatsPerRacer, prioritize = 'lanes' } = options;

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
  // Each racer can appear in at most 1 slot per heat
  // So we need at least heatsPerRacer heats (for each racer to get all their appearances)
  // And at least ceil(totalSlots / numLanes) heats (to fit all slots)
  const numHeats = Math.max(heatsPerRacer, Math.ceil(totalSlots / numLanes));

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

  // Greedy assignment algorithm:
  // For each heat, select racers that maximize diversity (avoid repeat pairings)
  // Then assign lanes to maximize lane variety per racer

  // Track state for each racer
  const heatsRemaining = new Array(racers.length).fill(heatsPerRacer);
  const lanesUsed: Set<number>[] = racers.map(() => new Set());

  // Track which pairs have raced together (for diversity)
  const racedTogether = new Set<string>();
  const pairKey = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;

  // Build list of available lanes per heat (excluding BYEs)
  const availableLanesPerHeat: number[][] = [];
  for (let heat = 0; heat < numHeats; heat++) {
    const lanes: number[] = [];
    for (let lane = 0; lane < numLanes; lane++) {
      if (!isByeSlot(heat, lane)) {
        lanes.push(lane);
      }
    }
    availableLanesPerHeat.push(lanes);
  }

  // Process each heat
  for (let heat = 0; heat < numHeats; heat++) {
    const slotsInHeat = availableLanesPerHeat[heat].length;
    const selectedRacers: number[] = [];

    // Greedily select racers for this heat
    for (let slot = 0; slot < slotsInHeat; slot++) {
      // Find candidates: racers who still need heats and aren't already in this heat
      const candidates: number[] = [];
      for (let r = 0; r < racers.length; r++) {
        if (heatsRemaining[r] > 0 && !selectedRacers.includes(r)) {
          candidates.push(r);
        }
      }

      if (candidates.length === 0) break;

      // Score each candidate based on priority mode
      // Both lane diversity and opponent diversity are considered; priority changes weights
      let bestCandidate = candidates[0];
      let bestScore = -Infinity;

      // Get available lanes in this heat for lane scoring
      const availableLanesNow = availableLanesPerHeat[heat];

      for (const candidate of candidates) {
        // Opponent diversity score
        let newOpponents = 0;
        let repeatOpponents = 0;
        for (const alreadySelected of selectedRacers) {
          if (racedTogether.has(pairKey(candidate, alreadySelected))) {
            repeatOpponents++;
          } else {
            newOpponents++;
          }
        }

        // Lane diversity score: count how many available lanes are unused by this racer
        let unusedLanesAvailable = 0;
        for (const lane of availableLanesNow) {
          if (!lanesUsed[candidate].has(lane)) {
            unusedLanesAvailable++;
          }
        }
        const hasUnusedLane = unusedLanesAvailable > 0 ? 1 : 0;

        // Calculate score based on priority mode
        let score: number;
        if (prioritize === 'lanes') {
          // Lane priority: heavily weight having an unused lane available
          // Still consider opponents but with lower weight
          score = hasUnusedLane * 1000 + unusedLanesAvailable * 50
                + newOpponents * 5 - repeatOpponents * 20
                + heatsRemaining[candidate];
        } else {
          // Opponent priority: heavily weight new opponents, penalize repeats
          // Still consider lanes but with lower weight
          score = newOpponents * 10 - repeatOpponents * 100
                + hasUnusedLane * 20 + unusedLanesAvailable * 2
                + heatsRemaining[candidate];
        }

        // Tiebreaker: lower racer index for determinism
        if (score > bestScore || (score === bestScore && candidate < bestCandidate)) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      selectedRacers.push(bestCandidate);
      heatsRemaining[bestCandidate]--;
    }

    // Record all pairings from this heat
    for (let i = 0; i < selectedRacers.length; i++) {
      for (let j = i + 1; j < selectedRacers.length; j++) {
        racedTogether.add(pairKey(selectedRacers[i], selectedRacers[j]));
      }
    }

    // Assign lanes with rotation preference
    const availableLanes = [...availableLanesPerHeat[heat]];

    // Sort racers by their preferred lane for stable assignment
    const racerLanePrefs = selectedRacers.map(r => {
      // Preferred lane: next lane this racer hasn't used
      for (let offset = 0; offset < numLanes; offset++) {
        const tryLane = (r + lanesUsed[r].size + offset) % numLanes;
        if (!lanesUsed[r].has(tryLane)) {
          return { racer: r, preferredLane: tryLane };
        }
      }
      // All lanes used, just use rotation
      return { racer: r, preferredLane: (r + lanesUsed[r].size) % numLanes };
    });

    // Sort by preferred lane, then racer index for determinism
    racerLanePrefs.sort((a, b) => {
      if (a.preferredLane !== b.preferredLane) return a.preferredLane - b.preferredLane;
      return a.racer - b.racer;
    });

    for (const { racer, preferredLane } of racerLanePrefs) {
      let assignedLane: number;
      const prefIdx = availableLanes.indexOf(preferredLane);

      if (prefIdx >= 0) {
        assignedLane = preferredLane;
        availableLanes.splice(prefIdx, 1);
      } else if (availableLanes.length > 0) {
        // Find the first available lane this racer hasn't used
        let foundUnused = false;
        for (let i = 0; i < availableLanes.length; i++) {
          if (!lanesUsed[racer].has(availableLanes[i])) {
            assignedLane = availableLanes[i];
            availableLanes.splice(i, 1);
            foundUnused = true;
            break;
          }
        }
        if (!foundUnused) {
          assignedLane = availableLanes.shift()!;
        }
      } else {
        continue; // No lanes available
      }

      result[heat][assignedLane!] = racers[racer];
      lanesUsed[racer].add(assignedLane!);
    }
  }

  return result;
}