/**
 * Tests for the CodeWhale provider — reads codewhale session JSON files.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { setLocale } from "../i18n.mjs";
import { detect, getDailyStats, getDateRangeStats, id, name } from "../providers/codewhale.mjs";

setLocale("zh-CN");

/**
 * Build a mock session JSON structure.
 */
function makeSession(meta, messages = []) {
  return {
    schema_version: 1,
    metadata: meta,
    messages,
  };
}

/**
 * Build a mock assistant message, optionally with tool_use blocks.
 */
function makeAssistantMsg(toolCount = 0) {
  const content = [{ type: "thinking", thinking: "thinking content" }];
  for (let i = 0; i < toolCount; i++) {
    content.push({
      type: "tool_use",
      id: `call_${i}`,
      name: "read_file",
      input: { path: "foo.txt" },
    });
  }
  content.push({ type: "text", text: "response text" });
  return { role: "assistant", content };
}

function makeUserMsg() {
  return { role: "user", content: [{ type: "text", text: "user message" }] };
}

/**
 * Create a temporary directory with sample codewhale session files.
 */
function createTestFixtures() {
  const dir = mkdtempSync(join(tmpdir(), "ocusage-codewhale-test-"));
  const sessionsDir = join(dir, "sessions");
  mkdirSync(sessionsDir, { recursive: true });

  const baseMeta = (id, date, tokens, model, ws) => ({
    id,
    title: `Test session ${id}`,
    created_at: date,
    updated_at: date,
    message_count: 0, // not used by provider
    total_tokens: tokens,
    model,
    workspace: ws,
    mode: "agent",
    cumulative_turn_secs: 60,
  });

  // --- Session 1: today, project-a, deepseek-v4-pro, 50000 tokens ---
  // 4 assistant messages, 2 of them have tool_use blocks (1 and 2)
  const s1 = makeSession(baseMeta("s1", "2026-06-08T10:00:00.000Z", 50000, "deepseek-v4-pro", "/home/user/project-a"), [
    makeUserMsg(),
    makeAssistantMsg(1), // assistant #1, 1 tool_use
    makeUserMsg(),
    makeAssistantMsg(0), // assistant #2, 0 tool_use
    makeUserMsg(),
    makeAssistantMsg(2), // assistant #3, 2 tool_use
    makeUserMsg(),
    makeAssistantMsg(0), // assistant #4, 0 tool_use
    makeUserMsg(), // user msgs don't count
  ]);

  // --- Session 2: yesterday, project-b, deepseek-v4-flash, 30000 tokens ---
  // 3 assistant messages, 1 has a tool_use block
  const s2 = makeSession(
    baseMeta("s2", "2026-06-07T14:00:00.000Z", 30000, "deepseek-v4-flash", "/home/user/project-b"),
    [
      makeUserMsg(),
      makeAssistantMsg(1), // assistant #1, 1 tool_use
      makeUserMsg(),
      makeAssistantMsg(0), // assistant #2
      makeAssistantMsg(0), // assistant #3
    ],
  );

  // --- Session 3: older, project-a, gpt-4o, 15000 tokens ---
  // 2 assistant messages, 0 tool_use
  const s3 = makeSession(baseMeta("s3", "2026-06-01T08:00:00.000Z", 15000, "gpt-4o", "/home/user/project-a"), [
    makeUserMsg(),
    makeAssistantMsg(0),
    makeUserMsg(),
    makeAssistantMsg(0),
  ]);

  // --- Session 4: yesterday, windows path, deepseek-v4-pro, 8000 tokens ---
  // 2 assistant messages, 1 tool_use
  const s4 = makeSession(
    baseMeta("s4", "2026-06-07T16:00:00.000Z", 8000, "deepseek-v4-pro", "C:\\Users\\testuser\\project-c"),
    [makeUserMsg(), makeAssistantMsg(1), makeUserMsg(), makeAssistantMsg(0)],
  );

  // --- Session 5: today, project-a, deepseek-v4-pro, 12000 tokens ---
  // 3 assistant messages, 1 tool_use
  const s5 = makeSession(baseMeta("s5", "2026-06-08T12:00:00.000Z", 12000, "deepseek-v4-pro", "/home/user/project-a"), [
    makeUserMsg(),
    makeAssistantMsg(1),
    makeAssistantMsg(0),
    makeAssistantMsg(0),
  ]);

  // Excluded: latest.json (checkpoint pointer)
  const checkpoint = makeSession(
    { id: "check", title: "Checkpoint", created_at: "2026-06-08T12:00:00.000Z", total_tokens: 999999 },
    [],
  );

  writeFileSync(join(sessionsDir, "session-1-uuid.json"), JSON.stringify(s1));
  writeFileSync(join(sessionsDir, "session-2-uuid.json"), JSON.stringify(s2));
  writeFileSync(join(sessionsDir, "session-3-uuid.json"), JSON.stringify(s3));
  writeFileSync(join(sessionsDir, "session-4-uuid.json"), JSON.stringify(s4));
  writeFileSync(join(sessionsDir, "session-5-uuid.json"), JSON.stringify(s5));
  writeFileSync(join(sessionsDir, "latest.json"), JSON.stringify(checkpoint));

  return {
    sessionsDir,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("CodeWhale provider", () => {
  const TODAY = "2026-06-08";
  const YESTERDAY = "2026-06-07";
  const _OLD_DATE = "2026-06-01";

  describe("module exports", () => {
    it("exposes correct name and id", () => {
      assert.equal(name, "CodeWhale");
      assert.equal(id, "codewhale");
    });
  });

  describe("detect", () => {
    it("returns null for non-existent directory", () => {
      assert.equal(detect("/nonexistent/path/to/codewhale"), null);
    });

    it("returns path for valid custom sessions dir", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        assert.equal(detect(sessionsDir), sessionsDir);
      } finally {
        cleanup();
      }
    });
  });

  describe("getDailyStats", () => {
    it("returns null for non-existent directory", () => {
      assert.equal(getDailyStats("/nonexistent/path", TODAY), null);
    });

    it("returns stats for today (2 sessions, project-a, same model)", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        const result = getDailyStats(sessionsDir, TODAY);
        assert.ok(result, "Expected stats result");
        assert.equal(result.date, TODAY);
        assert.equal(result.client, "codewhale");

        // s1: 4 asst, 3 tool_use, 50000 total / s5: 3 asst, 1 tool_use, 12000 total
        assert.equal(result.total.requests, 7);
        assert.equal(result.total.toolCalls, 4); // 3+1
        assert.equal(result.total.totalTokens, 62000);
        // inputTokens = totalTokens (no split available)
        assert.equal(result.total.inputTokens, 62000);
        assert.equal(result.total.outputTokens, 0);
        assert.equal(result.total.cacheRead, 0);
        assert.equal(result.total.cacheWrite, 0);

        const modelKey = "deepseek-v4-pro (codewhale)";
        assert.ok(result.byModel.has(modelKey), `Expected model key "${modelKey}"`);
        const m = result.byModel.get(modelKey);
        assert.equal(m.requests, 7);
        assert.equal(m.toolCalls, 4);
        assert.equal(m.totalTokens, 62000);
        assert.equal(m.inputTokens, 62000);

        assert.ok(result.byProject.has("project-a"));
        const p = result.byProject.get("project-a");
        assert.equal(p.requests, 7);
        assert.equal(p.totalTokens, 62000);
      } finally {
        cleanup();
      }
    });

    it("returns stats for yesterday (2 sessions, 2 models, 2 projects)", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        const result = getDailyStats(sessionsDir, YESTERDAY);
        assert.ok(result);
        assert.equal(result.date, YESTERDAY);

        // s2: 3 asst, 1 tc, 30000 / s4: 2 asst, 1 tc, 8000
        assert.equal(result.total.requests, 5);
        assert.equal(result.total.toolCalls, 2);
        assert.equal(result.total.totalTokens, 38000);
        assert.equal(result.total.inputTokens, 38000);

        // byModel
        assert.equal(result.byModel.size, 2);
        const flash = result.byModel.get("deepseek-v4-flash (codewhale)");
        assert.equal(flash.requests, 3);
        assert.equal(flash.totalTokens, 30000);
        const pro = result.byModel.get("deepseek-v4-pro (codewhale)");
        assert.equal(pro.requests, 2);
        assert.equal(pro.totalTokens, 8000);

        // byProject
        assert.equal(result.byProject.size, 2);
        assert.equal(result.byProject.get("project-b").totalTokens, 30000);
        assert.equal(result.byProject.get("project-c").totalTokens, 8000);
      } finally {
        cleanup();
      }
    });

    it("returns zeroed stats for a date with no matching sessions", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        const result = getDailyStats(sessionsDir, "2025-01-01");
        assert.ok(result, "Expected stats (files exist, no matching dates → zeroed)");
        assert.equal(result.total.requests, 0);
        assert.equal(result.total.totalTokens, 0);
      } finally {
        cleanup();
      }
    });

    it("excludes latest.json from aggregation", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        const result = getDailyStats(sessionsDir, TODAY);
        assert.ok(result);
        // Checkpoint has 999999 tokens but should be excluded
        assert.equal(result.total.totalTokens, 62000);
      } finally {
        cleanup();
      }
    });

    it("only counts assistant messages as requests (not user/tool_result)", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        const result = getDailyStats(sessionsDir, TODAY);
        // s1: 4 assistant out of 9 total messages / s5: 3 assistant out of 4
        assert.equal(result.total.requests, 7);
        assert.equal(result.total.totalTokens, 62000);
      } finally {
        cleanup();
      }
    });
  });

  describe("getDateRangeStats", () => {
    it("returns stats for a date range spanning multiple days", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        const result = getDateRangeStats(sessionsDir, YESTERDAY, TODAY);
        assert.ok(result);
        assert.equal(result.date, `${YESTERDAY} ~ ${TODAY}`);

        // s1 (4+3) + s2 (3+1) + s4 (2+1) + s5 (3+1)
        // requests: 4+3+2+3 = 12
        // toolCalls: 3+1+1+1 = 6
        // tokens: 50000+30000+8000+12000 = 100000
        assert.equal(result.total.requests, 12);
        assert.equal(result.total.toolCalls, 6);
        assert.equal(result.total.totalTokens, 100000);
        assert.equal(result.total.inputTokens, 100000);

        // byModel
        const pro = result.byModel.get("deepseek-v4-pro (codewhale)");
        assert.ok(pro);
        assert.equal(pro.requests, 9); // 4+2+3
        assert.equal(pro.totalTokens, 70000); // 50000+8000+12000
        assert.equal(pro.toolCalls, 5); // 3+1+1

        const flash = result.byModel.get("deepseek-v4-flash (codewhale)");
        assert.ok(flash);
        assert.equal(flash.requests, 3);
        assert.equal(flash.totalTokens, 30000);

        // byProject
        assert.equal(result.byProject.size, 3);
        assert.equal(result.byProject.get("project-a").totalTokens, 62000);
        assert.equal(result.byProject.get("project-b").totalTokens, 30000);
        assert.equal(result.byProject.get("project-c").totalTokens, 8000);
      } finally {
        cleanup();
      }
    });

    it("throws on invalid date range (from > to)", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        assert.throws(() => getDateRangeStats(sessionsDir, TODAY, YESTERDAY), /Start date .* after end date/);
      } finally {
        cleanup();
      }
    });

    it("returns full history when querying a broad range", () => {
      const { sessionsDir, cleanup } = createTestFixtures();
      try {
        const result = getDateRangeStats(sessionsDir, "2026-06-01", "2026-06-08");
        assert.ok(result);
        // All 5 sessions: s1+s2+s3+s4+s5
        // requests: 4+3+2+2+3 = 14
        // toolCalls: 3+1+0+1+1 = 6
        // tokens: 50000+30000+15000+8000+12000 = 115000
        assert.equal(result.total.requests, 14);
        assert.equal(result.total.toolCalls, 6);
        assert.equal(result.total.totalTokens, 115000);
        assert.equal(result.total.inputTokens, 115000);
      } finally {
        cleanup();
      }
    });
  });
});
