import { SnowballManager } from '../../src/core/algorithms/snowball';
import { MASTER_SEQUENCE } from '../../src/core/data/masterSequence';

describe('SnowballManager', () => {
  test('starts with first item from master sequence', () => {
    const sm = new SnowballManager();
    const queue = sm.getActiveQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].headingId).toBe(MASTER_SEQUENCE[0]); // "36"
    expect(queue[0].stability).toBe(0);
  });

  test('getNextItem returns the only item when queue has one', () => {
    const sm = new SnowballManager();
    expect(sm.getNextItem()).toBe('36');
  });

  test('does not expand until item is stable (3 consecutive greens)', () => {
    const sm = new SnowballManager();
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    expect(sm.getActiveQueue()).toHaveLength(1);

    sm.recordResult('36', 'green'); // 3rd green → stable → expand
    expect(sm.getActiveQueue()).toHaveLength(2);
    expect(sm.getActiveQueue()[1].headingId).toBe(MASTER_SEQUENCE[1]); // "18"
  });

  test('amber does not change stability or block expansion', () => {
    const sm = new SnowballManager();
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'amber'); // no change
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    // consecutiveGreens should have reset counting from the ambers perspective
    // Actually amber doesn't reset consecutiveGreens, it just doesn't increment
    // Wait — per the spec: amber maintains current stability, doesn't promote.
    // The snowball code: amber does nothing. So consecutiveGreens stays at 1 after amber.
    // Then two more greens → consecutiveGreens = 3 → stable
    expect(sm.getActiveQueue()).toHaveLength(2);
  });

  test('red resets stability to 0', () => {
    const sm = new SnowballManager();
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'red'); // reset
    expect(sm.getActiveQueue()[0].stability).toBe(0);
    expect(sm.getActiveQueue()[0].consecutiveGreens).toBe(0);
    expect(sm.getActiveQueue()).toHaveLength(1); // no expansion
  });

  test('blocks expansion when any item is unstable', () => {
    const sm = new SnowballManager();
    // Stabilize first item
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    expect(sm.getActiveQueue()).toHaveLength(2); // expanded to "18"

    // Now "18" is unstable, so even if "36" stays stable, no expansion
    sm.recordResult('36', 'green');
    expect(sm.getActiveQueue()).toHaveLength(2);
  });

  test('progresses through first 4 items (cardinals)', () => {
    const sm = new SnowballManager();
    const cardinals = ['36', '18', '09', '27'];

    for (let i = 0; i < cardinals.length; i++) {
      // Stabilize current item
      sm.recordResult(cardinals[i], 'green');
      sm.recordResult(cardinals[i], 'green');
      sm.recordResult(cardinals[i], 'green');

      if (i < cardinals.length - 1) {
        // Should have unlocked next
        expect(sm.getActiveQueue()).toHaveLength(i + 2);
        expect(sm.getActiveQueue()[i + 1].headingId).toBe(cardinals[i + 1]);
      }
    }

    // After stabilizing all 4 cardinals, should unlock 5th (first intercardinal)
    expect(sm.getActiveQueue()).toHaveLength(5);
    expect(sm.getActiveQueue()[4].headingId).toBe('05');
  });

  test('full expansion to 36 items', () => {
    const sm = new SnowballManager();

    for (let i = 0; i < MASTER_SEQUENCE.length; i++) {
      const heading = MASTER_SEQUENCE[i];
      sm.recordResult(heading, 'green');
      sm.recordResult(heading, 'green');
      sm.recordResult(heading, 'green');
    }

    expect(sm.getActiveQueue()).toHaveLength(36);
    expect(sm.isAllMastered()).toBe(true);
  });

  test('isAllMastered returns false when not all items unlocked', () => {
    const sm = new SnowballManager();
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    expect(sm.isAllMastered()).toBe(false);
  });

  test('restores from saved state', () => {
    const sm1 = new SnowballManager();
    sm1.recordResult('36', 'green');
    sm1.recordResult('36', 'green');
    sm1.recordResult('36', 'green');

    const saved = sm1.getState();
    const sm2 = new SnowballManager(saved);

    expect(sm2.getActiveQueue()).toHaveLength(2);
    expect(sm2.getUnlockedIndex()).toBe(1);
    expect(sm2.getActiveQueue()[0].stability).toBe(3);
  });

  test('regression after failure undoes progress', () => {
    const sm = new SnowballManager();
    // Stabilize "36"
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    expect(sm.getActiveQueue()).toHaveLength(2);

    // Fail on "36" — destabilizes it
    sm.recordResult('36', 'red');
    expect(sm.getActiveQueue()[0].stability).toBe(0);

    // Even stabilizing "18" won't expand because "36" is unstable
    sm.recordResult('18', 'green');
    sm.recordResult('18', 'green');
    sm.recordResult('18', 'green');
    expect(sm.getActiveQueue()).toHaveLength(2);

    // Re-stabilize "36"
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    // Now both stable → expand
    expect(sm.getActiveQueue()).toHaveLength(3);
  });

  test('weighted selection favors unstable items', () => {
    const sm = new SnowballManager();
    // Stabilize first, unlock second
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    sm.recordResult('36', 'green');
    // Now queue: ["36" stable, "18" unstable]

    const counts: Record<string, number> = { '36': 0, '18': 0 };
    for (let i = 0; i < 1000; i++) {
      counts[sm.getNextItem()]++;
    }

    // "18" (unstable) should appear much more often than "36" (stable)
    expect(counts['18']).toBeGreaterThan(counts['36']);
  });
});
