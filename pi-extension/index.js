import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_MODE,
  RUNTIME_MODES,
  getDefaultMode,
  normalizeMode,
  normalizePersistedMode,
  isDeactivationCommand,
} = require("../hooks/baldie-config.js");
const { getBaldieInstructions, getModeLine } = require("../hooks/baldie-instructions.js");
const { findAlternatives, formatForAgent } = require("../hooks/baldie-find.js");
const { calculateSavings, formatCostReport } = require("../hooks/baldie-cost.js");
const { planMigration, formatPlan } = require("../hooks/baldie-migrate.js");

export const readDefaultMode = getDefaultMode;
export { getBaldieInstructions, getModeLine };

const RUNTIME_MODE_LIST = RUNTIME_MODES.join("|");
const BALDIE_COMMAND_DESCRIPTION = `Set mode: ${RUNTIME_MODE_LIST}. Commands: status, default <mode>`;
const BALDIE_FIND_DESCRIPTION = `Search free alternatives: /baldie-find <category|service> [lite|full|ultra]. Categories: database, static-hosting, serverless, ci-cd, storage, paas, vm, observability, dns, email, auth, queue, search, analytics, selfhost.`;
const BALDIE_COST_DESCRIPTION = `Calculate savings: /baldie-cost <service> <tier> [lite|full|ultra]. Example: /baldie-cost RDS db.t3.micro`;
const BALDIE_MIGRATE_DESCRIPTION = `Migration plan: /baldie-migrate <from> <to> [tier] [lite|full|ultra]. Example: /baldie-migrate RDS Neon db.t3.micro`;

export function resolveSessionMode(entries, fallbackMode = DEFAULT_MODE) {
  const fallback = normalizePersistedMode(fallbackMode) || DEFAULT_MODE;
  if (!Array.isArray(entries)) return fallback;

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry?.type !== "custom" || entry?.customType !== "baldie-mode") continue;
    const mode = normalizePersistedMode(entry?.data?.mode);
    if (mode) return mode;
  }

  return fallback;
}

export function parseBaldieCommand(text, defaultMode = DEFAULT_MODE) {
  const fallback = normalizePersistedMode(defaultMode) || DEFAULT_MODE;
  const t = String(text || "").trim().toLowerCase();

  if (!t) return { type: "set-mode", mode: fallback === "off" ? "full" : fallback };

  const parts = t.split(/\s+/);
  if (parts[0] !== "/baldie") {
    if (isDeactivationCommand(t)) return { type: "set-mode", mode: "off" };
    return null;
  }

  const arg = parts[1] || "";
  if (normalizeMode(arg)) return { type: "set-mode", mode: arg };
  if (arg === "off" || isDeactivationCommand(arg)) return { type: "set-mode", mode: "off" };
  if (arg === "status") return { type: "status" };
  if (arg === "default" && normalizePersistedMode(parts[2])) return { type: "set-default", mode: parts[2] };
  return { type: "set-mode", mode: fallback === "off" ? "full" : fallback };
}

export function parseBaldieFindCommand(text, currentMode = DEFAULT_MODE) {
  const t = String(text || "").trim();
  if (!t || !t.toLowerCase().startsWith("/baldie-find")) return null;

  const parts = t.split(/\s+/);
  const query = parts[1] || "";
  const modeArg = parts[2] || "";
  const mode = normalizeMode(modeArg) || currentMode;

  if (!query) {
    return { type: "error", message: "Usage: /baldie-find <category|service> [lite|full|ultra]" };
  }

  return { type: "find", query, mode };
}

export function parseBaldieCostCommand(text, currentMode = DEFAULT_MODE) {
  const t = String(text || "").trim();
  if (!t || !t.toLowerCase().startsWith("/baldie-cost")) return null;

  const parts = t.split(/\s+/);
  const service = parts[1] || "";
  const tier = parts[2] || "";
  const modeArg = parts[3] || "";
  const mode = normalizeMode(modeArg) || currentMode;

  if (!service || !tier) {
    return { type: "error", message: "Usage: /baldie-cost <service> <tier> [lite|full|ultra]" };
  }

  return { type: "cost", service, tier, mode };
}

export function parseBaldieMigrateCommand(text, currentMode = DEFAULT_MODE) {
  const t = String(text || "").trim();
  if (!t || !t.toLowerCase().startsWith("/baldie-migrate")) return null;

  const parts = t.split(/\s+/);
  const from = parts[1] || "";
  const to = parts[2] || "";
  const tier = parts[3] || "";
  const modeArg = parts[4] || "";
  const mode = normalizeMode(modeArg) || currentMode;

  if (!from || !to) {
    return { type: "error", message: "Usage: /baldie-migrate <from> <to> [tier] [lite|full|ultra]" };
  }

  return { type: "migrate", from, to, tier: tier || "default", mode };
}

export const BALDIE_CONFIG = {
  id: "baldie",
  name: "Baldie",
  description:
    "Free-tier-first DevOps advisor. Makes you recommend the free or always-free option first and pay for usage, not guessing.",
  api: async (pi) => {
    if (!pi || !pi.mode) throw new Error("baldie extension requires a pi harness implementing mode.custom");
    const readMode = () => {
      const m = pi.mode?.get?.();
      return resolveSessionMode(m ? [m] : [], getDefaultMode());
    };

    return {
      name: "baldie",
      metadata: {
        description: "Free-tier-first DevOps advisor mode",
        commands: {
          "/baldie": {
            description: BALDIE_COMMAND_DESCRIPTION,
            handler: async (opts) => parseBaldieCommand(opts?.fullText || opts?.text || ""),
          },
          "/baldie-find": {
            description: BALDIE_FIND_DESCRIPTION,
            handler: async (opts) => parseBaldieFindCommand(opts?.fullText || opts?.text || "", readMode()),
          },
          "/baldie-cost": {
            description: BALDIE_COST_DESCRIPTION,
            handler: async (opts) => parseBaldieCostCommand(opts?.fullText || opts?.text || "", readMode()),
          },
          "/baldie-migrate": {
            description: BALDIE_MIGRATE_DESCRIPTION,
            handler: async (opts) => parseBaldieMigrateCommand(opts?.fullText || opts?.text || "", readMode()),
          },
        },
      },
      query: () => ({ instructions: getBaldieInstructions(readMode()) }),
      commands: {
        async ["/baldie"](opts) {
          const parsed = parseBaldieCommand(opts?.fullText || opts?.text || "");
          if (!parsed) return null;
          if (parsed.type === "set-mode") pi.mode.custom("baldie-mode", { mode: parsed.mode });
          if (parsed.type === "set-default") { /* persisted via config file */ }
          if (parsed.type === "status") {
            const mode = readMode();
            return { message: getModeLine(mode) };
          }
          return { message: getModeLine(parsed.mode) };
        },
        async ["/baldie-find"](opts) {
          const parsed = parseBaldieFindCommand(opts?.fullText || opts?.text || "", readMode());
          if (!parsed) return null;
          if (parsed.type === "error") return { message: parsed.message };
          if (parsed.type === "find") {
            const result = findAlternatives(parsed.query, { mode: parsed.mode, limit: 10 });
            return { message: formatForAgent(result) };
          }
          return null;
        },
        async ["/baldie-cost"](opts) {
          const parsed = parseBaldieCostCommand(opts?.fullText || opts?.text || "", readMode());
          if (!parsed) return null;
          if (parsed.type === "error") return { message: parsed.message };
          if (parsed.type === "cost") {
            const report = calculateSavings(parsed.service, parsed.tier, {}, { mode: parsed.mode, limit: 10 });
            return { message: formatCostReport(report) };
          }
          return null;
        },
        async ["/baldie-migrate"](opts) {
          const parsed = parseBaldieMigrateCommand(opts?.fullText || opts?.text || "", readMode());
          if (!parsed) return null;
          if (parsed.type === "error") return { message: parsed.message };
          if (parsed.type === "migrate") {
            const plan = planMigration(parsed.from, parsed.tier, parsed.to, {}, { mode: parsed.mode });
            return { message: formatPlan(plan) };
          }
          return null;
        },
      },
    };
  },
};