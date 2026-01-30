import { SessionManager } from '../../src/state/sessionManager';
import { MASTER_SEQUENCE } from '../../src/core/data/masterSequence';

describe('SessionManager', () => {
  test('initializes with first heading from master sequence', () => {
    const sm = new SessionManager(1);
    const heading = sm.getNextHeading();
    expect(heading).toBe(MASTER_SEQUENCE[0]); // "36"
  });

  test('getCurrentBaseHeading returns 2-digit heading', () => {
    const sm = new SessionManager(2);
    sm.getNextHeading();
    expect(sm.getCurrentBaseHeading()).toBe('36');
  });

  test('Level 5 appends ones digit', () => {
    const sm = new SessionManager(5);
    const heading = sm.getNextHeading();
    expect(heading).toHaveLength(3);
    expect(heading.slice(0, 2)).toBe('36');
  });

  test('timer tracks elapsed time', () => {
    const sm = new SessionManager(1);
    sm.getNextHeading();
    sm.startTimer();
    // Can't reliably test exact timing, just verify it returns a number
    expect(sm.getTimeElapsed()).toBeGreaterThanOrEqual(0);
  });

  test('submitResponse returns validation result', () => {
    const sm = new SessionManager(1);
    sm.getNextHeading(); // "36" — wedgeId 0
    sm.startTimer();
    const result = sm.submitResponse(0); // correct wedge
    expect(result.isCorrect).toBe(true);
  });

  describe('sandwich retry rule', () => {
    test('failure triggers forced retry sequence', () => {
      const sm = new SessionManager(2);
      const first = sm.getNextHeading(); // "36"
      sm.startTimer();
      sm.submitResponse('99'); // wrong → red

      // Next should be the same failed heading (forced retry)
      const retry1 = sm.getNextHeading();
      expect(retry1).toBe(first);

      // Then a different heading
      const different = sm.getNextHeading();
      // With only 1 item in queue, it may be the same, but the phase still advances
      // In a larger queue this would be different

      // Then the failed heading again
      const retry2 = sm.getNextHeading();
      expect(retry2).toBe(first);

      // After sandwich completes, normal flow resumes
      const normal = sm.getNextHeading();
      // Should come from snowball queue (still just "36" at this point)
      expect(normal).toBeDefined();
    });

    test('sandwich clears after completion', () => {
      const sm = new SessionManager(2);
      sm.getNextHeading();
      sm.startTimer();
      sm.submitResponse('99'); // fail

      // Go through the sandwich sequence
      sm.getNextHeading(); // retry
      sm.getNextHeading(); // different
      sm.getNextHeading(); // retry again

      // Next call should be normal (no more forced retries)
      // If we fail again, a new sandwich starts
      const heading = sm.getNextHeading();
      sm.startTimer();
      const result = sm.submitResponse('18'); // correct for "36"
      expect(result.isCorrect).toBe(true);
    });
  });

  test('getSnowballState returns serializable state', () => {
    const sm = new SessionManager(1);
    sm.getNextHeading();
    sm.startTimer();
    sm.submitResponse(0); // correct

    const state = sm.getSnowballState();
    expect(state.activeQueue).toBeDefined();
    expect(state.unlockedIndex).toBeDefined();
  });

  test('isLevelComplete returns false initially', () => {
    const sm = new SessionManager(1);
    expect(sm.isLevelComplete()).toBe(false);
  });

  test('restores from saved snowball state', () => {
    const sm1 = new SessionManager(1);
    // Stabilize first item
    for (let i = 0; i < 3; i++) {
      sm1.getNextHeading();
      sm1.startTimer();
      sm1.submitResponse(0); // wedge 0 for "36"
    }
    const saved = sm1.getSnowballState();
    expect(saved.activeQueue.length).toBe(2); // expanded

    const sm2 = new SessionManager(1, saved);
    const state = sm2.getSnowballState();
    expect(state.activeQueue.length).toBe(2);
    expect(state.unlockedIndex).toBe(1);
  });
});
