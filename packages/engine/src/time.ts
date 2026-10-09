const LOCAL_ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export interface LocalTime {
  /** Milliseconds on a zone-free timeline; only meaningful for differences and ordering. */
  ms: number;
  hour: number;
  minute: number;
}

/**
 * Parses a local ISO timestamp ("2026-10-05T02:34:00") without applying the
 * machine's time zone, so hour checks and time differences are deterministic.
 */
export function parseLocalTimestamp(timestamp: string): LocalTime {
  const match = LOCAL_ISO.exec(timestamp);
  if (!match) throw new Error(`Invalid local timestamp: "${timestamp}"`);
  const [year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  return { ms: Date.UTC(year, month - 1, day, hour, minute, second), hour, minute };
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
