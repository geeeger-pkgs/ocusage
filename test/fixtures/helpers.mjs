import initSqlJs from "sql.js";

export async function createTestDB() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      directory TEXT
    );
    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      data TEXT,
      time_created INTEGER
    );
    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      data TEXT,
      time_created INTEGER
    );
  `);

  return db;
}

export function insertSession(db, id, directory) {
  db.run("INSERT INTO session (id, directory) VALUES (?, ?)", [id, directory || null]);
}

export function insertMessage(db, { id, sessionId, role, modelID, providerID, tokens, timeCreated }) {
  const data = JSON.stringify({ role, modelID, providerID, tokens });
  db.run("INSERT INTO message (id, session_id, data, time_created) VALUES (?, ?, ?, ?)",
    [id, sessionId, data, timeCreated]);
}

export function insertPart(db, { id, messageId, type, timeCreated }) {
  const data = JSON.stringify({ type });
  db.run("INSERT INTO part (id, message_id, data, time_created) VALUES (?, ?, ?, ?)",
    [id, messageId, data, timeCreated]);
}

export const DAY = {
  "2025-04-20": {
    start: Date.UTC(2025, 3, 20, 0, 0, 0),
    end: Date.UTC(2025, 3, 20, 23, 59, 59, 999),
  },
};

export function seedTypicalDay(db) {
  insertSession(db, "s1", "/home/user/project-a");
  insertSession(db, "s2", "/home/user/project-b");
  insertSession(db, "s3", null);

  const t = DAY["2025-04-20"].start + 3600000;

  insertMessage(db, {
    id: "m1", sessionId: "s1", role: "user",
    modelID: "claude-3.5", providerID: "anthropic",
    tokens: {}, timeCreated: t,
  });

  insertMessage(db, {
    id: "m2", sessionId: "s1", role: "assistant",
    modelID: "claude-3.5", providerID: "anthropic",
    tokens: { input: 1000, output: 500, cache: { read: 200, write: 100 }, total: 1800 },
    timeCreated: t + 1000,
  });

  insertPart(db, { id: "p1", messageId: "m2", type: "tool", timeCreated: t + 1000 });
  insertPart(db, { id: "p2", messageId: "m2", type: "tool", timeCreated: t + 2000 });

  insertMessage(db, {
    id: "m3", sessionId: "s2", role: "assistant",
    modelID: "gpt-4o", providerID: "openai",
    tokens: { input: 2000, output: 1000, total: 3000 },
    timeCreated: t + 5000,
  });

  insertMessage(db, {
    id: "m4", sessionId: "s3", role: "assistant",
    modelID: "claude-3.5", providerID: "anthropic",
    tokens: { input: 500, output: 200, total: 700 },
    timeCreated: t + 10000,
  });
}
