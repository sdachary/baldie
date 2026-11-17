const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'free-tier.json');
const SEEN_PATH = path.join(ROOT, 'data', 'seen.json');

const CATEGORY_ALIASES = {
  'db': 'database',
  'databases': 'database',
  'postgres': 'database',
  'mysql': 'database',
  'redis': 'database',
  'sql': 'database',
  'nosql': 'database',
  'cache': 'database',
  'rds': 'database',
  'aurora': 'database',
  'dynamodb': 'database',
  'cosmosdb': 'database',
  'firestore': 'database',
  'supabase': 'database',
  'neon': 'database',
  'planetscale': 'database',
  'hosting': 'static-hosting',
  'static': 'static-hosting',
  'cdn': 'static-hosting',
  'vercel': 'static-hosting',
  'netlify': 'static-hosting',
  'cloudflare-pages': 'static-hosting',
  'github-pages': 'static-hosting',
  'serverless': 'serverless',
  'functions': 'serverless',
  'faas': 'serverless',
  'lambda': 'serverless',
  'cloudflare-workers': 'serverless',
  'vercel-functions': 'serverless',
  'netlify-functions': 'serverless',
  'ci': 'ci-cd',
  'cicd': 'ci-cd',
  'pipeline': 'ci-cd',
  'deploy': 'ci-cd',
  'github-actions': 'ci-cd',
  'gitlab-ci': 'ci-cd',
  'circleci': 'ci-cd',
  'jenkins': 'ci-cd',
  'storage': 'storage',
  'object-storage': 'storage',
  'blob': 'storage',
  'files': 'storage',
  's3': 'storage',
  'r2': 'storage',
  'gcs': 'storage',
  'azure-blob': 'storage',
  'paas': 'paas',
  'platform': 'paas',
  'heroku': 'paas',
  'render': 'paas',
  'fly': 'paas',
  'flyio': 'paas',
  'railway': 'paas',
  'vm': 'vm',
  'vps': 'vm',
  'compute': 'vm',
  'instance': 'vm',
  'ec2': 'vm',
  'digitalocean': 'vm',
  'linode': 'vm',
  'vultr': 'vm',
  'hetzner': 'vm',
  'oracle-cloud': 'vm',
  'aws': 'vm',
  'gcp': 'vm',
  'azure': 'vm',
  'monitoring': 'observability',
  'metrics': 'observability',
  'logs': 'observability',
  'logging': 'observability',
  'tracing': 'observability',
  'apm': 'observability',
  'uptime': 'observability',
  'alerting': 'observability',
  'datadog': 'observability',
  'newrelic': 'observability',
  'grafana-cloud': 'observability',
  'honeycomb': 'observability',
  'signoz': 'observability',
  'dns': 'dns',
  'domains': 'dns',
  'cloudflare-dns': 'dns',
  'route53': 'dns',
  'email': 'email',
  'transactional-email': 'email',
  'sendgrid': 'email',
  'mailgun': 'email',
  'postmark': 'email',
  'ses': 'email',
  'auth': 'auth',
  'identity': 'auth',
  'user-management': 'auth',
  'auth0': 'auth',
  'clerk': 'auth',
  'firebase-auth': 'auth',
  'supabase-auth': 'auth',
  'queue': 'queue',
  'messaging': 'queue',
  'pubsub': 'queue',
  'stream': 'queue',
  'kafka': 'queue',
  'rabbitmq': 'queue',
  'redis-streams': 'queue',
  'sqs': 'queue',
  'pubsub-lite': 'queue',
  'search': 'search',
  'elasticsearch': 'search',
  'algolia': 'search',
  'meilisearch': 'search',
  'typesense': 'search',
  'analytics': 'analytics',
  'bi': 'analytics',
  'mixpanel': 'analytics',
  'amplitude': 'analytics',
  'posthog': 'analytics',
  'plausible': 'analytics',
  'matomo': 'analytics',
  'cdn': 'cdn',
  'edge': 'cdn',
  'cloudflare': 'cdn',
  'cloudfront': 'cdn',
  'fastly': 'cdn',
  'selfhost': 'selfhost',
  'self-hosted': 'selfhost',
  'oss': 'selfhost',
  'open-source': 'selfhost',
};

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (e) {
    return { services: [] };
  }
}

function loadSeen() {
  try {
    return JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
  } catch (e) {
    return { entries: {} };
  }
}

function normalizeQuery(query) {
  const q = String(query || '').trim().toLowerCase();
  return CATEGORY_ALIASES[q] || q;
}

function matchesCategory(service, query) {
  const cat = String(service.category || '').toLowerCase();
  const name = String(service.name || '').toLowerCase();
  const q = query.toLowerCase();

  if (cat === q) return true;
  if (name === q) return true;
  if (name.includes(q)) return true;
  if (cat.includes(q)) return true;

  const aliases = CATEGORY_ALIASES[q];
  if (aliases && cat === aliases) return true;

  return false;
}

function getUpstreamHits(seen, service) {
  const host = service.url ? new URL(service.url).hostname.replace(/^www\./, '') : '';
  if (!host) return 0;

  let count = 0;
  for (const [, rec] of Object.entries(seen.entries)) {
    try {
      const recHost = new URL(rec.url).hostname.replace(/^www\./, '');
      if (recHost === host || recHost.endsWith('.' + host) || host.endsWith('.' + recHost)) {
        count++;
      }
    } catch (e) {}
  }
  return count;
}

function rankService(service, seen, mode) {
  const isSelfHost = service.category === 'selfhost';
  const isAlwaysFree = service.usage_ceiling?.includes('forever') ||
                       service.usage_ceiling?.includes('always-free') ||
                       service.free_offer?.includes('no credit card');
  const isFreeTierSaaS = !isSelfHost && !isAlwaysFree;
  const upstreamHits = getUpstreamHits(seen, service);
  const verified = service.status === 'live' && service.last_verified;
  const flagged = service.status === 'flagged';

  let score = 0;

  if (mode === 'ultra') {
    if (isSelfHost) score += 1000;
    else if (isAlwaysFree) score += 500;
    else score -= 1000;
  } else if (mode === 'lite') {
    if (isSelfHost) score += 500;
    else if (isAlwaysFree) score += 400;
    else if (isFreeTierSaaS) score += 300;
  } else {
    if (isSelfHost) score += 400;
    else if (isAlwaysFree) score += 350;
    else if (isFreeTierSaaS) score += 300;
  }

  if (verified) score += 100;
  if (flagged) score -= 200;
  score += Math.min(upstreamHits * 10, 100);

  return { score, upstreamHits, verified, flagged, isSelfHost, isAlwaysFree, isFreeTierSaaS };
}

function findAlternatives(query, options = {}) {
  const { mode = 'full', limit = 10 } = options;
  const normalized = normalizeQuery(query);

  const registry = loadRegistry();
  const seen = loadSeen();

  const results = registry.services
    .filter(svc => matchesCategory(svc, normalized))
    .map(svc => {
      const ranking = rankService(svc, seen, mode);
      return { ...svc, ...ranking };
    })
    .filter(r => mode !== 'ultra' || r.isSelfHost || r.isAlwaysFree)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    query: normalized,
    mode,
    count: results.length,
    results: results.map(r => ({
      name: r.name,
      url: r.url,
      category: r.category,
      free_offer: r.free_offer,
      usage_ceiling: r.usage_ceiling,
      status: r.status,
      last_verified: r.last_verified || null,
      upstream_hits: r.upstreamHits,
      why_it_fits: buildWhy(r, mode),
    })),
  };
}

function buildWhy(r, mode) {
  const parts = [];
  if (r.isSelfHost) parts.push('self-host on hardware you own');
  else if (r.isAlwaysFree) parts.push('always-free tier (no expiry)');
  else if (r.isFreeTierSaaS) parts.push('free tier with usage limits');
  if (r.verified) parts.push('verified live upstream');
  if (r.flagged) parts.push('⚠ free tier may have ended');
  if (r.upstreamHits > 0) parts.push(`${r.upstreamHits} upstream references`);
  return parts.join('; ');
}

function formatForAgent(result) {
  if (!result.results.length) {
    return `No free alternatives found for "${result.query}". Check provider pricing page or broaden search (e.g. "database" instead of "RDS").`;
  }

  const lines = [`Found ${result.count} free alternative(s) for "${result.query}" (mode: ${result.mode}):`, ''];
  for (const r of result.results) {
    const tag = r.isSelfHost ? '[SELF-HOST]' : r.isAlwaysFree ? '[ALWAYS-FREE]' : '[FREE-TIER]';
    const verified = r.last_verified ? ` (verified ${r.last_verified})` : '';
    const flagged = r.status === 'flagged' ? ' ⚠ FLAGGED' : '';
    lines.push(`${tag} ${r.name}${verified}${flagged}`);
    lines.push(`  ${r.free_offer}`);
    lines.push(`  Ceiling: ${r.usage_ceiling}`);
    lines.push(`  Why: ${r.why_it_fits}`);
    lines.push(`  ${r.url}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

module.exports = { findAlternatives, formatForAgent, normalizeQuery, CATEGORY_ALIASES };

if (require.main === module) {
  const query = process.argv[2] || 'database';
  const mode = process.argv[3] || 'full';
  const result = findAlternatives(query, { mode });
  console.log(formatForAgent(result));
}