/**
 * The fraud scoring engine, shared by the web app and the server.
 * Pure and deterministic: no framework, no I/O, and no clock (a transaction's own timestamp is "now").
 */
export * from './types';
export { calculateFraudRisk } from './calculateFraudRisk';
export { formatDuration, formatMoney, formatNumber } from './format';
export { haversine } from './haversine';
export { CITIES, getCity, type CityInfo, type CityName } from './locations';
export { getRiskLevel, getStatus, isFlagged } from './riskLevel';
export {
  DEFAULT_RULES,
  MAX_POINTS,
  MIN_POINTS,
  THRESHOLDS,
  clampPoints,
  createDefaultRules,
} from './rules';
export { compareChronological, scoreAll } from './scoreAll';
export { parseLocalTimestamp } from './time';
