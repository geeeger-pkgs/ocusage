/**
 * Provider registry — auto-detects installed AI clients and provides a unified interface.
 *
 * Usage:
 *   const { detectProviders, getProviderStats } from './providers/index.mjs';
 *   const providers = detectProviders(); // returns [{id, name, path, available}]
 *   const stats = getProviderStats('opencode', date, toDate); // StatsResult | null
 */

import { addStat, EMPTY_STAT } from "./base.mjs";
import * as claude from "./claude.mjs";
import * as codewhale from "./codewhale.mjs";
import * as mimocode from "./mimocode.mjs";
import * as opencode from "./opencode.mjs";
import * as qoder from "./qoder.mjs";
import * as qoderCli from "./qoder-cli.mjs";
import * as trae from "./trae.mjs";
import * as traeSolo from "./trae-solo.mjs";

const PROVIDERS = [
  { id: opencode.id, name: opencode.name, module: opencode },
  { id: mimocode.id, name: mimocode.name, module: mimocode },
  { id: qoder.id, name: qoder.name, module: qoder },
  { id: qoderCli.id, name: qoderCli.name, module: qoderCli },
  { id: claude.id, name: claude.name, module: claude },
  { id: codewhale.id, name: codewhale.name, module: codewhale },
  { id: trae.id, name: trae.name, module: trae },
  { id: traeSolo.id, name: traeSolo.name, module: traeSolo },
];

/**
 * Detect all installed AI clients with available data.
 * Returns an array of { id, name, path } for each detected client.
 */
export function detectProviders(customPaths = {}) {
  const detected = [];
  for (const provider of PROVIDERS) {
    const customPath = customPaths[provider.id];
    const path = provider.module.detect(customPath);
    if (path) {
      detected.push({
        id: provider.id,
        name: provider.name,
        path,
      });
    }
  }
  return detected;
}

/**
 * Get provider stats for a specific client.
 * Returns StatsResult | null | { encrypted: true } (for Trae).
 */
export function getProviderStats(providerId, dateStr, toDateStr, customPaths = {}) {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}. Available: ${PROVIDERS.map((p) => p.id).join(", ")}`);
  }

  const customPath = customPaths[provider.id];
  const detectedPath = provider.module.detect(customPath);
  if (!detectedPath) return null;

  if (toDateStr) {
    return provider.module.getDateRangeStats(customPath || undefined, dateStr, toDateStr);
  }
  return provider.module.getDailyStats(customPath || undefined, dateStr);
}

/**
 * Get stats for all detected clients for a given date or date range.
 * Returns an array of { id, name, stats } entries.
 */
export function getAllProviderStats(dateStr, toDateStr, customPaths = {}, clientFilter = null) {
  const results = [];
  const clientList =
    clientFilter && clientFilter.toLowerCase() !== "all"
      ? clientFilter.split(",").map((s) => s.trim().toLowerCase())
      : null;

  for (const provider of PROVIDERS) {
    // Apply client filter
    if (clientList && !clientList.includes(provider.id)) continue;

    const customPath = customPaths[provider.id];
    const detectedPath = provider.module.detect(customPath);
    if (!detectedPath) continue;

    let stats;
    try {
      if (toDateStr) {
        stats = provider.module.getDateRangeStats(customPath || undefined, dateStr, toDateStr);
      } else {
        stats = provider.module.getDailyStats(customPath || undefined, dateStr);
      }
    } catch (err) {
      results.push({
        id: provider.id,
        name: provider.name,
        stats: null,
        error: err.message,
      });
      continue;
    }

    if (stats === null) continue;

    results.push({
      id: provider.id,
      name: provider.name,
      stats,
    });
  }

  return results;
}

export const AVAILABLE_PROVIDERS = PROVIDERS.map((p) => ({ id: p.id, name: p.name }));

/**
 * Aggregate multiple client stats into a single combined result.
 */
export function aggregateStats(results, dateLabel) {
  const total = EMPTY_STAT();
  const byModel = new Map();
  const byProject = new Map();
  const byProvider = new Map();

  for (const { stats } of results) {
    if (!stats || stats.encrypted) continue;

    addStat(total, stats.total);

    for (const [key, val] of stats.byModel) {
      if (!byModel.has(key)) byModel.set(key, EMPTY_STAT());
      addStat(byModel.get(key), val);
    }

    for (const [key, val] of stats.byProject) {
      if (!byProject.has(key)) byProject.set(key, EMPTY_STAT());
      addStat(byProject.get(key), val);
    }

    for (const [key, val] of stats.byProvider) {
      if (!byProvider.has(key)) byProvider.set(key, EMPTY_STAT());
      addStat(byProvider.get(key), val);
    }
  }

  return { total, byModel, byProject, byProvider, date: dateLabel };
}
