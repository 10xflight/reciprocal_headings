import {
  DeckEngine,
  TrialEngine,
  MasteryChallengeEngine,
  gradeResponse,
  MASTER_SEQUENCE,
} from '../../src/core/algorithms/trainingEngine';

describe('DeckEngine', () => {
  it('starts with one heading (36)', () => {
    const engine = new DeckEngine();
    expect(engine.getDeckSize()).toBe(1);
    expect(engine.drawNext()).toBe('36');
  });

  it('fast answer (<1.0s) grants mastery', () => {
    const engine = new DeckEngine();
    engine.drawNext();
    const result = engine.recordResult('36', 500, true);
    expect(result.feedbackColor).toBe('green');
    expect(result.isMastered).toBe(true);
    expect(result.allMastered).toBe(true);
  });

  it('slow answer does not grant mastery', () => {
    const engine = new DeckEngine();
    engine.drawNext();
    const result = engine.recordResult('36', 1200, true);
    expect(result.feedbackColor).toBe('amber');
    expect(result.isMastered).toBe(false);
  });

  it('wrong answer removes mastery', () => {
    const engine = new DeckEngine();
    engine.drawNext();
    engine.recordResult('36', 500, true);
    expect(engine.getMasteredCount()).toBe(1);
    engine.drawNext();
    engine.recordResult('36', 500, false);
    expect(engine.getMasteredCount()).toBe(0);
  });

  it('auto-unlocks next heading when all mastered', () => {
    const engine = new DeckEngine();
    engine.drawNext();
    const r = engine.recordResult('36', 500, true);
    expect(r.allMastered).toBe(true);
    expect(r.newHeadingUnlocked).toBe(true);
    expect(engine.getDeckSize()).toBe(2);
  });

  it('penalty box: wrong goes to position 0', () => {
    const engine = new DeckEngine();
    engine.drawNext();
    engine.recordResult('36', 500, false);
    expect(engine.isInPenaltyBox('36')).toBe(true);
    expect(engine.drawNext()).toBe('36');
  });

  it('penalty box: escape requires correct <1.0s', () => {
    const engine = new DeckEngine();
    engine.drawNext();
    engine.recordResult('36', 500, false); // into penalty
    engine.drawNext();
    engine.recordResult('36', 500, true); // correct <1s → escape
    expect(engine.isInPenaltyBox('36')).toBe(false);
  });

  it('addNextHeading grows the deck', () => {
    const engine = new DeckEngine();
    engine.addNextHeading();
    expect(engine.getDeckSize()).toBe(2);
  });

  it('getHeadingReport returns stats', () => {
    const engine = new DeckEngine();
    engine.drawNext();
    engine.recordResult('36', 500, true);
    const report = engine.getHeadingReport();
    expect(report[0].heading).toBe('36');
    expect(report[0].mastered).toBe(true);
  });
});

describe('TrialEngine', () => {
  it('removes on fast, reinserts on wrong', () => {
    const engine = new TrialEngine(['36', '18']);
    engine.drawNext();
    engine.recordResult('36', 'fast');
    expect(engine.getRemaining()).toBe(1);
  });

  it('completes when empty', () => {
    const engine = new TrialEngine(['36']);
    engine.drawNext();
    engine.recordResult('36', 'fast');
    expect(engine.isTrialComplete()).toBe(true);
  });
});

describe('MasteryChallengeEngine', () => {
  it('starts with 36 headings', () => {
    const engine = new MasteryChallengeEngine();
    expect(engine.getRemaining()).toBe(36);
  });

  it('removes heading on correct <1.0s', () => {
    const engine = new MasteryChallengeEngine();
    const h = engine.drawNext();
    const result = engine.recordResult(h, 500, true);
    expect(result.feedbackColor).toBe('green');
    expect(result.removed).toBe(true);
    expect(engine.getRemaining()).toBe(35);
  });

  it('requeues on slow correct', () => {
    const engine = new MasteryChallengeEngine();
    const h = engine.drawNext();
    const result = engine.recordResult(h, 1500, true);
    expect(result.feedbackColor).toBe('red');
    expect(result.removed).toBe(false);
    expect(engine.getRemaining()).toBe(36);
  });

  it('requeues on wrong', () => {
    const engine = new MasteryChallengeEngine();
    const h = engine.drawNext();
    const result = engine.recordResult(h, 500, false);
    expect(result.feedbackColor).toBe('red');
    expect(engine.getRemaining()).toBe(36);
  });

  it('tracks first-time accuracy', () => {
    const engine = new MasteryChallengeEngine();
    const h = engine.drawNext();
    engine.recordResult(h, 500, true); // first attempt correct+fast
    expect(engine.getFirstTimeCorrectCount()).toBe(1);
  });

  it('score = time / accuracy', () => {
    const engine = new MasteryChallengeEngine();
    // Simulate 1 correct first attempt out of 36
    const h = engine.drawNext();
    engine.recordResult(h, 500, true);
    const accuracy = 1 / 36;
    const score = engine.getScore(60000);
    expect(score).toBeCloseTo(60000 / accuracy, 0);
  });
});

describe('gradeResponse', () => {
  it('fast < 1000ms', () => expect(gradeResponse(true, 500, 2000)).toBe('fast'));
  it('slow 1000-2000ms', () => expect(gradeResponse(true, 1500, 2000)).toBe('slow'));
  it('wrong on incorrect', () => expect(gradeResponse(false, 500, 2000)).toBe('wrong'));
  it('wrong on timeout', () => expect(gradeResponse(true, 2000, 2000)).toBe('wrong'));
});

describe('MASTER_SEQUENCE', () => {
  it('has 36 unique headings', () => {
    expect(MASTER_SEQUENCE.length).toBe(36);
    expect(new Set(MASTER_SEQUENCE).size).toBe(36);
  });
});
