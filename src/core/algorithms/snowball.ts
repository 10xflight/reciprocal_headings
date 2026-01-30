import { QueueItem, SnowballState } from '../types';
import { MASTER_SEQUENCE } from '../data/masterSequence';

const STABILITY_THRESHOLD = 3;
const UNSTABLE_WEIGHT = 0.7;

export class SnowballManager {
  private state: SnowballState;

  constructor(savedState?: SnowballState) {
    this.state = savedState
      ? { activeQueue: [...savedState.activeQueue], unlockedIndex: savedState.unlockedIndex }
      : {
          activeQueue: [SnowballManager.createItem(MASTER_SEQUENCE[0])],
          unlockedIndex: 0,
        };
  }

  /** Weighted random selection — unstable items chosen ~70% of the time when they exist. */
  getNextItem(): string {
    const unstable = this.state.activeQueue.filter((i) => i.stability < STABILITY_THRESHOLD);
    const queue = this.state.activeQueue;

    if (unstable.length > 0 && Math.random() < UNSTABLE_WEIGHT) {
      return unstable[Math.floor(Math.random() * unstable.length)].headingId;
    }

    return queue[Math.floor(Math.random() * queue.length)].headingId;
  }

  /** Record a rep result and potentially expand the queue. */
  recordResult(headingId: string, result: 'green' | 'amber' | 'red'): void {
    const item = this.state.activeQueue.find((i) => i.headingId === headingId);
    if (!item) return;

    if (result === 'green') {
      item.consecutiveGreens++;
      if (item.consecutiveGreens >= STABILITY_THRESHOLD) {
        item.stability = STABILITY_THRESHOLD;
      }
    } else if (result === 'red') {
      item.stability = 0;
      item.consecutiveGreens = 0;
    }
    // amber: no change

    item.lastResult = result;
    this.checkExpansion();
  }

  /** Return serializable state for persistence. */
  getState(): SnowballState {
    return {
      activeQueue: this.state.activeQueue.map((i) => ({ ...i })),
      unlockedIndex: this.state.unlockedIndex,
    };
  }

  /** True when all 36 headings are stable. */
  isAllMastered(): boolean {
    return (
      this.state.activeQueue.length === MASTER_SEQUENCE.length &&
      this.state.activeQueue.every((i) => i.stability >= STABILITY_THRESHOLD)
    );
  }

  /** Current active queue (read-only copy). */
  getActiveQueue(): readonly QueueItem[] {
    return this.state.activeQueue;
  }

  getUnlockedIndex(): number {
    return this.state.unlockedIndex;
  }

  private checkExpansion(): void {
    const allStable = this.state.activeQueue.every((i) => i.stability >= STABILITY_THRESHOLD);

    if (allStable && this.state.unlockedIndex < MASTER_SEQUENCE.length - 1) {
      this.state.unlockedIndex++;
      this.state.activeQueue.push(
        SnowballManager.createItem(MASTER_SEQUENCE[this.state.unlockedIndex]),
      );
    }
  }

  private static createItem(headingId: string): QueueItem {
    return {
      headingId,
      stability: 0,
      consecutiveGreens: 0,
      lastResult: null,
    };
  }
}
