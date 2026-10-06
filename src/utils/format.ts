const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const twoDecimals = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "GHS 15,400" for whole amounts, "GHS 850.50" otherwise. */
export function formatMoney(amount: number, currency = 'GHS'): string {
  const formatter = Number.isInteger(amount) ? wholeNumber : twoDecimals;
  return `${currency} ${formatter.format(amount)}`;
}

/** Rounded number with thousands separators: 5093.4 -> "5,093". */
export function formatNumber(value: number): string {
  return wholeNumber.format(value);
}

/** "1 h 5 min", "45 min", "0 min". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

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
