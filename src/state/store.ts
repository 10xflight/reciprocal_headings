import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrialResult, UserStats } from '../core/types';

interface AppState {
  // Current learning stage (1-11)
  currentStage: number;

  // Completed stages
  completedStages: number[];

  // Trial best results keyed by stage number string
  trialBestTimes: Record<string, TrialResult>;

  // Statistics
  stats: UserStats;

  // Dev/testing: unlock all levels regardless of progress
  unlockAllLevels: boolean;

  // Actions
  completeStage: (stage: number) => void;
  saveTrialResult: (stage: number, result: TrialResult) => void;
  toggleUnlockAllLevels: () => void;
  resetProgress: () => void;
  exportState: () => string;
  importState: (data: string) => boolean;
}

const INITIAL_STATS: UserStats = {
  totalReps: 0,
  totalTimeMs: 0,
  bestStreak: 0,
  currentStreak: 0,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentStage: 1,
      completedStages: [],
      trialBestTimes: {},
      stats: { ...INITIAL_STATS },
      unlockAllLevels: false,

      completeStage: (stage) => {
        set((state) => {
          const completed = state.completedStages.includes(stage)
            ? state.completedStages
            : [...state.completedStages, stage];
          const nextStage = Math.min(stage + 1, 11);
          return {
            completedStages: completed,
            currentStage: Math.max(state.currentStage, nextStage),
          };
        });
      },

      saveTrialResult: (stage, result) => {
        set((state) => {
          const key = String(stage);
          const existing = state.trialBestTimes[key];
          const isBetter = !existing || result.time < existing.time;
          return {
            trialBestTimes: isBetter
              ? { ...state.trialBestTimes, [key]: result }
              : state.trialBestTimes,
          };
        });
      },

      toggleUnlockAllLevels: () => {
        set((state) => ({ unlockAllLevels: !state.unlockAllLevels }));
      },

      resetProgress: () => {
        set({
          currentStage: 1,
          completedStages: [],
          trialBestTimes: {},
          stats: { ...INITIAL_STATS },
        });
      },

      exportState: () => {
        const { currentStage, completedStages, trialBestTimes, stats } = get();
        return btoa(JSON.stringify({ currentStage, completedStages, trialBestTimes, stats }));
      },

      importState: (data) => {
        try {
          const parsed = JSON.parse(atob(data));
          if (typeof parsed.currentStage !== 'number' || !Array.isArray(parsed.completedStages)) {
            return false;
          }
          set({
            currentStage: parsed.currentStage,
            completedStages: parsed.completedStages,
            trialBestTimes: parsed.trialBestTimes || {},
            stats: parsed.stats || { ...INITIAL_STATS },
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'reciprocal-headings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentStage: state.currentStage,
        completedStages: state.completedStages,
        trialBestTimes: state.trialBestTimes,
        stats: state.stats,
        unlockAllLevels: state.unlockAllLevels,
      }),
    },
  ),
);
