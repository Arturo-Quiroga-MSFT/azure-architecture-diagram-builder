---
title: IaC Template Import - Bicep and Terraform Support
description: Design document for importing Bicep and Terraform templates to generate architecture diagrams, replacing the ARM-only import workflow
author: Arturo Quiroga
ms.date: 2026-02-28
ms.topic: concept
keywords:
  - bicep
  - terraform
  - arm template
  - infrastructure as code
  - import
  - architecture diagram
estimated_reading_time: 8
---

## Motivation

The current "Import ARM" feature accepts only ARM template JSON files
(`.json` with `$schema` and `resources`). ARM templates are rarely
authored directly today; most Azure practitioners use **Bicep** or
**Terraform** instead. Supporting these two formats broadens the
tool's audience and aligns with current industry practice.

## Current State

| Capability | Status |
|---|---|
| ARM JSON import (`$schema` + `resources`) | Implemented |
| Bicep **export** (deployment guide generator) | Implemented |
| Bicep **import** | Not implemented |
| Terraform import | Not implemented |

### Existing ARM Import Flow

1. User clicks **Import ARM** and selects a `.json` file.
2. `App.tsx` validates `$schema` and `resources` keys.
3. The JSON is sent to `generateArchitectureFromARM()` in
   `azureOpenAI.ts`, which builds a system prompt mapping ARM resource
   types to Azure services.
4. GPT returns a diagram specification (services, groups, connections).
5. The result feeds into `handleAIGenerate()` to render the diagram.

Key files:

* `src/services/azureOpenAI.ts` — `generateArchitectureFromARM()`
* `src/App.tsx` — `uploadARMTemplate()`, "Import ARM" button
* `src/services/telemetryService.ts` — `trackARMImport()`

## Design: Unified IaC Import

### Guiding Principles

* **AI-assisted parsing** — Bicep and Terraform (HCL) are plain text,
  not JSON. Writing full parsers is unnecessary because GPT already
  understands both syntaxes with high fidelity. The AI maps resource
  declarations to Azure services, infers dependencies, and groups
  resources logically.
* **Single entry point** — One button, one handler, auto-detection of
  format from file extension and content heuristics.
* **Multi-file support** — Bicep modules (`main.bicep` + `modules/`)
  and Terraform configs (multiple `.tf` files) are the norm. Accept
  ZIP archives or multi-file selection for these cases.

### Format Detection

| Extension | Content heuristic | Detected format |
|---|---|---|
| `.json` | `$schema` contains `deploymentTemplate` | ARM |
| `.json` | Contains `"terraform"` or `"azurerm"` keys | Terraform state |
| `.bicep` | Contains `resource` or `module` keywords | Bicep |
| `.tf` | Contains `resource` or `provider` keywords | Terraform HCL |
| `.zip` | Extract, then apply rules above to contents | Auto |

### Proposed API

Replace `generateArchitectureFromARM()` with a unified function:

```typescript
export type IaCFormat = 'arm' | 'bicep' | 'terraform-hcl' | 'terraform-state';

export interface IaCImportInput {
  format: IaCFormat;
  /** For ARM/tfstate: parsed JSON. For Bicep/HCL: raw text. */
  content: string | object;
  /** Original filename(s) for context */
  filenames: string[];
}

export async function generateArchitectureFromIaC(
  input: IaCImportInput
): Promise<ArchitectureResult>;
```

Internally, the function selects a format-specific system prompt and
resource-mapping table, then delegates to `callAzureOpenAI()`.

### System Prompt Strategy

Each format needs a tailored system prompt section:

* **Bicep** — Map `resource` declarations
  (e.g., `resource appService 'Microsoft.Web/sites@2023-12-01'`) to
  Azure services. Parse `module` references for grouping. Infer
  connections from parameter passing between modules and `dependsOn`.
* **Terraform HCL** — Map `azurerm_*` resource types
  (e.g., `azurerm_linux_web_app`) to Azure services. Use
  `depends_on` and implicit reference expressions
  (`azurerm_resource_group.rg.name`) for connections.
* **Terraform state** — Similar to ARM: JSON with a `resources` array
  containing `type`, `name`, and `instances` with attribute values.
* **ARM** — Existing prompt, preserved as-is.

The shared output schema (services, groups, connections) remains
unchanged across all formats.

### Multi-File Handling

For ZIP archives or multi-file selection:

1. Extract all relevant files (`.bicep`, `.tf`, or `.json`).
2. Sort by filename (entry-point files like `main.bicep` or
   `main.tf` first).
3. Concatenate with `// === filename.bicep ===` headers.
4. Send concatenated text to GPT as a single user message.

Token budget consideration: large Terraform projects can exceed
context limits. If the concatenated input exceeds ~80K tokens,
truncate module files and keep only resource declarations.

### UI Changes

#### Button

Rename **Import ARM** to **Import Template**.

```tsx
<label className="btn btn-secondary" title="Import Bicep, Terraform, or ARM template">
  <Upload size={18} />
  Import Template
  <input
    type="file"
    accept=".json,.bicep,.tf,.zip"
    multiple
    onChange={uploadTemplate}
    style={{ display: 'none' }}
  />
</label>
```

#### Loading Banner

Update the parsing banner text to reflect the detected format:

* "Parsing Bicep template..."
* "Parsing Terraform configuration..."
* "Parsing ARM template..."

#### Prompt Label

After import, set `architecturePrompt` to a descriptive label:

* `Bicep Template: main.bicep (+3 modules)`
* `Terraform Config: main.tf (+5 files)`
* `ARM Template: deployment.json`

### Telemetry

Extend `trackARMImport()` to a generic `trackTemplateImport()`:

```typescript
export function trackTemplateImport(
  format: IaCFormat,
  fileName: string,
  fileCount: number,
  resourceCount?: number
): void {
  trackEvent('Template_Imported', {
    format,
    fileName,
    fileCount,
    resourceCount: resourceCount ?? 0,
  });
}
```

### Validation Heuristics

Before sending to GPT, perform lightweight client-side validation:

| Format | Check |
|---|---|
| ARM | `$schema` and `resources` keys present |
| Bicep | Text contains at least one `resource` or `module` keyword |
| Terraform HCL | Text contains `resource` or `provider` keyword |
| Terraform state | JSON with `version` and `resources` keys |
| ZIP | At least one file with a recognized extension inside |

Invalid files produce a user-friendly alert with the detected issue.

## Implementation Phases

### Phase A: Unified parsing function (priority 1)

Create `generateArchitectureFromIaC()` in `azureOpenAI.ts` with
format-specific system prompts. Keep the existing ARM prompt as-is
and add Bicep and Terraform HCL prompts. Refactor
`generateArchitectureFromARM()` to call the new unified function
internally for backward compatibility.

### Phase B: Smart upload button (priority 1)

Update `App.tsx`:

* Rename button to "Import Template"
* Accept `.json`, `.bicep`, `.tf`, `.zip`
* Auto-detect format from extension and content
* Update loading banner text dynamically
* Update telemetry calls

### Phase C: Multi-file and ZIP support (priority 2)

* Accept `multiple` file selection
* Accept `.zip` archives
* Extract, sort by filename, concatenate with headers
* Handle token budget limits

### Phase D: Terraform state import (priority 3)

* Accept `.tfstate` files (JSON)
* Parse `resources` array for deployed resource graph
* Use ARM-like system prompt adapted for Terraform state schema

## Formats Not in Scope

* **Pulumi** — TypeScript/Python/Go programs; would require language
  understanding beyond IaC template parsing. Low demand.
* **AWS CloudFormation** — Not relevant for an Azure-focused tool.
* **CDK (AWS or Azure)** — Same reasoning as Pulumi.
* **ARM→Bicep decompilation** — Azure CLI provides
  `az bicep decompile` but this is a conversion concern, not an
  import concern. Users can decompile separately and import the
  resulting `.bicep` file.

## Resource Type Mapping Reference

### Bicep Resource Types (examples)

| Bicep resource type | Azure service | Icon category |
|---|---|---|
| `Microsoft.Web/sites@*` | App Service | app services |
| `Microsoft.Web/sites@*` (kind: functionapp) | Function App | app services |
| `Microsoft.DocumentDB/databaseAccounts@*` | Cosmos DB | databases |
| `Microsoft.Sql/servers/databases@*` | SQL Database | databases |
| `Microsoft.Storage/storageAccounts@*` | Storage Account | storage |
| `Microsoft.Network/virtualNetworks@*` | Virtual Network | networking |
| `Microsoft.ContainerService/managedClusters@*` | AKS | containers |
| `Microsoft.KeyVault/vaults@*` | Key Vault | identity |
| `Microsoft.Insights/components@*` | Application Insights | monitor |

### Terraform Resource Types (examples)

| Terraform resource type | Azure service | Icon category |
|---|---|---|
| `azurerm_linux_web_app` | App Service | app services |
| `azurerm_linux_function_app` | Function App | app services |
| `azurerm_cosmosdb_account` | Cosmos DB | databases |
| `azurerm_mssql_database` | SQL Database | databases |
| `azurerm_storage_account` | Storage Account | storage |
| `azurerm_virtual_network` | Virtual Network | networking |
| `azurerm_kubernetes_cluster` | AKS | containers |
| `azurerm_key_vault` | Key Vault | identity |
| `azurerm_application_insights` | Application Insights | monitor |

## Testing Strategy

* **Sample files** — Add sample Bicep and Terraform files alongside
  the existing `sample-arm-template.json` for manual testing.
* **Format detection** — Unit-test the detection function with edge
  cases (empty files, mixed content, malformed JSON).
* **Multi-file concatenation** — Verify ordering and header injection
  with a test ZIP containing `main.bicep` + 3 modules.
* **End-to-end** — Import each format and verify the rendered diagram
  contains the expected services, groups, and connections.
