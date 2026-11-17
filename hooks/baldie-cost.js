const { estimateCurrentCost, TIER_COSTS } = require('./baldie-migrate.js');
const { findAlternatives } = require('./baldie-find.js');

function calculateSavings(currentService, currentTier, usage = {}, options = {}) {
  const { mode = 'full', limit = 5 } = options;
  const current = estimateCurrentCost(currentService, currentTier, usage);
  const alternatives = findAlternatives(currentService, { mode, limit });

  const results = alternatives.results.map(alt => {
    const isSelfHost = alt.category === 'selfhost';
    const isAlwaysFree = alt.free_offer?.includes('no credit card') ||
                         alt.usage_ceiling?.includes('forever') ||
                         alt.usage_ceiling?.includes('always-free');

    let monthlyCost = 0;
    let costNote = '';

    if (isSelfHost) {
      monthlyCost = 0;
      costNote = 'Self-host on existing hardware ($0 marginal)';
    } else if (isAlwaysFree) {
      monthlyCost = 0;
      costNote = 'Always-free tier ($0)';
    } else {
      monthlyCost = 0;
      costNote = `Free tier: ${alt.free_offer}`;
    }

    const monthlySavings = (current.known ? current.estimate : 0) - monthlyCost;
    const annualSavings = monthlySavings * 12;

    return {
      name: alt.name,
      url: alt.url,
      category: alt.category,
      monthly_cost: monthlyCost,
      monthly_savings: monthlySavings,
      annual_savings: annualSavings,
      cost_note: costNote,
      free_offer: alt.free_offer,
      usage_ceiling: alt.usage_ceiling,
      status: alt.status,
      last_verified: alt.last_verified,
      why_it_fits: alt.why_it_fits,
    };
  });

  return {
    current: { service: currentService, tier: currentTier, ...current },
    alternatives: results,
    total_monthly_savings: results.reduce((sum, r) => sum + r.monthly_savings, 0),
    total_annual_savings: results.reduce((sum, r) => sum + r.annual_savings, 0),
    mode,
  };
}

function formatCostReport(report) {
  const lines = [];
  lines.push(`=== Cost Analysis: ${report.current.service} (${report.current.tier}) ===`);
  lines.push('');
  lines.push(`Current cost: ${report.current.note}`);
  lines.push(`Mode: ${report.mode}`);
  lines.push('');
  lines.push(`Top ${report.alternatives.length} free alternatives:`);
  lines.push('');

  for (const alt of report.alternatives) {
    const tag = alt.category === 'selfhost' ? '[SELF-HOST]' : alt.monthly_cost === 0 ? '[FREE]' : '[PAID]';
    const verified = alt.last_verified ? ` (verified ${alt.last_verified})` : '';
    const flagged = alt.status === 'flagged' ? ' ⚠ FLAGGED' : '';
    lines.push(`${tag} ${alt.name}${verified}${flagged}`);
    lines.push(`  Monthly: $${alt.monthly_cost.toFixed(2)} | Savings: $${alt.monthly_savings.toFixed(2)}/mo ($${alt.annual_savings.toFixed(2)}/yr)`);
    lines.push(`  ${alt.cost_note}`);
    lines.push(`  Ceiling: ${alt.usage_ceiling}`);
    lines.push(`  Why: ${alt.why_it_fits}`);
    lines.push(`  ${alt.url}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(`Total potential monthly savings: $${report.total_monthly_savings.toFixed(2)}`);
  lines.push(`Total potential annual savings:  $${report.total_annual_savings.toFixed(2)}`);
  lines.push('');

  if (report.total_monthly_savings > 0) {
    lines.push(`baldie: Migrate to save $${report.total_monthly_savings.toFixed(2)}/mo. Review at usage ceiling.`);
  } else {
    lines.push('baldie: No clear savings — verify usage fits free tier before migrating.');
  }

  return lines.join('\n');
}

function getKnownTiers(service) {
  return TIER_COSTS[service] || {};
}

module.exports = { calculateSavings, formatCostReport, getKnownTiers, TIER_COSTS };

if (require.main === module) {
  const service = process.argv[2] || 'RDS';
  const tier = process.argv[3] || 'db.t3.micro';
  const mode = process.argv[4] || 'full';
  const report = calculateSavings(service, tier, {}, { mode });
  console.log(formatCostReport(report));
}