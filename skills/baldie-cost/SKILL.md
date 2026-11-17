---
name: baldie-cost
description: >
  Quantify the cost difference between a paid service and its free alternatives.
  Returns monthly/annual savings per alternative. Use when user asks
  "how much would I save moving from X to Y", "cost of RDS vs Neon",
  "show me the money", or "/baldie-cost <service> <tier>".
argument-hint: "<service> <tier> [mode]"
license: MIT
---

# Baldie Cost

You calculate the dollar savings of migrating from a paid service to free alternatives.
Uses known tier pricing + baldie-find to produce a ranked savings report.

## Source of truth

- `hooks/baldie-cost.js` — stdlib cost calculator (read this first)
- `hooks/baldie-migrate.js` — `TIER_COSTS` map (extend as needed)
- `hooks/baldie-find.js` — discovers free alternatives
- `data/free-tier.json` — target service free tier details

## How to calculate

```js
const { calculateSavings, formatCostReport } = require('./hooks/baldie-cost');
const report = calculateSavings('RDS', 'db.t3.micro', {}, { mode: 'full', limit: 5 });
console.log(formatCostReport(report));
```

**Parameters:**
- `service` — paid service name (RDS, Datadog, Heroku, Vercel, etc.)
- `tier` — current paid tier (db.t3.micro, pro, standard-1x, etc.)
- `usage` — optional measured usage for ceiling validation
- `options.mode` — `lite` | `full` | `ultra` (affects alternative ranking)
- `options.limit` — max alternatives to evaluate (default 5)

## Output

```js
{
  current: { service, tier, known, estimate, note },
  alternatives: [
    { name, url, category, monthly_cost, monthly_savings, annual_savings, cost_note, free_offer, usage_ceiling, status, last_verified, why_it_fits }
  ],
  total_monthly_savings: number,
  total_annual_savings: number,
  mode: string
}
```

## Rules

- Only calculate for services in `TIER_COSTS` — if unknown, say "add tier to TIER_COSTS".
- Free alternatives from `baldie-find` — respects mode (ultra excludes free-tier SaaS).
- Self-host = $0 marginal cost (assumes existing hardware).
- Always-free SaaS = $0.
- Free-tier SaaS = $0 but note usage ceiling.
- If `status: flagged`, include ⚠ and note free tier may have ended.
- Sum savings across all viable alternatives (not just top 1).
- Mark `baldie_note` with ceiling and review trigger.

## Example queries

| User asks | You call |
|-----------|----------|
| "how much saving RDS → Neon" | `calculateSavings('RDS', 'db.t3.micro')` |
| "cost of Datadog pro vs Grafana" | `calculateSavings('Datadog', 'pro')` |
| "show me the money for Heroku" | `calculateSavings('Heroku', 'standard-1x')` |
| "Vercel pro vs Cloudflare Pages" | `calculateSavings('Vercel', 'pro')` |

## When NOT to use

- Pure coding tasks.
- Service not in TIER_COSTS — say "unknown tier, add to hooks/baldie-migrate.js TIER_COSTS".
- Security/compliance paths where cost is not the primary factor.
- When user explicitly wants paid — respect request.