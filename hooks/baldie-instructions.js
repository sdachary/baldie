#!/usr/bin/env node
// baldie — shared instruction builder for Claude/Copilot/Qoder/Codex hooks and the pi extension.

const fs = require('fs');
const path = require('path');
const { DEFAULT_MODE, normalizeMode } = require('./baldie-config');

const AGENTS_PATH = path.join(__dirname, '..', 'AGENTS.md');

const MODE_LINE = {
  lite: 'BALDIE MODE ACTIVE — level: lite. Free/free-tier first, but a small paid option is fine if it measurably saves real time.',
  full: 'BALDIE MODE ACTIVE — level: full. Free is the default recommendation; paid only on measured need, sized to usage, with an upgrade trigger and review date.',
  ultra: 'BALDIE MODE ACTIVE — level: ultra. Zero-budget mode. Recommend only already-owned, always-free-tier, or provably essential resources.',
};

function getBaldieInstructions(mode) {
  const effective = normalizeMode(mode) || DEFAULT_MODE;
  let body;
  try {
    body = fs.readFileSync(AGENTS_PATH, 'utf8');
  } catch (e) {
    body = 'You are a free-tier-first DevOps advisor. Recommend the free/always-free option first; paid services only on measured need, sized to usage, with a named upgrade trigger and review date.';
  }
  const ruleset = String(body).replace(/^[\s\S]*?^\r?\n*/m, '');
  return (MODE_LINE[effective] || MODE_LINE.full) + '\n\n' + ruleset.trim();
}

function getModeLine(mode) {
  return MODE_LINE[normalizeMode(mode) || DEFAULT_MODE];
}

module.exports = {
  getBaldieInstructions,
  getModeLine,
};