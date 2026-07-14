# Model Comparison — Multi‑Critic Leaderboard (Healthcare FHIR prompt)

**Generated:** 2026-07-14
**Prompt under test:** *A healthcare data platform with FHIR API, HIPAA‑compliant storage, real‑time patient monitoring, Azure Health Data Services, and Power BI for clinical dashboards*
**Method:** The same 14 model‑generated architectures were each ranked by **5 different critic models**. Averaging the ranks cancels out per‑critic bias and separates signal from judge‑dependent noise.

**Critic models:** GPT‑5.6 Sol · DeepSeek V4 Pro · Grok 4.3 · Kimi K2.5 · Mistral Large 3

> ⚠️ All rankings are AI‑generated and reflect each critic's architectural preferences. Treat the **consensus** (low‑variance) rows as reliable and the **volatile** rows as opinion‑dependent.

---

## Consensus leaderboard (average rank across 5 critics)

| # | Model | Sol | V4Pro | Grok43 | Kimi25 | Mistral | **Avg** | Range | Reliability |
|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| 1 | **DeepSeek V4 Pro** | 1 | 1 | 2 | 1 | 1 | **1.2** | 1 | 🟢 rock‑solid |
| 2 | **GPT‑5.6 Luna** | 2 | 3 | 3 | 3 | 2 | **2.6** | 1 | 🟢 rock‑solid |
| 3 | **GPT‑5.6 Terra** | 3 | 5 | 6 | 5 | 5 | **4.8** | 3 | 🟢 stable |
| 4 | **GPT‑5.1** | 6 | 6 | **1** | 4 | 8 | **5.0** | **7** | 🔴 polarizing |
| 5 | GPT‑5.6 Sol | 5 | 7 | 7 | 6 | 7 | 6.4 | 2 | 🟢 stable |
| 6 | GPT‑5.2 | 4 | 4 | 5 | 10 | 11 | 6.8 | 7 | 🟠 volatile |
| 7 | Kimi K2.7 Code | 13 | 11 | 4 | 2 | 9 | 7.8 | 11 | 🔴 very volatile |
| 8 | GPT‑5.4 | 8 | 2 | 11 | 11 | 10 | 8.4 | 9 | 🔴 very volatile |
| 9 | DeepSeek V3.2 Speciale | 11 | 9 | 8 | 13 | 3 | 8.8 | 10 | 🔴 very volatile |
| 10 | Grok 4.1 Fast | 10 | 12 | 10 | 9 | 4 | 9.0 | 8 | 🟠 volatile |
| 11 | Mistral Large 3 | 12 | 8 | 9 | 12 | 6 | 9.4 | 6 | 🟠 volatile |
| 12 | GPT‑5.4 Mini | 7 | 10 | 14 | 8 | 12 | 10.2 | 7 | 🟠 |
| 13 | Kimi K2.5 | 9 | 13 | 13 | 7 | 14 | 11.2 | 7 | 🟠 |
| 14 | Grok 4.3 | 14 | 14 | 12 | 14 | 13 | 13.4 | 2 | 🟢 consensus worst |

*Columns Sol…Mistral are the rank each critic assigned. **Avg** = mean rank (lower is better). **Range** = max − min rank (lower = critics agree more).*

---

## Key findings

### 1. Two undisputed winners
**DeepSeek V4 Pro** (avg 1.2) and **GPT‑5.6 Luna** (avg 2.6) are top‑3 under *every* critic (range = 1). Even after removing V4 Pro's self‑vote, three *competitor* critics still ranked it #1. **Luna never voted for itself** (it wasn't a critic) and is also the fastest generator (10.1s in the compare modal) — making **Luna the safest default**, and **V4 Pro the "maximum completeness" pick**.

### 2. GPT‑5.1 is now #4 — and highly polarizing
It has slipped from a former favorite to **#4 overall (avg 5.0)**, clearly behind V4 Pro / Luna / Terra — but it is the **single most polarizing model** (range 7):
- **Grok 4.3 ranked it #1**; Kimi ranked it #4.
- V4 Pro and Mistral buried it at #6–#8.

The split is philosophical: minimalist critics reward its clean, correct *"FHIR‑as‑system‑of‑record"* flow; "serving‑layer" critics dock it for lacking a Synapse/SQL tier between the data lake and Power BI. Its **one universally‑cited flaw**: it lists **"Azure API for FHIR" twice**.
**Verdict:** demote from default, but it's *polarizing, not obsolete* — still strong for lean, correct‑core designs.

### 3. Self‑bias is measurable
Every critic favored itself relative to where the others placed it:

| Critic | Ranked *itself* | Consensus (others) | Self‑boost |
|---|:--:|:--:|:--:|
| Kimi K2.5 | 7 | ~13 | **+6** (worst) |
| Mistral Large 3 | 6 | ~11 | **+5** |
| GPT‑5.6 Sol | 5 | ~6.75 | +1.75 |
| Grok 4.3 | 12 | ~13.75 | +1.75 |
| DeepSeek V4 Pro | 1 | 1 | 0 (earned — others agree) |

**Rule of thumb:** discard a critic's vote for itself and its own family; the podium (V4 Pro / Luna / Terra) does not change.

### 4. Ignore the volatile middle
Kimi K2.7 Code (range 11), DeepSeek V3.2 Speciale (10), and GPT‑5.4 (9) swing wildly by judge — their rank is effectively an opinion coin‑flip, not signal. High "MOST THOROUGH" service counts (V3.2 Speciale, 16 services) did **not** translate to high rank; extra services often hid correctness bugs (e.g., Cosmos DB modeled as the FHIR store).

---

## Recommendations

| Use case | Model |
|---|---|
| **Default (quality + speed)** | **GPT‑5.6 Luna** — top‑3 under every critic, fastest generator, no self‑vote |
| **Maximum completeness** | **DeepSeek V4 Pro** — consensus #1, richest end‑to‑end design |
| **Solid third option** | **GPT‑5.6 Terra** |
| **Lean / correct‑core designs** | **GPT‑5.1** — polarizing but strong when simplicity is valued |
| **Avoid as go‑tos** | Grok 4.3, Kimi K2.5, GPT‑5.4 Mini (consensus bottom‑4) |

**Biggest lesson:** a single critic is noise. A 5‑critic average is the first view that reliably separates signal (V4 Pro / Luna at the top, Grok 4.3 at the bottom — all range ≤ 2) from judge‑dependent noise. Prefer models the critics *agree* on, and cross‑check any single‑critic verdict with at least one model that scored poorly (so it has no family in the top ranks).

---

## Caveats
- **Single prompt.** This leaderboard reflects one healthcare/FHIR scenario. Model strengths shift by domain — re‑run the multi‑critic method per prompt class before generalizing.
- **AI‑generated critiques.** Each ranking may embed the reviewer's own architectural philosophy; the averaging and self‑bias adjustments above mitigate but do not eliminate this.
- **Source critiques:** raw per‑critic files live in `DONOTTRACK/HealthcareDataPlatformFhir-AI-Critique-by-*.md`.
