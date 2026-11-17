---
name: baldie-find
description: >
  Search the baldie free-tier registry for alternatives to a paid service.
  Returns free-tier SaaS, self-hostable OSS, or already-owned options by category or service name.
  Use when user asks "free alternative to X", "what can replace Y for free",
  "self-hosted Z", or "/baldie-find <category|service>".
argument-hint: "[category|service-name]"
license: MIT
---

# Baldie Find

You search the baldie free-tier registry for free alternatives to paid services.
The registry combines a curated list (~12 services with verified free tiers) with
a weekly-refreshed observation log of 2400+ entries from free-for-dev and
awesome-selfhosted upstream.

## Source of truth

- `hooks/baldie-find.js` — stdlib search + ranking logic (read this first)
- `data/free-tier.json` — curated registry: name, url, category, free_offer, usage_ceiling, status, last_verified
- `data/seen.json` — observation log: every upstream entry with first_seen, last_seen, missing_streak, source

## How to search

Call the find function (or run `node hooks/baldie-find.js <query> [mode]`):

```js
const { findAlternatives, formatForAgent } = require('./hooks/baldie-find');
const result = findAlternatives('database', { mode: 'full', limit: 10 });
console.log(formatForAgent(result));
```

**Parameters:**
- `query` — category (database, static-hosting, serverless, ci-cd, storage, paas, vm, observability, dns, email, auth, queue, search, analytics, selfhost) or service name (RDS, Vercel, Datadog, etc.)
- `mode` — `lite` | `full` (default) | `ultra` — affects ranking
- `limit` — max results (default 10)

## Ranking (mode-aware)

| Mode | Priority order |
|------|----------------|
| `ultra` | self-host on owned hardware → always-free SaaS → (exclude free-tier SaaS) |
| `full` | self-host → always-free → free-tier SaaS |
| `lite` | self-host → always-free → free-tier SaaS (slightly lower bar for SaaS) |

Bonus points: verified live upstream (`last_verified` set), upstream reference count.
Penalty: `status: flagged` (free tier likely ended).

## Output format for agents

Each result includes:
- `name`, `url`, `category`
- `free_offer` — human-readable free tier description
- `usage_ceiling` — the limit that triggers paid
- `status` — `live` | `flagged`
- `last_verified` — date or null
- `upstream_hits` — how many upstream entries reference this host
- `why_it_fits` — one-line rationale for the current mode

## Example queries

| User asks | You search |
|-----------|------------|
| "free alternative to RDS" | `findAlternatives('RDS')` or `findAlternatives('database')` |
| "what can replace Datadog for free" | `findAlternatives('observability')` |
| "self-hosted CI/CD" | `findAlternatives('ci-cd')` or `findAlternatives('selfhost')` |
| "free static hosting" | `findAlternatives('static-hosting')` |
| "cheap queue service" | `findAlternatives('queue')` |

## Rules

- Never quote a free tier you cannot point at — use `last_verified` or say "verify at provider pricing page".
- If `status: flagged`, say so and do not recommend as current.
- If no results, suggest broadening to category (e.g. "database" not "RDS").
- Respect mode: `ultra` excludes free-tier SaaS; `lite` is more permissive.
- Mark deliberate corner-cuts with `baldie:` comment naming ceiling and upgrade trigger.

## When NOT to use

- Pure coding tasks with no infra dimension.
- When user explicitly wants paid (respect the request, no re-arguing).
- Security/compliance/real-money paths where free is not appropriate.