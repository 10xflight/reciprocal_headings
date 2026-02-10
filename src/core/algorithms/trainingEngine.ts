export type TrainingGrade = 'fast' | 'slow' | 'wrong';

export type FeedbackColor = 'green' | 'amber' | 'red';

export interface RecordResultOutput {
  feedbackColor: FeedbackColor;
  isMastered: boolean;
  allMastered: boolean;
  /** True if a new heading was auto-unlocked this rep */
  newHeadingUnlocked: boolean;
}

/** The 36 headings in unlock order — cardinals first, then intercardinals, then fill. */
export const MASTER_SEQUENCE: string[] = [
  '36', '18', '09', '27',
  '05', '23', '14', '32',
  '01', '19', '10', '28', '04', '22', '13', '31',
  '02', '20', '08', '26', '06', '24', '15', '33',
  '35', '17', '07', '25', '03', '21', '12', '30', '34', '16', '11', '29',
];

/** Grid layout: reciprocal pairs left-right, following master sequence order. */
export const GRID_PAIRS: [string, string][] = [
  ['36', '18'], ['09', '27'],
  ['05', '23'], ['14', '32'],
  ['01', '19'], ['10', '28'], ['04', '22'], ['13', '31'],
  ['02', '20'], ['08', '26'], ['06', '24'], ['15', '33'],
  ['35', '17'], ['07', '25'], ['03', '21'], ['12', '30'], ['34', '16'], ['11', '29'],
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class DeckEngine {
  private deck: string[];
  private queue: string[];
  private mastered: Set<string> = new Set();
  private everMastered: Set<string> = new Set();
  private penaltyBox: Set<string> = new Set();
  private seenCount: Record<string, number> = {};
  private mistakeCount: Record<string, number> = {};
  private slowCount: Record<string, number> = {};
  private totalMistakes: number = 0;
  private unlockIndex: number;

  constructor() {
    this.deck = [MASTER_SEQUENCE[0]];
    this.queue = [MASTER_SEQUENCE[0]];
    this.unlockIndex = 1;
    this.seenCount[MASTER_SEQUENCE[0]] = 0;
    this.mistakeCount[MASTER_SEQUENCE[0]] = 0;
    this.slowCount[MASTER_SEQUENCE[0]] = 0;
  }

  static restore(unlockedCount: number, masteredHeadings: string[], everMasteredHeadings?: string[]): DeckEngine {
    const engine = new DeckEngine();
    // Unlock headings up to saved count
    while (engine.deck.length < unlockedCount && engine.unlockIndex < MASTER_SEQUENCE.length) {
      const h = MASTER_SEQUENCE[engine.unlockIndex];
      engine.deck.push(h);
      engine.seenCount[h] = 0;
      engine.mistakeCount[h] = 0;
      engine.slowCount[h] = 0;
      engine.unlockIndex++;
    }
    // Restore mastery
    for (const h of masteredHeadings) {
      if (engine.deck.includes(h)) {
        engine.mastered.add(h);
      }
    }
    // Restore everMastered (includes all masteredHeadings plus any that lost mastery)
    const everSet = everMasteredHeadings || masteredHeadings;
    for (const h of everSet) {
      engine.everMastered.add(h);
    }
    // Build queue: unmastered first (shuffled), then mastered (shuffled)
    const unmastered = engine.deck.filter((h) => !engine.mastered.has(h));
    const mastered = engine.deck.filter((h) => engine.mastered.has(h));
    engine.queue = [...shuffle(unmastered), ...shuffle(mastered)];
    if (engine.queue.length === 0) engine.queue = shuffle([...engine.deck]);
    return engine;
  }

  drawNext(): string {
    const heading = this.queue[0];
    this.seenCount[heading] = (this.seenCount[heading] || 0) + 1;
    return heading;
  }

  recordResult(headingId: string, timeMs: number, isCorrect: boolean): RecordResultOutput {
    this.queue.shift();
    const len = this.queue.length;
    const wasInPenalty = this.penaltyBox.has(headingId);
    let feedbackColor: FeedbackColor;
    let isMastered = false;

    if (!isCorrect || timeMs > 2000) {
      // Wrong or timeout → position 0 (penalty box), remove mastery
      feedbackColor = 'red';
      this.mastered.delete(headingId);
      this.penaltyBox.add(headingId);
      this.mistakeCount[headingId] = (this.mistakeCount[headingId] || 0) + 1;
      this.totalMistakes++;
      this.queue.unshift(headingId);
    } else if (wasInPenalty) {
      // In penalty box: need correct <=1.0s to escape
      if (timeMs <= 1000) {
        // Escape penalty → front 10%, NOT mastered
        feedbackColor = 'green';
        this.penaltyBox.delete(headingId);
        const maxPos = Math.max(1, Math.ceil(len / 10));
        const pos = Math.floor(Math.random() * maxPos) + 1;
        this.queue.splice(pos, 0, headingId);
      } else {
        // Still in penalty (correct but >= 1.0s)
        feedbackColor = 'amber';
        this.slowCount[headingId] = (this.slowCount[headingId] || 0) + 1;
        this.queue.unshift(headingId);
      }
    } else if (timeMs > 1000) {
      // Normal queue, slow (>1.0s to 2.0s) → not mastered
      feedbackColor = 'amber';
      this.slowCount[headingId] = (this.slowCount[headingId] || 0) + 1;

      if (timeMs < 1500) {
        // 1.0-1.5s → 25-50% range
        const minPos = Math.ceil(len / 4);
        const maxPos = Math.ceil(len / 2);
        const pos = minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
        this.queue.splice(pos, 0, headingId);
      } else {
        // 1.5-2.0s → front 25%
        const maxPos = Math.ceil(len / 4);
        const pos = Math.floor(Math.random() * (maxPos + 1));
        this.queue.splice(pos, 0, headingId);
      }
    } else {
      // Normal queue, fast (<=1.0s) → mastered
      feedbackColor = 'green';
      isMastered = true;
      this.mastered.add(headingId);
      this.everMastered.add(headingId);

      if (timeMs < 800) {
        // <0.8s → back 50%
        const minPos = Math.ceil(len / 2);
        const pos = minPos + Math.floor(Math.random() * (len - minPos + 1));
        this.queue.splice(pos, 0, headingId);
      } else {
        // 0.8-1.0s → 25-50% range
        const minPos = Math.ceil(len / 4);
        const maxPos = Math.ceil(len / 2);
        const pos = minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
        this.queue.splice(pos, 0, headingId);
      }
    }

    // Auto-unlock: if all non-everMastered headings are currently mastered, unlock next
    let newHeadingUnlocked = false;
    const newHeadingsMastered = this.deck.every((h) => this.everMastered.has(h) || this.mastered.has(h));
    const allMastered = newHeadingsMastered;
    if (newHeadingsMastered && this.unlockIndex < MASTER_SEQUENCE.length) {
      this.addNextHeading();
      newHeadingUnlocked = true;
    }

    return { feedbackColor, isMastered, allMastered, newHeadingUnlocked };
  }

  allMastered(): boolean {
    return this.mastered.size >= this.deck.length;
  }

  addNextHeading(): string | null {
    if (this.unlockIndex >= MASTER_SEQUENCE.length) return null;
    const heading = MASTER_SEQUENCE[this.unlockIndex];
    this.deck.push(heading);
    const len = this.queue.length;
    const maxPos = Math.max(1, Math.ceil(len / 10));
    const pos = Math.floor(Math.random() * maxPos) + 1;
    this.queue.splice(Math.min(pos, len), 0, heading);
    this.seenCount[heading] = 0;
    this.mistakeCount[heading] = 0;
    this.slowCount[heading] = 0;
    this.unlockIndex++;
    return heading;
  }

  isComplete(): boolean {
    return this.unlockIndex >= MASTER_SEQUENCE.length && this.allMastered();
  }

  getDeckSize(): number {
    return this.deck.length;
  }

  getUnlockedCount(): number {
    return this.deck.length;
  }

  getMasteredCount(): number {
    return this.mastered.size;
  }

  getMasteredHeadings(): Set<string> {
    return new Set(this.mastered);
  }

  getEverMasteredHeadings(): Set<string> {
    return new Set(this.everMastered);
  }

  getDeckSet(): Set<string> {
    return new Set(this.deck);
  }

  isInPenaltyBox(headingId: string): boolean {
    return this.penaltyBox.has(headingId);
  }

  getTotalMistakes(): number {
    return this.totalMistakes;
  }

  getHeadingReport(): { heading: string; reps: number; mistakes: number; slows: number; mastered: boolean }[] {
    return this.deck.map((h) => ({
      heading: h,
      reps: this.seenCount[h] || 0,
      mistakes: this.mistakeCount[h] || 0,
      slows: this.slowCount[h] || 0,
      mastered: this.mastered.has(h),
    }));
  }

  getDeck(): string[] {
    return [...this.deck];
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export class TrialEngine {
  private queue: string[];
  private mistakes: number = 0;

  constructor(headingIds: string[]) {
    this.queue = shuffle([...headingIds]);
  }

  drawNext(): string {
    return this.queue[0];
  }

  recordResult(headingId: string, grade: TrainingGrade): void {
    this.queue.shift();

    if (grade === 'fast') {
      // Remove permanently (already shifted)
    } else {
      this.mistakes++;
      const len = this.queue.length;
      const pos = Math.floor(Math.random() * (len + 1));
      this.queue.splice(pos, 0, headingId);
    }
  }

  isTrialComplete(): boolean {
    return this.queue.length === 0;
  }

  getRemaining(): number {
    return this.queue.length;
  }

  getMistakes(): number {
    return this.mistakes;
  }
}

export interface ChallengeResultOutput {
  feedbackColor: FeedbackColor;
  removed: boolean;
}

export class MasteryChallengeEngine {
  private queue: string[];
  private firstAttempt: Record<string, boolean> = {};
  private timeLimit: number;

  constructor(timeLimit: number = 1200) {
    this.queue = shuffle([...MASTER_SEQUENCE]);
    this.timeLimit = timeLimit;
  }

  drawNext(): string {
    return this.queue[0];
  }

  recordResult(headingId: string, timeMs: number, isCorrect: boolean): ChallengeResultOutput {
    this.queue.shift();

    // Track first attempt per heading
    if (!(headingId in this.firstAttempt)) {
      this.firstAttempt[headingId] = isCorrect && timeMs < this.timeLimit;
    }

    let feedbackColor: FeedbackColor;
    let removed = false;

    if (isCorrect && timeMs <= this.timeLimit) {
      feedbackColor = 'green';
      removed = true; // already shifted out
    } else {
      feedbackColor = 'red';
      const len = this.queue.length;
      // Never position 0 (would be immediate next) - at least 1 card away
      const pos = len > 0 ? 1 + Math.floor(Math.random() * len) : 0;
      this.queue.splice(pos, 0, headingId);
    }

    return { feedbackColor, removed };
  }

  isComplete(): boolean {
    return this.queue.length === 0;
  }

  getRemaining(): number {
    return this.queue.length;
  }

  getFirstTimeCorrectCount(): number {
    return Object.values(this.firstAttempt).filter(Boolean).length;
  }

  getAccuracy(): number {
    const count = this.getFirstTimeCorrectCount();
    return count / 36;
  }

  getScore(totalTimeMs: number): number {
    const accuracy = this.getAccuracy();
    if (accuracy === 0) return Infinity;
    return totalTimeMs / accuracy;
  }
}

/** Grade a response for visual feedback. */
export function gradeResponse(isCorrect: boolean, timeMs: number, timeLimit: number): TrainingGrade {
  if (!isCorrect || timeMs >= timeLimit) return 'wrong';
  if (timeMs < 1000) return 'fast';
  return 'slow';
}
