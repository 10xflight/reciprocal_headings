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

export type TrainingGrade = 'fast' | 'slow' | 'wrong';

export interface TrialResult {
  trialId: string;
  time: number;
  mistakes: number;
  headingsPerMinute: number;
}

export interface UserStats {
  totalReps: number;
  totalTimeMs: number;
  bestStreak: number;
  currentStreak: number;
}

export const TIMING = {
  LEVEL1_LIMIT: 2000,
  LEVEL2_LIMIT: 2500, // +500ms for numpad lookup time
  LEVEL2_OFFSET: 500, // Offset to adjust thresholds for Level 2
  VERBAL_LIMIT: 1500, // Levels 3-5 verbal response time limit
  INTER_REP_DELAY: 1000,
} as const;
