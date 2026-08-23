# PSA Self-Deployment Quickstart

Use this page to deploy Azure Architecture Diagram Builder and its AI dependency into a greenfield Azure subscription with Azure Developer CLI (`azd`). The destination subscription owns every resource created by the default path.

## What You Need

- An Azure subscription where you have **Owner**, or both **Contributor** and **User Access Administrator**, because the Bicep creates role assignments.
- [Git](https://git-scm.com/), [Docker Desktop](https://www.docker.com/products/docker-desktop/) running, [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli), and [Azure Developer CLI](https://aka.ms/azd) installed.
- Regional quota for `gpt-5.6-luna` `GlobalStandard` capacity 10. The deployment runs an automatic catalog and quota preflight before creating resources.

The default deployment creates a Microsoft Foundry `AIServices` account, a GPT-5.6 Luna model deployment, Azure Container Registry, a Container Apps environment, two Container Apps (web and MCP), a managed identity, Log Analytics, Application Insights, and Azure Speech. Cosmos DB is off by default. A Foundry project is not created because AADB calls the account-level model endpoint directly.

> [!WARNING]
> The default web endpoint is public and unauthenticated, including its server-side Azure OpenAI proxy. Use this configuration only for a controlled installation test and do not share the URL. Before team or production use, configure [Microsoft Entra authentication](../README.md#securing-with-entra-id-optional). The MCP endpoint remains internal unless you explicitly set `MCP_AUTH_TOKEN`.

## Deploy

Replace every value in angle brackets.

```bash
git clone https://github.com/Arturo-Quiroga-MSFT/azure-architecture-diagram-builder.git
cd azure-architecture-diagram-builder

azd auth login
azd env new <environment-name> \
  --subscription <subscription-id> \
  --location eastus2

azd env set AZURE_SPEECH_REGION "eastus2"

# Automatically checks the Luna catalog entry and available quota first.
azd provision

# Continue only after both commands print one role assignment.
PRINCIPAL_ID="$(azd env get-value SERVICE_APP_IDENTITY_PRINCIPAL_ID)"
ACR_NAME="$(azd env get-value AZURE_CONTAINER_REGISTRY_NAME)"
ACR_ID="$(az acr show --name "$ACR_NAME" --resource-group "rg-<environment-name>" --query id -o tsv)"
FOUNDRY_ID="$(azd env get-value AZURE_AI_ACCOUNT_ID)"
az role assignment list --scope "$ACR_ID" --assignee-object-id "$PRINCIPAL_ID" \
  --query "[?roleDefinitionName=='AcrPull'].roleDefinitionName" -o tsv
az role assignment list --scope "$FOUNDRY_ID" --assignee-object-id "$PRINCIPAL_ID" \
  --query "[?roleDefinitionName=='Cognitive Services OpenAI User'].roleDefinitionName" -o tsv

azd deploy
```

Use a short, unique environment name such as `aadb-aq`; resources are created in `rg-<environment-name>`. `azd provision` creates the infrastructure, Foundry account, Luna deployment, and placeholder app images. The role checks prevent image-pull or model-access failures while Azure RBAC propagates. `azd deploy` builds both containers, pushes them to the new registry, and deploys them.

The web packaging hook is fail-closed: it requires the generated Foundry endpoint and at least one model deployment before building. Do not bypass a prepackage failure; an image built without those values loads but disables Generate and Guided Chat.

The default path is keyless. The web Container App uses its managed identity and a resource-scoped **Cognitive Services OpenAI User** assignment. Local authentication is disabled on the provisioned Foundry account.

## Verify

```bash
azd show
azd env get-value SERVICE_APP_URL
```

1. Open `SERVICE_APP_URL`.
2. Confirm GPT-5.6 Luna is selected with medium reasoning.
3. Confirm neither Generate Diagram nor Guided Chat says "Azure OpenAI is not configured."
4. Generate a small architecture, such as "Web app with App Service, Azure SQL, and Application Insights."

Success means the page loads and Luna returns an editable diagram. Provisioning success alone does not verify managed-identity model access.

## Add More Models

The greenfield path deploys only GPT-5.6 Luna to keep quota and cost explicit. To add another model already supported by AADB, first deploy it to the generated Foundry account, then set its deployment variable and rebuild only the web app:

```bash
az cognitiveservices account deployment create \
  --resource-group "$(azd env get-value AZURE_RESOURCE_GROUP)" \
  --name "$(azd env get-value AZURE_AI_ACCOUNT_NAME)" \
  --deployment-name "<deployment-name>" \
  --model-name "<model-name>" \
  --model-version "<model-version>" \
  --model-format OpenAI \
  --sku-name GlobalStandard \
  --sku-capacity 10
azd env set AZURE_OPENAI_DEPLOYMENT_GPT54MINI "<deployment-name>"
azd deploy app --no-prompt
```

No infrastructure provisioning or MCP redeployment is required. All configured deployments must be reachable through the same `AZURE_OPENAI_ENDPOINT`. See [Model Configuration](MODEL-CONFIGURATION.md) for all 15 variables, capability differences, verification, removal, and the code changes required for a new model type.

## Bring Your Own AI

To use an existing Azure OpenAI or Foundry endpoint instead, set `deployFoundry` to `false` in `infra/main.parameters.json`, configure `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` (optional when external managed-identity access is already assigned), and at least one supported deployment variable in the selected `azd` environment. The preprovision Foundry catalog/quota check is skipped in this mode.

## Optional MCP Access

The separate MCP Container App is internal-only when `MCP_AUTH_TOKEN` is unset. To expose a bearer-protected remote MCP endpoint, set a strong token before provisioning:

```bash
azd env set MCP_AUTH_TOKEN "$(openssl rand -hex 32)"
azd provision
azd deploy
azd env get-value MCP_ENDPOINT
```

Treat the token as a secret. See the [MCP setup in the main README](../README.md#use-it-from-vs-code-github-copilot) for client configuration.

## Update Or Remove

From the same repository and selected `azd` environment:

```bash
git pull
azd provision
azd deploy
```

To delete the resource group and resources created for this environment:

```bash
azd down
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Role-assignment authorization failure | Confirm Owner, or Contributor plus User Access Administrator, at subscription scope. |
| Docker/package failure | Confirm Docker Desktop is running and has enough free disk space. |
| Foundry preflight fails | Confirm Luna version/SKU availability and quota in the selected subscription and region. The installer does not silently substitute another model. |
| UI says Azure OpenAI is not configured | Confirm `azd env get-value AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_DEPLOYMENT_GPT56LUNA` are populated, then rerun `azd deploy app --no-prompt`. Current source refuses to package when either value is missing. |
| App loads but AI generation fails | Confirm the OpenAI User assignment exists at the generated Foundry account scope and Luna is in a succeeded provisioning state. |
| Speech provisioning fails | Use an Avatar-supported Speech region; `eastus2` is the documented default for this quickstart. |
| Need deployment diagnostics | Re-run the failed command with `--debug`; redact keys and tokens before sharing logs. |

## Validation Boundary

Live-tested end to end on 2026-08-21 in a new `aadb-greenfield-test` environment and resource group with no BYO endpoint or key. The automatic preflight validated Luna catalog availability and quota; `azd provision` created the destination-owned `AIServices` account and GPT-5.6 Luna deployment; both RBAC gates passed; and `azd deploy` deployed both apps. The public web endpoint, managed-identity Speech endpoint, and keyless Luna request returned HTTP 200. Browser automation confirmed the warning was absent, Luna/medium was selected, Generate enabled after entering a prompt, and a UI-originated request created six diagram nodes. Both Container App revisions were healthy, MCP was internal-only, the web container had no API-key variable, and Cosmos DB was absent. This evidence applies to the tested `SUB-2` / East US 2 environment; every destination must pass its own catalog and quota preflight.
