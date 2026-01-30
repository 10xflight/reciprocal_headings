import {
  calculateReciprocal,
  calculateReciprocalWithOnes,
  getDirection,
  getWedgeId,
} from '../../src/core/algorithms/reciprocal';

describe('calculateReciprocal', () => {
  // Exhaustive test of all 36 headings
  const pairs: [string, string][] = [
    ['01', '19'], ['02', '20'], ['03', '21'], ['04', '22'],
    ['05', '23'], ['06', '24'], ['07', '25'], ['08', '26'],
    ['09', '27'], ['10', '28'], ['11', '29'], ['12', '30'],
    ['13', '31'], ['14', '32'], ['15', '33'], ['16', '34'],
    ['17', '35'], ['18', '36'], ['19', '01'], ['20', '02'],
    ['21', '03'], ['22', '04'], ['23', '05'], ['24', '06'],
    ['25', '07'], ['26', '08'], ['27', '09'], ['28', '10'],
    ['29', '11'], ['30', '12'], ['31', '13'], ['32', '14'],
    ['33', '15'], ['34', '16'], ['35', '17'], ['36', '18'],
  ];

  test.each(pairs)('reciprocal of %s is %s', (input, expected) => {
    expect(calculateReciprocal(input)).toBe(expected);
  });

  test('reciprocal is symmetric', () => {
    for (const [a, b] of pairs.slice(0, 18)) {
      expect(calculateReciprocal(calculateReciprocal(a))).toBe(a);
      expect(calculateReciprocal(b)).toBe(a);
    }
  });

  test('throws on invalid input', () => {
    expect(() => calculateReciprocal('00')).toThrow();
    expect(() => calculateReciprocal('37')).toThrow();
    expect(() => calculateReciprocal('abc')).toThrow();
    expect(() => calculateReciprocal('')).toThrow();
  });
});

describe('calculateReciprocalWithOnes', () => {
  test.each([
    ['047', '227'],
    ['091', '271'],
    ['180', '360'],
    ['360', '180'],
    ['015', '195'],
    ['279', '099'],
  ])('reciprocal of %s is %s', (input, expected) => {
    expect(calculateReciprocalWithOnes(input)).toBe(expected);
  });

  test('ones digit is preserved', () => {
    for (let d = 0; d <= 9; d++) {
      const result = calculateReciprocalWithOnes(`04${d}`);
      expect(result.endsWith(d.toString())).toBe(true);
    }
  });

  test('throws on non-3-digit input', () => {
    expect(() => calculateReciprocalWithOnes('04')).toThrow();
    expect(() => calculateReciprocalWithOnes('0470')).toThrow();
  });
});

describe('getDirection', () => {
  test('returns correct direction for cardinals', () => {
    expect(getDirection('36')).toBe('North');
    expect(getDirection('09')).toBe('East');
    expect(getDirection('18')).toBe('South');
    expect(getDirection('27')).toBe('West');
  });

  test('returns correct direction for intercardinals', () => {
    expect(getDirection('05')).toBe('North East');
    expect(getDirection('14')).toBe('South East');
    expect(getDirection('23')).toBe('South West');
    expect(getDirection('32')).toBe('North West');
  });

  test('works with 3-digit headings (uses first 2 digits)', () => {
    expect(getDirection('047')).toBe('North East');
  });

  test('throws on invalid heading', () => {
    expect(() => getDirection('99')).toThrow();
  });
});

describe('getWedgeId', () => {
  test('North wedge (0) for 34,35,36,01,02', () => {
    for (const h of ['34', '35', '36', '01', '02']) {
      expect(getWedgeId(h)).toBe(0);
    }
  });

  test('East wedge (2) for 07-11', () => {
    for (const h of ['07', '08', '09', '10', '11']) {
      expect(getWedgeId(h)).toBe(2);
    }
  });
});
