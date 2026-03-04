---
title: Azure Architecture Diagram Builder, Getting Started Guide
description: Step-by-step walkthrough of every feature in the Azure Architecture Diagram Builder, designed for new users and team leads evaluating the tool
author: Arturo Quiroga
ms.date: 2026-03-04
ms.topic: tutorial
keywords:
  - azure architecture
  - diagram builder
  - getting started
  - AI-powered design
  - cloud architecture
estimated_reading_time: 12
---

<!-- markdownlint-disable-file -->

# Azure Architecture Diagram Builder: Getting Started Guide

**Author:** Arturo Quiroga, Senior Partner Solutions Architect, Microsoft
**Live App:** [https://aka.ms/diagram-builder](https://aka.ms/diagram-builder)

---

## What Is It?

The Azure Architecture Diagram Builder is a web application that lets you design, validate, and deploy Azure cloud architectures. You describe what you need in plain English, and one of six AI models generates a professional diagram with official Azure icons, logical groupings, data-flow connections, real-time cost estimates, and Infrastructure as Code templates.

No installs required. Open the link in any modern browser and start building.

---

## Step 1: Open the App and Orient Yourself

Navigate to [https://aka.ms/diagram-builder](https://aka.ms/diagram-builder). You will see three main areas:

| Area | Location | Purpose |
|------|----------|---------|
| Toolbar | Top (two rows) | All primary actions: generate, validate, export, model selection, region, layout |
| Icon Palette | Left sidebar | 714 official Azure service icons organized by category, with search and drag-and-drop |
| Canvas | Center | Your working diagram area with grid snapping, minimap, and zoom controls |

> [!TIP]
> Toggle dark mode with the sun/moon button (☀️/🌙) in the toolbar. Your preference is saved across sessions.

---

## Step 2: Generate Your First Architecture with AI

1. Click the **"Generate with AI"** button in the toolbar.
2. A modal opens with a text area. Type a description of the architecture you want, for example:

   > "Design a three-tier web application with a React frontend on Azure Static Web Apps, a Node.js API on Azure Functions, and a Cosmos DB database. Include Application Insights for monitoring and Azure Front Door for global load balancing."

3. Alternatively, browse the **13 curated sample prompts** organized by category (click any prompt to populate the text area):
   - Web & Microservices
   - Security & Networking
   - AI & Cognitive
   - E-commerce
   - Healthcare
   - Data & Analytics
   - IoT

4. Click **Generate**. The AI creates your diagram in seconds.

After generation, the canvas displays:

- Service nodes with official Azure icons and cost badges
- Logical groups (Frontend, Backend, Data, Security, Monitoring)
- Labeled connections showing data flow
- A workflow panel on the right side describing the architecture step by step
- A model badge showing which AI model was used and how long it took

> [!NOTE]
> The active model and reasoning effort level are shown in the modal footer. You can change them in the toolbar's AI Model settings (covered in Step 9).

---

## Step 3: Explore Alternate Starting Points

Beyond typing a prompt, there are two additional ways to create a diagram.

### Import from an Image

1. Inside the "Generate with AI" modal, use the image upload area (drag-and-drop or click to browse).
2. Upload a screenshot, whiteboard photo, or exported PNG of an existing architecture.
3. The AI analyzes the image using vision capabilities, identifies the services, and populates the description field.
4. Click **Generate** to produce an editable, interactive diagram.

A floating reference image viewer appears on the canvas so you can compare the original image with the generated diagram.

### Import from Infrastructure as Code

1. Click the **"Import Template"** button in the toolbar.
2. Select one or more files. Supported formats:
   - ARM templates (`.json`)
   - Bicep files (`.bicep`)
   - Terraform configurations (`.tf`)
   - Terraform state files (`.tfstate`)
3. The AI parses resource definitions and dependencies, then generates a visual diagram.
4. A loading banner appears on the canvas while parsing completes.

---

## Step 4: Interact with the Canvas

Your diagram is fully interactive. Here are the key actions:

### Nodes (Service Icons)

- Double-click a node label to rename it inline.
- Drag nodes to reposition them freely (snaps to a 20×20 grid).
- Drop a node inside a group to auto-parent it.
- Select a node and press **Delete** to remove it (connected edges are also removed).
- Select a node and press **Ctrl+D** (or **Cmd+D** on Mac) to duplicate it.
- Each node shows a left color bar indicating its service category (blue for compute, green for databases, orange for AI, and so on).

### Groups

- Double-click a group header to rename it.
- Drag the resize handles to adjust group boundaries.
- Click the palette button on a group to change its color (10 presets available).
- Click the fit-to-content button to auto-shrink the group around its children.
- Use the **Collapse All Groups** toolbar button for a bird's-eye summary, then expand to restore.

### Connections (Edges)

- Double-click an edge label to edit it.
- Drag edge labels to reposition them along the path.
- Right-click an edge to change direction (one-way forward, reverse, or bidirectional).
- Connections animate with flow dots showing data direction.

### Alignment Tools

Select two or more nodes and an alignment toolbar appears, offering:

- Align left, center, right, top, middle, bottom
- Distribute evenly (horizontal or vertical spacing)

---

## Step 5: Review Cost Estimates

Every service node shows a cost badge with the estimated monthly price. Costs are color-coded:

| Color | Meaning |
|-------|---------|
| Green | Lower cost tier |
| Orange | Moderate cost |
| Red | Higher cost tier |

A usage-based pricing indicator (⚡) appears on consumption services like Azure Functions or Logic Apps.

### Change the Pricing Region

Use the **Region Selector** dropdown in the toolbar to switch between five Azure regions:

- 🇺🇸 East US 2 (Virginia)
- 🇨🇦 Canada Central (Toronto)
- 🇧🇷 Brazil South (São Paulo)
- 🇳🇱 West Europe (Netherlands)
- 🇸🇪 Sweden Central (Gävle)

Changing the region recalculates all pricing in real time. The total estimated monthly cost is shown in the toolbar as a 💰 badge.

### Export Cost Data

Use **Export > Export Costs** to download a CSV file with per-service pricing details. Open it in Excel for further analysis.

---

## Step 6: Validate Against the Well-Architected Framework

1. Click **"Validate Architecture"** in the toolbar.
2. The system evaluates your architecture against all five WAF pillars:
   - Security
   - Reliability
   - Performance Efficiency
   - Cost Optimization
   - Operational Excellence
3. Each pillar receives a score (0-100), and the overall score is displayed with a color-coded indicator.
4. Findings are listed by severity (critical, high, medium, low), each with a specific recommendation.
5. Select the findings you want to act on using the checkboxes.
6. Click **Apply Recommendations** to regenerate an improved architecture that incorporates the selected changes (for example, adding a private endpoint, enabling multi-region failover, or introducing a WAF gateway).
7. Download the validation report as a markdown file with an embedded diagram snapshot.

---

## Step 7: Generate a Deployment Guide with Bicep Templates

1. Click **"Deployment Guide"** in the toolbar.
2. The AI generates a comprehensive document containing:
   - Prerequisites and Azure resource requirements
   - Step-by-step deployment instructions with CLI commands (copy-to-clipboard supported)
   - Configuration tables (setting name, value, description)
   - Individual Bicep templates for each service module, with syntax-highlighted previews
3. Click **Download All Bicep** to get every template in a single bundle.
4. Click **Download Guide** to export the full guide as a markdown file.

---

## Step 8: Compare AI Models Side by Side

Two comparison modes let you evaluate which model produces the best results for your scenario.

### Architecture Comparison

1. Click **"Compare Models"** in the toolbar.
2. Select two or more models from the six available options.
3. Enter your architecture prompt and click **Compare**.
4. All selected models run in parallel. Results appear side by side showing:
   - Service count, connection count, group count, workflow steps
   - Token usage and elapsed time
5. Click **Apply** on the result you prefer to load that architecture onto the canvas.
6. Use **Save All Diagrams** to download each result as an individual JSON file.
7. Use **Save Comparison Report** to download a combined analysis.

### Validation Comparison

1. Click **"Compare Validation"** in the toolbar (requires an existing diagram on the canvas).
2. Select models and run WAF validation across all of them in parallel.
3. Compare overall scores, pillar breakdowns, severity distributions, and quick wins.
4. Apply any result to view its full details.

---

## Step 9: Configure AI Model Settings

Click the **AI Model** dropdown in the toolbar to open the settings popover.

- Choose a global model from six options: GPT-5.1, GPT-5.2, GPT-5.2 Codex, GPT-5.3 Codex, DeepSeek V3.2 Speciale, or Grok 4.1 Fast.
- Set reasoning effort (none, low, medium, high) for models that support it.
- Override the model independently for three features:
  - Architecture Generation
  - Architecture Validation
  - Deployment Guide & Bicep
- Reset all overrides with a single button.

Settings persist across browser sessions.

---

## Step 10: Visualize the Workflow

When the AI generates an architecture, a **Workflow Panel** appears on the right side of the canvas. Each numbered step describes how data flows through the system.

- Hover over any step to highlight the associated service nodes on the canvas with a pulsing glow.
- Use this to walk stakeholders through the architecture during presentations.

> [!TIP]
> Click the **Focus** button in the toolbar to collapse both sidebars and the legend, maximizing the canvas area for demos and screen sharing.

---

## Step 11: Save, Restore, and Share

### Manual Snapshots

1. Click the **Camera** button to save a named snapshot with optional notes.
2. Click the **Clock** button to browse version history.
3. From version history you can:
   - Restore any previous version to the canvas
   - Open a version in a new browser tab (shareable URL)
   - Copy the diagram JSON to the clipboard
   - Delete old versions

### Auto-Snapshots

A checkbox inside the "Generate with AI" modal enables automatic snapshots before every AI regeneration (on by default). This gives you a safety net to undo any AI-generated change.

### Save and Load Files

- Use the **Save** button to download the current diagram as a JSON file.
- Use the **Load** button to restore a diagram from a previously saved JSON file.

---

## Step 12: Export Your Diagram

Click the **Export** dropdown to choose a format:

| Format | Best For |
|--------|----------|
| PNG | Documentation, presentations, email attachments |
| SVG | Scalable graphics for web pages or wikis |
| Draw.io | Further editing in diagrams.net |
| JSON | Backup, version control, sharing with teammates |
| CSV | Cost analysis in Excel or other spreadsheet tools |

The Export menu also shows your six most recent exports with timestamps for quick re-downloads.

---

## Step 13: Customize the Layout

Click the **Layout** dropdown in the toolbar to access:

| Setting | Options |
|---------|---------|
| Preset | Flow (Left→Right), Flow (Top→Bottom), Swimlanes by Group, Radial |
| Engine | Dagre, ELK |
| Spacing | Compact, Comfortable |
| Edge style | Straight, Smooth (Bézier), Orthogonal (step) |

Click **Apply Layout** to recalculate all node positions. The current settings summary is always visible at the bottom of the menu.

---

## Step 14: Use the Icon Palette for Manual Design

The left sidebar contains 714 official Azure service icons across 29 categories (AI + Machine Learning, Compute, Databases, Networking, Security, Storage, and more).

1. Expand a category or use the search box to find a service.
2. Drag an icon from the palette onto the canvas.
3. The node appears with its official icon, category color, and real-time pricing.
4. Drop it inside an existing group to auto-parent it.

You can combine AI-generated diagrams with manual additions: generate a baseline with AI, then drag additional services onto the canvas to customize.

---

## Step 15: Present Your Architecture

Switch to **Presentation** style (toolbar **Style** dropdown > Presentation) for stakeholder-ready visuals:

- Bolder connection lines (2.5px)
- Larger fonts
- Higher-contrast backgrounds

The **Title Block** (bottom-left) shows the architecture name, author, version, and date. Click it to edit these fields. Drag it to reposition.

The **Legend** (bottom-right) explains connection types, flow animations, and cost indicators. Collapse it when not needed.

Both the title block and legend are included in PNG and SVG exports.

---

## Quick Reference: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Delete / Backspace | Remove selected nodes and edges |
| Ctrl+D / Cmd+D | Duplicate selected nodes |
| Escape | Close any open dropdown |

---

## Summary of the End-to-End Workflow

```text
Describe → Generate → Review costs → Validate (WAF) → Apply recommendations →
Generate deployment guide → Export diagram + Bicep templates → Deploy to Azure
```

Every step in this chain is available from a single browser tab with no additional tooling. Go from an idea to a deployable, validated, costed Azure architecture in minutes.

---

**Questions or feedback?** Open an issue on the [GitHub repository](https://github.com/Arturo-Quiroga-MSFT/azure-architecture-diagram-builder) or reach out to Arturo Quiroga directly.
