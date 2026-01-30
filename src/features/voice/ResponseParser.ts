import { CompassDirection } from '../../core/types';

export interface ParsedResponse {
  number: string | null;
  direction: CompassDirection | null;
  raw: string;
}

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', oh: '0', o: '0',
  one: '1', won: '1',
  two: '2', to: '2', too: '2',
  three: '3', tree: '3',
  four: '4', for: '4', fore: '4',
  five: '5', fife: '5',
  six: '6',
  seven: '7',
  eight: '8', ate: '8',
  nine: '9', niner: '9',
};

const DIGIT_PATTERN = /\d/;

// Order matters: check compound directions before simple ones
const DIRECTION_PATTERNS: { direction: CompassDirection; pattern: RegExp }[] = [
  { direction: 'North East', pattern: /\bnor(?:th?)?\s*east\b/i },
  { direction: 'North West', pattern: /\bnor(?:th?)?\s*west\b/i },
  { direction: 'South East', pattern: /\bsou(?:th?)?\s*east\b/i },
  { direction: 'South West', pattern: /\bsou(?:th?)?\s*west\b/i },
  { direction: 'North', pattern: /\bnor(?:th?)?\b/i },
  { direction: 'South', pattern: /\bsou(?:th?)?\b/i },
  { direction: 'East', pattern: /\beast\b/i },
  { direction: 'West', pattern: /\bwest\b/i },
];

// Words to strip before number parsing
const FILLER = /\b(uh|um|ah|er|like|heading)\b/gi;

/**
 * Parse a voice transcription into a structured response.
 * @param text Raw transcription text
 * @param expectThreeDigits Whether to expect a 3-digit number (Level 5)
 */
export function parseVoiceResponse(text: string, expectThreeDigits = false): ParsedResponse {
  const raw = text;
  const cleaned = text.replace(FILLER, ' ').trim();

  const number = extractNumber(cleaned, expectThreeDigits);
  const direction = extractDirection(cleaned);

  return { number, direction, raw };
}

function extractNumber(text: string, threeDigits: boolean): string | null {
  const digits: string[] = [];
  const target = threeDigits ? 3 : 2;

  // Tokenize and convert each token to a digit
  const tokens = text.toLowerCase().split(/[\s,.-]+/);

  for (const token of tokens) {
    if (digits.length >= target) break;

    // Direct digit character
    if (token.length === 1 && DIGIT_PATTERN.test(token)) {
      digits.push(token);
      continue;
    }

    // Multi-digit string like "22" or "227"
    if (/^\d+$/.test(token)) {
      for (const ch of token) {
        if (digits.length < target) digits.push(ch);
      }
      continue;
    }

    // Word-to-digit mapping
    if (NUMBER_WORDS[token] !== undefined) {
      digits.push(NUMBER_WORDS[token]);
      continue;
    }

    // Handle "twenty-two" style (rare in STT but possible)
    const tens = parseTensWord(token);
    if (tens !== null) {
      for (const d of tens) {
        if (digits.length < target) digits.push(d);
      }
    }
  }

  if (digits.length === target) {
    return digits.join('');
  }

  // If we got 2 digits but needed 3, or vice versa, return what we have
  if (digits.length >= 2) {
    return digits.slice(0, target).join('');
  }

  return null;
}

function parseTensWord(word: string): string[] | null {
  const map: Record<string, string[]> = {
    ten: ['1', '0'],
    eleven: ['1', '1'],
    twelve: ['1', '2'],
    thirteen: ['1', '3'],
    fourteen: ['1', '4'],
    fifteen: ['1', '5'],
    sixteen: ['1', '6'],
    seventeen: ['1', '7'],
    eighteen: ['1', '8'],
    nineteen: ['1', '9'],
    twenty: ['2', '0'],
    thirty: ['3', '0'],
  };
  return map[word.toLowerCase()] ?? null;
}

function extractDirection(text: string): CompassDirection | null {
  for (const { direction, pattern } of DIRECTION_PATTERNS) {
    if (pattern.test(text)) {
      return direction;
    }
  }
  return null;
}

/**
 * Assess whether a voice result + parsed response is reliable enough
 * to count as a real attempt (vs. a "speak clearer" retry).
 */
export function assessConfidence(
  voiceConfidence: number,
  parsed: ParsedResponse,
): 'high' | 'low' {
  // No number at all → low
  if (!parsed.number) return 'low';
  // No direction → low
  if (!parsed.direction) return 'low';
  // Very low STT confidence → low
  if (voiceConfidence < 0.3) return 'low';
  return 'high';
}
