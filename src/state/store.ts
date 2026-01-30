import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LevelProgress, UserStats } from '../core/types';

interface SessionState {
  level: number | null;
  forceRetryId: string | null;
  sandwichPhase: 'none' | 'different' | 'retry';
  sandwichDifferentId: string | null;
}

interface AppState {
  // Snowball state (global across levels)
  unlockedIndex: number;

  // Per-level progress
  levels: Record<number, LevelProgress>;

  // Statistics
  stats: UserStats;

  // Active session (not persisted)
  session: SessionState;

  // Actions
  recordResult: (
    level: number,
    headingId: string,
    result: 'green' | 'amber' | 'red',
    timeMs: number,
  ) => void;
  setCurrentLevel: (level: number | null) => void;
  setForceRetry: (headingId: string | null) => void;
  setSandwichPhase: (phase: 'none' | 'different' | 'retry', differentId?: string | null) => void;
  resetProgress: () => void;
  exportState: () => string;
  importState: (data: string) => boolean;
}

const INITIAL_LEVELS: Record<number, LevelProgress> = {
  1: {},
  2: {},
  3: {},
  4: {},
  5: {},
};

const INITIAL_STATS: UserStats = {
  totalReps: 0,
  totalTimeMs: 0,
  bestStreak: 0,
  currentStreak: 0,
};

const INITIAL_SESSION: SessionState = {
  level: null,
  forceRetryId: null,
  sandwichPhase: 'none',
  sandwichDifferentId: null,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      unlockedIndex: 0,
      levels: { ...INITIAL_LEVELS },
      stats: { ...INITIAL_STATS },
      session: { ...INITIAL_SESSION },

      recordResult: (level, headingId, result, timeMs) => {
        set((state) => {
          const levelProgress = { ...state.levels[level] };
          const current = levelProgress[headingId]
            ? { ...levelProgress[headingId] }
            : { stability: 0, consecutiveGreens: 0, lastAttempt: 0 };

          if (result === 'green') {
            current.consecutiveGreens++;
            if (current.consecutiveGreens >= 3) {
              current.stability = 3;
            }
          } else if (result === 'red') {
            current.stability = 0;
            current.consecutiveGreens = 0;
          }
          // amber: no change

          current.lastAttempt = Date.now();
          levelProgress[headingId] = current;

          const newStreak = result === 'green' ? state.stats.currentStreak + 1 : 0;

          return {
            levels: { ...state.levels, [level]: levelProgress },
            stats: {
              totalReps: state.stats.totalReps + 1,
              totalTimeMs: state.stats.totalTimeMs + timeMs,
              currentStreak: newStreak,
              bestStreak: Math.max(state.stats.bestStreak, newStreak),
            },
          };
        });
      },

      setCurrentLevel: (level) => {
        set((state) => ({
          session: { ...state.session, level },
        }));
      },

      setForceRetry: (headingId) => {
        set((state) => ({
          session: { ...state.session, forceRetryId: headingId },
        }));
      },

      setSandwichPhase: (phase, differentId = null) => {
        set((state) => ({
          session: {
            ...state.session,
            sandwichPhase: phase,
            sandwichDifferentId: differentId ?? state.session.sandwichDifferentId,
          },
        }));
      },

      resetProgress: () => {
        set({
          unlockedIndex: 0,
          levels: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} },
          stats: { ...INITIAL_STATS },
          session: { ...INITIAL_SESSION },
        });
      },

      exportState: () => {
        const { unlockedIndex, levels, stats } = get();
        return btoa(JSON.stringify({ unlockedIndex, levels, stats }));
      },

      importState: (data) => {
        try {
          const parsed = JSON.parse(atob(data));
          if (
            typeof parsed.unlockedIndex !== 'number' ||
            !parsed.levels ||
            !parsed.stats
          ) {
            return false;
          }
          set({
            unlockedIndex: parsed.unlockedIndex,
            levels: parsed.levels,
            stats: parsed.stats,
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
        unlockedIndex: state.unlockedIndex,
        levels: state.levels,
        stats: state.stats,
      }),
    },
  ),
);
