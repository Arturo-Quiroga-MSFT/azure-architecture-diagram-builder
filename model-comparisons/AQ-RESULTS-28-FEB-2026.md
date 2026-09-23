
---

## Model Comparison Analysis — 4 Prompts, 6 Models, Low Reasoning

### Tier Classification

**Tier 1 — Speed Leaders (< 15s avg)**
| Model | Avg Time | Avg Tokens | Svc/sec | Best For |
|---|---|---|---|---|
| **Grok 4.1 Fast** | 8.1s | 2,854 | 1.30 | Rapid prototyping, demos, iterations |
| **GPT-5.1** | 12.9s | 3,769 | 0.77 | Balanced quality + speed, workflow depth |

**Tier 2 — Quality Mid-tier (15-35s avg)**
| Model | Avg Time | Avg Tokens | Svc/sec | Best For |
|---|---|---|---|---|
| **DeepSeek V3.2 Speciale** | 20.3s | 3,121 | 0.57 | Dense architectures, connectivity mapping |
| **GPT-5.2 Codex** | 31.9s | 3,224 | 0.29 | Token-efficient GPT option, simpler architectures |

**Tier 3 — Deep Reasoning (45-52s avg)**
| Model | Avg Time | Avg Tokens | Svc/sec | Best For |
|---|---|---|---|---|
| **GPT-5.3 Codex** | 49.5s | 3,982 | 0.23 | Consistent service counts (SD=0.5), complex IoT |
| **GPT-5.2** | 51.6s | 3,757 | 0.22 | Highest service richness, most connections from GPT family |

### Key Findings

**1. Grok is the clear efficiency champion**
- 6.3x faster than GPT-5.2, 2.5x faster than DeepSeek
- Fewest tokens (2,854 avg) — lowest cost per diagram
- Still produces competitive output: 10.5 avg services, 11.0 avg connections
- Most groups on average (5.8) — better logical separation
- **1.30 svc/sec** — nearly double GPT-5.1's ratio

**2. DeepSeek excels at connectivity density**
- 14.8 avg connections vs next-best GPT-5.2 at 12.8 — **16% more connections**
- P3 (Microservices) standout: 14 services, **22 connections** — no other model broke 13
- High variance though (SD=1.7 on services) — less predictable output
- Good speed for a third-party model (20.3s avg)

**3. GPT-5.1 owns workflow depth**
- 9.3 avg workflow steps — highest of all models
- Won "Most WF Steps" on 3 of 4 prompts (P1, P2, P4)
- Best for documentation-heavy outputs where step-by-step narrative matters
- Excellent speed-quality tradeoff at 12.9s

**4. GPT-5.2 Codex is the wildcard**
- Highest variance (SD=1.9) — produced 6 services for Microservices but 11 for E-commerce
- Fastest among codex models (31.9s) but least rich overall (9.3 avg services)
- P3 was notably weak: only 6 services, 5 connections, 5 workflow steps
- Best when token budget matters and prompt is well-defined

**5. GPT-5.3 Codex is the most consistent**
- Lowest service count standard deviation (SD=0.5) — always 11-12 services
- Highest token consumption (3,982 avg) — most verbose
- Slowest on IoT (53.6s) but produced the richest IoT architecture (12 svc, 13 conn, 9 wf)

**6. GPT-5.2 is reliable but slow**
- Tied for richest services (11.5 avg) with GPT-5.3 Codex and DeepSeek
- Won "Most Connections" on 3 of 4 prompts from the GPT family
- But 51.6s avg makes it hard to justify over DeepSeek (same richness, 2.5x faster)

### Prompt-Specific Insights

| Prompt | Best Speed | Best Quality | Best Connections | Observation |
|---|---|---|---|---|
| **E-commerce** | Grok (8.7s) | GPT-5.1 (12 svc, 10 wf) | GPT-5.2 (13) | All models performed well — straightforward architecture |
| **IoT Pipeline** | Grok (8.4s) | GPT-5.3 Codex (12 svc, 9 wf) | GPT-5.2/5.3/DeepSeek (13) | Complex domain benefits from reasoning models |
| **Microservices** | Grok (7.1s) | DeepSeek (14 svc, 22 conn) | DeepSeek (22) | DeepSeek dominates — 2x connections vs anyone else |
| **RAG Chatbot** | Grok (8.1s) | GPT-5.2 (12 svc, 13 conn) | GPT-5.2/5.3/DeepSeek (13) | AI-domain prompt favors GPT-5.2 reasoning |

### Recommendations for PSAs

| Scenario | Recommended Model | Why |
|---|---|---|
| **Live demos / workshops** | Grok 4.1 Fast | 8s response, good enough quality, lowest cost |
| **Customer deliverables** | GPT-5.1 | Best speed-quality balance, deepest workflows |
| **Complex microservices mapping** | DeepSeek V3.2 Speciale | Unmatched connectivity density |
| **Consistency-critical (reports)** | GPT-5.3 Codex | Lowest variance, always 11-12 services |
| **Deep architecture analysis** | GPT-5.2 | Richest output, best for reasoning-heavy prompts |
| **Budget-conscious** | Grok > DeepSeek > GPT-5.2 Codex | Ranked by token efficiency |

### Should prompts be model-specific?

**Not yet recommended.** The data shows all models handle the same prompts well. The differences are in *output characteristics* (speed, density, consistency) not in prompt comprehension. Instead, recommend **choosing the model** based on the use case rather than tuning prompts per model. The one exception: DeepSeek clearly "unlocks" on microservices-style prompts where complex inter-service communication is involved — PSAs doing service mesh or distributed systems work may want to default to DeepSeek for those.

