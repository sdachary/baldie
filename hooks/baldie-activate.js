#!/usr/bin/env node
// baldie — Claude Code SessionStart activation hook.
//
// Runs on every session start:
//   1. Writes flag file at the agent state dir (.baldie-active)
//   2. Emits the baldie ruleset as hidden SessionStart context
//   3. Honors "off" mode from config/env: skips activation entirely

const { getDefaultMode, isDeactivationCommandLike } = require('./baldie-config');
const { getBaldieInstructions } = require('./baldie-instructions');
const { clearMode, isCodex, isCopilot, setMode, writeHookOutput } = require('./baldie-runtime');

const mode = getDefaultMode();
const off = mode === 'off' || isDeactivationCommandLike(process.argv[2]);

if (off) {
  clearMode();
  writeHookOutput('SessionStart', 'off', isCodex || isCopilot ? '' : 'OK');
  process.exit(0);
}

setMode(mode);
writeHookOutput('SessionStart', mode, getBaldieInstructions(mode));
process.exit(0);