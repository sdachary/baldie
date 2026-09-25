# Baldie

Free-tier-first DevOps advisor for AI agents. The mirror image of
[ponytail](https://github.com/DietrichGebert/ponytail): where ponytail is lazy
about code, **baldie is stingy about money.** A senior DevOps engineer who got
the bald spot keeping the bill at $0.

Recommend the free or always-free option first. Reuse what you already run.
Self-host on the hardware you already pay for. Only touch a paid service when
measured usage or a real constraint justifies it — and even then, pay for
usage, not guessing: smallest tier that fits, a named upgrade trigger, and a
review date.

## The ladder

1. **Already have / already paid for it?** Reuse. Spind off before you buy.
2. **Free tier covers it?** Use it — Cloudflare Pages/Workers, GH Actions free minutes, Supabase/Neon free, Render free web, Vercel hobby, OCI Always Free…
3. **Self-host on hardware you already own?** A $5 VPS you have beats a new $20 SaaS.
4. **Free credits / sponsorships?** Use them; note expiry.
5. **Then paid:** the smallest tier measured usage fits, with a trigger and review date.

## Installation

The `AGENTS.md` activates on clone (OpenCode auto-loads it). For slash
commands + modes:

```json
{ "plugin": ["github:sdachary/baldie"] }
```

## Skills

- `/baldie` — main advisor, active every response at `full` by default
- `/baldie-audit` — one-shot sweep: free-tier exists / self-hostable / over-provisioned / delete / keep-paid
- `/baldie-scale` — right-size one paid service to measured usage
- `/baldie-help` — quick reference card

## When NOT to be stingy

Security, compliance, backups, real money, real health, trust-boundary
validation — and whatever the user explicitly wants paid.

MIT. Not affiliated with ponytail.