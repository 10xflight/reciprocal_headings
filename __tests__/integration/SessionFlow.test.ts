import { SessionManager } from '../../src/state/sessionManager';
import { MASTER_SEQUENCE } from '../../src/core/data/masterSequence';
import { HEADING_PACKETS } from '../../src/core/data/headingPackets';

describe('Session flow integration', () => {
  test('complete a rep from start to finish (Level 1)', () => {
    const sm = new SessionManager(1);
    const heading = sm.getNextHeading();
    expect(heading).toBe('36');

    sm.startTimer();
    const wedgeId = HEADING_PACKETS[heading].wedgeId;
    const result = sm.submitResponse(wedgeId);

    expect(result.isCorrect).toBe(true);
    expect(result.state).toBe('green');
  });

  test('complete a rep from start to finish (Level 2)', () => {
    const sm = new SessionManager(2);
    const heading = sm.getNextHeading();
    sm.startTimer();
    const recip = HEADING_PACKETS[heading].reciprocal;
    const result = sm.submitResponse(recip);

    expect(result.isCorrect).toBe(true);
  });

  test('complete a rep from start to finish (Level 3 voice)', () => {
    const sm = new SessionManager(3);
    const heading = sm.getNextHeading();
    sm.startTimer();
    const packet = HEADING_PACKETS[heading];
    const result = sm.submitResponse({
      number: packet.reciprocal,
      direction: packet.direction,
    });

    expect(result.isCorrect).toBe(true);
  });

  test('failure triggers sandwich retry', () => {
    const sm = new SessionManager(2);
    const heading = sm.getNextHeading();
    sm.startTimer();
    sm.submitResponse('99'); // wrong

    // Step 1: forced retry of same heading
    const retry1 = sm.getNextHeading();
    expect(retry1).toBe(heading);

    // Step 2: different heading (only one item in queue so may be same)
    sm.getNextHeading();

    // Step 3: retry again
    const retry2 = sm.getNextHeading();
    expect(retry2).toBe(heading);

    // Step 4: normal flow resumes
    const normal = sm.getNextHeading();
    expect(MASTER_SEQUENCE).toContain(normal);
  });

  test('state updates correctly after multiple reps', () => {
    const sm = new SessionManager(1);

    for (let i = 0; i < 3; i++) {
      sm.getNextHeading();
      sm.startTimer();
      sm.submitResponse(HEADING_PACKETS['36'].wedgeId);
    }

    // After 3 greens, snowball should have expanded
    const state = sm.getSnowballState();
    expect(state.activeQueue.length).toBe(2);
    expect(state.activeQueue[0].stability).toBe(3);
    expect(state.activeQueue[1].headingId).toBe(MASTER_SEQUENCE[1]);
  });

  test('Level 5 generates 3-digit stimuli', () => {
    const sm = new SessionManager(5);
    const heading = sm.getNextHeading();
    expect(heading).toHaveLength(3);

    const base = heading.slice(0, 2);
    expect(HEADING_PACKETS[base]).toBeDefined();

    const ones = heading.slice(2);
    expect(parseInt(ones)).toBeGreaterThanOrEqual(0);
    expect(parseInt(ones)).toBeLessThanOrEqual(9);
  });

  test('snowball state persists across session restore', () => {
    const sm1 = new SessionManager(1);

    // Stabilize first item
    for (let i = 0; i < 3; i++) {
      sm1.getNextHeading();
      sm1.startTimer();
      sm1.submitResponse(HEADING_PACKETS['36'].wedgeId);
    }

    const saved = sm1.getSnowballState();

    // Restore into new session
    const sm2 = new SessionManager(1, saved);
    const state = sm2.getSnowballState();
    expect(state.activeQueue).toHaveLength(2);
    expect(state.unlockedIndex).toBe(1);

    // New session should serve from expanded queue
    const next = sm2.getNextHeading();
    expect(['36', '18']).toContain(next);
  });
});
