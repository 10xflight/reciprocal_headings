import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrialResult, UserStats } from '../core/types';

interface DeckProgress {
  unlockedCount: number;
  masteredHeadings: string[];
  everMasteredHeadings: string[];
  totalReps: number;
}

interface MasteryChallengeBest {
  score: number;
  time: number;
  accuracy: number;
  totalResponses: number;
}

export interface HeadingPerformance {
  avgTime: number;
  mistakes: number;
  reps: number;
  status: 'green' | 'amber' | 'red';
}

export interface MasteryHeadingResult {
  status: 'green' | 'amber' | 'red';
  time: number;
  mistakes: number;
}

function calculateStatus(avgTime: number, mistakes: number, reps: number): 'green' | 'amber' | 'red' {
  if (reps === 0) return 'red';
  const errorRate = mistakes / reps;
  if (avgTime < 1000 && errorRate < 0.1) return 'green';
  if (avgTime < 1500 || errorRate < 0.3) return 'amber';
  return 'red';
}

interface AppState {
  // Growing deck progress (Level 1)
  deckProgress: DeckProgress;

  // Level 2 deck progress (separate from Level 1)
  level2DeckProgress: DeckProgress;

  // Trial best results keyed by identifier
  trialBestTimes: Record<string, TrialResult>;

  // Mastery challenge best score
  masteryChallengeBest: MasteryChallengeBest | null;

  // Practice data: per-heading performance
  practiceData: Record<string, HeadingPerformance>;

  // Most recent mastery challenge per-heading results
  masteryResults: Record<string, MasteryHeadingResult>;

  // Persisted focus heading selection
  focusSelection: string[];

  // Tracks which source last updated practice data
  practiceDataSource: 'mastery' | 'practice' | null;
  practiceDataUpdatedAt: number | null;

  // Last mastery challenge stats (for showing results on return)
  masteryLastElapsed: number;
  masteryLastMistakes: number;
  masteryLastTotalResponses: number;

  // Level 2 specific data (separate from Level 1)
  level2PracticeData: Record<string, HeadingPerformance>;
  level2MasteryResults: Record<string, MasteryHeadingResult>;
  level2FocusSelection: string[];
  level2PracticeDataSource: 'mastery' | 'practice' | null;
  level2PracticeDataUpdatedAt: number | null;
  level2MasteryChallengeBest: MasteryChallengeBest | null;
  level2MasteryLastElapsed: number;
  level2MasteryLastMistakes: number;
  level2MasteryLastTotalResponses: number;

  // Statistics
  stats: UserStats;

  // Dev/testing: unlock all levels regardless of progress
  unlockAllLevels: boolean;

  // Actions
  saveDeckProgress: (unlockedCount: number, masteredHeadings?: string[], incrementReps?: boolean, everMasteredHeadings?: string[]) => void;
  saveLevel2DeckProgress: (unlockedCount: number, masteredHeadings?: string[], incrementReps?: boolean, everMasteredHeadings?: string[]) => void;
  saveTrialResult: (key: string, result: TrialResult) => void;
  saveMasteryChallengeBest: (score: number, time: number, accuracy: number, totalResponses: number) => void;
  updatePracticeData: (heading: string, time: number, isCorrect: boolean) => void;
  batchUpdatePracticeData: (entries: { heading: string; time: number; isCorrect: boolean }[], masteredHeadings?: string[]) => void;
  saveMasteryResults: (results: Record<string, MasteryHeadingResult>, elapsed: number, mistakes: number, totalResponses: number) => void;
  importMasteryToPractice: () => void;
  saveFocusSelection: (headings: string[]) => void;
  resetPracticeData: () => void;
  resetMasteryResults: () => void;
  resetMasteryChallengeBest: () => void;
  // Level 2 actions
  updateLevel2PracticeData: (heading: string, time: number, isCorrect: boolean) => void;
  batchUpdateLevel2PracticeData: (entries: { heading: string; time: number; isCorrect: boolean }[], masteredHeadings?: string[]) => void;
  saveLevel2MasteryResults: (results: Record<string, MasteryHeadingResult>, elapsed: number, mistakes: number, totalResponses: number) => void;
  importLevel2MasteryToPractice: () => void;
  saveLevel2FocusSelection: (headings: string[]) => void;
  resetLevel2PracticeData: () => void;
  resetLevel2MasteryResults: () => void;
  saveLevel2MasteryChallengeBest: (score: number, time: number, accuracy: number, totalResponses: number) => void;
  resetLevel2MasteryChallengeBest: () => void;
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
      deckProgress: { unlockedCount: 1, masteredHeadings: [], everMasteredHeadings: [], totalReps: 0 },
      level2DeckProgress: { unlockedCount: 1, masteredHeadings: [], everMasteredHeadings: [], totalReps: 0 },
      trialBestTimes: {},
      masteryChallengeBest: null,
      practiceData: {},
      masteryResults: {},
      focusSelection: [],
      practiceDataSource: null,
      practiceDataUpdatedAt: null,
      masteryLastElapsed: 0,
      masteryLastMistakes: 0,
      masteryLastTotalResponses: 0,
      level2PracticeData: {},
      level2MasteryResults: {},
      level2FocusSelection: [],
      level2PracticeDataSource: null,
      level2PracticeDataUpdatedAt: null,
      level2MasteryChallengeBest: null,
      level2MasteryLastElapsed: 0,
      level2MasteryLastMistakes: 0,
      level2MasteryLastTotalResponses: 0,
      stats: { ...INITIAL_STATS },
      unlockAllLevels: false,

      saveDeckProgress: (unlockedCount, masteredHeadings = [], incrementReps = false, everMasteredHeadings) => {
        set((state) => ({
          deckProgress: {
            unlockedCount,
            masteredHeadings,
            everMasteredHeadings: everMasteredHeadings ?? state.deckProgress.everMasteredHeadings ?? [],
            totalReps: incrementReps ? (state.deckProgress.totalReps || 0) + 1 : (state.deckProgress.totalReps || 0),
          },
        }));
      },

      saveLevel2DeckProgress: (unlockedCount, masteredHeadings = [], incrementReps = false, everMasteredHeadings) => {
        set((state) => ({
          level2DeckProgress: {
            unlockedCount,
            masteredHeadings,
            everMasteredHeadings: everMasteredHeadings ?? state.level2DeckProgress.everMasteredHeadings ?? [],
            totalReps: incrementReps ? (state.level2DeckProgress.totalReps || 0) + 1 : (state.level2DeckProgress.totalReps || 0),
          },
        }));
      },

      saveTrialResult: (key, result) => {
        set((state) => {
          const existing = state.trialBestTimes[key];
          const isBetter = !existing || result.time < existing.time;
          return {
            trialBestTimes: isBetter
              ? { ...state.trialBestTimes, [key]: result }
              : state.trialBestTimes,
          };
        });
      },

      saveMasteryChallengeBest: (score, time, accuracy, totalResponses) => {
        set((state) => {
          const existing = state.masteryChallengeBest;
          // Save if score is better, OR if score is equal but accuracy is better
          const isBetter = !existing || score > existing.score || (score === existing.score && accuracy > existing.accuracy);
          return {
            masteryChallengeBest: isBetter ? { score, time, accuracy, totalResponses } : state.masteryChallengeBest,
          };
        });
      },

      updatePracticeData: (heading, time, isCorrect) => {
        set((state) => {
          const existing = state.practiceData[heading];
          const reps = (existing?.reps || 0) + 1;
          const mistakes = (existing?.mistakes || 0) + (isCorrect ? 0 : 1);
          const avgTime = existing ? (existing.avgTime * existing.reps + time) / reps : time;
          const status = calculateStatus(avgTime, mistakes, reps);
          return {
            practiceData: {
              ...state.practiceData,
              [heading]: { avgTime, mistakes, reps, status },
            },
          };
        });
      },

      batchUpdatePracticeData: (entries, masteredHeadings = []) => {
        set((state) => {
          const updated = { ...state.practiceData };
          const masteredSet = new Set(masteredHeadings);
          for (const { heading, time, isCorrect } of entries) {
            const existing = updated[heading];
            const reps = (existing?.reps || 0) + 1;
            const mistakes = (existing?.mistakes || 0) + (isCorrect ? 0 : 1);
            const avgTime = existing ? (existing.avgTime * existing.reps + time) / reps : time;
            const raw = calculateStatus(avgTime, mistakes, reps);
            // Optimize can only produce green/amber — cap at amber, but mastered headings are always green
            const status = masteredSet.has(heading) ? 'green' : (raw === 'red' ? 'amber' : raw);
            updated[heading] = { avgTime, mistakes, reps, status };
          }
          // Also mark any mastered headings that weren't in entries (shouldn't happen, but safety)
          for (const h of masteredHeadings) {
            if (!updated[h]) {
              updated[h] = { avgTime: 500, mistakes: 0, reps: 1, status: 'green' };
            } else if (updated[h].status !== 'green') {
              updated[h] = { ...updated[h], status: 'green' };
            }
          }
          return { practiceData: updated, practiceDataSource: 'practice' as const, practiceDataUpdatedAt: Date.now() };
        });
      },

      saveMasteryResults: (results, elapsed, mistakes, totalResponses) => {
        set({ masteryResults: results, masteryLastElapsed: elapsed, masteryLastMistakes: mistakes, masteryLastTotalResponses: totalResponses });
      },

      importMasteryToPractice: () => {
        set((state) => {
          const updated: Record<string, HeadingPerformance> = {};
          // Copy mastery status directly - don't recalculate with different thresholds
          for (const [heading, result] of Object.entries(state.masteryResults)) {
            updated[heading] = {
              avgTime: result.time,
              mistakes: result.mistakes,
              reps: 1,
              status: result.status,
            };
          }
          return { practiceData: updated, practiceDataSource: 'mastery' as const, practiceDataUpdatedAt: Date.now() };
        });
      },

      saveFocusSelection: (headings) => {
        set({ focusSelection: headings });
      },

      resetPracticeData: () => {
        set({ practiceData: {}, practiceDataSource: null, practiceDataUpdatedAt: null });
      },

      resetMasteryResults: () => {
        set({ masteryResults: {}, masteryLastElapsed: 0, masteryLastMistakes: 0, masteryLastTotalResponses: 0 });
      },

      resetMasteryChallengeBest: () => {
        set({ masteryChallengeBest: null });
      },

      // Level 2 actions
      updateLevel2PracticeData: (heading, time, isCorrect) => {
        set((state) => {
          const existing = state.level2PracticeData[heading];
          const reps = (existing?.reps || 0) + 1;
          const mistakes = (existing?.mistakes || 0) + (isCorrect ? 0 : 1);
          const avgTime = existing ? (existing.avgTime * existing.reps + time) / reps : time;
          const status = calculateStatus(avgTime, mistakes, reps);
          return {
            level2PracticeData: {
              ...state.level2PracticeData,
              [heading]: { avgTime, mistakes, reps, status },
            },
          };
        });
      },

      batchUpdateLevel2PracticeData: (entries, masteredHeadings = []) => {
        set((state) => {
          const updated = { ...state.level2PracticeData };
          const masteredSet = new Set(masteredHeadings);
          for (const { heading, time, isCorrect } of entries) {
            const existing = updated[heading];
            const reps = (existing?.reps || 0) + 1;
            const mistakes = (existing?.mistakes || 0) + (isCorrect ? 0 : 1);
            const avgTime = existing ? (existing.avgTime * existing.reps + time) / reps : time;
            const raw = calculateStatus(avgTime, mistakes, reps);
            const status = masteredSet.has(heading) ? 'green' : (raw === 'red' ? 'amber' : raw);
            updated[heading] = { avgTime, mistakes, reps, status };
          }
          for (const h of masteredHeadings) {
            if (!updated[h]) {
              updated[h] = { avgTime: 500, mistakes: 0, reps: 1, status: 'green' };
            } else if (updated[h].status !== 'green') {
              updated[h] = { ...updated[h], status: 'green' };
            }
          }
          return { level2PracticeData: updated, level2PracticeDataSource: 'practice' as const, level2PracticeDataUpdatedAt: Date.now() };
        });
      },

      saveLevel2MasteryResults: (results, elapsed, mistakes, totalResponses) => {
        set({ level2MasteryResults: results, level2MasteryLastElapsed: elapsed, level2MasteryLastMistakes: mistakes, level2MasteryLastTotalResponses: totalResponses });
      },

      importLevel2MasteryToPractice: () => {
        set((state) => {
          const updated: Record<string, HeadingPerformance> = {};
          for (const [heading, result] of Object.entries(state.level2MasteryResults)) {
            updated[heading] = {
              avgTime: result.time,
              mistakes: result.mistakes,
              reps: 1,
              status: result.status,
            };
          }
          return { level2PracticeData: updated, level2PracticeDataSource: 'mastery' as const, level2PracticeDataUpdatedAt: Date.now() };
        });
      },

      saveLevel2FocusSelection: (headings) => {
        set({ level2FocusSelection: headings });
      },

      resetLevel2PracticeData: () => {
        set({ level2PracticeData: {}, level2PracticeDataSource: null, level2PracticeDataUpdatedAt: null });
      },

      resetLevel2MasteryResults: () => {
        set({ level2MasteryResults: {}, level2MasteryLastElapsed: 0, level2MasteryLastMistakes: 0, level2MasteryLastTotalResponses: 0 });
      },

      saveLevel2MasteryChallengeBest: (score, time, accuracy, totalResponses) => {
        set((state) => {
          const existing = state.level2MasteryChallengeBest;
          const isBetter = !existing || score > existing.score || (score === existing.score && accuracy > existing.accuracy);
          return {
            level2MasteryChallengeBest: isBetter ? { score, time, accuracy, totalResponses } : state.level2MasteryChallengeBest,
          };
        });
      },

      resetLevel2MasteryChallengeBest: () => {
        set({ level2MasteryChallengeBest: null });
      },

      toggleUnlockAllLevels: () => {
        set((state) => ({ unlockAllLevels: !state.unlockAllLevels }));
      },

      resetProgress: () => {
        set({
          deckProgress: { unlockedCount: 1, masteredHeadings: [], everMasteredHeadings: [], totalReps: 0 },
          level2DeckProgress: { unlockedCount: 1, masteredHeadings: [], everMasteredHeadings: [], totalReps: 0 },
          trialBestTimes: {},
          masteryChallengeBest: null,
          practiceData: {},
          masteryResults: {},
          focusSelection: [],
          practiceDataSource: null,
          practiceDataUpdatedAt: null,
          masteryLastElapsed: 0,
          masteryLastMistakes: 0,
          masteryLastTotalResponses: 0,
          level2PracticeData: {},
          level2MasteryResults: {},
          level2FocusSelection: [],
          level2PracticeDataSource: null,
          level2PracticeDataUpdatedAt: null,
          level2MasteryChallengeBest: null,
          level2MasteryLastElapsed: 0,
          level2MasteryLastMistakes: 0,
          level2MasteryLastTotalResponses: 0,
          stats: { ...INITIAL_STATS },
        });
      },

      exportState: () => {
        const { deckProgress, level2DeckProgress, trialBestTimes, masteryChallengeBest, stats, practiceData, masteryResults, focusSelection, practiceDataSource, practiceDataUpdatedAt, masteryLastElapsed, masteryLastMistakes, masteryLastTotalResponses, level2PracticeData, level2MasteryResults, level2FocusSelection, level2PracticeDataSource, level2PracticeDataUpdatedAt, level2MasteryChallengeBest, level2MasteryLastElapsed, level2MasteryLastMistakes, level2MasteryLastTotalResponses } = get();
        return btoa(JSON.stringify({ deckProgress, level2DeckProgress, trialBestTimes, masteryChallengeBest, stats, practiceData, masteryResults, focusSelection, practiceDataSource, practiceDataUpdatedAt, masteryLastElapsed, masteryLastMistakes, masteryLastTotalResponses, level2PracticeData, level2MasteryResults, level2FocusSelection, level2PracticeDataSource, level2PracticeDataUpdatedAt, level2MasteryChallengeBest, level2MasteryLastElapsed, level2MasteryLastMistakes, level2MasteryLastTotalResponses }));
      },

      importState: (data) => {
        try {
          const parsed = JSON.parse(atob(data));
          if (!parsed.deckProgress || typeof parsed.deckProgress.unlockedCount !== 'number') {
            return false;
          }
          set({
            deckProgress: parsed.deckProgress,
            level2DeckProgress: parsed.level2DeckProgress || { unlockedCount: 1, masteredHeadings: [], everMasteredHeadings: [], totalReps: 0 },
            trialBestTimes: parsed.trialBestTimes || {},
            masteryChallengeBest: parsed.masteryChallengeBest || null,
            stats: parsed.stats || { ...INITIAL_STATS },
            practiceData: parsed.practiceData || {},
            masteryResults: parsed.masteryResults || {},
            focusSelection: parsed.focusSelection || [],
            practiceDataSource: parsed.practiceDataSource || null,
            practiceDataUpdatedAt: parsed.practiceDataUpdatedAt || null,
            masteryLastElapsed: parsed.masteryLastElapsed || 0,
            masteryLastMistakes: parsed.masteryLastMistakes || 0,
            masteryLastTotalResponses: parsed.masteryLastTotalResponses || 0,
            level2PracticeData: parsed.level2PracticeData || {},
            level2MasteryResults: parsed.level2MasteryResults || {},
            level2FocusSelection: parsed.level2FocusSelection || [],
            level2PracticeDataSource: parsed.level2PracticeDataSource || null,
            level2PracticeDataUpdatedAt: parsed.level2PracticeDataUpdatedAt || null,
            level2MasteryChallengeBest: parsed.level2MasteryChallengeBest || null,
            level2MasteryLastElapsed: parsed.level2MasteryLastElapsed || 0,
            level2MasteryLastMistakes: parsed.level2MasteryLastMistakes || 0,
            level2MasteryLastTotalResponses: parsed.level2MasteryLastTotalResponses || 0,
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
      merge: (persisted: any, current: AppState) => ({
        ...current,
        ...persisted,
        masteryChallengeBest: persisted?.masteryChallengeBest ?? null,
        deckProgress: {
            unlockedCount: persisted?.deckProgress?.unlockedCount ?? 1,
            masteredHeadings: persisted?.deckProgress?.masteredHeadings ?? [],
            everMasteredHeadings: persisted?.deckProgress?.everMasteredHeadings ?? persisted?.deckProgress?.masteredHeadings ?? [],
            totalReps: persisted?.deckProgress?.totalReps ?? 0,
          },
          level2DeckProgress: {
            unlockedCount: persisted?.level2DeckProgress?.unlockedCount ?? 1,
            masteredHeadings: persisted?.level2DeckProgress?.masteredHeadings ?? [],
            everMasteredHeadings: persisted?.level2DeckProgress?.everMasteredHeadings ?? persisted?.level2DeckProgress?.masteredHeadings ?? [],
            totalReps: persisted?.level2DeckProgress?.totalReps ?? 0,
          },
          practiceData: persisted?.practiceData ?? {},
          masteryResults: persisted?.masteryResults ?? {},
          focusSelection: persisted?.focusSelection ?? [],
          practiceDataSource: persisted?.practiceDataSource ?? null,
          practiceDataUpdatedAt: persisted?.practiceDataUpdatedAt ?? null,
          masteryLastElapsed: persisted?.masteryLastElapsed ?? 0,
          masteryLastMistakes: persisted?.masteryLastMistakes ?? 0,
          masteryLastTotalResponses: persisted?.masteryLastTotalResponses ?? 0,
          level2PracticeData: persisted?.level2PracticeData ?? {},
          level2MasteryResults: persisted?.level2MasteryResults ?? {},
          level2FocusSelection: persisted?.level2FocusSelection ?? [],
          level2PracticeDataSource: persisted?.level2PracticeDataSource ?? null,
          level2PracticeDataUpdatedAt: persisted?.level2PracticeDataUpdatedAt ?? null,
          level2MasteryChallengeBest: persisted?.level2MasteryChallengeBest ?? null,
          level2MasteryLastElapsed: persisted?.level2MasteryLastElapsed ?? 0,
          level2MasteryLastMistakes: persisted?.level2MasteryLastMistakes ?? 0,
          level2MasteryLastTotalResponses: persisted?.level2MasteryLastTotalResponses ?? 0,
      }),
      partialize: (state) => ({
        deckProgress: state.deckProgress,
        level2DeckProgress: state.level2DeckProgress,
        trialBestTimes: state.trialBestTimes,
        masteryChallengeBest: state.masteryChallengeBest,
        stats: state.stats,
        unlockAllLevels: state.unlockAllLevels,
        practiceData: state.practiceData,
        masteryResults: state.masteryResults,
        focusSelection: state.focusSelection,
        practiceDataSource: state.practiceDataSource,
        practiceDataUpdatedAt: state.practiceDataUpdatedAt,
        masteryLastElapsed: state.masteryLastElapsed,
        masteryLastMistakes: state.masteryLastMistakes,
        masteryLastTotalResponses: state.masteryLastTotalResponses,
        level2PracticeData: state.level2PracticeData,
        level2MasteryResults: state.level2MasteryResults,
        level2FocusSelection: state.level2FocusSelection,
        level2PracticeDataSource: state.level2PracticeDataSource,
        level2PracticeDataUpdatedAt: state.level2PracticeDataUpdatedAt,
        level2MasteryChallengeBest: state.level2MasteryChallengeBest,
        level2MasteryLastElapsed: state.level2MasteryLastElapsed,
        level2MasteryLastMistakes: state.level2MasteryLastMistakes,
        level2MasteryLastTotalResponses: state.level2MasteryLastTotalResponses,
      }),
    },
  ),
);
