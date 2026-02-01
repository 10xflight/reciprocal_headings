import { LearningEngine, TrialEngine, gradeResponse, TrainingGrade } from '../core/algorithms/trainingEngine';
import { validateResponse } from '../core/algorithms/validator';
import { ValidationResult, TIMING } from '../core/types';

export class SessionManager {
  private engine: LearningEngine | TrialEngine;
  private currentHeading: string = '';
  private responseStartTime: number = 0;

  constructor(engine: LearningEngine | TrialEngine) {
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

  submitResponse(response: number): { result: ValidationResult; grade: TrainingGrade } {
    const timeMs = this.getTimeElapsed();
    const result = validateResponse(1, this.currentHeading, response, timeMs);
    const grade = gradeResponse(result.isCorrect, timeMs, TIMING.LEVEL1_LIMIT);

    this.engine.recordResult(this.currentHeading, grade);

    return { result, grade };
  }

  getEngine(): LearningEngine | TrialEngine {
    return this.engine;
  }
}
