import { parseLocalTimestamp } from '@sentinel/engine';

/**
 * Transaction times are wall-clock strings ("2026-10-05T02:34:00") with no time zone.
 * Postgres keeps them in a timestamp column, which Prisma hands over as a Date holding
 * that wall-clock time in UTC. These convert between the two without any zone shifting.
 */
export const toDbTime = (timestamp: string) => new Date(parseLocalTimestamp(timestamp).ms);
export const fromDbTime = (date: Date) => date.toISOString().slice(0, 19);
