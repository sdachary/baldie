const fs = require('fs');
const path = require('path');
const { findAlternatives } = require('./baldie-find.js');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'free-tier.json');

const TIER_COSTS = {
  'RDS': { 'db.t3.micro': 13.50, 'db.t3.small': 27.00, 'db.t3.medium': 54.00 },
  'Aurora': { 'db.t3.medium': 60.00, 'db.r6g.large': 180.00 },
  'DynamoDB': { 'on-demand': 1.25, 'provisioned': 0.65 },
  'ElastiCache': { 'cache.t3.micro': 15.00, 'cache.t3.small': 30.00 },
  'DocumentDB': { 'db.t3.medium': 65.00 },
  'Neptune': { 'db.t3.medium': 90.00 },
  'EC2': { 't3.micro': 7.50, 't3.small': 15.00, 't3.medium': 30.00 },
  'Lambda': { '1M req': 0.20, '400K GB-s': 0.000016 },
  'CloudFront': { '10TB': 85.00 },
  'S3': { '50TB': 1150.00 },
  'Datadog': { 'host': 23.00, 'APM host': 31.00, 'log': 0.10 },
  'NewRelic': { 'full-user': 49.00, 'core-user': 9.00 },
  'Grafana Cloud': { 'metrics': 8.00, 'logs': 0.50 },
  'Heroku': { 'eco': 5.00, 'basic': 7.00, 'standard-1x': 25.00 },
  'Render': { 'starter': 7.00, 'standard': 25.00 },
  'Fly.io': { 'shared-1x': 1.94, 'dedicated-1x': 25.00 },
  'Vercel': { 'pro': 20.00, 'enterprise': 'custom' },
  'Netlify': { 'pro': 19.00, 'business': 99.00 },
  'Auth0': { 'b2c': 23.00, 'b2b': 24.00 },
  'Clerk': { 'pro': 25.00 },
  'SendGrid': { 'pro': 89.95 },
  'Mailgun': { 'flex': 35.00 },
  'Postmark': { '150K': 15.00 },
  'Algolia': { 'build': 1.50, 'grow': 150.00 },
  'Elastic Cloud': { 'small': 95.00 },
  'Meilisearch Cloud': { 'small': 29.00 },
  'Typesense Cloud': { 'small': 29.00 },
  'PostHog': { 'cloud': 0.00 },
  'Mixpanel': { 'growth': 25.00 },
  'Amplitude': { 'growth': 'custom' },
  'Plausible': { 'cloud': 9.00 },
};

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (e) {
    return { services: [] };
  }
}

function estimateCurrentCost(serviceName, tier, usage = {}) {
  const costs = TIER_COSTS[serviceName];
  if (!costs) return { known: false, estimate: 0, note: 'No cost data for this service' };
  const cost = costs[tier];
  if (!cost) return { known: false, estimate: 0, note: `Unknown tier: ${tier}` };
  if (typeof cost === 'number') return { known: true, estimate: cost, note: `${tier} @ $${cost}/mo` };
  return { known: true, estimate: 0, note: cost };
}

function estimateTargetCost(targetService, usage = {}) {
  const registry = loadRegistry();
  const svc = registry.services.find(s => s.name.toLowerCase() === targetService.toLowerCase());
  if (!svc) return { known: false, estimate: 0, note: 'Not in registry' };
  if (svc.category === 'selfhost') return { known: true, estimate: 0, note: 'Self-host on existing hardware ($0 marginal)' };
  if (svc.free_offer?.includes('no credit card') || svc.usage_ceiling?.includes('forever') || svc.usage_ceiling?.includes('always-free')) {
    return { known: true, estimate: 0, note: 'Always-free tier ($0)' };
  }
  return { known: true, estimate: 0, note: `Free tier: ${svc.free_offer}` };
}

function buildMigrationSteps(fromService, toService, mode = 'full') {
  const registry = loadRegistry();
  const target = registry.services.find(s => s.name.toLowerCase() === toService.toLowerCase());
  const isSelfHost = target?.category === 'selfhost';

  const steps = [
    `1. Audit current ${fromService} usage (storage, requests, connections, data volume)`,
    `2. Provision ${toService}${isSelfHost ? ' on existing VPS/VM' : ''}`,
    `3. Migrate data/schema (use native tools: pg_dump, mongodump, redis-cli, etc.)`,
    `4. Validate in staging: run integration tests against ${toService}`,
    `5. Switch DNS / connection strings / env vars (blue-green or canary)`,
    `6. Monitor for 48h: latency, errors, cost, ${isSelfHost ? 'disk/CPU/memory' : 'usage ceiling'}`,
    `7. Decommission ${fromService} (snapshot first, then delete)`,
  ];

  if (mode === 'ultra' && !isSelfHost) {
    steps.splice(1, 0, `   ⚠ ultra mode: prefer self-host; ${toService} is SaaS free-tier`);
  }

  return steps;
}

function identifyRisks(fromService, toService) {
  const risks = [];
  const registry = loadRegistry();
  const target = registry.services.find(s => s.name.toLowerCase() === toService.toLowerCase());

  if (target?.status === 'flagged') {
    risks.push(`⚠ ${toService} free tier may have ended (flagged in registry)`);
  }
  if (target?.category === 'selfhost') {
    risks.push('Self-host = you own backups, updates, security patches, scaling');
    risks.push('Single-VPS failure = downtime (no managed HA)');
  } else {
    const ceiling = target?.usage_ceiling || '';
    if (ceiling.includes('pauses') || ceiling.includes('idle')) {
      risks.push(`Free tier has cold starts / auto-pause: ${ceiling}`);
    }
    if (ceiling.includes('day') || ceiling.includes('month') || ceiling.includes('hrs')) {
      risks.push(`Usage ceiling: ${ceiling} — monitor and set alert at 70%`);
    }
    risks.push('Vendor lock-in: migration away later may cost engineering time');
  }
  risks.push('Data egress fees may apply when moving out of cloud provider');
  risks.push('Schema/driver differences may require code changes');
  return risks;
}

function buildRollbackPlan(fromService, toService) {
  return [
    `Keep ${fromService} running for 7 days after cutover (read-only)`,
    `Automated daily snapshot of ${toService} during transition`,
    `DNS TTL ≤ 60s for fast rollback`,
    `Feature flag to switch connection strings instantly`,
    `Runbook: "If error rate > 5% or p99 latency > 2x baseline, flip flag back"`,
  ];
}

function planMigration(fromService, fromTier, toService, usage = {}, options = {}) {
  const { mode = 'full' } = options;
  const current = estimateCurrentCost(fromService, fromTier, usage);
  const target = estimateTargetCost(toService, usage);
  const steps = buildMigrationSteps(fromService, toService, mode);
  const risks = identifyRisks(fromService, toService);
  const rollback = buildRollbackPlan(fromService, toService);

  const monthlyDelta = (current.known ? current.estimate : 0) - (target.known ? target.estimate : 0);
  const annualDelta = monthlyDelta * 12;

  return {
    from: { service: fromService, tier: fromTier, ...current },
    to: { service: toService, ...target },
    monthly_savings: monthlyDelta,
    annual_savings: annualDelta,
    steps,
    risks,
    rollback,
    mode,
    baldie_note: monthlyDelta > 0
      ? `baldie: saves $${monthlyDelta.toFixed(2)}/mo ($${annualDelta.toFixed(0)}/yr). Review at ${target.ceiling || 'usage ceiling'}.`
      : 'baldie: no clear savings — verify usage fits free tier before migrating.',
  };
}

function formatPlan(plan) {
  const lines = [];
  lines.push(`=== Migration Plan: ${plan.from.service} → ${plan.to.service} ===`);
  lines.push('');
  lines.push(`Current: ${plan.from.service} (${plan.from.tier})`);
  lines.push(`  ${plan.from.note}`);
  lines.push(`Target: ${plan.to.service}`);
  lines.push(`  ${plan.to.note}`);
  lines.push('');
  lines.push(`Monthly savings: $${plan.monthly_savings.toFixed(2)}`);
  lines.push(`Annual savings:  $${plan.annual_savings.toFixed(2)}`);
  lines.push('');
  lines.push('Steps:');
  plan.steps.forEach(s => lines.push(`  ${s}`));
  lines.push('');
  lines.push('Risks:');
  plan.risks.forEach(r => lines.push(`  - ${r}`));
  lines.push('');
  lines.push('Rollback plan:');
  plan.rollback.forEach(r => lines.push(`  - ${r}`));
  lines.push('');
  lines.push(plan.baldie_note);
  return lines.join('\n');
}

module.exports = { planMigration, formatPlan, estimateCurrentCost, estimateTargetCost, TIER_COSTS };

if (require.main === module) {
  const from = process.argv[2] || 'RDS';
  const tier = process.argv[3] || 'db.t3.micro';
  const to = process.argv[4] || 'Neon';
  const mode = process.argv[5] || 'full';
  const plan = planMigration(from, tier, to, {}, { mode });
  console.log(formatPlan(plan));
}