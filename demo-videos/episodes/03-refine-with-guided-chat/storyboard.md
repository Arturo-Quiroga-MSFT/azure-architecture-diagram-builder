# 3_Refine-with-Guided-Chat — storyboard

**Length:** ~2:45 · **Recorded on:** production AADB · **Music:** drive · **Narrator:** Andrew HD

**Asset** (`assets/clinic-booking-first-draft.json`): an AADB-saved diagram, generated once on production and renamed
"Clinic Booking · first draft" (8 services: App Service, Functions, SQL Database, Storage, Key Vault, Entra ID,
Application Insights, Log Analytics; $118.83/mo in East US 2). Loading it makes every take start identically.

| # | On screen | Narration | ~s |
|---|---|---|---|
| 1 | Cold open card: three customer asks pop in ("Can we add a cache?" · "What about security?" · "Go back to yesterday's version") | n01-open | 9 |
| 2 | Title card: Episode 3 · "Refine with Guided Chat" | n02-title | 5 |
| 3 | **Load** → the first draft appears; callout on the cost ($118.83/mo) | n03-draft | 11 |
| 4 | **Guided Chat** opens; callout on the pillar-tagged suggestion chips | n04-chat | 8 |
| 5 | The request is typed and sent | n05-ask | 8 |
| 6 | Waiting, sped up (capped at ~7 s on screen); **reveal** | n06-apply | 5 |
| 7 | Callout on the **change review** reply (added · removed · connections) | n07-review | 10 |
| 8 | Callout on the new **Azure Cache for Redis** node | n08-canvas | 7 |
| 9 | Callout on the re-priced run rate | n09-cost | 3 |
| 10 | Callout on **Suggested next steps**; the cursor clicks a chip, preferring Front Door / WAF (never private networking) → sped up → **reveal** | n10-next | 9 |
| 10b | *Only if it happens:* the **Review extra services** dialog → "Apply requested changes only" | n10b-guard | 6 |
| 11 | **Make it yours:** the Redis node is dragged | n11-yours | 5 |
| 12 | **Library:** the version list (one entry per change, with its request) | n12-history | 8 |
| 13 | **Restore This Version** on the first draft → back to the canvas at $118.83 | n13-restore | 7 |
| 14 | Full diagram → end card | n14-close | 9 |

Chips that touch private networking are skipped: in v2.1.10 "Add private endpoints…" set off a false review
(see README notes) and removed the WAF policy.
