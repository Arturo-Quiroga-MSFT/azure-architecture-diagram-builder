# Claude Desktop and Azure Foundry MCP tools

This note records the separate Azure Foundry MCP integration tested alongside
the AADB Claude Desktop integration on 2026-08-20. It covers Azure resource and
model-deployment tools. It does not change the model that powers Claude Desktop.

## Critical model boundary

Claude Desktop continues to use the Claude model selected in its user interface
for conversation, reasoning, orchestration, and the final response. MCP servers
add tools; they do not replace Claude's underlying model.

The control flow remains:

```text
User
  -> Claude model
  -> Azure Foundry MCP tool
  -> Azure resource or delegated Azure model operation
  -> tool result
  -> Claude model
  -> final response
```

The Foundry extension advertises model-list, chat-completion, completion, and
embedding operations. Only model deployment listing was tested in this effort.
Even if a future test invokes an Azure model through an MCP tool, Claude remains
the orchestrating and final-response model. This is not BYOM for Claude Desktop.

## Supported package

Use Microsoft's official Azure MCP Server:

```text
@azure/mcp
```

The package shown in an external example, `@azure/openai-mcp-server`, returned
npm `E404` and had no corresponding Microsoft documentation. Do not use that
package name.

The tested package version was `@azure/mcp` `3.0.0-beta.36`. The final local
configuration uses the directly installed `azmcp` executable instead of `npx`.
Claude starts multiple MCP launch lanes, and concurrent `npx` wrappers stalled
at the MCP initialize request during testing. The direct executable initialized
and listed tools consistently.

Install or update the supported package in the active Node.js runtime:

```bash
npm install --global @azure/mcp@latest
command -v azmcp
```

## Verified Azure context

The tested Foundry resource belongs to the managed MCAP tenant and subscription:

| Setting | Verified value |
| --- | --- |
| Account | `admin@MngEnvMCAP094150.onmicrosoft.com` |
| Tenant | `a172a259-b1c7-4944-b2e1-6d551f954711` |
| Subscription | `ARTURO-MngEnvMCAP094150` |
| Subscription ID | `7a28b21e-0d3e-4435-a686-d92889d4ee96` |
| Resource group | `AQ-FOUNDRY-RG` |
| Foundry resource | `r2d2-foundry-001` |
| Resource type | `Microsoft.CognitiveServices/accounts` |
| Location | `eastus2` |

The Microsoft corporate tenant `72f988bf-86f1-41af-91ab-2d7cd011db47` does not
own this subscription or resource. Attempting corporate-tenant login with the
managed MCAP administrator produced an expected "user account does not exist in
tenant" error. The earlier corporate-tenant assumption was incorrect.

## Claude Desktop configuration

Claude Desktop reads the local configuration from:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

Merge the following entry into `mcpServers`. Preserve existing servers and
Claude preferences. Replace the executable path if `command -v azmcp` reports a
different location.

```json
{
  "mcpServers": {
    "azure-foundry": {
      "type": "stdio",
      "command": "/Users/arturoquiroga/.nvm/versions/node/v24.18.0/bin/azmcp",
      "args": [
        "server",
        "start",
        "--namespace",
        "foundryextensions",
        "--read-only"
      ],
      "env": {
        "AZURE_TOKEN_CREDENTIALS": "AzureCliCredential",
        "AZURE_TENANT_ID": "a172a259-b1c7-4944-b2e1-6d551f954711",
        "AZURE_SUBSCRIPTION_ID": "7a28b21e-0d3e-4435-a686-d92889d4ee96"
      }
    }
  }
}
```

Why each constraint exists:

- `foundryextensions` limits the Azure MCP surface to Foundry extension tools.
- `--read-only` blocks write operations.
- `AzureCliCredential` prevents `DefaultAzureCredential` from choosing another
  cached identity.
- Tenant and subscription selectors make the managed MCAP context explicit.
- The configuration contains no API key, access token, or client secret.

Restart Claude Desktop after editing the file. A healthy startup in
`~/Library/Logs/Claude/mcp-server-azure-foundry.log` includes:

```text
initialize
notifications/initialized
tools/list
```

## Authentication prerequisite

Before starting Claude, Azure CLI must be authenticated to the managed MCAP
context:

```bash
az account show --query \
  '{tenantId:tenantId,subscriptionId:id,subscriptionName:name,user:user.name}' \
  -o json
```

Expected tenant and subscription IDs are the MCAP values in the table above.
Do not switch this workload to the Microsoft corporate tenant.

## Verified behavior

The following claims were tested:

- The direct `azmcp` stdio server initialized successfully.
- Claude completed `initialize` and `tools/list` with the direct launcher.
- Four MCP tools were discovered: the `foundryextensions` router plus read-only
  subscription and resource-group discovery tools.
- `foundryextensions openai models-list` completed through the pinned MCAP
  Azure CLI identity without protocol error, tenant mismatch, or failure text.
- Direct Azure CLI and Claude both returned 28 model deployments from
  `r2d2-foundry-001`; every returned deployment had provisioning state
  `Succeeded`.
- No resource change was made.

The tested Claude prompt was:

```text
Using azure-foundry, list the Azure OpenAI model deployments in Foundry resource
r2d2-foundry-001, resource group AQ-FOUNDRY-RG, subscription
7a28b21e-0d3e-4435-a686-d92889d4ee96, tenant
a172a259-b1c7-4944-b2e1-6d551f954711. Use credential authentication and make no
changes.
```

## Troubleshooting

### Tenant mismatch

Symptom: the tool claims the current credential and subscription belong to
different tenants.

Checks:

1. Verify the subscription directly with `az account show`.
2. Verify the resource directly with `az resource list` using the explicit
   MCAP subscription ID.
3. Set `AZURE_TOKEN_CREDENTIALS=AzureCliCredential` in the Claude server entry.
4. Pin `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` to the MCAP values.
5. Fully restart Claude Desktop and use a new conversation.

Do not infer resource ownership solely from an MCP error message. In this test,
the initial error attributed the subscription to the Microsoft corporate tenant,
but direct Azure CLI evidence proved the subscription and resource belonged to
the managed MCAP tenant.

### Server stalls at initialize

If Claude logs `initialize` but never logs the server response, check whether
Claude is launching `npx -y @azure/mcp@latest`. Install the package globally and
use the absolute `azmcp` executable instead. This removed the observed
concurrent-`npx` initialization stall.

### Credential lifetime

`AzureCliCredential` depends on the local Azure CLI session. When that session
expires, renew it with the managed MCAP account and confirm the tenant and
subscription before restarting Claude.

## Credential handling

An Azure OpenAI API key was pasted during exploration but was not used or stored
in Claude's configuration. Because it appeared in conversation text, rotate it
before any future key-based use. The verified integration requires no API key.
