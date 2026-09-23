# Model Comparison Report

**Generated:** 2026-03-12T22:35:44.154Z

**Prompt:** A zero trust enterprise network with Azure Firewall, Application Gateway with WAF, Private Link for PaaS, Bastion for VM access, and Microsoft Entra ID with Conditional Access

**Reasoning Effort:** low

**Models Compared:** 7 successful

## Summary

| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |
|-------|------|--------|----------|-------------|--------|----------------|
| **GPT-5.1** 📦 Most Services | 27.1s | 4,891 | 12 | 12 | 5 | 8 |
| **GPT-5.2** 🔗 Most Detailed | 82.5s | 4,907 | 11 | 14 | 5 | 7 |
| **GPT-5.2 Codex** | 25.9s | 3,207 | 10 | 11 | 4 | 7 |
| **GPT-5.3 Codex** | 38.5s | 4,253 | 11 | 12 | 4 | 8 |
| **GPT-5.4** 🏆 Most Thorough 📦 Most Services | 99.5s | 4,548 | 12 | 13 | 5 | 9 |
| **DeepSeek V3.2 Speciale** 💰 Cheapest | 92.4s | 2,956 | 11 | 11 | 5 | 5 |
| **Grok 4.1 Fast** ⚡ Fastest | 15.9s | 2,986 | 9 | 12 | 5 | 10 |

## Token Usage

| Model | Prompt Tokens | Completion Tokens | Total |
|-------|--------------|-------------------|-------|
| GPT-5.1 | 1,429 | 3,462 | 4,891 |
| GPT-5.2 | 1,429 | 3,478 | 4,907 |
| GPT-5.2 Codex | 1,429 | 1,778 | 3,207 |
| GPT-5.3 Codex | 1,429 | 2,824 | 4,253 |
| GPT-5.4 | 1,429 | 3,119 | 4,548 |
| DeepSeek V3.2 Speciale | 1,456 | 1,500 | 2,956 |
| Grok 4.1 Fast | 1,402 | 1,584 | 2,986 |

## Architecture Details

### GPT-5.1

**Services:**

| Service | Type | Group |
|---------|------|-------|
| VPN Gateway | VPN Gateway | grp-ingress-edge |
| Azure Firewall | Azure Firewall | grp-ingress-edge |
| Application Gateway | Application Gateway | grp-ingress-edge |
| Web Application Firewall | Web Application Firewall | grp-ingress-edge |
| Azure Private Link | Azure Private Link | grp-ingress-edge |
| Virtual Network | Virtual Network | grp-app-compute |
| Virtual Machines | Virtual Machines | grp-app-compute |
| Azure Bastion | Azure Bastion | grp-app-compute |
| Storage Account | Storage Account | grp-data-storage |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity-security |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress and Network Edge, Application and Compute, Data and PaaS over Private Link, Identity and Zero Trust Policies, Monitoring and Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-vpn-gateway | svc-azure-firewall | Tunnel remote and site-to-site enterprise traffic through Azure Firewall for inspection | sync |
| svc-app-gateway | svc-azure-firewall | Forward internet-facing web traffic from Application Gateway to Azure Firewall for network policy enforcement | sync |
| svc-waf | svc-app-gateway | Apply WAF policies to inspect and block malicious HTTP(S) requests on Application Gateway listeners | sync |
| svc-azure-firewall | svc-virtual-network | Route allowed and filtered traffic from firewall into the hub virtual network | sync |
| svc-virtual-network | svc-virtual-machines | Deliver segmented and filtered network traffic to application virtual machines | sync |
| svc-bastion | svc-virtual-machines | Provide browser-based RDP/SSH administration to VMs without exposing public IPs | sync |
| svc-virtual-network | svc-private-link | Create private endpoints within subnets for secure PaaS connectivity | sync |
| svc-private-link | svc-storage-account | Expose storage account via private IP reachable only from authorized virtual network subnets | sync |
| svc-entra-id | svc-bastion | Enforce Conditional Access and MFA for administrator sign-in to Bastion-hosted sessions | sync |
| svc-entra-id | svc-app-gateway | Authenticate users and apply Conditional Access before granting access to applications fronted by Application Gateway | sync |
| svc-virtual-machines | svc-azure-monitor | Send VM performance, security, and connection telemetry to Azure Monitor | async |
| svc-azure-monitor | svc-log-analytics | Ingest and store collected metrics and logs into Log Analytics workspace for analysis | async |

**Workflow:**

1. Remote and site-to-site users establish secure VPN tunnels, and traffic is directed to Azure Firewall for initial zero trust inspection. _(svc-vpn-gateway, svc-azure-firewall)_
2. Internet users access web applications through Application Gateway, where WAF policies inspect HTTP(S) requests before forwarding traffic toward the firewall. _(svc-app-gateway, svc-waf, svc-azure-firewall)_
3. Azure Firewall evaluates network rules and threat intelligence, then routes only permitted traffic into the hub Virtual Network. _(svc-azure-firewall, svc-virtual-network)_
4. The Virtual Network delivers segmented and filtered traffic to application Virtual Machines in protected subnets. _(svc-virtual-network, svc-virtual-machines)_
5. Administrators connect via Azure Bastion using Entra ID identities and Conditional Access, then securely administer Virtual Machines without public exposure. _(svc-entra-id, svc-bastion, svc-virtual-machines)_
6. Applications running on Virtual Machines access PaaS resources through Private Link endpoints within the Virtual Network, reaching the Storage Account over private IP only. _(svc-virtual-network, svc-private-link, svc-storage-account)_
7. Microsoft Entra ID authenticates end users accessing applications via Application Gateway and enforces Conditional Access policies such as MFA and compliant device checks. _(svc-entra-id, svc-app-gateway)_
8. Virtual Machines emit performance and security telemetry to Azure Monitor, which then forwards logs and metrics into Log Analytics for centralized monitoring and threat investigations. _(svc-virtual-machines, svc-azure-monitor, svc-log-analytics)_

---

### GPT-5.2

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Application Gateway | Application Gateway | grp-ingress-edge |
| Web Application Firewall | Web Application Firewall | grp-ingress-edge |
| Virtual Network | Virtual Network | grp-app-compute |
| Azure Firewall | Azure Firewall | grp-app-compute |
| Azure Bastion | Azure Bastion | grp-app-compute |
| Virtual Machines | Virtual Machines | grp-app-compute |
| Azure Private Link | Azure Private Link | grp-data-paas |
| SQL Database | SQL Database | grp-data-paas |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity-security |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress / Edge, Application / Compute (Zero Trust Network), Data / PaaS (Private Access), Identity & Access, Monitoring / Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-appgw | svc-waf | Apply WAF policies and block malicious HTTP(S) requests before forwarding | sync |
| svc-appgw | svc-vnet | Route approved application traffic to private backend IPs in workload subnets | sync |
| svc-vnet | svc-firewall | Force egress and inter-subnet flows through firewall using UDRs and segmentation | sync |
| svc-firewall | svc-vm | Allow only required ports and destinations to workload VMs based on policy | sync |
| svc-firewall | svc-privatelink | Permit outbound access only to approved private endpoints for PaaS resources | sync |
| svc-vm | svc-privatelink | Access PaaS resources via private endpoint DNS resolution and private routing | sync |
| svc-privatelink | svc-sql | Terminate private endpoint connectivity to SQL Database without public exposure | sync |
| svc-bastion | svc-vnet | Provide in-VNet jump connectivity from AzureBastionSubnet without public IPs on VMs | sync |
| svc-bastion | svc-vm | Establish secure RDP/SSH sessions to private VM addresses over TLS | sync |
| svc-appgw | svc-entra | Enforce user authentication and Conditional Access before granting app access | sync |
| svc-bastion | svc-entra | Authenticate administrators with Entra ID and Conditional Access for Bastion access | sync |
| svc-vm | svc-entra | Use Entra ID-based VM sign-in and token validation for privileged administration | sync |
| svc-vm | svc-azmonitor | Send guest OS logs and metrics using Azure Monitor agent for centralized visibility | sync |
| svc-azmonitor | svc-loganalytics | Ingest collected telemetry into Log Analytics workspace for querying and alerting | sync |

**Workflow:**

1. Inbound application requests reach Application Gateway and are inspected by WAF policies. _(svc-appgw, svc-waf)_
2. Application Gateway routes approved traffic to private backends hosted in the Virtual Network. _(svc-appgw, svc-vnet, svc-vm)_
3. Network segmentation and forced routing send relevant flows through Azure Firewall for policy enforcement. _(svc-vnet, svc-firewall, svc-vm)_
4. Admins access VMs through Azure Bastion without exposing VM public IPs. _(svc-bastion, svc-vnet, svc-vm)_
5. User and admin access is authenticated and governed by Microsoft Entra ID Conditional Access. _(svc-entra, svc-appgw, svc-bastion)_
6. Workloads connect to SQL Database privately via Azure Private Link, with firewall policies restricting allowed private endpoints. _(svc-vm, svc-firewall, svc-privatelink, svc-sql)_
7. VM telemetry is collected through Azure Monitor and centralized in Log Analytics for investigation and alerting. _(svc-vm, svc-azmonitor, svc-loganalytics)_

---

### GPT-5.2 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Application Gateway | Application Gateway | grp-edge |
| Web Application Firewall | Web Application Firewall | grp-edge |
| Azure Firewall | Azure Firewall | grp-core |
| Virtual Network | Virtual Network | grp-core |
| Azure Bastion | Azure Bastion | grp-core |
| Azure Private Link | Azure Private Link | grp-core |
| Virtual Machines | Virtual Machines | grp-core |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress / Edge, Network & Compute, Identity & Access, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-appgw | svc-waf | Apply WAF rules to inbound HTTP/S requests | sync |
| svc-appgw | svc-firewall | Forward inspected ingress traffic for centralized filtering | sync |
| svc-firewall | svc-vnet | Permit or deny traffic into segmented subnets | sync |
| svc-vnet | svc-vm | Route approved traffic to workload VMs | sync |
| svc-bastion | svc-vnet | Establish private management session into VNet | sync |
| svc-bastion | svc-vm | Provide secure RDP/SSH without public exposure | sync |
| svc-pl | svc-vnet | Attach private endpoints for PaaS access | sync |
| svc-entra | svc-appgw | Enforce Conditional Access for user ingress | sync |
| svc-entra | svc-bastion | Require MFA for admin session access | sync |
| svc-vm | svc-azmon | Send VM metrics and logs for monitoring | sync |
| svc-azmon | svc-log | Ingest telemetry into Log Analytics workspace | sync |

**Workflow:**

1. Users access applications through the edge gateway protected by WAF policies _(svc-appgw, svc-waf)_
2. Conditional Access is evaluated before requests are allowed to proceed _(svc-entra, svc-appgw)_
3. Approved traffic is routed to Azure Firewall for centralized inspection _(svc-appgw, svc-firewall)_
4. Firewall policies control traffic into segmented VNet subnets _(svc-firewall, svc-vnet)_
5. Workloads receive traffic within the VNet according to subnet rules _(svc-vnet, svc-vm)_
6. Admins connect to VMs via Bastion with MFA enforcement _(svc-entra, svc-bastion, svc-vm)_
7. VM telemetry is collected and centralized for analytics _(svc-vm, svc-azmon, svc-log)_

---

### GPT-5.3 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Application Gateway | Application Gateway | grp-edge |
| Web Application Firewall | Web Application Firewall | grp-edge |
| Azure Firewall | Azure Firewall | grp-edge |
| Virtual Network | Virtual Network | grp-workload |
| Virtual Machines | Virtual Machines | grp-workload |
| Azure Bastion | Azure Bastion | grp-workload |
| Azure Private Link | Azure Private Link | grp-workload |
| Storage Account | Storage Account | grp-workload |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & Perimeter Security, Private Workload Network, Identity & Access Control, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-waf | svc-appgw | Inspect inbound HTTP/S sessions and forward only validated requests | sync |
| svc-appgw | svc-firewall | Send routed application traffic for centralized L3-L7 policy checks | sync |
| svc-firewall | svc-vnet | Permit only policy-compliant flows into workload subnets | sync |
| svc-vnet | svc-vm | Deliver approved ingress traffic to private virtual machine backends | sync |
| svc-bastion | svc-vnet | Establish management-plane tunnel into isolated management subnet | sync |
| svc-bastion | svc-vm | Provide browser-based RDP/SSH sessions without exposing VM public IPs | sync |
| svc-entra | svc-bastion | Apply Conditional Access and MFA before administrative sign-in is granted | sync |
| svc-vm | svc-privatelink | Initiate outbound access to approved PaaS endpoints through private endpoints | sync |
| svc-privatelink | svc-storage | Access Storage Account over private IP path on Microsoft backbone | sync |
| svc-firewall | svc-privatelink | Restrict egress so workloads can reach PaaS only via private endpoints | sync |
| svc-vm | svc-azmon | Stream guest metrics and security events to centralized monitoring pipeline | async |
| svc-azmon | svc-log | Ingest and persist telemetry for KQL-based analysis and alerting | async |

**Workflow:**

1. Inbound web traffic is screened by WAF policies before entering application routing. _(svc-waf, svc-appgw)_
2. Validated requests are passed through Azure Firewall for centralized zero-trust network policy enforcement. _(svc-appgw, svc-firewall, svc-vnet)_
3. Allowed traffic reaches private VM workloads hosted inside segmented virtual network subnets. _(svc-vnet, svc-vm)_
4. Administrators authenticate with Microsoft Entra ID, where Conditional Access and MFA are evaluated for Bastion access. _(svc-entra, svc-bastion)_
5. After successful policy checks, Bastion opens secure RDP/SSH sessions to VMs without exposing public IP addresses. _(svc-bastion, svc-vnet, svc-vm)_
6. VM workloads access approved PaaS resources through Azure Private Link instead of public endpoints. _(svc-vm, svc-privatelink, svc-storage)_
7. Firewall egress rules ensure PaaS communication is constrained to private endpoint paths only. _(svc-firewall, svc-privatelink)_
8. Workload telemetry is sent to Azure Monitor and then stored in Log Analytics for operational and security analysis. _(svc-vm, svc-azmon, svc-log)_

---

### GPT-5.4

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Application Gateway | Application Gateway | grp-edge |
| Web Application Firewall | Web Application Firewall | grp-edge |
| Azure Firewall | Azure Firewall | grp-edge |
| Virtual Network | Virtual Network | grp-core |
| Virtual Machines | Virtual Machines | grp-core |
| Azure Bastion | Azure Bastion | grp-core |
| Azure Private Link | Azure Private Link | grp-data |
| Storage Account | Storage Account | grp-data |
| Key Vault | Key Vault | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress and Perimeter, Core Network and Workloads, Private PaaS Access, Identity and Access Control, Monitoring and Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-waf | svc-appgw | Inspect inbound HTTPS sessions and pass only compliant requests for routing | sync |
| svc-appgw | svc-firewall | Forward approved application traffic to centralized policy enforcement | sync |
| svc-firewall | svc-vnet | Permit only authorized north-south traffic into segmented subnets | sync |
| svc-vnet | svc-vm | Deliver private application traffic to workload instances in protected subnets | sync |
| svc-vm | svc-firewall | Send outbound connections through centralized egress filtering and threat controls | sync |
| svc-firewall | svc-private-link | Allow only approved private endpoint destinations for PaaS consumption | sync |
| svc-private-link | svc-storage | Reach storage services through private endpoints instead of public internet paths | sync |
| svc-private-link | svc-keyvault | Access secrets and certificates over private endpoint connections | sync |
| svc-entra | svc-bastion | Enforce MFA and Conditional Access before granting administrator portal access | sync |
| svc-bastion | svc-vm | Open browser-based RDP and SSH sessions without exposing public IP addresses | sync |
| svc-entra | svc-appgw | Validate user identity context and apply Conditional Access to published applications | optional |
| svc-vm | svc-monitor | Send guest and application telemetry from the primary compute tier | async |
| svc-monitor | svc-log | Ingest metrics and logs into centralized analytics workspaces | async |

**Workflow:**

1. Inbound enterprise application traffic is inspected by the web application firewall before routing decisions are made. _(svc-waf, svc-appgw)_
2. Application Gateway forwards only approved requests to Azure Firewall for centralized zero trust policy evaluation. _(svc-appgw, svc-firewall)_
3. Azure Firewall permits authorized traffic into the Virtual Network, where segmented subnets isolate internal workloads. _(svc-firewall, svc-vnet, svc-vm)_
4. Administrators authenticate with Microsoft Entra ID and satisfy Conditional Access requirements before opening Bastion sessions. _(svc-entra, svc-bastion)_
5. Azure Bastion establishes private RDP or SSH access to Virtual Machines without exposing public management endpoints. _(svc-bastion, svc-vm, svc-vnet)_
6. Workloads send outbound traffic through Azure Firewall, which restricts access to approved private endpoints only. _(svc-vm, svc-firewall, svc-private-link)_
7. Private Link connects workloads to Storage Account services over private addresses, avoiding public PaaS exposure. _(svc-private-link, svc-storage, svc-vm)_
8. Private Link also provides secure private access to Key Vault for secrets and certificate retrieval. _(svc-private-link, svc-keyvault, svc-vm)_
9. Virtual Machines emit telemetry to Azure Monitor, which forwards logs and metrics to Log Analytics for centralized visibility. _(svc-vm, svc-monitor, svc-log)_

---

### DeepSeek V3.2 Speciale

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Firewall | Azure Firewall | edge-security |
| Application Gateway | Application Gateway | edge-security |
| Azure Bastion | Azure Bastion | edge-security |
| Azure Private Link | Azure Private Link | edge-security |
| Virtual Machines | Virtual Machines | compute |
| Storage Account | Storage Account | data |
| SQL Database | SQL Database | data |
| Microsoft Entra ID | Microsoft Entra ID | identity |
| Key Vault | Key Vault | identity |
| Azure Monitor | Azure Monitor | monitoring |
| Log Analytics | Log Analytics | monitoring |

**Groups:** Edge Security, Compute, Data & Storage, Identity & Security, Monitoring

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| app-gateway-waf | vm | Routes HTTPS requests to backend VMs | sync |
| vm | storage | Read/write application data | sync |
| vm | sql | Database queries | sync |
| vm | key-vault | Retrieve secrets and certificates | sync |
| entra-id | app-gateway-waf | Authenticate users via OIDC | sync |
| entra-id | vm | Managed identity authentication | sync |
| azure-firewall | private-link | Outbound traffic to PaaS via private endpoints | sync |
| azure-firewall | vm | Filter east-west traffic | sync |
| bastion | vm | Secure admin RDP/SSH access | sync |
| vm | monitor | Send metrics and logs | async |
| monitor | log-analytics | Store and query logs | async |

**Workflow:**

1. User accesses application via HTTPS. Application Gateway with WAF terminates TLS and forwards request to backend VMs after authentication via Microsoft Entra ID. _(app-gateway-waf, entra-id, vm)_
2. VM processes request, retrieving secrets from Key Vault and accessing data from Storage Account and SQL Database over private network. _(vm, key-vault, storage, sql)_
3. Outbound traffic from VM to other Azure services (e.g., PaaS) is routed through Azure Firewall and uses Private Link for secure private connectivity. _(vm, azure-firewall, private-link)_
4. Administrators securely access VMs for management using Azure Bastion, which provides RDP/SSH without exposing public IPs. _(bastion, vm)_
5. All resources send telemetry to Azure Monitor; logs are stored in Log Analytics for analysis and alerting. _(vm, monitor, log-analytics)_

---

### Grok 4.1 Fast

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Application Gateway | Application Gateway | edge |
| Azure Firewall | Azure Firewall | network |
| Azure Private Link | Azure Private Link | network |
| Virtual Machines | Virtual Machines | compute |
| Azure Bastion | Azure Bastion | compute |
| SQL Database | SQL Database | paas |
| Azure Cosmos DB | Azure Cosmos DB | paas |
| Microsoft Entra ID | Microsoft Entra ID | identity |
| Key Vault | Key Vault | identity |

**Groups:** Edge & Ingress, Core Networking, PaaS Services, Compute Resources, Identity & Access

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| entra-id | app-gateway | Enforces Conditional Access policies on inbound traffic | sync |
| app-gateway | azure-firewall | Forwards filtered HTTP/S traffic through firewall | sync |
| azure-firewall | private-link | Routes private PaaS traffic via Private Link | sync |
| private-link | sql-paas | Provides private endpoint connectivity to SQL | sync |
| private-link | cosmos-paas | Provides private endpoint connectivity to Cosmos DB | sync |
| entra-id | vms | Authenticates admin access via RBAC | sync |
| entra-id | bastion | Authorizes Bastion sessions with MFA | sync |
| bastion | vms | Establishes secure RDP/SSH sessions to VMs | sync |
| key-vault | vms | Delivers workload secrets via MSI | sync |
| vms | sql-paas | Executes private connections to PaaS services | sync |
| vms | cosmos-paas | Reads/writes via private endpoints | sync |
| azure-firewall | vms | Applies network security group policies | sync |

**Workflow:**

1. External users authenticate through Microsoft Entra ID Conditional Access before reaching edge services _(entra-id, app-gateway)_
2. Application Gateway with WAF inspects and filters inbound web traffic _(app-gateway, azure-firewall)_
3. Azure Firewall applies zero-trust network policies to all traffic flows _(azure-firewall, private-link)_
4. Private Link establishes secure private connectivity to PaaS services _(private-link, sql-paas, cosmos-paas)_
5. VM workloads access PaaS services exclusively via private endpoints _(vms, sql-paas, cosmos-paas)_
6. Admins authenticate via Entra ID to access Azure Bastion for VM management _(entra-id, bastion)_
7. Bastion provides just-in-time secure access to workload VMs _(bastion, vms)_
8. VMs retrieve secrets from Key Vault using managed identities _(vms, key-vault)_
9. All components continuously validate zero-trust policies through Entra ID _(entra-id, azure-firewall)_
10. Network traffic flows remain isolated within VNet with no public exposure _(azure-firewall, private-link, vms)_

---

