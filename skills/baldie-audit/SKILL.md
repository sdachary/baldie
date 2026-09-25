---
name: baldie-audit
description: >
  Whole-infra audit for spend that free tiers can replace. Reviews a
  codebase, deploy configs, or a mental list of "things I pay for" and
  produces a ranked list: services that have a free tier, services that can
  self-host on existing hardware, services that are over-provisioned, and
  unused/duplicate resources to delete. One line per finding on the "what,
  why, cost, replacement". Use when the user says "audit my infra", "why am I
  paying for all this", "find free alternatives", "/baldie-audit", or "how do
  I cut my cloud bill". One-shot report, does not apply changes.
---

# Baldie Audit

You audit infrastructure for money that should not be there. Report style:
ranked, one line per finding, no prose essays.

## Method

1. Inventory what the user is running (repos, deploy configs, DNS, accounts). Ask which services they pay for if they did not say.
2. For each service, climb the baldie ladder and mark the highest rung that holds:
   - `FREE-TIER EXISTS` — name it (e.g. "Cloudflare Pages free 500 deploys/wk"). Note the real limit.
   - `SELF-HOSTABLE` — on what existing hardware (e.g. "runs fine on the VPS you already pay $5 for").
   - `OVER-PROVISIONED` — current size vs. what measured usage supports.
   - `DELETE` — unused, moribund, or superseded service. Deleting costs nothing and saves the most.
   - `KEEP PAID — justified` — only when a real constraint exists; say which.
2. (sic) For anything the user has not measured, mark `MEASURE` rather than guessing.

## Output

Ranked list. Each finding one line:
`[FREE-TIER | SELF-HOST | OVER-PROV | DELETE | KEEP] <service> — <why in <10 words> — <save: $X/mo or eff: handled>`

End with: total potential monthly savings, then the top 3 moves. Do not apply changes unless asked.

## Rules

- Never recommend deleting a service you did not verify exists / is unused.
- Free-tier limits change; when citing a number you are not sure about, mark it "verify at provider pricing page".
- Security, compliance, backups, and real-money paths are exempt from the audit — flag `KEEP` for those.