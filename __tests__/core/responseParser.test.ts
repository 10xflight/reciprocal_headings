import {
  parseVoiceResponse,
  assessConfidence,
} from '../../src/features/voice/ResponseParser';

describe('parseVoiceResponse', () => {
  describe('number extraction', () => {
    test('spoken words: "two two" → "22"', () => {
      expect(parseVoiceResponse('two two north east').number).toBe('22');
    });

    test('digit string: "22" → "22"', () => {
      expect(parseVoiceResponse('22 north east').number).toBe('22');
    });

    test('mixed: "2 2" → "22"', () => {
      expect(parseVoiceResponse('2 2 north east').number).toBe('22');
    });

    test('zero padded: "zero five" → "05"', () => {
      expect(parseVoiceResponse('zero five north east').number).toBe('05');
    });

    test('"oh" as zero: "oh five" → "05"', () => {
      expect(parseVoiceResponse('oh five north east').number).toBe('05');
    });

    test('three digits for Level 5: "two two seven" → "227"', () => {
      expect(parseVoiceResponse('two two seven north east', true).number).toBe('227');
    });

    test('three digit string: "227" → "227"', () => {
      expect(parseVoiceResponse('227 north east', true).number).toBe('227');
    });

    test('niner: "one niner" → "19"', () => {
      expect(parseVoiceResponse('one niner south').number).toBe('19');
    });

    test('returns null when no digits found', () => {
      expect(parseVoiceResponse('north east').number).toBeNull();
    });

    test('only one digit found → null', () => {
      expect(parseVoiceResponse('two north').number).toBeNull();
    });

    test('tens word: "eighteen" → "18"', () => {
      expect(parseVoiceResponse('eighteen south').number).toBe('18');
    });

    test('handles "for" as "4"', () => {
      expect(parseVoiceResponse('two for north east').number).toBe('24');
    });
  });

  describe('direction extraction', () => {
    test('"north east" → North East', () => {
      expect(parseVoiceResponse('22 north east').direction).toBe('North East');
    });

    test('"northeast" → North East', () => {
      expect(parseVoiceResponse('22 northeast').direction).toBe('North East');
    });

    test('"south" → South', () => {
      expect(parseVoiceResponse('18 south').direction).toBe('South');
    });

    test('"west" → West', () => {
      expect(parseVoiceResponse('27 west').direction).toBe('West');
    });

    test('compound before simple: "north east" does not match just "North"', () => {
      expect(parseVoiceResponse('22 north east').direction).toBe('North East');
    });

    test('no direction → null', () => {
      expect(parseVoiceResponse('22').direction).toBeNull();
    });

    test('handles abbreviated "nor" for North', () => {
      expect(parseVoiceResponse('22 nor east').direction).toBe('North East');
    });
  });

  describe('filler word stripping', () => {
    test('strips "uh" and "um"', () => {
      const result = parseVoiceResponse('uh two two um north east');
      expect(result.number).toBe('22');
      expect(result.direction).toBe('North East');
    });

    test('strips "heading"', () => {
      const result = parseVoiceResponse('heading two two north east');
      expect(result.number).toBe('22');
      expect(result.direction).toBe('North East');
    });
  });

  describe('edge cases', () => {
    test('empty string', () => {
      const result = parseVoiceResponse('');
      expect(result.number).toBeNull();
      expect(result.direction).toBeNull();
    });

    test('raw is preserved', () => {
      expect(parseVoiceResponse('two two north east').raw).toBe('two two north east');
    });

    test('"too" should map to 2 (but "too slow" is unlikely in real input)', () => {
      expect(parseVoiceResponse('too two north').number).toBe('22');
    });
  });
});

describe('assessConfidence', () => {
  test('high when both number and direction present', () => {
    expect(
      assessConfidence(0.9, { number: '22', direction: 'North East', raw: '' }),
    ).toBe('high');
  });

  test('low when number missing', () => {
    expect(
      assessConfidence(0.9, { number: null, direction: 'North East', raw: '' }),
    ).toBe('low');
  });

  test('low when direction missing', () => {
    expect(
      assessConfidence(0.9, { number: '22', direction: null, raw: '' }),
    ).toBe('low');
  });

  test('low when voice confidence below 0.3', () => {
    expect(
      assessConfidence(0.1, { number: '22', direction: 'North East', raw: '' }),
    ).toBe('low');
  });
});
