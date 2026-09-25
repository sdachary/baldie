#!/usr/bin/env node
// baldie — SubagentStart hook for Claude Code.
//
// Passes the baldie ruleset + current mode into subagents so they inherit the
// free-first behavior instead of silently regressing to default spending.

const { getBaldieInstructions } = require('./baldie-instructions');
const { getDefaultMode } = require('./baldie-config');
const { isCodex, readMode, writeHookOutput } = require('./baldie-runtime');

if (isCodex) process.exit(0);

const mode = readMode() || getDefaultMode();
if (mode === 'off') process.exit(0);

writeHookOutput('SubagentStart', mode, getBaldieInstructions(mode));
process.exit(0);