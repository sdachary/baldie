# Baldie

**Free-tier-first DevOps advisor for AI agents.**

Baldie is the stingy mirror of [ponytail](https://github.com/DietrichGebert/ponytail):
where ponytail is lazy about code, **baldie is stingy about money.** It makes an
AI agent think free-first before it reaches for your wallet — recommend the free or
always-free option, reuse what you already run, self-host what you own, and only
touch a paid service when measured usage or a real constraint earns it.

Think of it as a senior DevOps engineer who got the bald spot keeping the bill at $0.

## What baldie does

When activated, baldie nudges your agent to follow **the ladder** before any
infra decision:

1. **Already have it / already paying for it?** Reuse. A VM you own costs nothing extra to host another service on.
2. **Free tier covers it?** Start there — Cloudflare Pages/Workers, GH Actions free minutes, Supabase/Neon free, Render free web, Vercel hobby, OCI Always Free…
3. **Self-host on hardware you already pay for?** A $5 VPS you have beats a new $20 SaaS.
4. **Free credits / sponsorships?** Use them, note the expiry.
5. **Only then — paid, sized to measured numbers.** The smallest tier that fits, a named upgrade trigger, and a review date.

Plus the guardrails that make it trustworthy:

- **Paid needs a written reason** — a measured constraint (usage, latency, compliance, SLA), not a preference.
- **"What if it grows?" is not a reason to pay now.** Size for today; review when a metric crosses a threshold.
- **Hidden costs are real costs** — cold starts, egress, connection limits, per-seat, lock-in.
- **Your time counts** — a "free" option needing daily babysitting is paid in disguise.
- **Delete before you migrate.** Removing unused infra costs nothing and saves the most.
- **Never stingy about safety**: security, compliance, backups, real money, real health, trust-boundary validation.
- Marks deliberate corner-cuts with a `baldie:` comment naming the ceiling and upgrade trigger.

## Install for your agent

Baldie works with every major agent. Pick your row.

| Agent | How it loads | Setup |
|---|---|---|
| **Claude Code** (+ Codex) | Session/subagent/prompt hooks | `claude plugin marketplace add sdachary/baldie` (see below) |
| **OpenCode** | Plugin | `"plugin": ["github:sdachary/baldie"]` in `opencode.json` |
| **Gemini CLI** | Extension | `gemini extensions install github.com/sdachary/baldie` |
| **pi** | Extension | [pi docs](https://github.com/darwin-ai/pi) — point it at `pi-extension/` |
| **Copilot CLI** | Hooks | copy `hooks/copilot-hooks.json` |
| **Qoder** | Hooks / rules | see `hooks/qoder-hooks.json` |
| **Cursor · Windsurf · Cline · Copilot Chat · Devin · Codex deskop** | Reads `AGENTS.md` | nothing — clone or copy `AGENTS.md` into your project |

### Claude Code

```
claude plugin marketplace add sdachary/baldie
claude plugin install baldie
```

The hooks inject the full baldie ruleset at session start, pass it into every
subagent, and watch your prompts for `/baldie lite|full|ultra` switches. Same
steps work in the Claude Code desktop app (Install from marketplace).

### OpenCode

```json
{ "plugin": ["github:sdachary/baldie"] }
```

Register creates `.opencode/command/*.md` slash commands: `/baldie`,
`/baldie-audit`, `/baldie-scale`, `/baldie-help`. `AGENTS.md` is read natively
as project rules, so baldie is active even before the plugin.

### Gemini CLI

```
gemini extensions install github.com/sdachary/baldie
```

This reuses `gemini-extension.json`. Antigravity (Gemini's new CLI) converts
the `/baldie*` commands into skills you type as messages. To run baldie as an
always-on rule instead, drop the ruleset (or `AGENTS.md`) into `.agents/rules/`.

### libs pi

```
pi ext add baldie@github.com/sdachary/baldie
```

Shipped as a small extension in `pi-extension/` with its own test suite, so
it survives `pi cache` clears.

### Copilot CLI

Copy `hooks/copilot-hooks.json` into your Copilot plugin config `hooks` block.
It emits the ruleset as `additionalContext` on session start and handles
`/baldie` mode commands per prompt.

### Qoder

Qoder reads `AGENTS.md` for rules natively; for live mode switching hook up
`hooks/qoder-hooks.json` (a reference template — replace `BALDIE_DIR`).

### Any agent that reads AGENTS.md

Cursor, Windsurf, Cline, Copilot Chat, Devin and others read `AGENTS.md`
natively. Cloning the repo — or copying `AGENTS.md` into your working
directory — activates baldie with zero plugin machinery. Friendlier:
install baldie once at `~/.cursor/rules` / `~/.windsurf/rules` so it applies
everywhere.

## Modes

| Mode | Behavior |
|---|---|
| `lite` | Free-first, but a small paid option is fine if it measurably saves real time. |
| `full` | **Default.** Free is the default recommendation; paid only on measured need, sized to usage, with a trigger and review date. |
| `ultra` | Zero-budget. Only already-owned, always-free-tier, or provably essential resources. |
| `off` | Revert to normal behavior before session end (no persistence session). |

Switch mid-session: `/baldie lite`, `/baldie full`, `/baldie ultra`, or
`stop baldie`. Set the default permanently via
`BALDIE_DEFAULT_MODE` or `~/.config/baldie/config.json`:

```json
{ "defaultMode": "ultra" }
```

## The source of truth (auto-refreshed weekly)

Baldie is not a static ruleset — it ships a living registry of free /
free-tier / self-hostable services that agents are told to consult before
recommending anything:

```
data/free-tier.json      curated registry: service -> free offer, ceiling, status, last_verified
data/seen.json           observation log (what upstream lists, when first/last seen)
data/changelog.md        weekly diff: new upstream entries, possibly-gone free tiers
```

Every Monday 06:00 UTC a GitHub Action
(`.github/workflows/refresh-free-tier.yml`, free minutes on this public repo)
reads two upstream lists at run time — [free-for-dev](https://github.com/ripienaar/free-for-dev)
and [awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) —
diffs them against the observed history, restamps `last_verified` on still-live
entries, and flags entries that vanish for two consecutive runs as candidates
for "free tier ended". The lists themselves are never committed (both upstream
projects carry licenses that restrict redistribution); only baldie's own
facts go in the repo.

What the three statuses mean to an agent:

- `live` + `last_verified` — currently observed upstream, current.
- `live` + no date — human-curated, unverified; check the price page before quoting numbers.
- `flagged` — gone from upstream for 2+ refreshes; free tier likely ended, say so.

Run the refresh yourself anytime: `node scripts/refresh-free-tier.js`
(stdlib only, no deps). It writes `changelog.md` and updates the registry;
commit the diff if you want it persisted.

## The skills

- `baldie` — the advisor itself; active every response.
- `baldie-audit` — one-shot sweep of everything you run: free-tier exists / self-hostable / over-provisioned / delete / keep-paid. Ends with total potential monthly savings.
- `baldie-scale` — right-size one paid service to measured usage; name the upgrade trigger and review date.
- `baldie-help` — quick reference card.

## How it works / architecture

```
AGENTS.md                    ruleset any agent can read natively (zero-install path)
skills/baldie*/SKILL.md      full skill definitions for opencode, pi, antigravity
data/                        living free-tier registry + weekly changelog (see above)
scripts/refresh-free-tier.js stdlib refresh (¬deps) — diffs upstream lists vs our data
.github/workflows/           weekly auto-refresh (free minutes, public repo)
hooks/                       shared Node runtime: config, instructions, activate,
                             mode-tracker, subagent + per-agent JSON adapters
.opencode/plugin/baldie.mjs  opencode plugin (injects ruleset + slash commands)
gemini-extension.json        Gemini CLI / Antigravity adapter
pi-extension/                pi harness extension (+ tests)
```

Single source of truth: the ruleset lives once in `AGENTS.md`; hook scripts
and the pi extension read it from disk, so updating the repo updates every
agent. Zero network calls, works fully offline.

## License

MIT. Baldie is not affiliated with ponytail (it just owes ponytail the shape
of its hairline).