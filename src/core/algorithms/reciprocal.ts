import { CompassDirection } from '../types';
import { HEADING_PACKETS } from '../data/headingPackets';

/**
 * Calculate the reciprocal of a 2-digit heading (01-36).
 * Rule: ±18, wrapping at 36.
 */
export function calculateReciprocal(heading: string): string {
  const num = parseInt(heading, 10);
  if (isNaN(num) || num < 1 || num > 36) {
    throw new Error(`Invalid heading: ${heading}`);
  }
  const reciprocal = num <= 18 ? num + 18 : num - 18;
  return reciprocal.toString().padStart(2, '0');
}

/**
 * Calculate reciprocal for a 3-digit heading (Level 5).
 * The ones digit passes through unchanged.
 */
export function calculateReciprocalWithOnes(heading: string): string {
  if (heading.length !== 3) {
    throw new Error(`Expected 3-digit heading, got: ${heading}`);
  }
  const tens = heading.slice(0, 2);
  const ones = heading.slice(2);
  return calculateReciprocal(tens) + ones;
}

/** Look up compass direction for a heading. */
export function getDirection(heading: string): CompassDirection {
  const key = heading.slice(0, 2);
  const packet = HEADING_PACKETS[key];
  if (!packet) {
    throw new Error(`Invalid heading: ${heading}`);
  }
  return packet.direction;
}

/** Look up wedge ID for a heading. */
export function getWedgeId(heading: string): number {
  const key = heading.slice(0, 2);
  const packet = HEADING_PACKETS[key];
  if (!packet) {
    throw new Error(`Invalid heading: ${heading}`);
  }
  return packet.wedgeId;
}
