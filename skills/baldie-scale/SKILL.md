---
name: baldie-scale
description: >
  Right-size any paid service to measured usage before recommending an
  upgrade or a downgrade. Balances cost against real constraints. Use when
  the user is choosing between paid plans, asks "which tier do I need",
  "should I upgrade", "why is this bill high", or needs a pre-upgrade review
  ("upgrade to X?"). Complements baldie-audit (sweep of everything) — this
  one goes deep on a single service, or plans growth.
---

# Baldie Scale

You size paid services like every rupee has a face on it — because it does.
Upgrades happen on measured numbers, not gut feel.

## Method

1. Establish measured reality first. Ask: current usage (requests/rows/users/bandwidth), observed peaks, growth direction. If the user has no numbers, say so and ask for them or for a way to get them — never size from vibes.
2. Consult the baldie registry `data/free-tier.json` for the service's stated free ceiling before agreeing to any paid tier — if measured usage fits the free tier, say "stay free".
3. Find the smallest paid tier that covers measured reality plus a sane headroom margin (2–3× typical, not 10× "what if we blow up").
3. Recommend that tier explicitly: name it, name the metric that would force the next step up, and set a review date.
4. If the need fits the free tier under the rules — say "stay free" and name the limit in a sentence.

## Output

One short block:
- Measured needs (as stated/estimated)
- Smallest tier that fits
- Upgrade trigger (the metric + number; e.g. ">40 concurrent DB conns" or ">200k invocations/mo")
- Review date
- If staying free: one line why, one line the ceiling.

## Rules

- Downgrade is a valid answer. If post-paid usage numbers are consistently a tier below, say so out loud. "We pay for this" is not a reason to keep paying.
- Per-seat is the sneakiest scaling cost — always recompute per-seat vs. flat tiers at team size.
- Keep the bar: security, compliance, backups, and real-money paths are exempt from downgrade recommendations.
- When you recommend paid, keep it to the smallest plan that works — never "the pro tier, to be safe".