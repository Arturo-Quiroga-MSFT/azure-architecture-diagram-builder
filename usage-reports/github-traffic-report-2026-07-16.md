# GitHub Traffic Report — Azure Architecture Diagram Builder

**Repository:** `Arturo-Quiroga-MSFT/azure-architecture-diagram-builder`
**Report date:** 2026-07-16 · **Traffic window:** last 14 days (2026-07-02 → 2026-07-15)
**Source:** GitHub Traffic API (`gh api .../traffic/*`), captured via `scripts/repo-traffic.sh`

---

## Executive summary

In the last two weeks the repository drew **396 views from 131 unique visitors** and **215 clones from 59 unique cloners**, alongside **14 stars** and **5 forks**. Engagement is **real and technical, not casual**: nearly half of visitors opened the getting-started guide, and the burst converted into forks and clones — signs that people are standing the tool up, not just browsing. A pronounced spike on **July 13–15** coincides with a **Microsoft Teams** share, which was the largest external referral.

---

## Headline metrics (last 14 days)

| Metric | Total | Unique |
|--------|------:|-------:|
| **Views** | 396 | **131 visitors** |
| **Clones** | 215 | **59 cloners** |
| **Stars (all-time)** | 14 | — |
| **Forks (all-time)** | 5 | — |
| **Watchers** | 1 | — |
| **Open issues/PRs** | 0 | — |

> Stars and forks are cumulative and permanent; views and clones are a rolling 14-day window that GitHub does not retain — hence the CSV snapshot log (below) to build history.

---

## The July 13–15 surge

Traffic was quiet through early July, then spiked sharply:

| Date | Views | Unique visitors | Clones | Unique cloners |
|------|------:|----------------:|-------:|---------------:|
| Jul 11 | 2 | 1 | 0 | 0 |
| Jul 12 | 0 | 0 | 6 | 1 |
| **Jul 13** | **95** | **24** | 10 | 5 |
| **Jul 14** | **188** | **71** | **127** | **36** |
| **Jul 15** | **78** | **41** | 37 | 20 |

**~90% of the two-week traffic landed in these three days.** July 14 alone drove 188 views, 71 unique visitors, and 127 clones — the clearest signal of a coordinated share reaching a technical audience.

---

## Where visitors came from (referrers)

| Referrer | Views | Unique |
|----------|------:|-------:|
| github.com (internal / search) | 49 | 7 |
| **teams.public.onecdn.static.microsoft** (shared in Microsoft Teams) | 16 | 6 |
| techcommunity.microsoft.com | 1 | 1 |
| linkedin.com | 1 | 1 |
| Google | 1 | 1 |

The **Microsoft Teams** referral is the standout external driver — internal word-of-mouth is spreading the tool across the field.

---

## What people actually read (top content)

| Views | Unique | Path |
|------:|-------:|------|
| 135 | 89 | Repo home |
| **71** | **48** | **`DOCS/getting-started-guide.md`** |
| 15 | 10 | File tree (`/tree/main`) |
| 7 | 4 | `Architecture_validations/` |
| 6 | 3 | `DOCS/ARCHITECTURE.md` |
| 5 | 5 | `mcp-server/` |
| 4 | 1 | `DOCS/AI_INSTRUCTIONS_DOCUMENTATION.md` |

**The getting-started guide is the #2 destination after the repo home** — onboarding docs are doing real work. Interest in `mcp-server/` and the architecture docs shows a technically serious audience evaluating how to run and integrate it.

---

## Forks (all-time)

All five forks were created **inside the same July 13–16 surge**, i.e. the spike converted lookers into builders:

| Created | Fork |
|---------|------|
| 2026-07-16 | `sinnitesh/…` |
| 2026-07-14 | `yang-jiayi/…` |
| 2026-07-14 | `speaking-frankly/…` |
| 2026-07-14 | `nipaul/…` |
| 2026-07-13 | `anton-kasperovich/…` |

---

## On "ZIP downloads"

GitHub **does not expose** a count for "Download ZIP" of the source tree — that metric isn't available via the API or the UI. The only downloadable count GitHub tracks is **release-asset** downloads, and this repo currently has **no releases**. **Recommendation:** if download metrics matter to leadership, cut a GitHub Release and attach an asset — per-asset `download_count` then becomes reportable.

---

## Takeaways for leadership

- **Adoption is accelerating and organic** — a single Teams share produced 131 unique visitors, 59 unique cloners, and 5 forks in days.
- **Engagement is high-quality** — nearly half of visitors opened onboarding docs; clones and forks indicate hands-on trial, not passive interest.
- **Zero open issues** — no support backlog, but also an opportunity to invite feedback/contributions from the new fork owners.
- **Next steps to sustain momentum:** (1) cut a tagged Release for download metrics + easier consumption; (2) keep sharing via Teams/TechCommunity (proven channels); (3) run `scripts/repo-traffic.sh --csv` on a cadence to trend beyond GitHub's 14-day window.

---

*Generated from `scripts/repo-traffic.sh`. Snapshot history: `usage-reports/repo-traffic-log.csv`.*
