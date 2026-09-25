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

export const readDefaultMode = getDefaultMode;
export { getBaldieInstructions, getModeLine };

const RUNTIME_MODE_LIST = RUNTIME_MODES.join("|");
const BALDIE_COMMAND_DESCRIPTION = `Set mode: ${RUNTIME_MODE_LIST}. Commands: status, default <mode>`;

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
      },
    };
  },
};