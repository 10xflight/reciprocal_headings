import { SessionManager } from '../../src/state/sessionManager';
import { DeckEngine } from '../../src/core/algorithms/trainingEngine';
import { HEADING_PACKETS } from '../../src/core/data/headingPackets';

describe('Session flow integration', () => {
  it('full flow: draw, answer correctly, check mastery', () => {
    const engine = new DeckEngine();
    const session = new SessionManager(engine);
    const heading = session.getNextHeading();
    const correctWedge = HEADING_PACKETS[heading].wedgeId;

    const { result, engineResult } = session.submitResponseDeck(correctWedge, 500);
    expect(result.isCorrect).toBe(true);
    expect(engineResult.feedbackColor).toBe('green');
    expect(engineResult.isMastered).toBe(true);
    expect(engineResult.allMastered).toBe(true);
  });

  it('wrong answer requeues at front', () => {
    const engine = new DeckEngine();
    const session = new SessionManager(engine);
    const heading = session.getNextHeading();

    session.submitResponseDeck(-1, 500);
    // Same heading should be next (wrong → position 0)
    const next = session.getNextHeading();
    expect(next).toBe(heading);
  });

  it('growing deck: master triggers auto-unlock', () => {
    const engine = new DeckEngine();
    const session = new SessionManager(engine);

    // Master first heading
    session.getNextHeading();
    const correctWedge = HEADING_PACKETS['36'].wedgeId;
    const { engineResult } = session.submitResponseDeck(correctWedge, 500);
    expect(engineResult.allMastered).toBe(true);
    expect(engineResult.newHeadingUnlocked).toBe(true);

    // Auto-unlock added next heading
    expect(engine.getDeckSize()).toBe(2);
    expect(engine.allMastered()).toBe(false); // new heading not mastered
  });
});
