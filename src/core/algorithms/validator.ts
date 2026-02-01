import { CompassDirection, FeedbackState, ValidationResult, TIMING } from '../types';
import { HEADING_PACKETS } from '../data/headingPackets';
import { calculateReciprocal, calculateReciprocalWithOnes, getDirection } from './reciprocal';

export interface VoiceResponse {
  number: string;
  direction: CompassDirection;
}

/**
 * Validate a user response for any level.
 *
 * @param level      1-5
 * @param stimulus   The heading shown/played (2-digit for L1-4, 3-digit for L5)
 * @param response   wedgeId (L1), string (L2), or VoiceResponse (L3-5)
 * @param responseTimeMs  Milliseconds from stimulus to response
 */
export function validateResponse(
  level: number,
  stimulus: string,
  response: number | string | VoiceResponse,
  responseTimeMs: number,
): ValidationResult {
  const timeLimit = TIMING.LEVEL1_LIMIT;

  const expectedReciprocal =
    level === 5 ? calculateReciprocalWithOnes(stimulus) : calculateReciprocal(stimulus);

  const expectedDirection = getDirection(stimulus);

  let isCorrect = false;

  switch (level) {
    case 1: {
      const expectedWedge = HEADING_PACKETS[stimulus]?.wedgeId;
      isCorrect = response === expectedWedge;
      break;
    }
    case 2: {
      isCorrect = response === expectedReciprocal;
      break;
    }
    case 3:
    case 4:
    case 5: {
      const voice = response as VoiceResponse;
      isCorrect = voice.number === expectedReciprocal && voice.direction === expectedDirection;
      break;
    }
    default:
      throw new Error(`Invalid level: ${level}`);
  }

  const correctAnswer = { reciprocal: expectedReciprocal, direction: expectedDirection };

  if (!isCorrect) {
    return { isCorrect: false, state: 'red', correctAnswer };
  }

  if (responseTimeMs > timeLimit) {
    return { isCorrect: true, state: 'amber', feedback: 'Too Slow', correctAnswer };
  }

  return { isCorrect: true, state: 'green', correctAnswer };
}

/** Helper to build the correct-answer display for any heading. */
export function getCorrectAnswer(
  stimulus: string,
  level: number,
): { reciprocal: string; direction: CompassDirection } {
  const reciprocal =
    level === 5 ? calculateReciprocalWithOnes(stimulus) : calculateReciprocal(stimulus);
  const direction = getDirection(stimulus);
  return { reciprocal, direction };
}
