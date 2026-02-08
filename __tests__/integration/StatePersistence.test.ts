import { useStore } from '../../src/state/store';

beforeEach(() => {
  useStore.getState().resetProgress();
});

describe('State persistence integration', () => {
  it('deck progress persists through export/import', () => {
    useStore.getState().saveDeckProgress(20);
    useStore.getState().saveTrialResult('all', {
      trialId: 'test',
      time: 4000,
      mistakes: 1,
      headingsPerMinute: 35,
    });

    const exported = useStore.getState().exportState();
    useStore.getState().resetProgress();

    expect(useStore.getState().deckProgress.unlockedCount).toBe(1);

    useStore.getState().importState(exported);
    expect(useStore.getState().deckProgress.unlockedCount).toBe(20);
    expect(useStore.getState().trialBestTimes['all'].time).toBe(4000);
  });

  it('resetProgress clears all state', () => {
    useStore.getState().saveDeckProgress(15);
    useStore.getState().resetProgress();
    expect(useStore.getState().deckProgress.unlockedCount).toBe(1);
  });
});
