import { useStore } from '../../src/state/store';

beforeEach(() => {
  useStore.getState().resetProgress();
});

describe('State persistence integration', () => {
  test('export/import round trip preserves all data', () => {
    useStore.getState().completeStage(1);
    useStore.getState().completeStage(2);
    useStore.getState().saveTrialResult(1, {
      trialId: 'test-1',
      time: 5000,
      mistakes: 1,
      headingsPerMinute: 72,
    });

    const before = useStore.getState();
    const code = before.exportState();

    useStore.getState().resetProgress();
    expect(useStore.getState().completedStages).toEqual([]);

    const success = useStore.getState().importState(code);
    expect(success).toBe(true);

    const after = useStore.getState();
    expect(after.completedStages).toEqual(before.completedStages);
    expect(after.currentStage).toBe(before.currentStage);
    expect(after.trialBestTimes['1'].time).toBe(5000);
  });

  test('import handles corrupted base64 gracefully', () => {
    expect(useStore.getState().importState('not-valid-base64!!!')).toBe(false);
    expect(useStore.getState().currentStage).toBe(1);
  });

  test('import handles valid base64 but bad JSON', () => {
    expect(useStore.getState().importState(btoa('this is not json'))).toBe(false);
  });

  test('import handles valid JSON but wrong schema', () => {
    expect(useStore.getState().importState(btoa('{"foo":"bar"}'))).toBe(false);
  });

  test('import handles partial schema', () => {
    const partial = btoa(JSON.stringify({ currentStage: 2 }));
    expect(useStore.getState().importState(partial)).toBe(false);
  });

  test('multiple exports produce consistent results', () => {
    useStore.getState().completeStage(1);
    const code1 = useStore.getState().exportState();
    const code2 = useStore.getState().exportState();
    expect(code1).toBe(code2);
  });

  test('reset clears everything', () => {
    useStore.getState().completeStage(1);
    useStore.getState().completeStage(2);
    useStore.getState().resetProgress();

    const state = useStore.getState();
    expect(state.currentStage).toBe(1);
    expect(state.completedStages).toEqual([]);
    expect(state.stats.totalReps).toBe(0);
  });
});
