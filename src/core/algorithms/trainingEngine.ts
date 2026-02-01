export type TrainingGrade = 'fast' | 'slow' | 'wrong';

/** 6 sets of 6 headings each (36 total). Each set contains a heading and its reciprocal. */
export const SETS: string[][] = [
  ['36', '18', '09', '27', '05', '23'],  // Set 1: Cardinals + first intercardinals
  ['14', '32', '01', '19', '10', '28'],  // Set 2
  ['04', '22', '13', '31', '02', '20'],  // Set 3
  ['08', '26', '06', '24', '15', '33'],  // Set 4
  ['35', '17', '07', '25', '03', '21'],  // Set 5
  ['12', '30', '34', '16', '11', '29'],  // Set 6
];

/** 11 stages — each stage includes cumulative sets. */
export const STAGES: number[][] = [
  [0],           // Stage 1: Set 1
  [1],           // Stage 2: Set 2
  [0, 1],        // Stage 3: Sets 1+2
  [2],           // Stage 4: Set 3
  [0, 1, 2],     // Stage 5: Sets 1+2+3
  [3],           // Stage 6: Set 4
  [0, 1, 2, 3],  // Stage 7: Sets 1+2+3+4
  [4],           // Stage 8: Set 5
  [0, 1, 2, 3, 4],     // Stage 9: Sets 1-5
  [5],                  // Stage 10: Set 6
  [0, 1, 2, 3, 4, 5],  // Stage 11: All sets
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getHeadingsForStage(stage: number): string[] {
  const setIndices = STAGES[stage - 1];
  const headings: string[] = [];
  for (const idx of setIndices) {
    headings.push(...SETS[idx]);
  }
  return headings;
}

export class LearningEngine {
  private queue: string[];
  private seenCount: Record<string, number> = {};
  private mastered: Set<string> = new Set();
  private stumbled: Set<string> = new Set();
  private mistakeCount: Record<string, number> = {};
  private slowCount: Record<string, number> = {};
  private totalMistakes: number = 0;
  readonly stage: number;
  readonly totalHeadings: number;

  constructor(stage: number) {
    if (stage < 1 || stage > 11) throw new Error(`Invalid stage: ${stage}`);
    this.stage = stage;
    const headings = getHeadingsForStage(stage);
    this.totalHeadings = headings.length;
    this.queue = shuffle(headings);
    for (const h of headings) {
      this.seenCount[h] = 0;
      this.mistakeCount[h] = 0;
      this.slowCount[h] = 0;
    }
  }

  drawNext(): string {
    const heading = this.queue[0];
    this.seenCount[heading] = (this.seenCount[heading] || 0) + 1;
    return heading;
  }

  recordResult(headingId: string, grade: TrainingGrade): void {
    // Remove from front
    this.queue.shift();

    const len = this.queue.length;

    if (grade === 'fast') {
      this.mastered.add(headingId);
      // Insert in back 50% of queue
      const minPos = Math.ceil(len / 2);
      const pos = minPos + Math.floor(Math.random() * (len - minPos + 1));
      this.queue.splice(pos, 0, headingId);
    } else if (grade === 'slow') {
      this.stumbled.add(headingId);
      this.slowCount[headingId] = (this.slowCount[headingId] || 0) + 1;
      // Insert in first 50%
      const maxPos = Math.ceil(len / 2);
      const pos = Math.floor(Math.random() * (maxPos + 1));
      this.queue.splice(pos, 0, headingId);
    } else {
      // wrong — force as immediate next
      this.mastered.delete(headingId);
      this.stumbled.add(headingId);
      this.mistakeCount[headingId] = (this.mistakeCount[headingId] || 0) + 1;
      this.totalMistakes++;
      this.queue.unshift(headingId);
    }
  }

  isStageComplete(): boolean {
    return this.mastered.size >= this.totalHeadings;
  }

  getMasteredCount(): number {
    return this.mastered.size;
  }

  getMasteredHeadings(): string[] {
    return Array.from(this.mastered);
  }

  getTotalMistakes(): number {
    return this.totalMistakes;
  }

  getFirstTryMasteredCount(): number {
    return this.totalHeadings - this.stumbled.size;
  }

  getMistakesByHeading(): Record<string, number> {
    return { ...this.mistakeCount };
  }

  getSeenCount(): Record<string, number> {
    return { ...this.seenCount };
  }

  getSlowCountByHeading(): Record<string, number> {
    return { ...this.slowCount };
  }

  /** Full per-heading report for the results screen. */
  getHeadingReport(): { heading: string; reps: number; mistakes: number; slows: number; firstTry: boolean }[] {
    const headings = getHeadingsForStage(this.stage);
    return headings.map((h) => ({
      heading: h,
      reps: this.seenCount[h] || 0,
      mistakes: this.mistakeCount[h] || 0,
      slows: this.slowCount[h] || 0,
      firstTry: !this.stumbled.has(h),
    }));
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
      // Reinsert at random position
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

/** Grade a response based on correctness and time. */
export function gradeResponse(isCorrect: boolean, timeMs: number, timeLimit: number): TrainingGrade {
  if (!isCorrect || timeMs >= timeLimit) return 'wrong';
  if (timeMs < 1000) return 'fast';
  return 'slow';
}

/** Get all heading IDs for a given stage. */
export function getStageHeadings(stage: number): string[] {
  return getHeadingsForStage(stage);
}

/** Get stage display name. */
export function getStageName(stage: number): string {
  const setIndices = STAGES[stage - 1];
  return `Stage ${stage}`;
}

/** Get sets label for a stage, e.g. "Sets 1, 2, 3" */
export function getStageSets(stage: number): string {
  const setIndices = STAGES[stage - 1];
  const setNums = setIndices.map((i) => i + 1).join(', ');
  return `Sets ${setNums}`;
}
