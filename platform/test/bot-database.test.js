"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ursinho-bot-db-test-"));
const modulePath = path.resolve(__dirname, "../src/database/database.js");
const dbPath = path.join(temp, "bot-db.json");
const env = { ...process.env, BOT_DB_FILE: dbPath };

test("a base principal ausente é criada e as alterações persistem", () => {
  const first = spawnSync(process.execPath, ["-e", `const db=require(${JSON.stringify(modulePath)}); db.stats.messages=23; db.save();`], { env, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const second = spawnSync(process.execPath, ["-e", `const db=require(${JSON.stringify(modulePath)}); if(db.stats.messages!==23) process.exit(9);`], { env, encoding: "utf8" });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(JSON.parse(fs.readFileSync(dbPath, "utf8")).stats.messages, 23);
});

test("uma base corrompida preserva os bytes e bloqueia o arranque", () => {
  const broken = "{ JSON incompleto";
  fs.writeFileSync(dbPath, broken);
  const result = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(modulePath)});`], { env, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(dbPath, "utf8"), broken);
  const backups = fs.readdirSync(temp).filter(n => n.startsWith("bot-db.json.corrompido-"));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(temp, backups[0]), "utf8"), broken);
});

test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
