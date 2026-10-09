// Number formats live in the engine, which uses them in reason texts.
export { formatDuration, formatMoney, formatNumber } from '@sentinel/engine';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-05T02:34:00" -> "5 Oct 2026, 02:34". Parsed as text, so no time zone applies. */
export function formatDateTime(timestamp: string): string {
  const [date = '', time = ''] = timestamp.split('T');
  return `${formatDate(date)}, ${time.slice(0, 5)}`;
}

/** "2026-10-05" (or a full timestamp) -> "5 Oct 2026". */
export function formatDate(timestamp: string): string {
  const [year, month, day] = timestamp.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

/** "2026-10-05" -> "5 Oct", for compact chart axes. */
export function formatShortDate(date: string): string {
  return formatDate(date).replace(/ \d{4}$/, '');
}

/** "low" -> "Low". */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
