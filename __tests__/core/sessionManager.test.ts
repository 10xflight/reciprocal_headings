import { SessionManager } from '../../src/state/sessionManager';
import { DeckEngine } from '../../src/core/algorithms/trainingEngine';
import { HEADING_PACKETS } from '../../src/core/data/headingPackets';

describe('SessionManager', () => {
  it('gets next heading from engine', () => {
    const engine = new DeckEngine();
    const session = new SessionManager(engine);
    const heading = session.getNextHeading();
    expect(heading).toBe('36');
    expect(session.getCurrentHeading()).toBe('36');
  });

  it('tracks elapsed time', () => {
    const engine = new DeckEngine();
    const session = new SessionManager(engine);
    session.startTimer();
    const elapsed = session.getTimeElapsed();
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(100);
  });

  it('submitResponseDeck returns result and engine output', () => {
    const engine = new DeckEngine();
    const session = new SessionManager(engine);
    session.getNextHeading();
    const correctWedge = HEADING_PACKETS['36'].wedgeId;
    const { result, engineResult } = session.submitResponseDeck(correctWedge, 500);
    expect(result.isCorrect).toBe(true);
    expect(engineResult.feedbackColor).toBe('green');
  });

  it('submitResponseDeck handles wrong answer', () => {
    const engine = new DeckEngine();
    const session = new SessionManager(engine);
    session.getNextHeading();
    const { result, engineResult } = session.submitResponseDeck(-1, 500);
    expect(result.isCorrect).toBe(false);
    expect(engineResult.feedbackColor).toBe('red');
  });
});
