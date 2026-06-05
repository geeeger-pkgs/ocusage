/**
 * Multi-client orchestration layer.
 *
 * Provides a unified interface to query token usage across multiple AI clients:
 * OpenCode, Qoder, Claude Code, and Trae.
 *
 * Usage:
 *   import { getAllStats, detectClients } from './multi.mjs';
 *   const clients = detectClients();
 *   const results = getAllStats('2025-04-20', null, { clientFilter: 'opencode,qoder' });
 */

import { detectProviders, getAllProviderStats } from "./providers/index.mjs";

/**
 * Detect available AI clients on this machine.
 * Returns [{ id, name, path }] for each detected client.
 */
export function detectClients(customPaths = {}) {
  return detectProviders(customPaths);
}

/**
 * Get stats for all (or filtered) clients for a given date or range.
 *
 * @param {string} dateStr - Date (YYYY-MM-DD) or start date
 * @param {string|null} toDateStr - End date for range queries, null for single day
 * @param {object} opts - Options
 * @param {string|null} opts.clientFilter - Comma-separated client IDs to include, null for all
 * @param {object} opts.customPaths - Custom paths per client { opencode: '/path', qoder: '/path' }
 * @returns {Array<{id, name, stats, error?}>} - Results per client
 */
export function getAllStats(dateStr, toDateStr, opts = {}) {
  const { clientFilter = null, customPaths = {} } = opts;
  return getAllProviderStats(dateStr, toDateStr, customPaths, clientFilter);
}

/**
 * Aggregate multiple client stats into a single combined result.
 * Merges total, byModel, byProject, byProvider maps.
 *
 * @param {Array<{stats: StatsResult}>} results - Array of results from getAllStats
 * @param {string} dateLabel - Date label for the combined result
 * @returns {StatsResult} - Combined stats
 */
export function aggregateStats(results, dateLabel) {
  const total = {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    toolCalls: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
  };
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const { stats } of results) {
    if (!stats || stats.encrypted) continue;

    total.requests += stats.total.requests;
    total.inputTokens += stats.total.inputTokens;
    total.outputTokens += stats.total.outputTokens;
    total.toolCalls += stats.total.toolCalls;
    total.cacheRead += stats.total.cacheRead;
    total.cacheWrite += stats.total.cacheWrite;
    total.totalTokens += stats.total.totalTokens;

    for (const [key, val] of stats.byModel) {
      if (!byModel.has(key)) {
        byModel.set(key, {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          toolCalls: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
        });
      }
      const s = byModel.get(key);
      s.requests += val.requests;
      s.inputTokens += val.inputTokens;
      s.outputTokens += val.outputTokens;
      s.toolCalls += val.toolCalls;
      s.cacheRead += val.cacheRead;
      s.cacheWrite += val.cacheWrite;
      s.totalTokens += val.totalTokens;
    }

    for (const [key, val] of stats.byProject) {
      if (!byProject.has(key)) {
        byProject.set(key, {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          toolCalls: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
        });
      }
      const s = byProject.get(key);
      s.requests += val.requests;
      s.inputTokens += val.inputTokens;
      s.outputTokens += val.outputTokens;
      s.toolCalls += val.toolCalls;
      s.cacheRead += val.cacheRead;
      s.cacheWrite += val.cacheWrite;
      s.totalTokens += val.totalTokens;
    }

    for (const [key, val] of stats.byProvider) {
      if (!byProvider.has(key)) {
        byProvider.set(key, {
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          toolCalls: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
        });
      }
      const s = byProvider.get(key);
      s.requests += val.requests;
      s.inputTokens += val.inputTokens;
      s.outputTokens += val.outputTokens;
      s.toolCalls += val.toolCalls;
      s.cacheRead += val.cacheRead;
      s.cacheWrite += val.cacheWrite;
      s.totalTokens += val.totalTokens;
    }
  }

  return { total, byModel, byProject, byProvider, date: dateLabel };
}
