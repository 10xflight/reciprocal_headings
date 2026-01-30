import { validateResponse, getCorrectAnswer } from '../../src/core/algorithms/validator';

describe('validateResponse', () => {
  describe('Level 1 - Wedge tap', () => {
    test('correct wedge within time → green', () => {
      // heading "04" is in wedge 1 (North East)
      const result = validateResponse(1, '04', 1, 500);
      expect(result.state).toBe('green');
      expect(result.isCorrect).toBe(true);
    });

    test('correct wedge over time → amber', () => {
      const result = validateResponse(1, '04', 1, 1200);
      expect(result.state).toBe('amber');
      expect(result.isCorrect).toBe(true);
      expect(result.feedback).toBe('Too Slow');
    });

    test('wrong wedge → red', () => {
      const result = validateResponse(1, '04', 3, 500);
      expect(result.state).toBe('red');
      expect(result.isCorrect).toBe(false);
    });

    test('boundary: exactly at time limit → green', () => {
      const result = validateResponse(1, '04', 1, 1000);
      expect(result.state).toBe('green');
    });

    test('boundary: 1ms over time limit → amber', () => {
      const result = validateResponse(1, '04', 1, 1001);
      expect(result.state).toBe('amber');
    });
  });

  describe('Level 2 - Numpad', () => {
    test('correct reciprocal within time → green', () => {
      const result = validateResponse(2, '04', '22', 800);
      expect(result.state).toBe('green');
    });

    test('wrong reciprocal → red', () => {
      const result = validateResponse(2, '04', '23', 800);
      expect(result.state).toBe('red');
    });

    test('correct but slow → amber', () => {
      const result = validateResponse(2, '04', '22', 1500);
      expect(result.state).toBe('amber');
    });

    test('must be zero-padded', () => {
      // reciprocal of 19 is 01, not "1"
      const result = validateResponse(2, '19', '1', 500);
      expect(result.state).toBe('red');
    });
  });

  describe('Level 3 - Voice', () => {
    test('correct number and direction within time → green', () => {
      const result = validateResponse(3, '04', { number: '22', direction: 'North East' }, 1000);
      expect(result.state).toBe('green');
    });

    test('correct number wrong direction → red', () => {
      const result = validateResponse(3, '04', { number: '22', direction: 'East' }, 1000);
      expect(result.state).toBe('red');
    });

    test('wrong number correct direction → red', () => {
      const result = validateResponse(3, '04', { number: '23', direction: 'North East' }, 1000);
      expect(result.state).toBe('red');
    });

    test('correct but over 1500ms → amber', () => {
      const result = validateResponse(3, '04', { number: '22', direction: 'North East' }, 1600);
      expect(result.state).toBe('amber');
    });

    test('time limit is 1500ms (not 1000ms)', () => {
      const result = validateResponse(3, '04', { number: '22', direction: 'North East' }, 1400);
      expect(result.state).toBe('green');
    });
  });

  describe('Level 4 - Auditory', () => {
    test('uses same validation as Level 3', () => {
      const result = validateResponse(4, '09', { number: '27', direction: 'East' }, 1000);
      expect(result.state).toBe('green');
    });
  });

  describe('Level 5 - 3-digit', () => {
    test('correct 3-digit reciprocal + direction → green', () => {
      // 047 → reciprocal 227, direction North East
      const result = validateResponse(5, '047', { number: '227', direction: 'North East' }, 1200);
      expect(result.state).toBe('green');
    });

    test('wrong ones digit → red', () => {
      const result = validateResponse(5, '047', { number: '228', direction: 'North East' }, 1000);
      expect(result.state).toBe('red');
    });

    test('2-digit answer for 3-digit stimulus → red', () => {
      const result = validateResponse(5, '047', { number: '22', direction: 'North East' }, 1000);
      expect(result.state).toBe('red');
    });
  });

  describe('edge cases', () => {
    test('36 ↔ 18 wrap', () => {
      const result = validateResponse(2, '36', '18', 500);
      expect(result.state).toBe('green');
    });

    test('correctAnswer is always populated', () => {
      const green = validateResponse(2, '04', '22', 500);
      expect(green.correctAnswer).toEqual({ reciprocal: '22', direction: 'North East' });

      const red = validateResponse(2, '04', '99', 500);
      expect(red.correctAnswer).toEqual({ reciprocal: '22', direction: 'North East' });
    });

    test('invalid level throws', () => {
      expect(() => validateResponse(6, '04', '22', 500)).toThrow();
    });
  });
});

describe('getCorrectAnswer', () => {
  test('returns reciprocal and direction for 2-digit heading', () => {
    const answer = getCorrectAnswer('04', 2);
    expect(answer.reciprocal).toBe('22');
    expect(answer.direction).toBe('North East');
  });

  test('returns 3-digit reciprocal for Level 5', () => {
    const answer = getCorrectAnswer('047', 5);
    expect(answer.reciprocal).toBe('227');
    expect(answer.direction).toBe('North East');
  });
});
