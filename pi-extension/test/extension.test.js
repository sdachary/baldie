import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBaldieCommand,
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