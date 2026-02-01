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
  INTER_REP_DELAY: 1000,
} as const;
