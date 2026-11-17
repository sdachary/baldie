import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBaldieCommand,
  parseBaldieFindCommand,
  parseBaldieCostCommand,
  parseBaldieMigrateCommand,
  resolveSessionMode,
  BALDIE_CONFIG,
} from "../index.js";

test("parseBaldieCommand: bare command uses default", () => {
  assert.deepEqual(parseBaldieCommand("/baldie"), { type: "set-mode", mode: "full" });
  assert.deepEqual(parseBaldieCommand(""), { type: "set-mode", mode: "full" });
});

test("parseBaldieCommand: mode names", () => {
  assert.deepEqual(parseBaldieCommand("/baldie lite"), { type: "set-mode", mode: "lite" });
  assert.deepEqual(parseBaldieCommand("/baldie ultra"), { type: "set-mode", mode: "ultra" });
});

test("parseBaldieCommand: off and status", () => {
  assert.deepEqual(parseBaldieCommand("/baldie off"), { type: "set-mode", mode: "off" });
  assert.deepEqual(parseBaldieCommand("stop baldie"), { type: "set-mode", mode: "off" });
  assert.deepEqual(parseBaldieCommand("/baldie status"), { type: "status" });
});

test("parseBaldieCommand: default override", () => {
  assert.deepEqual(parseBaldieCommand("/baldie default lite"), { type: "set-default", mode: "lite" });
});

test("parseBaldieCommand: unknown arg falls back", () => {
  assert.deepEqual(parseBaldieCommand("/baldie explode"), { type: "set-mode", mode: "full" });
});

test("resolveSessionMode: last valid mode wins", () => {
  const entries = [
    { type: "custom", customType: "baldie-mode", data: { mode: "lite" } },
    { type: "custom", customType: "other", data: { mode: "ultra" } },
    { type: "custom", customType: "baldie-mode", data: { mode: "ultra" } },
  ];
  assert.equal(resolveSessionMode(entries), "ultra");
});

test("resolveSessionMode: ignores non-baldie entries, falls back", () => {
  assert.equal(resolveSessionMode(null), "full");
  assert.equal(resolveSessionMode([{ type: "custom", customType: "other", data: { mode: "lite" } }]), "full");
  assert.equal(resolveSessionMode([], "lite"), "lite");
});

test("extension exposes /baldie command", async () => {
  const pi = {
    mode: {
      custom() {},
      get: () => null,
    },
  };
  const installed = await BALDIE_CONFIG.api(pi);
  assert.ok(installed.commands["/baldie"]);
  const res = await installed.commands["/baldie"]({ text: "/baldie lite" });
  assert.match(res.message, /lite/i);
});

test("parseBaldieFindCommand: basic query", () => {
  assert.deepEqual(
    parseBaldieFindCommand("/baldie-find database", "full"),
    { type: "find", query: "database", mode: "full" }
  );
});

test("parseBaldieFindCommand: query with mode override", () => {
  assert.deepEqual(
    parseBaldieFindCommand("/baldie-find database ultra", "full"),
    { type: "find", query: "database", mode: "ultra" }
  );
});

test("parseBaldieFindCommand: missing query returns error", () => {
  const result = parseBaldieFindCommand("/baldie-find", "full");
  assert.equal(result.type, "error");
  assert.match(result.message, /Usage/);
});

test("extension exposes /baldie-find command", async () => {
  const pi = {
    mode: {
      custom() {},
      get: () => null,
    },
  };
  const installed = await BALDIE_CONFIG.api(pi);
  assert.ok(installed.commands["/baldie-find"]);
  const res = await installed.commands["/baldie-find"]({ text: "/baldie-find database" });
  assert.match(res.message, /database/i);
});

test("parseBaldieCostCommand: basic query", () => {
  assert.deepEqual(
    parseBaldieCostCommand("/baldie-cost RDS db.t3.micro", "full"),
    { type: "cost", service: "RDS", tier: "db.t3.micro", mode: "full" }
  );
});

test("parseBaldieCostCommand: query with mode override", () => {
  assert.deepEqual(
    parseBaldieCostCommand("/baldie-cost RDS db.t3.micro ultra", "full"),
    { type: "cost", service: "RDS", tier: "db.t3.micro", mode: "ultra" }
  );
});

test("parseBaldieCostCommand: missing args returns error", () => {
  const result = parseBaldieCostCommand("/baldie-cost RDS", "full");
  assert.equal(result.type, "error");
  assert.match(result.message, /Usage/);
});

test("extension exposes /baldie-cost command", async () => {
  const pi = {
    mode: {
      custom() {},
      get: () => null,
    },
  };
  const installed = await BALDIE_CONFIG.api(pi);
  assert.ok(installed.commands["/baldie-cost"]);
  const res = await installed.commands["/baldie-cost"]({ text: "/baldie-cost RDS db.t3.micro" });
  assert.match(res.message, /RDS/i);
});

test("parseBaldieMigrateCommand: basic query", () => {
  assert.deepEqual(
    parseBaldieMigrateCommand("/baldie-migrate RDS Neon", "full"),
    { type: "migrate", from: "RDS", to: "Neon", tier: "default", mode: "full" }
  );
});

test("parseBaldieMigrateCommand: query with tier and mode", () => {
  assert.deepEqual(
    parseBaldieMigrateCommand("/baldie-migrate RDS Neon db.t3.micro ultra", "full"),
    { type: "migrate", from: "RDS", to: "Neon", tier: "db.t3.micro", mode: "ultra" }
  );
});

test("parseBaldieMigrateCommand: missing args returns error", () => {
  const result = parseBaldieMigrateCommand("/baldie-migrate RDS", "full");
  assert.equal(result.type, "error");
  assert.match(result.message, /Usage/);
});

test("extension exposes /baldie-migrate command", async () => {
  const pi = {
    mode: {
      custom() {},
      get: () => null,
    },
  };
  const installed = await BALDIE_CONFIG.api(pi);
  assert.ok(installed.commands["/baldie-migrate"]);
  const res = await installed.commands["/baldie-migrate"]({ text: "/baldie-migrate RDS Neon db.t3.micro" });
  assert.match(res.message, /RDS/i);
});