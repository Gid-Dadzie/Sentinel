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
