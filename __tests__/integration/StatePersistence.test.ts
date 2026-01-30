import { useStore } from '../../src/state/store';

beforeEach(() => {
  useStore.getState().resetProgress();
});

describe('State persistence integration', () => {
  test('export/import round trip preserves all data', () => {
    const { recordResult } = useStore.getState();

    // Build up some progress across levels
    recordResult(1, '36', 'green', 500);
    recordResult(1, '36', 'green', 400);
    recordResult(1, '36', 'green', 300);
    recordResult(2, '18', 'red', 1200);
    recordResult(2, '18', 'green', 800);

    const before = useStore.getState();
    const code = before.exportState();

    // Reset and verify clean
    useStore.getState().resetProgress();
    expect(useStore.getState().stats.totalReps).toBe(0);

    // Restore
    const success = useStore.getState().importState(code);
    expect(success).toBe(true);

    const after = useStore.getState();
    expect(after.stats.totalReps).toBe(before.stats.totalReps);
    expect(after.stats.totalTimeMs).toBe(before.stats.totalTimeMs);
    expect(after.levels[1]['36'].stability).toBe(before.levels[1]['36'].stability);
    expect(after.levels[2]['18'].consecutiveGreens).toBe(before.levels[2]['18'].consecutiveGreens);
  });

  test('import handles corrupted base64 gracefully', () => {
    expect(useStore.getState().importState('not-valid-base64!!!')).toBe(false);
    // Store should be untouched
    expect(useStore.getState().stats.totalReps).toBe(0);
  });

  test('import handles valid base64 but bad JSON', () => {
    expect(useStore.getState().importState(btoa('this is not json'))).toBe(false);
  });

  test('import handles valid JSON but wrong schema', () => {
    expect(useStore.getState().importState(btoa('{"foo":"bar"}'))).toBe(false);
  });

  test('import handles partial schema (missing stats)', () => {
    const partial = btoa(JSON.stringify({ unlockedIndex: 2, levels: {} }));
    expect(useStore.getState().importState(partial)).toBe(false);
  });

  test('multiple exports produce consistent results', () => {
    const { recordResult } = useStore.getState();
    recordResult(1, '36', 'green', 500);

    const code1 = useStore.getState().exportState();
    const code2 = useStore.getState().exportState();
    expect(code1).toBe(code2);
  });

  test('reset clears everything including level data', () => {
    const { recordResult, resetProgress } = useStore.getState();
    recordResult(1, '36', 'green', 500);
    recordResult(2, '18', 'green', 600);
    recordResult(3, '09', 'red', 700);

    resetProgress();

    const state = useStore.getState();
    expect(state.stats.totalReps).toBe(0);
    expect(state.stats.totalTimeMs).toBe(0);
    expect(state.stats.bestStreak).toBe(0);
    expect(state.stats.currentStreak).toBe(0);
    expect(state.unlockedIndex).toBe(0);
    for (let l = 1; l <= 5; l++) {
      expect(Object.keys(state.levels[l])).toHaveLength(0);
    }
  });
});
