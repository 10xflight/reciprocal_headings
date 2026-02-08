import { useStore } from '../../src/state/store';

beforeEach(() => {
  useStore.getState().resetProgress();
});

describe('Store', () => {
  it('starts with deck progress unlockedCount 1', () => {
    const state = useStore.getState();
    expect(state.deckProgress.unlockedCount).toBe(1);
  });

  it('saveDeckProgress updates unlocked count', () => {
    useStore.getState().saveDeckProgress(5);
    expect(useStore.getState().deckProgress.unlockedCount).toBe(5);
  });

  it('saveTrialResult stores best time', () => {
    useStore.getState().saveTrialResult('all', {
      trialId: 'test',
      time: 5000,
      mistakes: 2,
      headingsPerMinute: 30,
    });
    expect(useStore.getState().trialBestTimes['all'].time).toBe(5000);
  });

  it('saveTrialResult keeps better time', () => {
    useStore.getState().saveTrialResult('all', {
      trialId: 'test1',
      time: 5000,
      mistakes: 2,
      headingsPerMinute: 30,
    });
    useStore.getState().saveTrialResult('all', {
      trialId: 'test2',
      time: 3000,
      mistakes: 1,
      headingsPerMinute: 40,
    });
    expect(useStore.getState().trialBestTimes['all'].time).toBe(3000);
  });

  it('saveTrialResult does not overwrite with worse time', () => {
    useStore.getState().saveTrialResult('all', {
      trialId: 'test1',
      time: 3000,
      mistakes: 1,
      headingsPerMinute: 40,
    });
    useStore.getState().saveTrialResult('all', {
      trialId: 'test2',
      time: 5000,
      mistakes: 2,
      headingsPerMinute: 30,
    });
    expect(useStore.getState().trialBestTimes['all'].time).toBe(3000);
  });

  it('resetProgress resets everything', () => {
    useStore.getState().saveDeckProgress(10);
    useStore.getState().resetProgress();
    expect(useStore.getState().deckProgress.unlockedCount).toBe(1);
    expect(Object.keys(useStore.getState().trialBestTimes).length).toBe(0);
  });

  it('export and import roundtrip', () => {
    useStore.getState().saveDeckProgress(15);
    const exported = useStore.getState().exportState();
    useStore.getState().resetProgress();
    const success = useStore.getState().importState(exported);
    expect(success).toBe(true);
    expect(useStore.getState().deckProgress.unlockedCount).toBe(15);
  });

  it('importState rejects invalid data', () => {
    const success = useStore.getState().importState('not-valid-base64!!!');
    expect(success).toBe(false);
  });
});
