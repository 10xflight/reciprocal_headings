import { SessionManager } from '../../src/state/sessionManager';
import { LearningEngine } from '../../src/core/algorithms/trainingEngine';
import { HEADING_PACKETS } from '../../src/core/data/headingPackets';

describe('SessionManager', () => {
  test('getNextHeading returns a valid heading', () => {
    const engine = new LearningEngine(1);
    const sm = new SessionManager(engine);
    const heading = sm.getNextHeading();
    expect(HEADING_PACKETS[heading]).toBeDefined();
  });

  test('getCurrentHeading returns current heading', () => {
    const engine = new LearningEngine(1);
    const sm = new SessionManager(engine);
    const heading = sm.getNextHeading();
    expect(sm.getCurrentHeading()).toBe(heading);
  });

  test('timer tracks elapsed time', () => {
    const engine = new LearningEngine(1);
    const sm = new SessionManager(engine);
    sm.getNextHeading();
    sm.startTimer();
    expect(sm.getTimeElapsed()).toBeGreaterThanOrEqual(0);
  });

  test('submitResponse returns validation result and grade', () => {
    const engine = new LearningEngine(1);
    const sm = new SessionManager(engine);
    const heading = sm.getNextHeading();
    sm.startTimer();
    const wedgeId = HEADING_PACKETS[heading].wedgeId;
    const { result, grade } = sm.submitResponse(wedgeId);
    expect(result.isCorrect).toBe(true);
    expect(['fast', 'slow']).toContain(grade);
  });

  test('incorrect response returns wrong grade', () => {
    const engine = new LearningEngine(1);
    const sm = new SessionManager(engine);
    sm.getNextHeading();
    sm.startTimer();
    const { result, grade } = sm.submitResponse(-1);
    expect(result.isCorrect).toBe(false);
    expect(grade).toBe('wrong');
  });

  test('getEngine returns the engine', () => {
    const engine = new LearningEngine(1);
    const sm = new SessionManager(engine);
    expect(sm.getEngine()).toBe(engine);
  });
});
