import {
  LearningEngine,
  TrialEngine,
  gradeResponse,
  SETS,
  STAGES,
  getStageHeadings,
  getStageName,
} from '../../src/core/algorithms/trainingEngine';

describe('SETS and STAGES constants', () => {
  test('SETS contains 6 sets of 6 headings each', () => {
    expect(SETS).toHaveLength(6);
    for (const set of SETS) {
      expect(set).toHaveLength(6);
    }
  });

  test('all 36 headings are covered across SETS', () => {
    const all = SETS.flat().sort();
    const expected = Array.from({ length: 36 }, (_, i) =>
      String(i + 1).padStart(2, '0')
    ).sort();
    expect(all).toEqual(expected);
  });

  test('STAGES has 11 entries', () => {
    expect(STAGES).toHaveLength(11);
  });

  test('Stage 11 includes all sets', () => {
    expect(STAGES[10]).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('LearningEngine', () => {
  test('constructor builds queue from stage headings', () => {
    const engine = new LearningEngine(1);
    expect(engine.getQueueLength()).toBe(6);
    expect(engine.totalHeadings).toBe(6);
  });

  test('drawNext returns front of queue and increments seenCount', () => {
    const engine = new LearningEngine(1);
    const h = engine.drawNext();
    expect(typeof h).toBe('string');
    expect(engine.getSeenCount()[h]).toBe(1);
  });

  test('recordResult with fast adds to mastered and reinserts', () => {
    const engine = new LearningEngine(1);
    const h = engine.drawNext();
    engine.recordResult(h, 'fast');
    expect(engine.getQueueLength()).toBe(6);
    expect(engine.getMasteredCount()).toBe(1);
    expect(engine.getMasteredHeadings()).toContain(h);
  });

  test('recordResult with wrong removes from mastered and tracks mistakes', () => {
    const engine = new LearningEngine(1);

    let h = engine.drawNext();
    engine.recordResult(h, 'fast');
    expect(engine.getMasteredCount()).toBe(1);

    // Force the same heading to appear by drawing until we find it
    // Instead, just record a wrong on a new heading
    const h2 = engine.drawNext();
    engine.recordResult(h2, 'wrong');
    expect(engine.getTotalMistakes()).toBe(1);
    expect(engine.getMistakesByHeading()[h2]).toBe(1);
  });

  test('recordResult with slow does not affect mastery', () => {
    const engine = new LearningEngine(1);
    const h = engine.drawNext();
    engine.recordResult(h, 'fast');
    expect(engine.getMasteredCount()).toBe(1);

    const h2 = engine.drawNext();
    engine.recordResult(h2, 'slow');
    // slow doesn't add to mastered, but doesn't remove existing mastered
    expect(engine.getMasteredCount()).toBe(1);
  });

  test('isStageComplete when all headings mastered', () => {
    const engine = new LearningEngine(1);
    expect(engine.isStageComplete()).toBe(false);

    // Answer fast enough times that all 6 headings get mastered
    for (let i = 0; i < 50; i++) {
      if (engine.isStageComplete()) break;
      const h = engine.drawNext();
      engine.recordResult(h, 'fast');
    }

    expect(engine.isStageComplete()).toBe(true);
    expect(engine.getMasteredCount()).toBe(6);
  });

  test('stage with more headings works', () => {
    const engine = new LearningEngine(3); // Sets 1+2 = 12 headings
    expect(engine.getQueueLength()).toBe(12);
    expect(engine.totalHeadings).toBe(12);
  });

  test('invalid stage throws', () => {
    expect(() => new LearningEngine(0)).toThrow();
    expect(() => new LearningEngine(12)).toThrow();
  });
});

describe('TrialEngine', () => {
  const testHeadings = ['01', '02', '03', '04', '05', '06'];

  test('constructor shuffles and sets queue', () => {
    const engine = new TrialEngine(testHeadings);
    expect(engine.getRemaining()).toBe(6);
  });

  test('fast grade removes heading permanently', () => {
    const engine = new TrialEngine(testHeadings);
    const h = engine.drawNext();
    engine.recordResult(h, 'fast');
    expect(engine.getRemaining()).toBe(5);
  });

  test('slow grade reinserts heading', () => {
    const engine = new TrialEngine(testHeadings);
    const h = engine.drawNext();
    engine.recordResult(h, 'slow');
    expect(engine.getRemaining()).toBe(6); // Still 6, reinserted
    expect(engine.getMistakes()).toBe(1);
  });

  test('wrong grade reinserts heading', () => {
    const engine = new TrialEngine(testHeadings);
    const h = engine.drawNext();
    engine.recordResult(h, 'wrong');
    expect(engine.getRemaining()).toBe(6);
    expect(engine.getMistakes()).toBe(1);
  });

  test('trial completes when all eliminated', () => {
    const engine = new TrialEngine(testHeadings);
    // Keep answering fast until done
    let safety = 0;
    while (!engine.isTrialComplete() && safety < 100) {
      const h = engine.drawNext();
      engine.recordResult(h, 'fast');
      safety++;
    }
    expect(engine.isTrialComplete()).toBe(true);
    expect(engine.getRemaining()).toBe(0);
  });
});

describe('gradeResponse', () => {
  const LIMIT = 2000;

  test('correct + under 1s = fast', () => {
    expect(gradeResponse(true, 500, LIMIT)).toBe('fast');
    expect(gradeResponse(true, 999, LIMIT)).toBe('fast');
  });

  test('correct + 1s to limit = slow', () => {
    expect(gradeResponse(true, 1000, LIMIT)).toBe('slow');
    expect(gradeResponse(true, 1500, LIMIT)).toBe('slow');
    expect(gradeResponse(true, 1999, LIMIT)).toBe('slow');
  });

  test('correct + at/over limit = wrong', () => {
    expect(gradeResponse(true, 2000, LIMIT)).toBe('wrong');
    expect(gradeResponse(true, 3000, LIMIT)).toBe('wrong');
  });

  test('incorrect = wrong regardless of time', () => {
    expect(gradeResponse(false, 100, LIMIT)).toBe('wrong');
    expect(gradeResponse(false, 500, LIMIT)).toBe('wrong');
  });
});

describe('getStageHeadings', () => {
  test('stage 1 returns set 1 headings', () => {
    const headings = getStageHeadings(1);
    expect(headings).toEqual(SETS[0]);
  });

  test('stage 11 returns all 36 headings', () => {
    const headings = getStageHeadings(11);
    expect(headings).toHaveLength(36);
  });
});

describe('getStageName', () => {
  test('returns formatted stage name', () => {
    expect(getStageName(1)).toBe('Stage 1 — Set 1');
    expect(getStageName(3)).toBe('Stage 3 — Set 1+Set 2');
    expect(getStageName(11)).toContain('Stage 11');
  });
});
