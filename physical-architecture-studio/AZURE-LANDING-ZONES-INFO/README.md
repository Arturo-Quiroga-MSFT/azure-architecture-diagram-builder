# Azure Landing Zones (ALZ) — alignment reference

Reference material for keeping the **Physical Architecture Studio** aligned with the
Cloud Adoption Framework (CAF) Azure landing zone architecture.

- Primary docs: <https://learn.microsoft.com/azure/cloud-adoption-framework/ready/landing-zone/?tabs=hubspoke>
- Accelerators / bootstrap: <https://azure.github.io/Azure-Landing-Zones/bootstrap/>
- Local copy of the reference architecture (diagrams, management groups):
  `enterprise-scale-architecture.pdf` — *not committed (git-ignored: large
  Microsoft-published PDF). Download it from the
  [CAF repo](https://github.com/MicrosoftDocs/cloud-adoption-framework/raw/main/docs/ready/enterprise-scale/media/enterprise-scale-architecture.pdf).*

---

## Where ALZ sits

```
Cloud Adoption Framework (CAF)
└── Ready
    └── Azure Landing Zones (ALZ)      ← a.k.a. "enterprise-scale"
```

"Enterprise-grade" architecture includes ALZ. ALZ is the standardized, opinionated
approach for running workloads on Azure at scale, built on **8 design areas**:

Azure billing & Microsoft Entra tenant · identity and access management ·
management group & subscription organization · network topology & connectivity ·
security · management · governance · platform automation & DevOps.

---

## Composition: one platform LZ + one or more application LZs

An Azure landing zone is **not** a single thing. It is:

| | Purpose | Owned by |
|---|---|---|
| **Platform landing zone** | Shared services consumed by every workload | Central platform team(s) |
| **Application landing zone** | Resources for **one** workload, per environment (dev/test/prod) | Workload team (or central, or shared) |

### Platform landing zone — 4 recommended subscriptions

| Subscription | Hosts |
|---|---|
| `management` | Log Analytics, automation, monitoring |
| `identity` | Domain controllers, Microsoft Entra Domain Services |
| `connectivity` | **Hub VNet, Azure Firewall, VPN/ExpressRoute gateways, private DNS** |
| `security` | Microsoft Sentinel, security tooling |

### Application landing zone

- One or more subscriptions, pre-provisioned by code through **subscription vending**.
- Nested under `Corp` / `Online` (or `Local`) management groups so they **inherit Azure Policy**.
- Three management approaches: central team · application team · shared (e.g. AKS, AVS).

---

## Network topologies (two supported options)

| Topology | Hub | Notes |
|---|---|---|
| **Hub & spoke** | Customer-managed hub VNet | Declare `AzureFirewallSubnet`, `GatewaySubnet` yourself |
| **Virtual WAN** | **Microsoft-managed** virtual hub | Do **not** declare those subnets; use Azure Firewall Manager (secured virtual hub) |

---

## Management group hierarchy

```
Tenant root
└── Intermediate root (e.g. "contoso")
    ├── Platform
    │   ├── Management
    │   ├── Identity
    │   ├── Connectivity
    │   └── Security
    ├── Landing zones
    │   ├── Corp     (internal, no direct public ingress)
    │   └── Online   (internet facing)
    ├── Sandbox
    └── Decommissioned
```

Policy inheritance flows down this hierarchy — which is why an application landing
zone's **archetype** (Corp vs Online) is a governance decision, not a cosmetic label.

---

## ⚠️ There is no separate "AI landing zone"

This is worth stating plainly because it is commonly misunderstood:

> Microsoft explicitly guides that you **do not need a dedicated AI landing zone**.
> AI workloads are deployed into ordinary **application landing zones**, governed by
> the same ALZ design areas as any other workload.

The "AI landing zone" repositories and reference architectures are **application
landing zone accelerators**, not a distinct landing zone type. The studio's golden
scenario is therefore *"an AI workload running in an application landing zone"*.

---

## Deployment & accelerators (IaC strongly preferred)

| Option | Link |
|---|---|
| ALZ IaC Accelerator (**recommended**) | <https://aka.ms/alz/accelerator> |
| AVM for Platform LZ — Terraform | <https://aka.ms/alz/acc/tf> |
| AVM for Platform LZ — Bicep | <https://aka.ms/alz/acc/bicep> |
| Portal accelerator (visual, less repeatable) | <https://aka.ms/alz/portal> |
| Application LZ accelerators | Azure Architecture Center → `landing-zones/landing-zone-deploy#application` |

Bootstrap requires `Owner` on the parent management group and on each of the four
platform subscriptions (Bicep additionally needs `User Access Administrator` at root `/`).

---

## How the Physical Architecture Studio maps to ALZ

| ALZ concept | Studio manifest |
|---|---|
| Platform vs application LZ | `landingZones[].kind` = `platform` \| `application` |
| Platform subscriptions | `landingZones[].platformSubscription` = `management` \| `identity` \| `connectivity` \| `security` |
| Corp / Online archetype | `landingZones[].archetype` |
| Management group hierarchy | `managementGroups` (intermediate root, platform, landing zones, sandbox, decommissioned) |
| Hub & spoke vs Virtual WAN | `networkTopology` = `hubSpoke` \| `virtualWan` |
| Hub connectivity resources | `landingZones[].firewall`, `.gateway`, `AzureFirewallSubnet`, `GatewaySubnet` |
| Workload + private endpoints | Application LZ `services[]`, `privateEndpoints[]`, private DNS zones |
| AVM-based IaC | Bicep `br/public:avm/res/network/*`, Terraform `Azure/avm-res-network-*` |

### Automated conformance checks

`core/validation/alz.ts` deterministically checks a manifest against these rules and
reports them in the UI validation rail as `ALZ n/n · hub & spoke`:

| Code | Meaning |
|---|---|
| `ALZ_NO_PLATFORM_LZ` | No platform landing zone (error) |
| `ALZ_NO_APPLICATION_LZ` | No application landing zone (error) |
| `ALZ_NO_CONNECTIVITY_SUB` | No connectivity subscription hosting the hub |
| `ALZ_HUB_NO_FIREWALL_SUBNET` | Hub & spoke hub is missing `AzureFirewallSubnet` |
| `ALZ_HUB_NO_GATEWAY_SUBNET` | Hub & spoke hub is missing `GatewaySubnet` |
| `ALZ_VWAN_MANAGED_HUB` | Virtual WAN topology declares Microsoft-managed subnets |
| `ALZ_NO_ARCHETYPE` | Application LZ has no Corp/Online archetype |
| `ALZ_PE_IN_PLATFORM` | Workload private endpoints placed in the platform LZ |
| `ALZ_NO_MGMT_GROUPS` | No management group hierarchy declared |
| `ALZ_OBSERVABILITY_IN_APP_LZ` | Log Analytics / Azure Monitor sit in an application LZ instead of the management platform subscription |

---

## Generated artifacts

| Artifact | Scope | Notes |
|---|---|---|
| `main.bicep` / `main.tf` | Resource group | Networking, private endpoints, DNS. Emits **Virtual WAN** resources when `networkTopology: virtualWan`, otherwise hub & spoke |
| `managementGroups.bicep` | **Tenant** | ALZ management group hierarchy. Deploy with `az deployment tenant create` |
| `managementGroups.tf` | Subscription/tenant | Same hierarchy as `azurerm_management_group` |
| `ip-plan.csv` | — | Auditable address plan |

All Bicep artifacts are verified locally with `az bicep build` (hub & spoke,
Virtual WAN, and tenant-scoped management groups all compile).

---

## Known gaps / roadmap

- **Subscription vending** is not emitted. Application landing zone subscriptions
  are assumed to exist; production should use the
  [subscription vending](https://azure.github.io/Azure-Landing-Zones/sub-vending/)
  modules.
- **Azure Policy assignments** are not emitted. The management group hierarchy is
  created, but the ALZ policy set should come from the
  [ALZ IaC Accelerator](https://aka.ms/alz/accelerator) / AVM platform modules.
- The `identity` and `security` platform subscriptions appear in the management
  group hierarchy but do not yet carry resources; `connectivity` (hub) and
  `management` (observability) do.
- Policy/sovereign profiles remain **preview guidance**, not official certification.
