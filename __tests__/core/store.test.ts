import { useStore } from '../../src/state/store';

beforeEach(() => {
  useStore.getState().resetProgress();
});

describe('Zustand store', () => {
  test('initial state', () => {
    const state = useStore.getState();
    expect(state.currentStage).toBe(1);
    expect(state.completedStages).toEqual([]);
    expect(state.stats.totalReps).toBe(0);
  });

  test('completeStage advances currentStage', () => {
    useStore.getState().completeStage(1);
    const state = useStore.getState();
    expect(state.completedStages).toContain(1);
    expect(state.currentStage).toBe(2);
  });

  test('completeStage is idempotent', () => {
    useStore.getState().completeStage(1);
    useStore.getState().completeStage(1);
    expect(useStore.getState().completedStages.filter((s) => s === 1)).toHaveLength(1);
  });

  test('completeStage does not exceed 11', () => {
    useStore.getState().completeStage(11);
    expect(useStore.getState().currentStage).toBe(11);
  });

  test('saveTrialResult stores best time', () => {
    useStore.getState().saveTrialResult(1, {
      trialId: 'test-1',
      time: 5000,
      mistakes: 2,
      headingsPerMinute: 72,
    });
    const best = useStore.getState().trialBestTimes['1'];
    expect(best).toBeDefined();
    expect(best.time).toBe(5000);
  });

  test('saveTrialResult keeps better time', () => {
    useStore.getState().saveTrialResult(1, {
      trialId: 'test-1',
      time: 5000,
      mistakes: 2,
      headingsPerMinute: 72,
    });
    useStore.getState().saveTrialResult(1, {
      trialId: 'test-2',
      time: 3000,
      mistakes: 0,
      headingsPerMinute: 120,
    });
    expect(useStore.getState().trialBestTimes['1'].time).toBe(3000);
  });

  test('saveTrialResult does not overwrite with worse time', () => {
    useStore.getState().saveTrialResult(1, {
      trialId: 'test-1',
      time: 3000,
      mistakes: 0,
      headingsPerMinute: 120,
    });
    useStore.getState().saveTrialResult(1, {
      trialId: 'test-2',
      time: 5000,
      mistakes: 2,
      headingsPerMinute: 72,
    });
    expect(useStore.getState().trialBestTimes['1'].time).toBe(3000);
  });

  test('export and import round-trip', () => {
    useStore.getState().completeStage(1);
    useStore.getState().completeStage(2);
    useStore.getState().saveTrialResult(1, {
      trialId: 'test-1',
      time: 5000,
      mistakes: 1,
      headingsPerMinute: 72,
    });

    const exported = useStore.getState().exportState();
    useStore.getState().resetProgress();
    expect(useStore.getState().completedStages).toEqual([]);

    const success = useStore.getState().importState(exported);
    expect(success).toBe(true);
    expect(useStore.getState().completedStages).toContain(1);
    expect(useStore.getState().completedStages).toContain(2);
    expect(useStore.getState().trialBestTimes['1'].time).toBe(5000);
  });

  test('import rejects invalid data', () => {
    expect(useStore.getState().importState('not-base64!')).toBe(false);
    expect(useStore.getState().importState(btoa('{}'))).toBe(false);
  });

  test('resetProgress clears everything', () => {
    useStore.getState().completeStage(1);
    useStore.getState().resetProgress();

    const state = useStore.getState();
    expect(state.currentStage).toBe(1);
    expect(state.completedStages).toEqual([]);
    expect(state.stats.totalReps).toBe(0);
  });
});
