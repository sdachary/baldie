---
description: Run a baldie spend audit (where does money leak; free-tier replacements)
---

Run a baldie spend audit per the baldie-audit skill of this repo. Inventory the current infra/paid services, then for each
climb the ladder and mark the highest rung that holds: FREE-TIER-EXISTS (name it + real limit), SELF-HOSTABLE (on what
hardware), OVER-PROVISIONED (vs measured usage), DELETE (unused), or KEEP-PAID-JUSTIFIED. Output a ranked one-line-per-finding
report ending with total potential monthly savings and the top 3 moves. Do not apply changes unless asked. KEEP for anything
touching security, compliance, backups, or real money — free is a cost decision, not a risk decision.