import { DeckEngine, TrialEngine, MasteryChallengeEngine, gradeResponse, TrainingGrade, RecordResultOutput } from '../core/algorithms/trainingEngine';
import { FocusDeckEngine } from '../core/algorithms/focusDeckEngine';
import { validateResponse } from '../core/algorithms/validator';
import { ValidationResult, TIMING } from '../core/types';

type AnyEngine = DeckEngine | TrialEngine | MasteryChallengeEngine | FocusDeckEngine;

export class SessionManager {
  private engine: AnyEngine;
  private currentHeading: string = '';
  private responseStartTime: number = 0;

  constructor(engine: AnyEngine) {
    this.engine = engine;
  }

  getNextHeading(): string {
    this.currentHeading = this.engine.drawNext();
    return this.currentHeading;
  }

  getCurrentHeading(): string {
    return this.currentHeading;
  }

  startTimer(): void {
    this.responseStartTime = Date.now();
  }

  getTimeElapsed(): number {
    return Date.now() - this.responseStartTime;
  }

  submitResponseDeck(wedgeId: number, totalElapsed: number): { result: ValidationResult; engineResult: RecordResultOutput } {
    const result = validateResponse(1, this.currentHeading, wedgeId, totalElapsed);
    const engineResult = (this.engine as DeckEngine).recordResult(this.currentHeading, totalElapsed, result.isCorrect);
    return { result, engineResult };
  }

  submitResponseTrial(wedgeId: number): { result: ValidationResult; grade: TrainingGrade } {
    const timeMs = this.getTimeElapsed();
    const result = validateResponse(1, this.currentHeading, wedgeId, timeMs);
    const grade = gradeResponse(result.isCorrect, timeMs, TIMING.LEVEL1_LIMIT);
    (this.engine as TrialEngine).recordResult(this.currentHeading, grade);
    return { result, grade };
  }

  submitResponseFocusDeck(wedgeId: number, totalElapsed: number): { result: ValidationResult; engineResult: RecordResultOutput } {
    const result = validateResponse(1, this.currentHeading, wedgeId, totalElapsed);
    const engineResult = (this.engine as FocusDeckEngine).recordResult(this.currentHeading, totalElapsed, result.isCorrect);
    return { result, engineResult };
  }

  getEngine(): AnyEngine {
    return this.engine;
  }
}
