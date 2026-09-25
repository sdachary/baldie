#!/usr/bin/env node
// baldie — UserPromptSubmit hook.
//
// Watches every user message for mode commands:
//   /baldie [lite|full|ultra]   switch intensity
//   /baldie off, stop baldie, normal mode
//   /baldie status              report current mode
// Repersists the (possibly new) mode so the ruleset stays live all session.
// Quiet on everything else so ordinary prompts never churn the transcript.

const fs = require('fs');
const path = require('path');
const {
  getClaudeDir,
  getConfigDir,
  getDefaultMode,
  isDeactivationCommand,
  isDeactivationCommandLike,
  normalizeMode,
  normalizePersistedMode,
} = require('./baldie-config');
const { getBaldieInstructions, getModeLine } = require('./baldie-instructions');
const {
  clearMode,
  isCodex,
  isCopilot,
  isQoder,
  readMode,
  setMode,
  writeHookOutput,
} = require('./baldie-runtime');

function lastModeCommand(text) {
  const parts = String(text || '').trim().split(/\s+/);
  if (parts[0]?.toLowerCase() !== '/baldie') return null;
  const arg = (parts[1] || '').toLowerCase();
  if (normalizeMode(arg)) return { action: 'set', mode: arg };
  if (arg === 'off') return { action: 'off' };
  if (arg === 'status') return { action: 'status' };
  if (isDeactivationCommand('/baldie ' + arg)) return { action: 'off' };
  return { action: 'set', mode: getDefaultMode() };
}

const stdin = fs.readFileSync(0, 'utf8');
let input;
try { input = JSON.parse(stdin); } catch (e) { input = { prompt: stdin }; }
const prompt = String(input.prompt || input.message?.content || '').trim();

if (!prompt) process.exit(0);

const cmd = lastModeCommand(prompt);
if (!cmd) process.exit(0);

if (cmd.action === 'status') {
  const m = readMode() || getDefaultMode();
  writeHookOutput('UserPromptSubmit', m, getModeLine(m));
  process.exit(0);
}

const current = readMode();
const effective = normalizePersistedMode(current);

if (cmd.action === 'set') {
  const m = cmd.mode;
  if (effective !== m) setMode(m);
  writeHookOutput('UserPromptSubmit', m, getBaldieInstructions(m));
} else if (cmd.action === 'off') {
  clearMode();
  writeHookOutput('UserPromptSubmit', 'off', '');
}
process.exit(0);