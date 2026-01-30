/**
 * Master unlock sequence for the Dynamic Snowball algorithm.
 *
 * Order: Centers of each compass wedge first, then fill outward.
 * This ensures spatial anchoring starts at cardinal/intercardinal
 * reference points before introducing adjacent headings.
 */
export const MASTER_SEQUENCE: string[] = [
  // Tier 1: Cardinals (4)
  '36', '18', '09', '27',
  // Tier 2: Intercardinals (4)
  '05', '23', '14', '32',
  // Tier 3: Fill (8)
  '01', '19', '10', '28', '04', '22', '13', '31',
  // Tier 4: Fill (8)
  '02', '20', '08', '26', '06', '24', '15', '33',
  // Tier 5: Final (12)
  '35', '17', '07', '25', '03', '21', '12', '30', '34', '16', '11', '29',
];
