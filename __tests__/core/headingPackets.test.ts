import { HEADING_PACKETS, getPacket } from '../../src/core/data/headingPackets';
import { WEDGE_DEFINITIONS } from '../../src/core/data/compassGeometry';
import { MASTER_SEQUENCE } from '../../src/core/data/masterSequence';
import { calculateReciprocal } from '../../src/core/algorithms/reciprocal';
import { CompassDirection } from '../../src/core/types';

describe('headingPackets data integrity', () => {
  test('contains exactly 36 packets', () => {
    expect(Object.keys(HEADING_PACKETS)).toHaveLength(36);
  });

  test('IDs are zero-padded 01 through 36', () => {
    for (let i = 1; i <= 36; i++) {
      const id = i.toString().padStart(2, '0');
      expect(HEADING_PACKETS[id]).toBeDefined();
      expect(HEADING_PACKETS[id].id).toBe(id);
    }
  });

  test('all reciprocals are correct', () => {
    for (const packet of Object.values(HEADING_PACKETS)) {
      expect(packet.reciprocal).toBe(calculateReciprocal(packet.id));
    }
  });

  test('reciprocal is symmetric', () => {
    for (const packet of Object.values(HEADING_PACKETS)) {
      const other = HEADING_PACKETS[packet.reciprocal];
      expect(other).toBeDefined();
      expect(other.reciprocal).toBe(packet.id);
    }
  });

  test('all directions are valid CompassDirection values', () => {
    const valid: CompassDirection[] = [
      'North', 'North East', 'East', 'South East',
      'South', 'South West', 'West', 'North West',
    ];
    for (const packet of Object.values(HEADING_PACKETS)) {
      expect(valid).toContain(packet.direction);
    }
  });

  test('wedgeId is 0-7', () => {
    for (const packet of Object.values(HEADING_PACKETS)) {
      expect(packet.wedgeId).toBeGreaterThanOrEqual(0);
      expect(packet.wedgeId).toBeLessThanOrEqual(7);
    }
  });

  test('wedgeId matches compassGeometry definitions', () => {
    for (const packet of Object.values(HEADING_PACKETS)) {
      const wedge = WEDGE_DEFINITIONS[packet.wedgeId];
      expect(wedge.headings).toContain(packet.id);
      expect(wedge.direction).toBe(packet.direction);
    }
  });

  test('every heading appears in exactly one wedge', () => {
    const seen = new Set<string>();
    for (const wedge of WEDGE_DEFINITIONS) {
      for (const h of wedge.headings) {
        expect(seen.has(h)).toBe(false);
        seen.add(h);
      }
    }
    expect(seen.size).toBe(36);
  });

  test('MASTER_SEQUENCE contains all 36 headings exactly once', () => {
    expect(MASTER_SEQUENCE).toHaveLength(36);
    const unique = new Set(MASTER_SEQUENCE);
    expect(unique.size).toBe(36);
    for (const id of MASTER_SEQUENCE) {
      expect(HEADING_PACKETS[id]).toBeDefined();
    }
  });

  test('getPacket throws on invalid id', () => {
    expect(() => getPacket('00')).toThrow();
    expect(() => getPacket('37')).toThrow();
    expect(() => getPacket('xx')).toThrow();
  });
});
