import { getRiskLevel, getStatus, isFlagged } from '../riskLevel';

// Checklist 9
describe('getRiskLevel', () => {
  it.each([
    [0, 'low'],
    [25, 'low'],
    [26, 'medium'],
    [50, 'medium'],
    [51, 'high'],
    [75, 'high'],
    [76, 'critical'],
    [100, 'critical'],
  ] as const)('score %i is %s', (score, level) => {
    expect(getRiskLevel(score)).toBe(level);
  });
});

describe('getStatus', () => {
  it.each([
    [50, 'approved'],
    [51, 'pending'],
    [75, 'pending'],
    [76, 'declined'],
  ] as const)('score %i is %s', (score, status) => {
    expect(getStatus(score)).toBe(status);
  });
});

describe('isFlagged', () => {
  it('flags medium risk and above', () => {
    expect(isFlagged(25)).toBe(false);
    expect(isFlagged(26)).toBe(true);
  });
});
