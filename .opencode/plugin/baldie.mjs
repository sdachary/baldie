// baldie — OpenCode plugin.
//
// Injects the baldie ruleset into every chat's system prompt, registers the
// skills dir and /baldie slash commands, and persists the active intensity.
//
// OpenCode loads this as a server plugin — add to opencode.json:
//   { "plugin": ["github:sdachary/baldie"] /* or local path */ }

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODES = ['lite', 'full', 'ultra'];

const statePath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'opencode',
  '.baldie-active',
);

function readMode() {
  try {
    const m = fs.readFileSync(statePath, 'utf8').trim();
    return MODES.includes(m) ? m : 'full';
  } catch (e) {
    return 'full';
  }
}

function writeMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

const INSTRUCTIONS = {
  full: fs.readFileSync(path.resolve(__dirname, '../../AGENTS.md'), 'utf8'),
  lite: 'Baldie (lite): recommend free/free-tier first, but a small paid option is fine if it measurably saves real time. Follow AGENTS.md.',
  ultra: 'Baldie (ultra): zero-budget mode. Recommend only already-owned, always-free-tier, or provably essential resources. Follow AGENTS.md.',
};

export default async ({ client } = {}) => {
  const log = (level, message) => {
    try { client && client.app && client.app.log({ body: { service: 'baldie', level, message } }); } catch (e) {}
  };

  const skillsDir = path.resolve(__dirname, '../../skills');

  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) config.skills.paths.push(skillsDir);
    },

    chat: {
      async system() { return INSTRUCTIONS[readMode()] || INSTRUCTIONS.full; },
    },

    event: async (event) => {
      if (!event || !event.message) return;
      const text = (event.message.content || '').toLowerCase();
      const m = text.match(/^\/baldie\s+(lite|full|ultra)$/);
      if (m) { writeMode(m[1]); log('info', `mode -> ${m[1]}`); }
    },
  };
};