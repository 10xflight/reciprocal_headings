import { WedgeDefinition } from '../types';

export const WEDGE_DEFINITIONS: WedgeDefinition[] = [
  { id: 0, direction: 'North', headings: ['34', '35', '36', '01', '02'], angle: 0 },
  { id: 1, direction: 'North East', headings: ['03', '04', '05', '06'], angle: 45 },
  { id: 2, direction: 'East', headings: ['07', '08', '09', '10', '11'], angle: 90 },
  { id: 3, direction: 'South East', headings: ['12', '13', '14', '15'], angle: 135 },
  { id: 4, direction: 'South', headings: ['16', '17', '18', '19', '20'], angle: 180 },
  { id: 5, direction: 'South West', headings: ['21', '22', '23', '24'], angle: 225 },
  { id: 6, direction: 'West', headings: ['25', '26', '27', '28', '29'], angle: 270 },
  { id: 7, direction: 'North West', headings: ['30', '31', '32', '33'], angle: 315 },
];

export function getWedgeForHeading(headingId: string): WedgeDefinition | undefined {
  return WEDGE_DEFINITIONS.find((w) => w.headings.includes(headingId));
}
