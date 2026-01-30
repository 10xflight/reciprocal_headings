export type CompassDirection =
  | 'North'
  | 'North East'
  | 'East'
  | 'South East'
  | 'South'
  | 'South West'
  | 'West'
  | 'North West';

export interface HeadingPacket {
  id: string;
  reciprocal: string;
  direction: CompassDirection;
  wedgeId: number;
}

export interface WedgeDefinition {
  id: number;
  direction: CompassDirection;
  headings: string[];
  angle: number;
}

export type FeedbackState = 'green' | 'amber' | 'red';

export interface ValidationResult {
  isCorrect: boolean;
  state: FeedbackState;
  feedback?: string;
  correctAnswer?: { reciprocal: string; direction: CompassDirection };
}

export interface QueueItem {
  headingId: string;
  stability: number;
  consecutiveGreens: number;
  lastResult: FeedbackState | null;
}

export interface SnowballState {
  activeQueue: QueueItem[];
  unlockedIndex: number;
}

export interface LevelProgress {
  [headingId: string]: {
    stability: number;
    consecutiveGreens: number;
    lastAttempt: number;
  };
}

export interface UserStats {
  totalReps: number;
  totalTimeMs: number;
  bestStreak: number;
  currentStreak: number;
}

export interface AppState {
  unlockedIndex: number;
  levels: Record<number, LevelProgress>;
  stats: UserStats;
}

export const TIMING = {
  NON_VERBAL_LIMIT: 1000,
  VERBAL_LIMIT: 1500,
  INTER_REP_DELAY: 1000,
} as const;
