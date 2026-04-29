# AIDC Facilitator Guide — Using the Diagram Builder in AI Discovery Cards Workshops

A working guide for AIDC Champs and PSAs who want to make the Azure Architecture Diagram Builder an official tool inside AI Discovery Cards workshops, in person or virtual.

---

## Why pair the Diagram Builder with AIDC

| AIDC alone produces… | The Diagram Builder adds… |
|---|---|
| A set of cards capturing the customer's AI ambitions, grouped by capability category | A presentation-ready Azure architecture diagram that visually realizes those cards |
| Per-card service recommendations (Azure AI Foundry, Azure AI Search, Microsoft Fabric, …) | Service connectivity, grouping, official Azure iconography, and an end-to-end picture |
| Conceptual conversation about what is possible | Concrete artifacts: SVG/PNG/PPTX/Draw.io export, WAF validation score, monthly cost estimate across 8 regions |
| A team aligned on direction | A team aligned on a deliverable they can email the day of the workshop |

In Guilherme's regional sessions the diagram step closed the gap between "great conversation" and "thing the customer takes away." This guide standardizes that move so any AIDC Champ can replicate it.

---

## Where the Diagram Builder fits in the workshop flow

```
1. Set the stage          (existing AIDC step, ~10 min)
2. Empathize / ideate     (existing AIDC step, card sort, ~45 min)
3. Group cards by theme   (existing AIDC step, ~15 min)
4. ►► Diagram the top theme  (new step with Diagram Builder, ~20 min)
5. Validate & cost        (new step with Diagram Builder, ~10 min)
6. Next steps & handoff   (existing AIDC step, ~10 min)
```

Steps 4 and 5 are additive — they don't replace anything. They take ~30 minutes total. In a virtual workshop you can collapse them to 20 minutes by pre-loading the prompt.

### Step 4 — Diagram the top theme

After the team has clustered the chosen cards into themes, pick the highest-priority theme. Walk through this on screen:

1. Open the Diagram Builder.
2. Paste the **AIDC card-driven prompt** (template below).
3. Read the cards aloud as you fill the prompt — this re-anchors the room on what was decided.
4. Generate. Talk through the resulting diagram.

### Step 5 — Validate & cost

1. Click **WAF Validation**. Read the top 3 findings out loud. Mark which ones the customer must fix before pilot.
2. Click **Cost Estimate**. Pick the customer's primary region. Note the monthly range. (The catalog covers 8 regions: East US 2, Sweden Central, West Europe, Canada Central, Brazil South, Australia East, Southeast Asia, Mexico Central.)
3. Export to PPTX or PNG. Drop into the workshop deck.

---

## The card-to-prompt translation

The Diagram Builder works best when the prompt names the cards by `Category > Card title`. The model uses the AIDC vocabulary as grounding cues and tends to produce services that match the per-card recommendations on the original cards.

### Master template

```
Design an Azure architecture that delivers the following AI Discovery Cards
selected by the customer.

Customer: <name / industry / segment>
Business outcome (one sentence): <e.g., "reduce average handle time 30%">

AI Discovery Cards selected:
  - <Category> > <Card title>
  - <Category> > <Card title>
  - <Category> > <Card title>
  - <Category> > <Card title>

Constraints from the room:
  - Region: <region>
  - Compliance: <list or "none">
  - Identity: <Entra ID / B2C / hybrid>
  - Existing investments to reuse: <e.g., Fabric, D365, SharePoint, M365 Copilot>
  - Time horizon: <PoC in 6 weeks / production in 6 months>

Please:
  1. Use the Microsoft services already recommended on the selected cards
     wherever possible.
  2. Group services by AIDC card category.
  3. Add only the supporting services that are necessary (identity, networking,
     storage, observability, key management).
  4. Provide a short narrative tying each service to the card it satisfies.
```

### Quick mapping cheat-sheet (cards → expected services)

The Diagram Builder will produce its own picks; this list is what to expect so you can reassure the room when it appears. Pulled directly from the card-recommended services on the official AIDC deck.

| AIDC card | Services the diagram is likely to include |
|---|---|
| Information Management > Retrieve information | Azure AI Search, Bing Search API, M365 Copilot, Sharepoint Premium |
| Information Management > Recognize and understand forms | Azure AI Document Intelligence, Azure AI Content Understanding, Azure AI Foundry |
| Information Management > Structure raw data | Azure AI Document Intelligence, Azure AI Foundry, Azure Machine Learning |
| Data and predictive analytics > Predict customer churn | Azure Machine Learning, Microsoft Fabric, Dynamics 365 Customer Insights |
| Data and predictive analytics > Detect anomalies | Azure Machine Learning, Azure AI Custom Vision, Azure Sentinel |
| Data and predictive analytics > Visualize data | Microsoft Fabric, Azure AI Foundry, Power BI |
| Decision making > Boost sales with insights | Dynamics 365 Sales, M365 Copilot for Sales, D365 Customer Insights |
| Decision making > Enhance decisions | Azure AI Foundry, Azure ML, D365 Customer Insights |
| Visual perception > Identify objects | Azure AI Foundry, Azure AI Vision, Azure ML, Azure AI Content Understanding |
| Visual perception > Analyse images | Azure AI Vision, Azure AI Foundry, Azure ML, Bing Search API, Azure AI Content Understanding |
| Text processing > Summarize text | Azure AI Language, Azure AI Foundry, M365 Copilot Studio, M365 Agents SDK, M365 Teams Premium |
| Text processing > Translate text | Azure AI Translator, Azure AI Foundry, M365 Copilot Studio, M365 Teams Premium |
| Communication > Engage in natural conversations | Azure AI Bot Service, Azure AI Foundry, Azure AI Translator, M365 Copilot Studio, M365 Agents SDK |
| Communication > Automate answers | Azure AI Search, Azure AI Foundry, Azure AI Bot Service, M365 Copilot Studio, M365 Agents SDK |
| Speech recognition > Convert speech to text | Azure AI Foundry (with Speech) |
| Speech recognition > Enable voice commands | Azure AI Language, Azure AI Foundry |
| Process optimization > Quality control & maintenance | Azure ML, Azure IoT Edge, Dynamics 365 Field Service, Azure AI Vision, M365 Agents SDK |
| Process optimization > Streamline field service | Dynamics 365 Field Service, Azure AI Language, Azure AI Foundry |
| Content creation > Generate images from text | Azure AI Foundry, Microsoft Designer, Microsoft Copilot, Azure AI Content Understanding |
| Navigation and control > Human-robot interaction | Azure IoT Operations, Azure Digital Twins, Azure AI Foundry |

(Refer to the AIDC deck for the complete card library; this table covers the cards we see most often in workshops.)

---

## Pre-workshop checklist (10 minutes the day before)

- [ ] Confirm the Diagram Builder URL is reachable from the workshop venue / VPN.
- [ ] Test sign-in with the account you'll demo from.
- [ ] Pre-fill the card-driven prompt template with the customer name, region, and any compliance constraints you already know.
- [ ] Pre-pick a primary model: **GPT-5.2 medium** for live demos (fast and reliable), **GPT-5.4** if you have a few extra minutes and want the most thorough output.
- [ ] If virtual: ensure the screen-share resolution is high enough to read the diagram. The interactive HTML export is the fallback if the SVG looks crowded.
- [ ] Bring a printed copy of the AIDC deck or have the digital cards open in a side window so participants can read titles aloud.

---

## During the workshop — facilitator script

> *"Now that we've grouped your cards, let's turn the top theme into a real Azure architecture. I'll use the Diagram Builder. As I read each card title, I'll add it to the prompt. Stop me if you see something that doesn't match what you meant."*

Then, while typing into the prompt:

> *"`<Category> > <Card title>` — that's the one we picked because of `<one-sentence reason from the discussion>`."*

After generating:

> *"Here's the architecture. Each grouping on the diagram corresponds to one of your cards. The services in each group are the Microsoft services we'd recommend to deliver that capability."*

After WAF validation:

> *"Here's where this design has gaps today. Top 3 to address before pilot: …"*

After cost estimate:

> *"In `<region>` this lands in the `<low–high $/month>` range, depending on tier. We can tighten that with workload-specific sizing in the next session."*

---

## Post-workshop deliverable (what the customer leaves with)

A simple email-back package, all generated by the Diagram Builder in the same session:

1. **Architecture diagram** — PPTX (for their next exec review) and SVG (for docs).
2. **WAF validation report** — score + top findings by pillar.
3. **Cost estimate** — monthly range for primary region; CSV across 8 regions if multi-region was discussed.
4. **az prototype interchange manifest** (JSON) — bundled in case a partner / internal team wants to take this into IaC and production-grade deployment next.
5. **Card-to-service summary** — one-page note: each chosen card and which Azure services it maps to in the diagram. (Generated from the diagram metadata.)

---

## Sharing & adoption

Two channels to drive adoption across regions, per the action items from the April 28 PSA call:

1. **Viva Engage AIDC channel** — post one short case study per region using this guide. Include the diagram, the cards selected, and the customer's reaction. (Owner: Guilherme is taking the first regional post.)
2. **AIDC Champs Americas chat** — weekly office hour rotation; one Champ shows the most interesting diagram from the prior week.
3. **Global AIDC Champs call** — propose a 15-minute slot to demo the workflow once we have 3–4 regional case studies posted.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Diagram is generic / has services nobody asked for | Prompt didn't name the cards | Re-prompt using the AIDC template above with `Category > Card title` lines |
| Diagram missing a card's intent | Card title too abstract for the model | Add a one-line clarifier in parentheses next to the card, e.g. *"Detect anomalies (real-time fraud signals on card transactions)"* |
| WAF score is shockingly low | Architecture is mid-discussion / missing identity, KV, monitoring | This is normal for a first pass. Use it as the talking point; iterate to fix the top 3 |
| Cost estimate looks too high | Default tier is "Standard" across the board | Re-prompt: *"Show me the dev/test variant under $X/month"* |
| Model picks the wrong region | Region not in the prompt | Add `Region(s):` to the constraints block |

---

## Open questions / future enhancements (parking lot)

- **MCP integration with Architect Agent.** When supported, the Diagram Builder's six MCP tools (`list_services`, `validate_architecture`, `estimate_costs`, `generate_manifest`, `get_waf_rules`, `render_diagram`) will let Architect Agent generate the diagram inline. (Lucy is tracking the Seismic roadmap.)
- **Card-aware mode in the app itself.** Today the AIDC vocabulary lives in the prompt. A future enhancement could surface AIDC categories as first-class groups in the UI.
- **Workshop replay.** Capture the session as a recorded walkthrough so virtual AIDC sessions can re-use it.
