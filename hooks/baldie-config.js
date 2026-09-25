#!/usr/bin/env node
// baldie — shared configuration resolver.
//
// Resolution order for default mode:
//   1. BALDIE_DEFAULT_MODE environment variable
//   2. Config file defaultMode field:
//      - $XDG_CONFIG_HOME/baldie/config.json (any platform, if set)
//      - ~/.config/baldie/config.json (macOS / Linux fallback)
//      - %APPDATA%\baldie\config.json (Windows fallback)
//   3. 'full'

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_MODE = 'full';
const VALID_MODES = ['off', 'lite', 'full', 'ultra'];
const RUNTIME_MODES = ['lite', 'full', 'ultra'];

function normalizeMode(mode) {
  if (typeof mode !== 'string') return null;
  const normalized = mode.trim().toLowerCase();
  return RUNTIME_MODES.includes(normalized) ? normalized : null;
}

function normalizeConfigMode(mode) {
  if (typeof mode !== 'string') return null;
  const normalized = mode.trim().toLowerCase();
  return VALID_MODES.includes(normalized) ? normalized : null;
}

function normalizePersistedMode(mode) {
  return normalizeMode(mode) || normalizeConfigMode(mode);
}

// "stop baldie" / "normal mode" turn baldie off, but only as a standalone
// command. Matching the phrase anywhere in the message would turn it off
// mid-task for ordinary requests — so require the whole message to be the
// command, ignoring case and trailing punctuation.
function isDeactivationCommand(text) {
  const t = String(text || '').trim().replace(/[.!]+$/, '').toLowerCase();
  return t === 'stop baldie' || t === 'normal mode' || t === 'off';
}

// "off" is a valid persisted mode but not an active runtime level. "/baldie off"
// keeps persistence; bare "off" deactivates like stop baldie.
function isDeactivationCommandLike(text) {
  return isDeactivationCommand(text) || String(text || '').trim().toLowerCase() === 'baldie off';
}

function getConfigDir() {
  if (process.env.BALDIE_CONFIG_DIR) return process.env.BALDIE_CONFIG_DIR;
  if (process.env.XDG_CONFIG_HOME) return path.join(process.env.XDG_CONFIG_HOME, 'baldie');
  if (process.platform === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'baldie');
  }
  return path.join(os.homedir(), '.config', 'baldie');
}

function getClaudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function readConfigFile() {
  try {
    return JSON.parse(fs.readFileSync(path.join(getConfigDir(), 'config.json'), 'utf8'));
  } catch (e) {
    return {};
  }
}

function getDefaultMode() {
  const env = normalizeConfigMode(process.env.BALDIE_DEFAULT_MODE);
  if (env) return env;
  const file = normalizeConfigMode(readConfigFile().defaultMode);
  if (file) return file;
  return DEFAULT_MODE;
}

function writeDefaultMode(mode) {
  const normalized = normalizeConfigMode(mode);
  if (!normalized) return false;
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ defaultMode: normalized }, null, 2));
  return true;
}

module.exports = {
  DEFAULT_MODE,
  VALID_MODES,
  RUNTIME_MODES,
  getClaudeDir,
  getConfigDir,
  getDefaultMode,
  isDeactivationCommand,
  isDeactivationCommandLike,
  normalizeConfigMode,
  normalizeMode,
  normalizePersistedMode,
  writeDefaultMode,
};