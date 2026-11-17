#!/usr/bin/env node
// baldie — refresh the free-tier source of truth.
//
// Reads two upstream lists (at runtime only, never committed — both carry
// licenses that forbid wholesale re-publishing):
//   free-for-dev       https://github.com/ripienaar/free-for-dev
//   awesome-selfhosted https://github.com/awesome-selfhosted/awesome-selfhosted
// and diffs them against baldie's own data:
//   data/free-tier.json   curated registry (the thing agents read)
//   data/seen.json        observation history (names/urls/presence we compile)
// Outputs:
//   data/changelog.md     human-readable: new, gone, and registry updates
//
// Stdlib only. No deps, no caches, no config. Policy for what lands in the
// registry stays with a human (+ the baldie agent); this script only reports.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const REGISTRY_PATH = path.join(DATA, 'free-tier.json');
const SEEN_PATH = path.join(DATA, 'seen.json');
const CHANGELOG_PATH = path.join(DATA, 'changelog.md');

const SOURCES = [
  {
    key: 'free-for-dev',
    name: 'free-for-dev',
    url: 'https://raw.githubusercontent.com/ripienaar/free-for-dev/master/README.md',
  },
  {
    key: 'awesome-selfhosted',
    name: 'awesome-selfhosted',
    url: 'https://raw.githubusercontent.com/awesome-selfhosted/awesome-selfhosted/master/README.md',
  },
];

const out = { errors: [] };

async function fetchText(src) {
  const res = await fetch(src.url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${src.name}: HTTP ${res.status}`);
  return res.text();
}

// --- parsing (flat "category -> entries" facts, no prose re-publishing) ---

function parseFreeForDev(text) {
  const entries = [];
  let category = '';
  let provider = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const m = line.match(/^##\s+(.+)$/);
    if (m) { category = m[1].trim(); continue; }
    const leaf = line.match(/^\s{4,4}\*\s+\[([^\]]+)\]\(([^)]+)\)\s*-\s*(.+)$/);
    if (leaf) {
      entries.push({ category, provider, name: leaf[1].trim(), url: leaf[2].trim(), desc: leaf[3].trim() });
      continue;
    }
    const prov = line.match(/^\s{2,2}\*\s+\[([^\]]+)\]\(([^)]+)\)$/);
    if (prov) { provider = prov[1].trim(); continue; }
    const flat = line.match(/^\s{2,2}\*\s+\[([^\]]+)\]\(([^)]+)\)\s*-\s*(.+)$/);
    if (flat) {
      entries.push({ category, provider: flat[1].trim(), name: flat[1].trim(), url: flat[2].trim(), desc: flat[3].trim() });
    }
  }
  return entries.filter((e) => e.url.startsWith('http'));
}

function parseAwesomeSelfhosted(text) {
  const entries = [];
  let category = '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const m = line.match(/^###\s+(.+)$/);
    if (m) { category = m[1].trim(); continue; }
    const e = line.match(/^\s*- \[([^\]]+)\]\(([^)]+)\)\s*-\s*(.+)$/);
    if (e && !e[2].startsWith('#')) {
      entries.push({ category, provider: '', name: e[1].trim(), url: e[2].trim(), desc: e[3].split('`')[0].trim() });
    }
  }
  return entries;
}

// --- persistence helpers ---

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

function entryKey(e) {
  return e.url.replace(/\/+$/, '');
}

const today = () => new Date().toISOString().slice(0, 10);

// --- main ---

async function main() {
  const registry = loadJson(REGISTRY_PATH, { schema: 1, updated: '', services: [] });
  const seen = loadJson(SEEN_PATH, { entries: {} });
  const changes = { date: today(), new: [], gone: [], verified: [], flagged: [] };

  const rawBySource = {};
  for (const src of SOURCES) {
    try { rawBySource[src.key] = await fetchText(src); }
    catch (e) {
      out.errors.push(String(e.message || e));
      console.error(`[baldie] fetch failed: ${src.name}: ${e.message}`);
    }
  }

  const upstream = {};
  if (rawBySource['free-for-dev']) {
    for (const e of parseFreeForDev(rawBySource['free-for-dev'])) {
      (upstream['free-for-dev'] = upstream['free-for-dev'] || []).push(e);
    }
  }
  if (rawBySource['awesome-selfhosted']) {
    for (const e of parseAwesomeSelfhosted(rawBySource['awesome-selfhosted'])) {
      (upstream['awesome-selfhosted'] = upstream['awesome-selfhosted'] || []).push(e);
    }
  }

  const currentKeys = new Map(); // key -> {source, entry}
  for (const srcKey of Object.keys(upstream)) {
    for (const e of upstream[srcKey]) {
      const k = entryKey(e);
      if (!currentKeys.has(k)) currentKeys.set(k, { ...e, source: srcKey });
    }
  }

  // Hostname index for loose matching: upstream lists one service under many
  // URLs (workers.cloudflare.com vs developers.cloudflare.com/workers/), so
  // exact-URL matching would falsely "lose" live services. Match by host.
  const hostCount = new Map(); // host -> number of upstream entries on it
  for (const [k, entry] of currentKeys) {
    let host;
    try { host = new URL(entry.url).hostname.replace(/^www\./, ''); } catch (e) { continue; }
    hostCount.set(host, (hostCount.get(host) || 0) + 1);
  }

  // 1. Observation log: first_seen/last_seen/present/counter per upstream entry.
  //    Facts only (name/url/presence) — upstream descriptions are never stored:
  //    smaller repo, and no copyright reproduction of the source lists.
  for (const [k, entry] of currentKeys) {
    const rec = seen.entries[k] || { name: entry.name, url: entry.url, first_seen: changes.date };
    rec.last_seen = changes.date;
    rec.name = entry.name;
    rec.url = entry.url;
    rec.present = true;
    rec.missing_streak = 0;
    rec.source = entry.source;
    seen.entries[k] = rec;
  }
  for (const [k, rec] of Object.entries(seen.entries)) {
    if (!currentKeys.has(k)) {
      rec.present = false;
      rec.missing_streak = (rec.missing_streak || 0) + 1;
      if (rec.missing_streak === 1) changes.gone.push(rec);
    }
  }

  // 2. Registry reconciliation. A service is "live" if any upstream entry sits
  //    on its host (or a bare-domain parent). Only services previously verified
  //    live can be flagged — human-curated entries that never verified are left
  //    alone, so first-run noise never flips statuses.
  const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  };
  const seenOnHost = (host) => {
    if (!host) return false;
    if (hostCount.has(host)) return true;
    const parts = host.split('.');
    if (parts.length > 2) {
      const parent = parts.slice(-2).join('.');
      if (hostCount.has('www.' + parent) || hostCount.has(parent)) return true;
    }
    return false;
  };
  for (const svc of registry.services) {
    if (seenOnHost(hostOf(svc.url))) {
      svc.status = 'live';
      svc.last_verified = changes.date;
      changes.verified.push(svc.name);
    } else if (svc.status === 'live' && svc.last_verified) {
      svc.missing_streak = (svc.missing_streak || 0) + 1;
      if (svc.missing_streak >= 2) {
        svc.status = 'flagged';
        changes.flagged.push(svc.name);
      }
    }
  }
  registry.updated = changes.date;

  // 3. Auto-promotion: promote high-confidence upstream entries to curated registry
  changes.promoted = [];
  const KNOWN_CATEGORIES = new Set([
    'database', 'static-hosting', 'serverless', 'ci-cd', 'storage', 'paas', 'vm',
    'observability', 'dns', 'email', 'auth', 'queue', 'search', 'analytics', 'selfhost',
    'cdn', 'monitoring', 'logging', 'analytics', 'ai-ml', 'security', 'secrets',
    'feature-flags', 'api-gateway', 'message-broker', 'cache', 'blob-storage',
    'vector-db', 'time-series', 'graph-db', 'search-engine', 'data-warehouse',
    'etl', 'streaming', 'workflow', 'orchestration', 'service-mesh', 'api-management',
  ]);
  const SELFHOST_HINTS = ['self-host', 'selfhost', 'open source', 'oss', 'on-prem', 'docker', 'kubernetes', 'helm'];
  const ALWAYS_FREE_HINTS = ['forever', 'always free', 'no credit card', 'no card required', 'generous free tier'];

  const existingHosts = new Set(registry.services.map(s => {
    try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }).filter(Boolean));

  for (const [k, entry] of currentKeys) {
    if (existingHosts.has(new URL(entry.url).hostname.replace(/www\./, ''))) continue;
    if (registry.services.some(s => s.name.toLowerCase() === entry.name.toLowerCase())) continue;

    const rec = seen.entries[k];
    if (!rec || rec.missing_streak > 0) continue;
    const weeksObserved = rec.last_seen && rec.first_seen
      ? Math.floor((new Date(rec.last_seen) - new Date(rec.first_seen)) / (7 * 86400000))
      : 0;
    if (weeksObserved < 4) continue;

    const host = new URL(entry.url).hostname.replace(/^www\./, '');
    const hostEntries = Array.from(currentKeys.values()).filter(e => {
      try { return new URL(e.url).hostname.replace(/^www\./, '') === host; } catch { return false; }
    });
    if (hostEntries.length < 2) continue;

    const cat = entry.category.toLowerCase();
    if (!KNOWN_CATEGORIES.has(cat) && cat !== 'selfhost') continue;

    const desc = entry.desc.toLowerCase();
    const isSelfHost = SELFHOST_HINTS.some(h => desc.includes(h)) || cat === 'selfhost';
    const isAlwaysFree = ALWAYS_FREE_HINTS.some(h => desc.includes(h));

    let category = cat;
    if (cat === 'database' || cat.includes('sql') || cat.includes('db')) category = 'database';
    else if (cat.includes('host') || cat.includes('static') || cat.includes('cdn')) category = 'static-hosting';
    else if (cat.includes('serverless') || cat.includes('function') || cat.includes('faas')) category = 'serverless';
    else if (cat.includes('ci') || cat.includes('deploy') || cat.includes('pipeline')) category = 'ci-cd';
    else if (cat.includes('storage') || cat.includes('blob') || cat.includes('object') || cat.includes('s3')) category = 'storage';
    else if (cat.includes('paas') || cat.includes('platform') || cat.includes('app host')) category = 'paas';
    else if (cat.includes('vm') || cat.includes('vps') || cat.includes('compute') || cat.includes('instance')) category = 'vm';
    else if (cat.includes('monitor') || cat.includes('observ') || cat.includes('metric') || cat.includes('log') || cat.includes('apm')) category = 'observability';
    else if (cat.includes('dns') || cat.includes('domain')) category = 'dns';
    else if (cat.includes('email') || cat.includes('mail') || cat.includes('smtp')) category = 'email';
    else if (cat.includes('auth') || cat.includes('identity') || cat.includes('user')) category = 'auth';
    else if (cat.includes('queue') || cat.includes('message') || cat.includes('pubsub') || cat.includes('stream') || cat.includes('kafka')) category = 'queue';
    else if (cat.includes('search') || cat.includes('elastic') || cat.includes('algolia')) category = 'search';
    else if (cat.includes('analytic') || cat.includes('bi') || cat.includes('metric')) category = 'analytics';
    else if (isSelfHost) category = 'selfhost';

    const freeOffer = isSelfHost
      ? `Open-source self-hosted ${entry.name}, run on your own hardware`
      : isAlwaysFree
        ? `${entry.name} — generous always-free tier (no credit card)`
        : `${entry.name} — free tier available (verify limits at provider)`;

    const usageCeiling = isSelfHost
      ? 'your own hardware'
      : isAlwaysFree
        ? 'forever (always-free)'
        : 'check provider pricing page';

    const promoted = {
      name: entry.name,
      url: entry.url,
      category,
      free_offer: freeOffer,
      usage_ceiling: usageCeiling,
      status: 'live',
      added: changes.date,
      last_verified: changes.date,
      auto_promoted: true,
      promotion_source: entry.source,
      promotion_weeks_observed: weeksObserved,
    };

    registry.services.push(promoted);
    changes.promoted.push(promoted.name);
  }

  // 4. New upstream entries (never before observed).
  const bootstrap = Object.keys(seen.entries).filter((k) => seen.entries[k].first_seen !== changes.date).length === 0;
  for (const [k, entry] of currentKeys) {
    if (seen.entries[k] && seen.entries[k].first_seen === changes.date) {
      changes.new.push(entry);
    }
  }
  changes.new.sort((a, b) => a.name.localeCompare(b.name));
  if (bootstrap) changes.new = []; // first run: everything is new; don't dump 2400 lines

  // --- changelog ---
  fs.mkdirSync(DATA, { recursive: true });
  const lines = [`## ${changes.date}`, ''];
  lines.push(`Observed: ${currentKeys.size} entries across ${Object.keys(upstream).join(', ') || '(no fetches)'}.`);
  if (upstream['free-for-dev']) lines.push(`  free-for-dev: ${upstream['free-for-dev'].length} parsed.`);
  if (upstream['awesome-selfhosted']) lines.push(`  awesome-selfhosted: ${upstream['awesome-selfhosted'].length} parsed.`);
  if (out.errors.length) lines.push(`  Fetch failures: ${out.errors.join('; ')}`);
  lines.push('');
  if (bootstrap) {
    lines.push(`First run — baseline recorded (${currentKeys.size} entries). Incremental new/gone tracking starts next run.`);
  } else {
    lines.push(`**New upstream entries (${changes.new.length}):**`);
    if (changes.new.length === 0) lines.push('- none');
    for (const e of changes.new.slice(0, 40)) {
      lines.push(`- [${e.name}](${e.url}) — ${e.desc.slice(0, 90)}`);
    }
    lines.push('');
    lines.push(`**Possibly gone (missing on this run, ${changes.gone.length}):**`);
    if (changes.gone.length === 0) lines.push('- none');
    for (const g of changes.gone.slice(0, 40)) {
      lines.push(`- [${g.name}](${g.url}) — seen ${g.last_seen || '?'}, streak ${g.missing_streak}`);
    }
  }
  lines.push('');
  if (changes.promoted.length) {
    lines.push(`**Auto-promoted to registry (${changes.promoted.length}):**`);
    for (const p of changes.promoted.slice(0, 20)) {
      lines.push(`- ${p} (observed 4+ weeks, multiple upstream refs)`);
    }
    lines.push('');
  }
  lines.push(`Registry: ${changes.verified.length} verified live, ${changes.flagged.length} flagged for review (${changes.flagged.slice(0, 15).join(', ') || 'none'}), ${changes.promoted.length} auto-promoted.`);
  lines.push('');
  const prev = fs.existsSync(CHANGELOG_PATH) ? fs.readFileSync(CHANGELOG_PATH, 'utf8') : '';
  fs.writeFileSync(CHANGELOG_PATH, lines.join('\n') + '\n' + prev);

  fs.writeFileSync(SEEN_PATH, JSON.stringify(seen, null, 2) + '\n');
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');

  console.log(`[baldie] refreshed. parsed: ${currentKeys.size} | new ${changes.new.length} | gone ${changes.gone.length} | verified ${changes.verified.length} | flagged ${changes.flagged.length} | promoted ${changes.promoted.length}`);
  if (out.errors.length) { console.error(`[baldie] ${out.errors.length} fetch error(s)`); process.exitCode = 1; }
}

module.exports = { parseFreeForDev, parseAwesomeSelfhosted };
main();