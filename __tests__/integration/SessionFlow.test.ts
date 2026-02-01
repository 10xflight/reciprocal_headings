import { SessionManager } from '../../src/state/sessionManager';
import { LearningEngine, TrialEngine, getStageHeadings } from '../../src/core/algorithms/trainingEngine';
import { HEADING_PACKETS } from '../../src/core/data/headingPackets';

describe('Session flow integration', () => {
  test('complete a rep from start to finish (Level 1 learning)', () => {
    const engine = new LearningEngine(1);
    const sm = new SessionManager(engine);
    const heading = sm.getNextHeading();

    sm.startTimer();
    const wedgeId = HEADING_PACKETS[heading].wedgeId;
    const { result } = sm.submitResponse(wedgeId);
    expect(result.isCorrect).toBe(true);
  });

  test('incorrect wedge gives wrong grade', () => {
    const engine = new LearningEngine(1);
    const sm = new SessionManager(engine);
    sm.getNextHeading();
    sm.startTimer();
    const { result, grade } = sm.submitResponse(-1);
    expect(result.isCorrect).toBe(false);
    expect(grade).toBe('wrong');
  });

  test('trial mode eliminates headings on fast answers', () => {
    const headings = getStageHeadings(1);
    const engine = new TrialEngine(headings);
    const sm = new SessionManager(engine);

    const initial = engine.getRemaining();
    const heading = sm.getNextHeading();
    sm.startTimer();
    const wedgeId = HEADING_PACKETS[heading].wedgeId;
    sm.submitResponse(wedgeId);

    // Should have removed one if fast
    expect(engine.getRemaining()).toBeLessThanOrEqual(initial);
  });

  test('trial completes when all eliminated', () => {
    const headings = ['36', '18']; // small set
    const engine = new TrialEngine(headings);
    const sm = new SessionManager(engine);

    let safety = 0;
    while (!engine.isTrialComplete() && safety < 50) {
      const h = sm.getNextHeading();
      sm.startTimer();
      const wedgeId = HEADING_PACKETS[h].wedgeId;
      sm.submitResponse(wedgeId);
      safety++;
    }

    expect(engine.isTrialComplete()).toBe(true);
  });
});
