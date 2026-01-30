import { CompassDirection, HeadingPacket } from '../types';

export const HEADING_PACKETS: Record<string, HeadingPacket> = {
  '01': { id: '01', reciprocal: '19', direction: 'North', wedgeId: 0 },
  '02': { id: '02', reciprocal: '20', direction: 'North', wedgeId: 0 },
  '03': { id: '03', reciprocal: '21', direction: 'North East', wedgeId: 1 },
  '04': { id: '04', reciprocal: '22', direction: 'North East', wedgeId: 1 },
  '05': { id: '05', reciprocal: '23', direction: 'North East', wedgeId: 1 },
  '06': { id: '06', reciprocal: '24', direction: 'North East', wedgeId: 1 },
  '07': { id: '07', reciprocal: '25', direction: 'East', wedgeId: 2 },
  '08': { id: '08', reciprocal: '26', direction: 'East', wedgeId: 2 },
  '09': { id: '09', reciprocal: '27', direction: 'East', wedgeId: 2 },
  '10': { id: '10', reciprocal: '28', direction: 'East', wedgeId: 2 },
  '11': { id: '11', reciprocal: '29', direction: 'East', wedgeId: 2 },
  '12': { id: '12', reciprocal: '30', direction: 'South East', wedgeId: 3 },
  '13': { id: '13', reciprocal: '31', direction: 'South East', wedgeId: 3 },
  '14': { id: '14', reciprocal: '32', direction: 'South East', wedgeId: 3 },
  '15': { id: '15', reciprocal: '33', direction: 'South East', wedgeId: 3 },
  '16': { id: '16', reciprocal: '34', direction: 'South', wedgeId: 4 },
  '17': { id: '17', reciprocal: '35', direction: 'South', wedgeId: 4 },
  '18': { id: '18', reciprocal: '36', direction: 'South', wedgeId: 4 },
  '19': { id: '19', reciprocal: '01', direction: 'South', wedgeId: 4 },
  '20': { id: '20', reciprocal: '02', direction: 'South', wedgeId: 4 },
  '21': { id: '21', reciprocal: '03', direction: 'South West', wedgeId: 5 },
  '22': { id: '22', reciprocal: '04', direction: 'South West', wedgeId: 5 },
  '23': { id: '23', reciprocal: '05', direction: 'South West', wedgeId: 5 },
  '24': { id: '24', reciprocal: '06', direction: 'South West', wedgeId: 5 },
  '25': { id: '25', reciprocal: '07', direction: 'West', wedgeId: 6 },
  '26': { id: '26', reciprocal: '08', direction: 'West', wedgeId: 6 },
  '27': { id: '27', reciprocal: '09', direction: 'West', wedgeId: 6 },
  '28': { id: '28', reciprocal: '10', direction: 'West', wedgeId: 6 },
  '29': { id: '29', reciprocal: '11', direction: 'West', wedgeId: 6 },
  '30': { id: '30', reciprocal: '12', direction: 'North West', wedgeId: 7 },
  '31': { id: '31', reciprocal: '13', direction: 'North West', wedgeId: 7 },
  '32': { id: '32', reciprocal: '14', direction: 'North West', wedgeId: 7 },
  '33': { id: '33', reciprocal: '15', direction: 'North West', wedgeId: 7 },
  '34': { id: '34', reciprocal: '16', direction: 'North', wedgeId: 0 },
  '35': { id: '35', reciprocal: '17', direction: 'North', wedgeId: 0 },
  '36': { id: '36', reciprocal: '18', direction: 'North', wedgeId: 0 },
};

export function getPacket(headingId: string): HeadingPacket {
  const packet = HEADING_PACKETS[headingId];
  if (!packet) {
    throw new Error(`Invalid heading ID: ${headingId}`);
  }
  return packet;
}

export function getDirectionForHeading(headingId: string): CompassDirection {
  return getPacket(headingId).direction;
}

export function getWedgeForHeading(headingId: string): number {
  return getPacket(headingId).wedgeId;
}
