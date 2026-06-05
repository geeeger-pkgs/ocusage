/**
 * Base provider interface for AI client token usage data.
 *
 * Each provider must implement:
 *   - name: string           — Human-readable client name
 *   - id: string             — Unique identifier for CLI flags
 *   - detect(): string|null  — Return data path if client is installed & has data, else null
 *   - getDailyStats(dateStr): StatsResult
 *   - getDateRangeStats(from, to): StatsResult
 *   - close(): void          — Release any resources (DB handles, etc.)
 *
 * StatsResult shape:
 *   {
 *     total:    { requests, inputTokens, outputTokens, toolCalls, cacheRead, cacheWrite, totalTokens },
 *     byModel:  Map<string, StatEntry>,
 *     byProject: Map<string, StatEntry>,
 *     byProvider: Map<string, StatEntry>,
 *     date: string,
 *     client: string  — provider id
 *   }
 */

export const EMPTY_STAT = () => ({
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  toolCalls: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
});

/**
 * Validate a date string (YYYY-MM-DD) and return it.
 * Throws on invalid format.
 */
export function validateDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const testDate = new Date(Date.UTC(y, m - 1, d));
  if (testDate.getUTCFullYear() !== y || testDate.getUTCMonth() !== m - 1 || testDate.getUTCDate() !== d) {
    throw new Error(`Date does not exist: ${dateStr}`);
  }
  return dateStr;
}

/**
 * Parse a period string (YYYY-MM or YYYY-MM-DD) into {from, to}.
 */
export function parsePeriod(period) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    validateDate(period);
    return { from: period, to: period };
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    if (m < 1 || m > 12) {
      throw new Error(`Invalid period: ${period}`);
    }
    const from = `${period}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const to = `${period}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }
  throw new Error(`Invalid period: ${period}`);
}
