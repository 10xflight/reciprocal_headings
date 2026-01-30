import { SnowballManager } from '../core/algorithms/snowball';
import { validateResponse, VoiceResponse } from '../core/algorithms/validator';
import { ValidationResult, SnowballState } from '../core/types';

export class SessionManager {
  private level: number;
  private snowball: SnowballManager;
  private currentHeading: string = '';
  private responseStartTime: number = 0;
  private forceRetryHeading: string | null = null;
  private sandwichPhase: 'none' | 'different' | 'retry' = 'none';
  private onesDigit: string = '0';

  constructor(level: number, snowballState?: SnowballState) {
    this.level = level;
    this.snowball = new SnowballManager(snowballState);
  }

  /** Pick the next heading to show, respecting force-retry and sandwich rules. */
  getNextHeading(): string {
    if (this.forceRetryHeading) {
      if (this.sandwichPhase === 'none') {
        // Step 2: force retry of failed heading
        this.currentHeading = this.forceRetryHeading;
        this.sandwichPhase = 'different';
      } else if (this.sandwichPhase === 'different') {
        // Step 3: show a different heading
        let next = this.snowball.getNextItem();
        // Make sure it's different from the retry heading
        let attempts = 0;
        while (next === this.forceRetryHeading && attempts < 20) {
          next = this.snowball.getNextItem();
          attempts++;
        }
        this.currentHeading = next;
        this.sandwichPhase = 'retry';
      } else {
        // Step 4: show failed heading one more time, then clear
        this.currentHeading = this.forceRetryHeading;
        this.forceRetryHeading = null;
        this.sandwichPhase = 'none';
      }
    } else {
      this.currentHeading = this.snowball.getNextItem();
    }

    // Level 5: append random ones digit
    if (this.level === 5) {
      this.onesDigit = Math.floor(Math.random() * 10).toString();
    }

    return this.getCurrentStimulus();
  }

  /** The full stimulus string (2-digit for L1-4, 3-digit for L5). */
  getCurrentStimulus(): string {
    return this.level === 5 ? this.currentHeading + this.onesDigit : this.currentHeading;
  }

  /** The base 2-digit heading (for snowball tracking). */
  getCurrentBaseHeading(): string {
    return this.currentHeading;
  }

  /** Mark the moment the stimulus is shown. */
  startTimer(): void {
    this.responseStartTime = Date.now();
  }

  /** Milliseconds since startTimer was called. */
  getTimeElapsed(): number {
    return Date.now() - this.responseStartTime;
  }

  /** Validate the user's response and update snowball state. */
  submitResponse(response: number | string | VoiceResponse): ValidationResult {
    const timeMs = this.getTimeElapsed();
    const stimulus = this.getCurrentStimulus();
    const result = validateResponse(this.level, stimulus, response, timeMs);

    this.snowball.recordResult(this.currentHeading, result.state);

    // On failure, set up the sandwich retry sequence
    if (result.state === 'red') {
      this.forceRetryHeading = this.currentHeading;
      this.sandwichPhase = 'none';
    }

    return result;
  }

  /** Get snowball state for persistence. */
  getSnowballState(): SnowballState {
    return this.snowball.getState();
  }

  /** Check if all 36 headings are mastered at this level. */
  isLevelComplete(): boolean {
    return this.snowball.isAllMastered();
  }
}
