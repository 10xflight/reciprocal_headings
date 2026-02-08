import { FeedbackColor, RecordResultOutput } from './trainingEngine';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Same algorithm as DeckEngine but accepts a custom heading sequence.
 * Used by Focus mode (custom subset) and Optimize mode (weighted all-36).
 */
export class FocusDeckEngine {
  private sequence: string[];
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

  constructor(sequence: string[]) {
    this.sequence = [...sequence];
    this.deck = [sequence[0]];
    this.queue = [sequence[0]];
    this.unlockIndex = 1;
    this.seenCount[sequence[0]] = 0;
    this.mistakeCount[sequence[0]] = 0;
    this.slowCount[sequence[0]] = 0;
  }

  /**
   * Create engine with all headings unlocked and queue in given order (no shuffle).
   * Used by Optimize mode for pre-weighted queue.
   */
  static restoreAllUnlocked(orderedSequence: string[]): FocusDeckEngine {
    const engine = new FocusDeckEngine(orderedSequence);
    // Unlock all remaining headings
    while (engine.unlockIndex < orderedSequence.length) {
      const h = orderedSequence[engine.unlockIndex];
      engine.deck.push(h);
      engine.seenCount[h] = 0;
      engine.mistakeCount[h] = 0;
      engine.slowCount[h] = 0;
      engine.unlockIndex++;
    }
    // Queue in the given order (no shuffle — pre-weighted by caller)
    engine.queue = [...orderedSequence];
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
      feedbackColor = 'red';
      this.mastered.delete(headingId);
      this.penaltyBox.add(headingId);
      this.mistakeCount[headingId] = (this.mistakeCount[headingId] || 0) + 1;
      this.totalMistakes++;
      this.queue.unshift(headingId);
    } else if (wasInPenalty) {
      if (timeMs <= 1000) {
        feedbackColor = 'green';
        this.penaltyBox.delete(headingId);
        const maxPos = Math.max(1, Math.ceil(len / 10));
        const pos = Math.floor(Math.random() * maxPos) + 1;
        this.queue.splice(pos, 0, headingId);
      } else {
        feedbackColor = 'amber';
        this.slowCount[headingId] = (this.slowCount[headingId] || 0) + 1;
        this.queue.unshift(headingId);
      }
    } else if (timeMs > 1000) {
      feedbackColor = 'amber';
      this.slowCount[headingId] = (this.slowCount[headingId] || 0) + 1;

      if (timeMs < 1500) {
        const minPos = Math.ceil(len / 4);
        const maxPos = Math.ceil(len / 2);
        const pos = minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
        this.queue.splice(pos, 0, headingId);
      } else {
        const maxPos = Math.ceil(len / 4);
        const pos = Math.floor(Math.random() * (maxPos + 1));
        this.queue.splice(pos, 0, headingId);
      }
    } else {
      feedbackColor = 'green';
      isMastered = true;
      this.mastered.add(headingId);
      this.everMastered.add(headingId);

      if (timeMs < 800) {
        const minPos = Math.ceil(len / 2);
        const pos = minPos + Math.floor(Math.random() * (len - minPos + 1));
        this.queue.splice(pos, 0, headingId);
      } else {
        const minPos = Math.ceil(len / 4);
        const maxPos = Math.ceil(len / 2);
        const pos = minPos + Math.floor(Math.random() * (maxPos - minPos + 1));
        this.queue.splice(pos, 0, headingId);
      }
    }

    // Auto-unlock
    let newHeadingUnlocked = false;
    const newHeadingsMastered = this.deck.every((h) => this.everMastered.has(h) || this.mastered.has(h));
    const allMastered = newHeadingsMastered;
    if (newHeadingsMastered && this.unlockIndex < this.sequence.length) {
      this.addNextHeading();
      newHeadingUnlocked = true;
    }

    return { feedbackColor, isMastered, allMastered, newHeadingUnlocked };
  }

  allMastered(): boolean {
    return this.mastered.size >= this.deck.length;
  }

  addNextHeading(): string | null {
    if (this.unlockIndex >= this.sequence.length) return null;
    const heading = this.sequence[this.unlockIndex];
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
    return this.unlockIndex >= this.sequence.length && this.allMastered();
  }

  getDeckSize(): number {
    return this.deck.length;
  }

  getUnlockedCount(): number {
    return this.deck.length;
  }

  getSequenceLength(): number {
    return this.sequence.length;
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
