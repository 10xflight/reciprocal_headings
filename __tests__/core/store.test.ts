import { useStore } from '../../src/state/store';

// Reset store between tests
beforeEach(() => {
  useStore.getState().resetProgress();
});

describe('Zustand store', () => {
  test('initial state', () => {
    const state = useStore.getState();
    expect(state.unlockedIndex).toBe(0);
    expect(state.stats.totalReps).toBe(0);
    expect(Object.keys(state.levels)).toHaveLength(5);
  });

  test('recordResult updates level progress', () => {
    const { recordResult } = useStore.getState();
    recordResult(1, '36', 'green', 500);

    const state = useStore.getState();
    expect(state.levels[1]['36']).toBeDefined();
    expect(state.levels[1]['36'].consecutiveGreens).toBe(1);
    expect(state.levels[1]['36'].stability).toBe(0);
    expect(state.stats.totalReps).toBe(1);
    expect(state.stats.totalTimeMs).toBe(500);
  });

  test('3 consecutive greens sets stability to 3', () => {
    const { recordResult } = useStore.getState();
    recordResult(1, '36', 'green', 500);
    recordResult(1, '36', 'green', 400);
    recordResult(1, '36', 'green', 300);

    const state = useStore.getState();
    expect(state.levels[1]['36'].stability).toBe(3);
    expect(state.levels[1]['36'].consecutiveGreens).toBe(3);
  });

  test('red resets stability and consecutiveGreens', () => {
    const { recordResult } = useStore.getState();
    recordResult(1, '36', 'green', 500);
    recordResult(1, '36', 'green', 500);
    recordResult(1, '36', 'red', 500);

    const state = useStore.getState();
    expect(state.levels[1]['36'].stability).toBe(0);
    expect(state.levels[1]['36'].consecutiveGreens).toBe(0);
  });

  test('amber does not change progress', () => {
    const { recordResult } = useStore.getState();
    recordResult(1, '36', 'green', 500);
    recordResult(1, '36', 'amber', 1200);

    const state = useStore.getState();
    expect(state.levels[1]['36'].consecutiveGreens).toBe(1);
    expect(state.levels[1]['36'].stability).toBe(0);
  });

  test('streak tracking', () => {
    const { recordResult } = useStore.getState();
    recordResult(1, '36', 'green', 500);
    recordResult(1, '36', 'green', 500);
    recordResult(1, '36', 'green', 500);

    expect(useStore.getState().stats.currentStreak).toBe(3);
    expect(useStore.getState().stats.bestStreak).toBe(3);

    recordResult(1, '36', 'red', 500);
    expect(useStore.getState().stats.currentStreak).toBe(0);
    expect(useStore.getState().stats.bestStreak).toBe(3);
  });

  test('levels are independent', () => {
    const { recordResult } = useStore.getState();
    recordResult(1, '36', 'green', 500);
    recordResult(2, '36', 'red', 500);

    const state = useStore.getState();
    expect(state.levels[1]['36'].consecutiveGreens).toBe(1);
    expect(state.levels[2]['36'].consecutiveGreens).toBe(0);
  });

  test('export and import round-trip', () => {
    const { recordResult } = useStore.getState();
    recordResult(1, '36', 'green', 500);
    recordResult(1, '36', 'green', 400);
    recordResult(1, '36', 'green', 300);

    const exported = useStore.getState().exportState();

    useStore.getState().resetProgress();
    expect(useStore.getState().levels[1]['36']).toBeUndefined();

    const success = useStore.getState().importState(exported);
    expect(success).toBe(true);
    expect(useStore.getState().levels[1]['36'].stability).toBe(3);
    expect(useStore.getState().stats.totalReps).toBe(3);
  });

  test('import rejects invalid data', () => {
    expect(useStore.getState().importState('not-base64!')).toBe(false);
    expect(useStore.getState().importState(btoa('{}'))).toBe(false);
    expect(useStore.getState().importState(btoa('{"unlockedIndex":"bad"}'))).toBe(false);
  });

  test('resetProgress clears everything', () => {
    const { recordResult, resetProgress } = useStore.getState();
    recordResult(1, '36', 'green', 500);
    resetProgress();

    const state = useStore.getState();
    expect(state.stats.totalReps).toBe(0);
    expect(state.unlockedIndex).toBe(0);
    expect(Object.keys(state.levels[1])).toHaveLength(0);
  });
});
