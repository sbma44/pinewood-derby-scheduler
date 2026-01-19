/**
 * Scheduling criteria that can be prioritized.
 * - 'lanes': Lane diversity (each racer uses different lanes)
 * - 'opponents': Opponent diversity (each racer faces different opponents)
 * - 'turnover': Minimize cars appearing in consecutive heats (faster race setup)
 */
export type ScheduleCriterion = 'lanes' | 'opponents' | 'turnover';

/**
 * Options for generating a race schedule.
 */
export interface ScheduleOptions {
  /** Number of lanes on the track */
  numLanes: number;
  /** Number of heats each racer should participate in */
  heatsPerRacer: number;
  /**
   * Priority ordering for scheduling criteria.
   * Can be specified as:
   * - A single criterion string (backward compatible): 'lanes' | 'opponents'
   * - An array of criteria in priority order (first = highest priority)
   *
   * Default: ['lanes', 'turnover', 'opponents']
   *
   * All criteria are always considered; this controls their relative weights.
   * First criterion gets weight 1000, second gets 100, third gets 10.
   *
   * @example
   * // Prioritize turnover (fast setup), then opponents, then lanes
   * prioritize: ['turnover', 'opponents', 'lanes']
   */
  prioritize?: ScheduleCriterion | ScheduleCriterion[];
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
  const { numLanes, heatsPerRacer, prioritize = ['lanes', 'turnover', 'opponents'] } = options;

  // Normalize prioritize to an array and calculate weights
  const priorityList: ScheduleCriterion[] = Array.isArray(prioritize)
    ? prioritize
    : prioritize === 'lanes'
      ? ['lanes', 'turnover', 'opponents']
      : ['opponents', 'turnover', 'lanes'];

  // Calculate weights based on priority order: first=1000, second=100, third=10
  const weights: Record<ScheduleCriterion, number> = { lanes: 1, opponents: 1, turnover: 1 };
  const weightValues = [1000, 100, 10];
  for (let i = 0; i < priorityList.length; i++) {
    weights[priorityList[i]] = weightValues[i] ?? 1;
  }
  // Assign minimal weight to any criteria not in the list
  const allCriteria: ScheduleCriterion[] = ['lanes', 'opponents', 'turnover'];
  for (const criterion of allCriteria) {
    if (!priorityList.includes(criterion)) {
      weights[criterion] = 1;
    }
  }

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

  // Lane-by-lane greedy assignment algorithm:
  // For each heat, fill each lane one at a time, selecting the best candidate
  // for that specific lane. This makes priority settings directly control outcomes.

  // Track state for each racer
  const heatsRemaining = new Array(racers.length).fill(heatsPerRacer);
  const lanesUsed: Set<number>[] = racers.map(() => new Set());

  // Track which pairs have raced together (for opponent diversity)
  const racedTogether = new Set<string>();
  const pairKey = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;

  // Track racers in the previous heat (for turnover optimization)
  let previousHeatRacers = new Set<number>();

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
    const lanesInHeat = availableLanesPerHeat[heat];
    const racersInThisHeat: number[] = []; // Track who's been assigned to this heat

    // Rotate the lane fill order each heat for fairness
    // This ensures no lane consistently gets "first pick" of candidates
    const laneOrder = [...lanesInHeat];
    for (let i = 0; i < heat % lanesInHeat.length; i++) {
      laneOrder.push(laneOrder.shift()!);
    }

    // Fill each lane one at a time
    for (const lane of laneOrder) {
      // Find candidates: racers who still need heats and aren't already in this heat
      const candidates: number[] = [];
      for (let r = 0; r < racers.length; r++) {
        if (heatsRemaining[r] > 0 && !racersInThisHeat.includes(r)) {
          candidates.push(r);
        }
      }

      if (candidates.length === 0) break;

      // Score each candidate for THIS specific lane
      let bestCandidate = candidates[0];
      let bestScore = -Infinity;

      for (const candidate of candidates) {
        // Lane diversity score: has this racer used THIS specific lane before?
        const hasUsedThisLane = lanesUsed[candidate].has(lane);
        const laneScore = hasUsedThisLane ? 0 : 10;

        // Opponent diversity score: how many new vs repeat opponents?
        let newOpponents = 0;
        let repeatOpponents = 0;
        for (const alreadyInHeat of racersInThisHeat) {
          if (racedTogether.has(pairKey(candidate, alreadyInHeat))) {
            repeatOpponents++;
          } else {
            newOpponents++;
          }
        }
        const opponentScore = newOpponents * 2 - repeatOpponents * 5;

        // Turnover score: reward candidates NOT in previous heat (faster setup)
        const wasInPreviousHeat = previousHeatRacers.has(candidate);
        const turnoverScore = wasInPreviousHeat ? -1 : 1;

        // Calculate weighted score based on priority
        const weightedLaneScore = laneScore * weights.lanes;
        const weightedOpponentScore = opponentScore * weights.opponents;
        const weightedTurnoverScore = turnoverScore * weights.turnover;

        // Combine scores with a small tiebreaker for heatsRemaining (prefer those who need more heats)
        const score = weightedLaneScore + weightedOpponentScore + weightedTurnoverScore
                    + heatsRemaining[candidate] * 0.1;

        // Tiebreaker: lower racer index for determinism
        if (score > bestScore || (score === bestScore && candidate < bestCandidate)) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      // Assign the best candidate to this lane
      result[heat][lane] = racers[bestCandidate];
      racersInThisHeat.push(bestCandidate);
      heatsRemaining[bestCandidate]--;
      lanesUsed[bestCandidate].add(lane);
    }

    // Record all pairings from this heat (for opponent diversity tracking)
    for (let i = 0; i < racersInThisHeat.length; i++) {
      for (let j = i + 1; j < racersInThisHeat.length; j++) {
        racedTogether.add(pairKey(racersInThisHeat[i], racersInThisHeat[j]));
      }
    }

    // Update previous heat racers for turnover tracking
    previousHeatRacers = new Set(racersInThisHeat);
  }

  return result;
}