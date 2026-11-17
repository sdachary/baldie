---
name: baldie-migrate
description: >
  Plan a migration from a paid service to a free/self-hosted alternative.
  Returns steps, cost delta, risks, and rollback plan. Use when user asks
  "migrate from X to Y", "how do I move off RDS", "migration plan for X",
  or "/baldie-migrate <from> <to> [tier]".
argument-hint: "<from-service> <to-service> [tier]"
license: MIT
---

# Baldie Migrate

You plan migrations from paid services to free/self-hosted alternatives.
Outputs a concrete plan: steps, cost delta, risks, rollback.

## Source of truth

- `hooks/baldie-migrate.js` — stdlib migration planner (read this first)
- `hooks/baldie-find.js` — validates target exists in registry
- `data/free-tier.json` — target service details (free tier, ceiling, status)
- `TIER_COSTS` in baldie-migrate.js — known paid tier pricing (extend as needed)

## How to plan

```js
const { planMigration, formatPlan } = require('./hooks/baldie-migrate');
const plan = planMigration('RDS', 'db.t3.micro', 'Neon', {}, { mode: 'full' });
console.log(formatPlan(plan));
```

**Parameters:**
- `fromService` — paid service name (RDS, Datadog, Heroku, etc.)
- `fromTier` — current paid tier (db.t3.micro, pro, standard-1x, etc.)
- `toService` — target free/self-hosted service (must be in registry)
- `usage` — optional measured usage object for ceiling checks
- `options.mode` — `lite` | `full` | `ultra` (affects risk weighting)

## Output

```js
{
  from: { service, tier, known, estimate, note },
  to: { service, known, estimate, note },
  monthly_savings: number,
  annual_savings: number,
  steps: string[],
  risks: string[],
  rollback: string[],
  mode: string,
  baldie_note: string
}
```

## Rules

- Only recommend migration if target is in registry and `status: live`.
- If target `status: flagged`, include ⚠ in risks and note.
- Self-host target = $0 marginal but add operational risks.
- Always include rollback plan (DNS TTL, feature flag, snapshot schedule).
- Mark `baldie_note` with ceiling and review trigger.
- If no savings, say so — don't migrate for migration's sake.

## Example queries

| User asks | You call |
|-----------|----------|
| "migrate from RDS to Neon" | `planMigration('RDS', 'db.t3.micro', 'Neon')` |
| "how to move off Datadog" | `planMigration('Datadog', 'pro', 'Grafana')` |
| "migration plan Heroku → Fly.io" | `planMigration('Heroku', 'standard-1x', 'Fly.io')` |
| "move from Vercel to Cloudflare Pages" | `planMigration('Vercel', 'pro', 'Cloudflare Pages')` |

## When NOT to use

- Pure coding tasks.
- Security/compliance/real-money paths where migration adds risk.
- When user explicitly wants to stay on paid (respect request).
- Target not in registry — say "verify at provider pricing page first".