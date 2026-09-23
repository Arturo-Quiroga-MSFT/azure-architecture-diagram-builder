---
title: "Cloud Solution Architect Artifacts Research"
description: "Vendor-agnostic research on official cloud solution architect deliverables, diagrams, and decision documents"
author: "Arturo Quiroga"
ms.date: 2025-03-25
ms.topic: overview
keywords:
  - cloud architecture
  - solution architect artifacts
  - architecture diagrams
  - ADR
  - IaC
  - well-architected framework
---

## Purpose

This directory collects vendor-agnostic research on what constitutes
**official cloud solution architect artifacts** — the documented deliverables,
diagrams, and decisions produced during the design, planning, and
implementation of cloud solutions.

The goal is to establish a clear taxonomy of architect outputs that transcends
any single cloud provider, drawing from frameworks such as the
AWS Well-Architected Framework, Microsoft Azure Well-Architected Framework,
and Google Cloud Architecture Framework.

## Artifact Taxonomy

Cloud architect artifacts generally fall into four categories:

1. **Architectural Diagrams** — visual representations of system design
2. **Design & Decision Documents** — written rationale and requirements
3. **Implementation & Operational Artifacts** — executable infrastructure and
   runbooks
4. **Framework-Specific Resources** — provider-native templates and blueprints

---

## 1 — Architectural Diagrams (Visual Artifacts)

| Artifact | Description |
|---|---|
| **High-Level Architecture Diagram (HLD)** | Conceptual view showing generic component types (load balancers, VMs, databases) and their interactions without naming specific services or configurations. |
| **Solution / Reference Architecture Diagram** | Named cloud services organized into logical groups with annotated data flows and interaction descriptions. Sits between HLD and LLD: more specific than a concept sketch, less granular than a network-level design. This is the most common deliverable a Cloud Solution Architect produces. |
| **Low-Level Design Diagram (LLD)** | Detailed illustration of networking (subnets, NSGs, CIDRs), specific service SKUs/tiers, port mappings, and infrastructure-level data flows. |
| **Network Topology Diagram** | Maps VPCs / VNets, subnets, routing tables, and connectivity (VPN, ExpressRoute, Interconnect). |
| **Security Architecture Diagram** | Visualizes firewalls, IAM roles, encryption boundaries, and traffic-flow security. |
| **Data Flow Diagram** | Shows how data moves through the system from ingestion to storage and consumption. |

## 2 — Design and Decision Documents

| Artifact | Description |
|---|---|
| **Architecture Decision Records (ADRs)** | Capture significant architectural decisions, their context, and consequences. |
| **Cloud Adoption Framework (CAF) Documents** | Landing-zone designs, governance models, and security foundations. |
| **Well-Architected Review Report** | Assessment against the core pillars (operational excellence, security, reliability, performance, cost, sustainability). |
| **Functional & Non-Functional Requirements (NFR) Document** | Outlines performance targets, uptime (SLA), security compliance, and scalability needs. |
| **Disaster Recovery (DR) Plan** | Defines RPO (Recovery Point Objective) and RTO (Recovery Time Objective) strategies. |

## 3 — Implementation and Operational Artifacts

| Artifact | Description |
|---|---|
| **Infrastructure as Code (IaC) Templates** | Terraform modules, ARM / Bicep templates, CloudFormation stacks, or Ansible playbooks that define infrastructure declaratively. |
| **CI/CD Pipeline Configurations** | Jenkinsfiles, GitHub Actions, Azure DevOps pipelines, or Cloud Build configs that deploy infrastructure and applications. |
| **Cost Modeling Document** | Forecast of expected monthly/yearly spending based on service consumption rates. |
| **Operational Procedures / Runbooks** | Documentation for maintenance, monitoring, and incident response. |

## 4 — Common Framework Resources

| Provider / Platform | Key Resources |
|---|---|
| **Google Cloud** | Enterprise foundations blueprint, deployment archetypes (zonal, regional, global), Well-Architected Framework. |
| **Microsoft Azure** | Solution Architecture Questions (SAQ), Well-Architected pillars, Azure Academy templates. |
| **AWS** | Well-Architected Tool reviews, Landing Zone accelerators, Service Control Policies. |
| **Salesforce** | Architect Diagrams, Data 360 provisioning guides. |

## Storage and Governance

These artifacts are typically stored in:

- **Git repositories** — version-controlled source of truth
- **Documentation systems** — Confluence, SharePoint, Notion
- **Native cloud storage** — Azure Artifacts, AWS CodeArtifact, GCS buckets

Version control and access policies ensure traceability and collaboration
across teams.

---

## Azure Architecture Diagram Builder — Artifact Mapping

The following table maps each output of the
**Azure Architecture Diagram Builder** app to its corresponding official CSA
artifact category. This mapping helps PSAs and CSAs position the app's value
in architecture engagements by showing that a single generation pass produces
multiple recognized deliverables, not only a diagram.

### Category 1 — Architectural Diagrams (Visual Artifacts)

| App Feature | CSA Artifact | Notes |
|---|---|---|
| **AI-generated diagram** (canvas with grouped Azure services, annotated connectors, and data-flow labels) | **Solution / Reference Architecture Diagram** | Named services organized into logical groups (Identity & Access, Application & AI, Data & Storage, Monitoring & Observability) with interaction annotations. Sits between HLD and LLD. |
| **Architecture Workflow panel** (numbered steps describing how requests traverse the system) | **Data Flow Diagram** (narrative form) | Structured step-by-step description of data movement and service interactions, with affected services listed per step. |
| **Export to Draw.io** (`.drawio` XML) | **Solution / Reference Architecture Diagram** (editable) | Portable format for collaborative editing in diagrams.net. |
| **Export to PowerPoint** (`.pptx` single-slide) | **Solution / Reference Architecture Diagram** (presentation) | Stakeholder-ready slide preserving layout, icons, and colour mode. |
| **Export to interactive HTML** | **Solution / Reference Architecture Diagram** (shareable) | Self-contained, browser-viewable diagram for teams without tooling. |
| **Narrate** (avatar-driven audio walkthrough) | **Data Flow Diagram** (audio presentation) | Spoken narration of the Architecture Workflow for live demos or recorded walkthroughs. |

### Category 2 — Design and Decision Documents

| App Feature | CSA Artifact | Notes |
|---|---|---|
| **Validate Architecture** (five-pillar scoring with issue / recommendation / affected-services) | **Well-Architected Review Report** | Automated assessment against Reliability, Security, Cost Optimization, Operational Excellence, and Performance Efficiency. Combines local WAF rule detection with AI refinement. Produces an overall score (0-100) and per-pillar scores with severity-graded findings. |
| **Compare Validation** (side-by-side validation comparison) | **Architecture Decision Record (ADR)** (lightweight) | Enables comparison of alternative designs or model outputs so teams can document which approach scored higher and why. |
| **Compare Models** (same prompt, multiple LLMs) | **Architecture Decision Record (ADR)** (model selection) | Generates the same architecture across different AI models to evaluate quality trade-offs, providing a documented basis for model selection decisions. |
| **Snapshot / Version History** | **Architecture Decision Record (ADR)** (versioned) | Each snapshot captures the diagram state plus notes, creating a chronological trail of design evolution. |

### Category 3 — Implementation and Operational Artifacts

| App Feature | CSA Artifact | Notes |
|---|---|---|
| **Regional cost estimate** (`$XXX.XX/mo` in toolbar) | **Cost Modeling Document** | Real-time monthly cost estimate based on Azure Retail Pricing API with per-service breakdown and region-aware pricing (supports 8+ regions). |
| **Deployment Guide** (step-by-step Azure CLI commands + Bicep modules) | **Operational Procedures / Runbook** + **IaC Templates** | AI-generated guide containing deployment steps, Bicep module code, and configuration settings. Bridges the gap from diagram to deployment. |
| **Import IaC** (ARM, Bicep, Terraform HCL, Terraform state) | **IaC Templates** (reverse-engineered) | Converts existing infrastructure definitions into a visual diagram — enabling architecture documentation of already-deployed resources. |
| **Export as AzPrototype** (JSON manifest) | **IaC Templates** (intermediate representation) | Machine-readable manifest containing services, connections, groups, workflow steps, cost estimates, and project config. Serves as a portable architecture definition. |

### Artifacts per generation pass

A single "Generate with AI" action produces up to **six** recognized CSA
artifacts simultaneously:

1. Solution / Reference Architecture Diagram (canvas)
2. Data Flow Diagram narrative (Architecture Workflow panel)
3. Cost Modeling Document (regional pricing estimate)
4. Well-Architected Review Report (via Validate Architecture)
5. IaC Templates + Runbook (via Deployment Guide)
6. ADR trail (via Snapshot history)

This multi-artifact output positions the app as an **architecture accelerator**
rather than a simple diagramming tool — it compresses what traditionally
requires multiple specialized tools and manual effort into a single,
AI-assisted workflow.

---

## Research Backlog

Planned sub-topics for deeper investigation:

- [ ] Comparative matrix of Well-Architected pillars across AWS, Azure, and GCP
- [ ] ADR templates and tooling (e.g., adr-tools, Log4brains)
- [ ] IaC maturity model — from ad-hoc scripts to policy-as-code
- [ ] Mapping artifacts to architecture review checkpoints
- [ ] Role of cost modeling artifacts in FinOps workflows
- [ ] Security architecture artifact standards (NIST, CIS, CSA CCM)

## Sources

- Google Cloud Architecture Framework
- Microsoft Azure Well-Architected Framework
- AWS Well-Architected Framework
- DEV Community — cloud architecture artifact discussions
- YouTube — solution architect walkthrough videos
