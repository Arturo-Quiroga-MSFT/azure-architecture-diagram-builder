# Diagram Builder — Starter Prompts

Copy-paste prompts that get a high-quality Azure architecture diagram on the first try. Three tiers, all covering the same scenarios so users can pick the depth that matches their need.

App URL: `https://<diagram-builder-fqdn>` *(replace with the deployed FQDN)*

---

## How to use these prompts

1. Open the Diagram Builder.
2. Pick a model from the dropdown (recommended: **GPT-5.2 medium** for balanced speed/quality, **GPT-5.4** for the most thorough output).
3. Paste a prompt below. Edit the **bold** placeholders to match the customer scenario.
4. Click **Generate**. Iterate on the resulting diagram with follow-up prompts ("add a private endpoint to the SQL DB", "switch the cache to Premium", "show me the dev/test variant").
5. Use the **Cost Estimate**, **WAF Validation**, and **Export** features to round out the deliverable.

---

## Tier A — One-liner prompts

For users who just want something on the screen fast. Use these as a warm-up; iterate from there.

| Scenario | Prompt |
|---|---|
| RAG knowledge assistant | *Design an Azure architecture for a RAG-based internal knowledge assistant grounded on SharePoint documents.* |
| Document intelligence | *Design an Azure architecture to extract structured data from PDF invoices and route them to a SQL database.* |
| Customer service agent | *Design an Azure architecture for a customer-service chatbot with sentiment analysis and human handoff.* |
| Sales insights | *Design an Azure architecture that analyzes CRM data to predict customer churn and surface insights to sellers.* |
| Vision quality control | *Design an Azure architecture for real-time defect detection on a manufacturing line using factory cameras.* |
| Multilingual contact center | *Design an Azure architecture for a multilingual voice contact center with live translation and sentiment scoring.* |

---

## Tier B — Structured prompts (recommended)

Same scenarios, with the structure the LLM uses best. Filling in the bold sections gives sharper, more grounded diagrams.

### Template

```
Design an Azure architecture for the following workload.

Workload: <one-sentence summary>
Industry: <e.g., financial services, manufacturing, healthcare>
Primary users: <who calls the system, how many, from where>
Data sources: <what we read from / write to>
Key capabilities (AI/ML): <bullet list>
Non-functional requirements:
  - Region(s): <e.g., East US 2 + Sweden Central for DR>
  - Compliance: <e.g., HIPAA, PCI, GDPR, none>
  - Identity: <Entra ID, B2C, none>
  - Scale: <expected RPS, DAU, document volume>
  - Budget tier: <demo / pilot / production>
Out of scope: <explicit non-goals>

Please produce: services, connections, logical groups, and a short narrative.
```

### Worked examples

#### B1 — RAG knowledge assistant

```
Design an Azure architecture for the following workload.

Workload: Internal knowledge assistant grounded on company documents.
Industry: Professional services.
Primary users: ~2,000 employees, web + Teams, single tenant.
Data sources: SharePoint Online libraries, a public-facing policy site,
              a small SQL knowledge base.
Key capabilities (AI/ML):
  - Retrieve information from grounded documents
  - Engage in natural conversations
  - Summarize text and cite sources
  - Translate responses on demand
Non-functional requirements:
  - Region(s): East US 2 (primary)
  - Compliance: SOC 2; data must stay in tenant
  - Identity: Entra ID with Conditional Access
  - Scale: 200 concurrent chats peak
  - Budget tier: production
Out of scope: Voice, image generation.
```

#### B2 — Document intelligence pipeline

```
Design an Azure architecture for the following workload.

Workload: Extract structured fields from supplier invoices and route to ERP.
Industry: Retail.
Primary users: AP team (50 users) reviewing exceptions only.
Data sources: Email mailbox, scanned PDFs in a landing storage account.
Key capabilities (AI/ML):
  - Recognize and understand forms (printed + handwritten)
  - Structure raw data into a canonical invoice schema
  - Detect anomalies vs. historical supplier patterns
  - Workflow creation for human-in-the-loop exceptions
Non-functional requirements:
  - Region(s): West Europe
  - Compliance: GDPR, SOX
  - Identity: Entra ID
  - Scale: 50,000 invoices/month, peak 5/min
  - Budget tier: pilot
Out of scope: Customer-facing UX.
```

#### B3 — Customer service agent with handoff

```
Design an Azure architecture for the following workload.

Workload: Customer self-service agent that handles tier-1 questions
          and hands off to a live agent when sentiment turns negative.
Industry: Telecommunications.
Primary users: B2C customers, web + mobile, ~10K MAU.
Data sources: KB articles, CRM tickets, billing system (read-only API).
Key capabilities (AI/ML):
  - Engage in natural conversations
  - Understand user intent
  - Automate answers from grounded KB
  - Analyze emotion and sentiment to trigger handoff
Non-functional requirements:
  - Region(s): East US 2 + West US 3 (active/active)
  - Compliance: PCI (no card data in scope)
  - Identity: Azure AD B2C
  - Scale: 500 concurrent chats peak
  - Budget tier: production
Out of scope: Outbound campaigns.
```

#### B4 — Sales insights / churn prediction

```
Design an Azure architecture for the following workload.

Workload: Predict customer churn and surface next-best-action to sellers
          inside their CRM.
Industry: SaaS / B2B.
Primary users: 300 sellers via Dynamics 365 Sales.
Data sources: Dynamics 365, product telemetry (Event Hubs), support tickets.
Key capabilities (AI/ML):
  - Predict customer churn
  - Boost sales with insights
  - Personalize content per account
  - Visualize data for sales leaders
Non-functional requirements:
  - Region(s): East US 2
  - Compliance: SOC 2
  - Identity: Entra ID
  - Scale: nightly batch + on-demand inference
  - Budget tier: production
Out of scope: Marketing automation.
```

#### B5 — Vision-based quality control

```
Design an Azure architecture for the following workload.

Workload: Real-time defect detection on a packaging line with edge inference
          and central training.
Industry: Manufacturing.
Primary users: 4 plants, line operators + plant managers.
Data sources: 24 industrial cameras per plant, MES events.
Key capabilities (AI/ML):
  - Identify objects on the line
  - Detect anomalies / spot damage
  - Quality control & maintenance
  - Spot damage, predict failure (predictive maintenance)
Non-functional requirements:
  - Region(s): East US 2 (cloud) + on-prem edge per plant
  - Compliance: ISO 27001
  - Identity: Entra ID for cloud, local AD for OT
  - Scale: 30 fps per camera, ~700 cameras total
  - Budget tier: production
Out of scope: Worker safety analytics.
```

#### B6 — Multilingual voice contact center

```
Design an Azure architecture for the following workload.

Workload: Multilingual voice contact center that transcribes calls live,
          translates between agent and caller, and scores sentiment.
Industry: Travel.
Primary users: 200 agents in 3 countries, ~5K calls/day.
Data sources: SIP trunk, CRM (read/write), call recordings storage.
Key capabilities (AI/ML):
  - Convert speech to text
  - Translate speech instantly
  - Convert text into speech
  - Analyze emotion and sentiment in real time
  - Summarize text (post-call notes)
Non-functional requirements:
  - Region(s): West Europe + Southeast Asia
  - Compliance: GDPR; recording opt-in flow
  - Identity: Entra ID
  - Scale: 300 concurrent calls peak
  - Budget tier: production
Out of scope: Outbound dialing.
```

---

## Tier C — AIDC workshop variants

For use **inside** AI Discovery Cards workshops once participants have selected cards. The prompt is built from the cards they chose, so the resulting diagram visually validates their selection and surfaces the recommended Azure services.

### Template (paste after the card selection step)

```
Design an Azure architecture that delivers the following AI Discovery Cards
selected by the customer.

Customer: <name / industry / segment>
Business outcome (one sentence): <e.g., "reduce average handle time 30%">

AI Discovery Cards selected:
  - <Category> > <Card title>     (e.g., "Information Management > Retrieve information")
  - <Category> > <Card title>
  - <Category> > <Card title>
  - <Category> > <Card title>

Constraints from the room:
  - Region: <region>
  - Compliance: <list>
  - Identity: <Entra ID / B2C / hybrid>
  - Existing investments to reuse: <e.g., Fabric, D365 CE, SharePoint>
  - Time horizon: <PoC in 6 weeks / production in 6 months>

Please:
  1. Use the Microsoft services already recommended on the selected cards
     wherever possible.
  2. Group services by AIDC card category.
  3. Add only the supporting services that are necessary (identity, networking,
     storage, observability, key management).
  4. Provide a short narrative tying each service to the card it satisfies.
```

### Worked examples (mapped to card selections)

#### C1 — Insurance claims triage

**Cards selected:**
- Information Management > **Recognize and understand forms**
- Information Management > **Structure raw data**
- Data and predictive analytics > **Detect anomalies**
- Decision making > **Enhance decisions**
- Communication > **Automate answers**

```
Design an Azure architecture that delivers the following AI Discovery Cards
selected by the customer.

Customer: Mid-market P&C insurer, North America.
Business outcome: Cut first-notice-of-loss triage time from 24h to under 2h.

AI Discovery Cards selected:
  - Information Management > Recognize and understand forms
  - Information Management > Structure raw data
  - Data and predictive analytics > Detect anomalies
  - Decision making > Enhance decisions
  - Communication > Automate answers

Constraints from the room:
  - Region: East US 2 (primary), Canada Central (DR)
  - Compliance: SOC 2, state-level PII rules
  - Identity: Entra ID
  - Existing investments to reuse: Microsoft Fabric, D365 Customer Service
  - Time horizon: PoC in 8 weeks, production in 6 months

Please:
  1. Use the Microsoft services already recommended on the selected cards
     wherever possible.
  2. Group services by AIDC card category.
  3. Add only the supporting services that are necessary.
  4. Provide a short narrative tying each service to the card it satisfies.
```

#### C2 — Field-service technician copilot

**Cards selected:**
- Process optimization > **Streamline field service**
- Communication > **Engage in natural conversations**
- Information Management > **Retrieve information**
- Visual perception > **Analyse images**
- Speech recognition > **Convert speech to text**

```
Design an Azure architecture that delivers the following AI Discovery Cards
selected by the customer.

Customer: Industrial HVAC service provider, EMEA.
Business outcome: Resolve 25% more service calls on the first visit.

AI Discovery Cards selected:
  - Process optimization > Streamline field service
  - Communication > Engage in natural conversations
  - Information Management > Retrieve information
  - Visual perception > Analyse images
  - Speech recognition > Convert speech to text

Constraints from the room:
  - Region: West Europe
  - Compliance: GDPR
  - Identity: Entra ID
  - Existing investments to reuse: D365 Field Service, M365 Copilot licenses
  - Time horizon: pilot in 3 markets in Q3, expand in Q4

Please:
  1. Use the Microsoft services already recommended on the selected cards
     wherever possible.
  2. Group services by AIDC card category.
  3. Add only the supporting services that are necessary.
  4. Provide a short narrative tying each service to the card it satisfies.
```

#### C3 — Retail demand and pricing optimization

**Cards selected:**
- Data and predictive analytics > **Predict & plan demand**
- Process optimization > **Adjust pricing**
- Decision making > **Optimize strategy**
- Data and predictive analytics > **Visualize data**

```
Design an Azure architecture that delivers the following AI Discovery Cards
selected by the customer.

Customer: Specialty retail chain, ~400 stores.
Business outcome: Reduce stockouts 15% while protecting margin.

AI Discovery Cards selected:
  - Data and predictive analytics > Predict & plan demand
  - Process optimization > Adjust pricing
  - Decision making > Optimize strategy
  - Data and predictive analytics > Visualize data

Constraints from the room:
  - Region: East US 2
  - Compliance: PCI for the storefront only (out of scope here)
  - Identity: Entra ID
  - Existing investments to reuse: Microsoft Fabric, D365 F&O
  - Time horizon: pilot in 30 stores in Q3

Please:
  1. Use the Microsoft services already recommended on the selected cards
     wherever possible.
  2. Group services by AIDC card category.
  3. Add only the supporting services that are necessary.
  4. Provide a short narrative tying each service to the card it satisfies.
```

---

## Iteration prompts (good follow-ups for any tier)

After the first diagram appears, refine with prompts like:

- *"Add private endpoints and a hub-and-spoke VNet topology."*
- *"Swap App Service for Azure Container Apps."*
- *"Show me a dev/test variant that costs under $500/month."*
- *"Add observability: App Insights, Log Analytics, and a Workbook for token usage."*
- *"Add a multi-region active/passive DR posture with paired regions."*
- *"Replace the Search index with Azure AI Search hybrid + semantic ranking, and call out the indexer."*
- *"Run WAF validation and tell me the top 3 things to fix before production."*
- *"Estimate monthly cost in **<region>** for the **<small / medium / large>** tier."*

---

## Anti-patterns (what to avoid in prompts)

- **Don't** ask for "the best Azure architecture" with no scenario — the model will hedge and produce a generic stack.
- **Don't** list 15+ capabilities in one prompt — split into two diagrams (e.g., "ingest + train" and "serve + monitor").
- **Don't** mix unrelated industries in one prompt — the grounding cues conflict.
- **Don't** specify exact SKUs unless you mean it — let the diagram pick a sensible default, then refine.
