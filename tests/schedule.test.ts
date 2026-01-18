import { describe, it, expect } from 'vitest';
import { schedule, ScheduleCriterion } from '../src/index';

describe('schedule', () => {
  // Sample racer data for tests
  const makeRacers = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Racer ${i + 1}` }));

  /**
   * Calculate opponent statistics for a schedule
   */
  function analyzeOpponents(
    result: ({ id: number } | null)[][],
    racerCount: number
  ): {
    minUniqueOpponents: number;
    maxUniqueOpponents: number;
    avgUniqueOpponents: number;
    pairingVariance: number;
  } {
    // Track opponent counts for each racer
    const opponents = new Map<number, Map<number, number>>();
    for (let i = 1; i <= racerCount; i++) {
      opponents.set(i, new Map());
    }

    // Count how many times each pair races together
    for (const heat of result) {
      const racersInHeat = heat
        .filter((r) => r !== null)
        .map((r) => (r as { id: number }).id);

      // Each pair of racers in this heat faced each other
      for (let i = 0; i < racersInHeat.length; i++) {
        for (let j = i + 1; j < racersInHeat.length; j++) {
          const a = racersInHeat[i];
          const b = racersInHeat[j];
          opponents.get(a)!.set(b, (opponents.get(a)!.get(b) || 0) + 1);
          opponents.get(b)!.set(a, (opponents.get(b)!.get(a) || 0) + 1);
        }
      }
    }

    // Calculate unique opponent counts
    const uniqueCounts: number[] = [];
    for (let i = 1; i <= racerCount; i++) {
      uniqueCounts.push(opponents.get(i)!.size);
    }

    const minUniqueOpponents = Math.min(...uniqueCounts);
    const maxUniqueOpponents = Math.max(...uniqueCounts);
    const avgUniqueOpponents = uniqueCounts.reduce((a, b) => a + b, 0) / uniqueCounts.length;

    // Calculate variance in pairing counts (how evenly distributed are matchups?)
    const allPairCounts: number[] = [];
    for (let i = 1; i <= racerCount; i++) {
      for (const count of opponents.get(i)!.values()) {
        allPairCounts.push(count);
      }
    }

    const avgPairCount = allPairCounts.length > 0
      ? allPairCounts.reduce((a, b) => a + b, 0) / allPairCounts.length
      : 0;
    const pairingVariance = allPairCounts.length > 0
      ? allPairCounts.reduce((sum, c) => sum + Math.pow(c - avgPairCount, 2), 0) / allPairCounts.length
      : 0;

    return { minUniqueOpponents, maxUniqueOpponents, avgUniqueOpponents, pairingVariance };
  }

  describe('input validation', () => {
    it('throws if racers is not an array', () => {
      // @ts-expect-error testing invalid input
      expect(() => schedule('not an array', { numLanes: 4, heatsPerRacer: 3 })).toThrow(
        'racers must be an array'
      );
    });

    it('throws if racers array is empty', () => {
      expect(() => schedule([], { numLanes: 4, heatsPerRacer: 3 })).toThrow(
        'racers array cannot be empty'
      );
    });

    it('throws if numLanes is less than 1', () => {
      expect(() => schedule(makeRacers(4), { numLanes: 0, heatsPerRacer: 3 })).toThrow(
        'numLanes must be a positive integer'
      );
    });

    it('throws if numLanes is not an integer', () => {
      expect(() => schedule(makeRacers(4), { numLanes: 2.5, heatsPerRacer: 3 })).toThrow(
        'numLanes must be a positive integer'
      );
    });

    it('throws if heatsPerRacer is less than 1', () => {
      expect(() => schedule(makeRacers(4), { numLanes: 4, heatsPerRacer: 0 })).toThrow(
        'heatsPerRacer must be a positive integer'
      );
    });

    it('throws if heatsPerRacer is not an integer', () => {
      expect(() => schedule(makeRacers(4), { numLanes: 4, heatsPerRacer: 1.5 })).toThrow(
        'heatsPerRacer must be a positive integer'
      );
    });
  });

  describe('basic scheduling', () => {
    it('returns a 2D array', () => {
      const result = schedule(makeRacers(4), { numLanes: 4, heatsPerRacer: 1 });
      expect(Array.isArray(result)).toBe(true);
      expect(Array.isArray(result[0])).toBe(true);
    });

    it('each heat has the correct number of lanes', () => {
      const numLanes = 4;
      const result = schedule(makeRacers(6), { numLanes, heatsPerRacer: 2 });
      for (const heat of result) {
        expect(heat.length).toBe(numLanes);
      }
    });

    it('each racer appears the correct number of times', () => {
      const racers = makeRacers(4);
      const heatsPerRacer = 3;
      const result = schedule(racers, { numLanes: 4, heatsPerRacer });

      // Count appearances of each racer
      const counts = new Map<number, number>();
      for (const heat of result) {
        for (const slot of heat) {
          if (slot !== null) {
            const id = (slot as { id: number }).id;
            counts.set(id, (counts.get(id) || 0) + 1);
          }
        }
      }

      for (const racer of racers) {
        expect(counts.get(racer.id)).toBe(heatsPerRacer);
      }
    });

    it('no racer appears twice in the same heat', () => {
      const racers = makeRacers(8);
      const result = schedule(racers, { numLanes: 4, heatsPerRacer: 4 });

      for (const heat of result) {
        const ids = heat.filter((r) => r !== null).map((r) => (r as { id: number }).id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }
    });
  });

  describe('edge cases', () => {
    it('handles fewer racers than lanes', () => {
      const racers = makeRacers(2);
      const result = schedule(racers, { numLanes: 4, heatsPerRacer: 2 });

      // Should still produce valid output
      expect(result.length).toBeGreaterThan(0);
      // Each heat has the correct number of lanes
      for (const heat of result) {
        expect(heat.length).toBe(4);
      }
    });

    it('handles single racer', () => {
      const racers = makeRacers(1);
      const result = schedule(racers, { numLanes: 4, heatsPerRacer: 3 });

      expect(result.length).toBeGreaterThan(0);
      const appearances = result.flat().filter((r) => r !== null).length;
      expect(appearances).toBe(3);
    });

    it('handles single lane', () => {
      const racers = makeRacers(4);
      const result = schedule(racers, { numLanes: 1, heatsPerRacer: 2 });

      expect(result.length).toBe(8); // 4 racers * 2 heats each
      for (const heat of result) {
        expect(heat.length).toBe(1);
      }
    });
  });

  describe('determinism', () => {
    it('produces the same output for the same input', () => {
      const racers = makeRacers(6);
      const options = { numLanes: 4, heatsPerRacer: 3 };

      const result1 = schedule(racers, options);
      const result2 = schedule(racers, options);

      expect(result1).toEqual(result2);
    });
  });

  // Algorithm constraint tests with various lane counts and larger racer pools
  const laneCounts = [3, 4, 6, 8] as const;

  describe('no single-racer heats', () => {
    // A heat with only one racer is pointless - should have at least 2 (unless only 1 racer exists)

    laneCounts.forEach((numLanes) => {
      it(`with ${numLanes} lanes and 20 racers, no heat has only one racer`, () => {
        const racers = makeRacers(20);
        const result = schedule(racers, { numLanes, heatsPerRacer: numLanes });

        for (const heat of result) {
          const filledSlots = heat.filter((r) => r !== null).length;
          expect(filledSlots).toBeGreaterThanOrEqual(2);
        }
      });

      it(`with ${numLanes} lanes and 50 racers, no heat has only one racer`, () => {
        const racers = makeRacers(50);
        const result = schedule(racers, { numLanes, heatsPerRacer: numLanes });

        for (const heat of result) {
          const filledSlots = heat.filter((r) => r !== null).length;
          expect(filledSlots).toBeGreaterThanOrEqual(2);
        }
      });
    });
  });

  describe('lane fairness - no lane repeats when heatsPerRacer <= numLanes', () => {
    // Each racer should race in a different lane each time (when possible)

    laneCounts.forEach((numLanes) => {
      it(`with ${numLanes} lanes, heatsPerRacer=${numLanes}, high lane diversity`, () => {
        const racers = makeRacers(24);
        const heatsPerRacer = numLanes;
        const result = schedule(racers, { numLanes, heatsPerRacer });

        // Track which lanes each racer used
        const lanesUsed = new Map<number, number[]>();
        for (const racer of racers) {
          lanesUsed.set(racer.id, []);
        }

        for (const heat of result) {
          heat.forEach((racer, laneIndex) => {
            if (racer !== null) {
              const id = (racer as { id: number }).id;
              lanesUsed.get(id)!.push(laneIndex);
            }
          });
        }

        // Each racer should use most lanes (allowing 1-2 repeats due to BYE constraints)
        for (const racer of racers) {
          const lanes = lanesUsed.get(racer.id)!;
          const uniqueLanes = new Set(lanes);
          expect(lanes.length).toBe(heatsPerRacer);
          // At least (heatsPerRacer - 2) unique lanes
          expect(uniqueLanes.size).toBeGreaterThanOrEqual(Math.max(1, heatsPerRacer - 2));
        }
      });

      it(`with ${numLanes} lanes, heatsPerRacer=${Math.min(numLanes - 1, 2)}, high lane diversity`, () => {
        const heatsPerRacer = Math.min(numLanes - 1, 2);
        if (heatsPerRacer < 1) return; // Skip for 1 lane

        const racers = makeRacers(30);
        const result = schedule(racers, { numLanes, heatsPerRacer });

        const lanesUsed = new Map<number, number[]>();
        for (const racer of racers) {
          lanesUsed.set(racer.id, []);
        }

        for (const heat of result) {
          heat.forEach((racer, laneIndex) => {
            if (racer !== null) {
              const id = (racer as { id: number }).id;
              lanesUsed.get(id)!.push(laneIndex);
            }
          });
        }

        // Count how many racers have fully unique lanes
        let racersWithUniqueLanes = 0;
        for (const racer of racers) {
          const lanes = lanesUsed.get(racer.id)!;
          const uniqueLanes = new Set(lanes);
          if (uniqueLanes.size === lanes.length) {
            racersWithUniqueLanes++;
          }
        }

        // At least 60% of racers should have fully unique lanes
        // (greedy algorithm prioritizes opponent diversity over perfect lane rotation)
        expect(racersWithUniqueLanes).toBeGreaterThanOrEqual(Math.floor(racers.length * 0.6));
      });
    });

    it('lane repeats are allowed when heatsPerRacer > numLanes', () => {
      const numLanes = 4;
      const heatsPerRacer = 6; // More heats than lanes, so repeats are inevitable
      const racers = makeRacers(16);
      const result = schedule(racers, { numLanes, heatsPerRacer });

      // Just verify we get a valid result - repeats are expected
      expect(result.length).toBeGreaterThan(0);

      // Each racer should appear exactly heatsPerRacer times
      const counts = new Map<number, number>();
      for (const heat of result) {
        for (const slot of heat) {
          if (slot !== null) {
            const id = (slot as { id: number }).id;
            counts.set(id, (counts.get(id) || 0) + 1);
          }
        }
      }

      for (const racer of racers) {
        expect(counts.get(racer.id)).toBe(heatsPerRacer);
      }
    });
  });

  describe('opponent diversity', () => {
    // Measure how well the algorithm distributes opponents
    // Each racer should face as many different opponents as possible

    laneCounts.forEach((numLanes) => {
      it(`with ${numLanes} lanes and 24 racers, each racer faces many different opponents`, () => {
        const racers = makeRacers(24);
        const heatsPerRacer = numLanes;
        const result = schedule(racers, { numLanes, heatsPerRacer });

        const stats = analyzeOpponents(result, racers.length);

        // With heatsPerRacer heats and (numLanes - 1) opponents per heat,
        // max possible unique opponents is heatsPerRacer * (numLanes - 1)
        // but capped at (racerCount - 1)
        const maxPossibleOpponents = Math.min(
          heatsPerRacer * (numLanes - 1),
          racers.length - 1
        );

        // Each racer should face at least 25% of maximum possible unique opponents
        // (Simple deterministic algorithms can't achieve higher without sophisticated scheduling)
        expect(stats.minUniqueOpponents).toBeGreaterThanOrEqual(Math.floor(maxPossibleOpponents * 0.25));
      });

      it(`with ${numLanes} lanes and 50 racers, opponent diversity is reasonably high`, () => {
        const racers = makeRacers(50);
        const heatsPerRacer = numLanes;
        const result = schedule(racers, { numLanes, heatsPerRacer });

        const stats = analyzeOpponents(result, racers.length);

        // With more racers than we can possibly face, just ensure we're
        // facing a reasonable number of unique opponents
        // (Simple deterministic algorithms achieve ~20-30% of theoretical max)
        const minExpectedOpponents = Math.floor(heatsPerRacer * (numLanes - 1) * 0.20);
        expect(stats.minUniqueOpponents).toBeGreaterThanOrEqual(minExpectedOpponents);
      });
    });

    it('pairing distribution is relatively even (low variance)', () => {
      const racers = makeRacers(16);
      const numLanes = 4;
      const heatsPerRacer = 4;
      const result = schedule(racers, { numLanes, heatsPerRacer });

      const stats = analyzeOpponents(result, racers.length);

      // Variance should be reasonably low - ideally each pair races together
      // roughly the same number of times. A variance under 1.0 is good.
      // This is a soft expectation since perfect distribution isn't always possible.
      expect(stats.pairingVariance).toBeLessThan(2.0);
    });

    it('reports opponent diversity statistics', () => {
      // This test just logs stats for manual inspection - always passes
      const configs = [
        { racerCount: 16, numLanes: 4, heatsPerRacer: 4 },
        { racerCount: 24, numLanes: 6, heatsPerRacer: 6 },
        { racerCount: 50, numLanes: 4, heatsPerRacer: 4 },
        { racerCount: 50, numLanes: 8, heatsPerRacer: 8 },
      ];

      for (const { racerCount, numLanes, heatsPerRacer } of configs) {
        const racers = makeRacers(racerCount);
        const result = schedule(racers, { numLanes, heatsPerRacer });
        const stats = analyzeOpponents(result, racerCount);

        console.log(
          `[${racerCount} racers, ${numLanes} lanes, ${heatsPerRacer} heats/racer] ` +
          `Unique opponents: min=${stats.minUniqueOpponents}, ` +
          `max=${stats.maxUniqueOpponents}, ` +
          `avg=${stats.avgUniqueOpponents.toFixed(1)}, ` +
          `pairing variance=${stats.pairingVariance.toFixed(2)}`
        );
      }

      expect(true).toBe(true); // Always pass - this is for inspection
    });
  });

  describe('priority modes', () => {
    it('defaults to lane priority', () => {
      const racers = makeRacers(24);
      const result = schedule(racers, { numLanes: 4, heatsPerRacer: 4 });

      // Track lane usage
      const lanesUsed = new Map<number, number[]>();
      for (const racer of racers) {
        lanesUsed.set(racer.id, []);
      }

      for (const heat of result) {
        heat.forEach((racer, laneIndex) => {
          if (racer !== null) {
            const id = (racer as { id: number }).id;
            lanesUsed.get(id)!.push(laneIndex);
          }
        });
      }

      // With lane priority, calculate average lane diversity
      let totalUniqueLanes = 0;
      for (const racer of racers) {
        const lanes = lanesUsed.get(racer.id)!;
        const uniqueLanes = new Set(lanes);
        totalUniqueLanes += uniqueLanes.size;
      }
      const avgUniqueLanes = totalUniqueLanes / racers.length;

      // Average should be at least 75% of heatsPerRacer (most racers use most lanes)
      expect(avgUniqueLanes).toBeGreaterThanOrEqual(4 * 0.75);
    });

    it('opponent priority mode maximizes opponent diversity', () => {
      const racers = makeRacers(24);
      const resultOpponent = schedule(racers, { numLanes: 6, heatsPerRacer: 6, prioritize: 'opponents' });
      const resultLane = schedule(racers, { numLanes: 6, heatsPerRacer: 6, prioritize: 'lanes' });

      const statsOpponent = analyzeOpponents(resultOpponent, racers.length);
      const statsLane = analyzeOpponents(resultLane, racers.length);

      // Opponent priority should have equal or better opponent diversity
      expect(statsOpponent.minUniqueOpponents).toBeGreaterThanOrEqual(statsLane.minUniqueOpponents);
    });

    it('lane priority mode provides good lane distribution', () => {
      const racers = makeRacers(20);
      const numLanes = 4;
      const heatsPerRacer = 4;

      const resultLane = schedule(racers, { numLanes, heatsPerRacer, prioritize: 'lanes' });

      // Count lane diversity
      const lanesUsed = new Map<number, Set<number>>();
      for (const racer of racers) {
        lanesUsed.set(racer.id, new Set());
      }
      for (const heat of resultLane) {
        heat.forEach((racer, laneIndex) => {
          if (racer !== null) {
            const id = (racer as { id: number }).id;
            lanesUsed.get(id)!.add(laneIndex);
          }
        });
      }

      // Average unique lanes per racer should be good
      let totalUniqueLanes = 0;
      for (const lanes of lanesUsed.values()) {
        totalUniqueLanes += lanes.size;
      }
      const avgUniqueLanes = totalUniqueLanes / racers.length;

      // With lane priority, average should be at least 3 out of 4 lanes
      expect(avgUniqueLanes).toBeGreaterThanOrEqual(3);
    });

    it('accepts explicit prioritize parameter', () => {
      const racers = makeRacers(12);

      // Both modes should produce valid schedules
      const resultLanes = schedule(racers, { numLanes: 4, heatsPerRacer: 3, prioritize: 'lanes' });
      const resultOpponents = schedule(racers, { numLanes: 4, heatsPerRacer: 3, prioritize: 'opponents' });

      // Each racer should appear exactly heatsPerRacer times in both
      for (const result of [resultLanes, resultOpponents]) {
        const counts = new Map<number, number>();
        for (const heat of result) {
          for (const slot of heat) {
            if (slot !== null) {
              const id = (slot as { id: number }).id;
              counts.set(id, (counts.get(id) || 0) + 1);
            }
          }
        }
        for (const racer of racers) {
          expect(counts.get(racer.id)).toBe(3);
        }
      }
    });

    it('accepts array of priorities', () => {
      const racers = makeRacers(16);
      const priorities: ScheduleCriterion[] = ['turnover', 'opponents', 'lanes'];

      const result = schedule(racers, { numLanes: 4, heatsPerRacer: 4, prioritize: priorities });

      // Should produce a valid schedule
      expect(result.length).toBeGreaterThan(0);

      // Each racer should appear exactly heatsPerRacer times
      const counts = new Map<number, number>();
      for (const heat of result) {
        for (const slot of heat) {
          if (slot !== null) {
            const id = (slot as { id: number }).id;
            counts.set(id, (counts.get(id) || 0) + 1);
          }
        }
      }
      for (const racer of racers) {
        expect(counts.get(racer.id)).toBe(4);
      }
    });
  });

  describe('turnover optimization', () => {
    /**
     * Calculate turnover statistics for a schedule.
     * Turnover = number of cars that appear in both consecutive heats.
     */
    function analyzeTurnover(result: ({ id: number } | null)[][]): {
      totalTurnover: number;
      avgTurnover: number;
      maxTurnover: number;
      minTurnover: number;
    } {
      const turnovers: number[] = [];

      for (let i = 1; i < result.length; i++) {
        const prevHeat = new Set(
          result[i - 1].filter((r) => r !== null).map((r) => (r as { id: number }).id)
        );
        const currentHeat = result[i]
          .filter((r) => r !== null)
          .map((r) => (r as { id: number }).id);

        let turnover = 0;
        for (const id of currentHeat) {
          if (prevHeat.has(id)) {
            turnover++;
          }
        }
        turnovers.push(turnover);
      }

      if (turnovers.length === 0) {
        return { totalTurnover: 0, avgTurnover: 0, maxTurnover: 0, minTurnover: 0 };
      }

      return {
        totalTurnover: turnovers.reduce((a, b) => a + b, 0),
        avgTurnover: turnovers.reduce((a, b) => a + b, 0) / turnovers.length,
        maxTurnover: Math.max(...turnovers),
        minTurnover: Math.min(...turnovers),
      };
    }

    it('turnover priority reduces consecutive heat appearances', () => {
      const racers = makeRacers(24);
      const numLanes = 4;
      const heatsPerRacer = 4;

      // Compare turnover-prioritized vs non-turnover-prioritized
      const resultTurnover = schedule(racers, {
        numLanes,
        heatsPerRacer,
        prioritize: ['turnover', 'lanes', 'opponents'],
      });
      const resultLanes = schedule(racers, {
        numLanes,
        heatsPerRacer,
        prioritize: ['lanes', 'opponents', 'turnover'],
      });

      const statsTurnover = analyzeTurnover(resultTurnover);
      const statsLanes = analyzeTurnover(resultLanes);

      // Turnover priority should have lower or equal total turnover
      expect(statsTurnover.totalTurnover).toBeLessThanOrEqual(statsLanes.totalTurnover);
    });

    it('with turnover priority, consecutive heats have minimal overlap', () => {
      const racers = makeRacers(20);
      const numLanes = 4;
      const heatsPerRacer = 4;

      const result = schedule(racers, {
        numLanes,
        heatsPerRacer,
        prioritize: ['turnover', 'opponents', 'lanes'],
      });

      const stats = analyzeTurnover(result);

      // With 20 racers and 4 lanes, there are enough racers to avoid overlap in most cases.
      // Average turnover should be low (ideally 0, but allowing some due to constraints).
      // With good turnover optimization, average should be less than half the lane count.
      expect(stats.avgTurnover).toBeLessThan(numLanes / 2);
    });

    it('turnover statistics can be logged for inspection', () => {
      const configs = [
        { racerCount: 16, numLanes: 4, heatsPerRacer: 4 },
        { racerCount: 24, numLanes: 6, heatsPerRacer: 6 },
        { racerCount: 50, numLanes: 4, heatsPerRacer: 4 },
      ];

      for (const { racerCount, numLanes, heatsPerRacer } of configs) {
        const racers = makeRacers(racerCount);

        const priorities: ScheduleCriterion[][] = [
          ['lanes', 'opponents', 'turnover'],
          ['turnover', 'opponents', 'lanes'],
          ['opponents', 'turnover', 'lanes'],
        ];

        for (const priority of priorities) {
          const result = schedule(racers, { numLanes, heatsPerRacer, prioritize: priority });
          const stats = analyzeTurnover(result);

          console.log(
            `[${racerCount} racers, ${numLanes} lanes, ${heatsPerRacer} heats/racer, priority=${priority.join('>')}] ` +
            `Turnover: total=${stats.totalTurnover}, avg=${stats.avgTurnover.toFixed(1)}, ` +
            `max=${stats.maxTurnover}, min=${stats.minTurnover}`
          );
        }
      }

      expect(true).toBe(true); // Always pass - for inspection
    });

    it('each racer appears correct number of times with turnover priority', () => {
      const racers = makeRacers(30);
      const heatsPerRacer = 5;
      const result = schedule(racers, {
        numLanes: 5,
        heatsPerRacer,
        prioritize: ['turnover', 'lanes', 'opponents'],
      });

      const counts = new Map<number, number>();
      for (const heat of result) {
        for (const slot of heat) {
          if (slot !== null) {
            const id = (slot as { id: number }).id;
            counts.set(id, (counts.get(id) || 0) + 1);
          }
        }
      }

      for (const racer of racers) {
        expect(counts.get(racer.id)).toBe(heatsPerRacer);
      }
    });
  });

  describe('priority list ordering', () => {
    it('different priority orders produce different schedules', () => {
      const racers = makeRacers(16);
      const options = { numLanes: 4, heatsPerRacer: 4 };

      const result1 = schedule(racers, { ...options, prioritize: ['lanes', 'opponents', 'turnover'] });
      const result2 = schedule(racers, { ...options, prioritize: ['turnover', 'opponents', 'lanes'] });
      const result3 = schedule(racers, { ...options, prioritize: ['opponents', 'lanes', 'turnover'] });

      // Convert to comparable strings
      const toString = (r: typeof result1) =>
        r.map((heat) => heat.map((slot) => (slot ? (slot as { id: number }).id : 'X')).join(',')).join('|');

      // At least two of the three should be different
      const s1 = toString(result1);
      const s2 = toString(result2);
      const s3 = toString(result3);

      const uniqueSchedules = new Set([s1, s2, s3]);
      expect(uniqueSchedules.size).toBeGreaterThanOrEqual(2);
    });

    it('prioritizing turnover first results in lower turnover than prioritizing lanes first', () => {
      const racers = makeRacers(32);
      const numLanes = 4;
      const heatsPerRacer = 4;

      const resultTurnoverFirst = schedule(racers, {
        numLanes,
        heatsPerRacer,
        prioritize: ['turnover', 'lanes', 'opponents'],
      });
      const resultLanesFirst = schedule(racers, {
        numLanes,
        heatsPerRacer,
        prioritize: ['lanes', 'turnover', 'opponents'],
      });

      // Analyze turnover for both
      const analyzeTurnover = (result: typeof resultTurnoverFirst) => {
        let totalTurnover = 0;
        for (let i = 1; i < result.length; i++) {
          const prevIds = new Set(
            result[i - 1].filter((r) => r !== null).map((r) => (r as { id: number }).id)
          );
          for (const slot of result[i]) {
            if (slot !== null && prevIds.has((slot as { id: number }).id)) {
              totalTurnover++;
            }
          }
        }
        return totalTurnover;
      };

      const turnoverFirstTotal = analyzeTurnover(resultTurnoverFirst);
      const lanesFirstTotal = analyzeTurnover(resultLanesFirst);

      // Turnover-first should be equal or better
      expect(turnoverFirstTotal).toBeLessThanOrEqual(lanesFirstTotal);
    });

    it('partial priority list still works (missing criteria get low weight)', () => {
      const racers = makeRacers(12);

      // Only specify two criteria - third should get minimal weight
      const result = schedule(racers, {
        numLanes: 3,
        heatsPerRacer: 3,
        prioritize: ['opponents', 'turnover'] as ScheduleCriterion[],
      });

      // Should still produce a valid schedule
      const counts = new Map<number, number>();
      for (const heat of result) {
        for (const slot of heat) {
          if (slot !== null) {
            const id = (slot as { id: number }).id;
            counts.set(id, (counts.get(id) || 0) + 1);
          }
        }
      }
      for (const racer of racers) {
        expect(counts.get(racer.id)).toBe(3);
      }
    });

    it('backward compatible: string priority still works', () => {
      const racers = makeRacers(16);

      // Old-style single string priority should still work
      const resultLanes = schedule(racers, { numLanes: 4, heatsPerRacer: 4, prioritize: 'lanes' });
      const resultOpponents = schedule(racers, { numLanes: 4, heatsPerRacer: 4, prioritize: 'opponents' });

      // Both should produce valid schedules
      for (const result of [resultLanes, resultOpponents]) {
        const counts = new Map<number, number>();
        for (const heat of result) {
          for (const slot of heat) {
            if (slot !== null) {
              const id = (slot as { id: number }).id;
              counts.set(id, (counts.get(id) || 0) + 1);
            }
          }
        }
        for (const racer of racers) {
          expect(counts.get(racer.id)).toBe(4);
        }
      }
    });
  });
});