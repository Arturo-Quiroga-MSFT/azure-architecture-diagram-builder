# Foundry Dataset Storage Access Runbook

This runbook documents how to register a local evaluation dataset in a Microsoft Foundry project when the connected Azure Storage account uses Microsoft Entra ID, public network access is disabled, and an Azure Policy `modify` effect enforces that setting.

Use this procedure only when a private endpoint or VNet-hosted upload runner is not available. The preferred durable design is private storage access from Foundry VNet injection and VNet-attached development or CI compute.

## What This Procedure Changes

Permanent changes:

- Grants the Foundry **project** managed identity `Storage Blob Data Contributor` on the connected storage account.
- Registers a named, versioned Foundry dataset.
- Records the remote dataset ID, backing blob URI, and verified SHA-256 in `.foundry/evaluation-metadata.json`.

Temporary changes:

- Creates a resource-scoped Azure Policy exemption for only the policy-set reference that forces storage public network access off.
- Enables the storage public endpoint for the upload window.
- If a source-IP rule does not work, temporarily changes the storage firewall default action to `Allow` while anonymous blob access and shared-key authentication remain disabled.

Cleanup restores `publicNetworkAccess=Disabled`, restores `defaultAction=Deny`, and deletes the policy exemption.

## Required Access and Tools

The operator needs:

- Azure CLI authenticated to the target tenant and subscription.
- Permission to read the Foundry project and storage account.
- `Microsoft.Authorization/roleAssignments/write` at the storage-account scope, normally through Owner or User Access Administrator.
- Permission to create and delete policy exemptions at the storage-account scope.
- Permission to update the storage account.
- A user data-plane role such as `Storage Blob Data Contributor` if the operator will download the backing blob for hash verification.
- `uv` and a Python virtual environment.

On Microsoft-managed devices, install Python packages through the approved proxy:

```bash
uv pip install \
  --python .venv/bin/python \
  --default-index https://packagefeedproxy.microsoft.io/pypi/simple \
  'azure-ai-projects>=2.2.0' \
  'azure-identity>=1.25.0' \
  'azure-storage-blob>=12.30.0'
```

Do not print package-feed credentials or local package-manager configuration.

## Configure the Target

Set these values for the target environment. Keep the local dataset label, such as `v1`, separate from the Foundry version string, such as `1`.

```bash
export SUBSCRIPTION_ID='<subscription-guid>'
export TENANT_ID='<tenant-guid>'
export RESOURCE_GROUP='<resource-group>'
export FOUNDRY_ACCOUNT='<foundry-account>'
export FOUNDRY_PROJECT='<foundry-project>'
export STORAGE_ACCOUNT='<storage-account>'
export PROJECT_ENDPOINT="https://${FOUNDRY_ACCOUNT}.services.ai.azure.com/api/projects/${FOUNDRY_PROJECT}"
export STORAGE_CONNECTION_NAME='' # Optional; set when the project has multiple storage connections.
export DATASET_NAME='<stable-dataset-name>'
export DATASET_VERSION='1'
export DATASET_FILE='<path-to-versioned-jsonl-or-csv>'

export PROJECT_RESOURCE_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.CognitiveServices/accounts/${FOUNDRY_ACCOUNT}/projects/${FOUNDRY_PROJECT}"
export STORAGE_RESOURCE_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Storage/storageAccounts/${STORAGE_ACCOUNT}"
```

Confirm the CLI context before changing Azure resources:

```bash
az account set --subscription "$SUBSCRIPTION_ID"
az account show \
  --query '{subscriptionId:id,subscriptionName:name,tenantId:tenantId,user:user.name}' \
  -o json
```

## 1. Confirm the Project Storage Connection

The Foundry project must contain an Azure Blob Storage connection for the target account. In the Foundry portal, open the project and check **Build > Tools** or the project connection settings.

A storage connection is necessary but not sufficient. The project managed identity must also have data-plane RBAC, and both Foundry and the upload client need network access to Blob Storage.

## 2. Resolve the Correct Managed Identity

Foundry can expose separate account and project identities. Dataset storage access belongs to the **project** identity. Do not infer the project principal from the parent account.

```bash
export PROJECT_PRINCIPAL_ID="$(az resource show \
  --ids "$PROJECT_RESOURCE_ID" \
  --api-version '2026-07-01' \
  --query 'identity.principalId' \
  -o tsv)"

az ad sp show \
  --id "$PROJECT_PRINCIPAL_ID" \
  --query '{id:id,displayName:displayName,servicePrincipalType:servicePrincipalType}' \
  -o json
```

Expected display-name shape:

```text
<foundry-account>/projects/<foundry-project>
```

If the display name contains only the account name, stop. That is the parent account identity, not the project identity.

## 3. Grant Permanent Storage RBAC

Assign the least-privilege built-in role at the storage-account scope:

```bash
az role assignment create \
  --assignee-object-id "$PROJECT_PRINCIPAL_ID" \
  --assignee-principal-type ServicePrincipal \
  --role 'Storage Blob Data Contributor' \
  --scope "$STORAGE_RESOURCE_ID"
```

Verify the exact subject, role, and scope:

```bash
az role assignment list \
  --scope "$STORAGE_RESOURCE_ID" \
  --assignee-object-id "$PROJECT_PRINCIPAL_ID" \
  --query '[].{role:roleDefinitionName,principalId:principalId,scope:scope}' \
  -o json
```

RBAC can take up to 10 minutes to propagate. A retry made seconds after role creation is not a conclusive test.

## 4. Diagnose Policy Enforcement

First capture the original storage posture. Preserve these values for cleanup.

```bash
az storage account show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT" \
  --query '{publicNetworkAccess:publicNetworkAccess,defaultAction:networkRuleSet.defaultAction,bypass:networkRuleSet.bypass,ipRules:networkRuleSet.ipRules,allowBlobPublicAccess:allowBlobPublicAccess,allowSharedKeyAccess:allowSharedKeyAccess}' \
  -o json
```

Find policies evaluated against the storage account:

```bash
az policy state list \
  --resource "$STORAGE_RESOURCE_ID" \
  --query "[].{definitionName:policyDefinitionName,assignmentId:policyAssignmentId,definitionId:policyDefinitionId,referenceId:policyDefinitionReferenceId,effect:policyDefinitionAction,compliance:complianceState}" \
  -o json
```

If an update reports success but `publicNetworkAccess` immediately returns to `Disabled`, look for a `modify` policy. Capture both:

- The policy assignment ID.
- The policy definition reference ID inside the assigned policy set.

For the MCAPS environment documented below, the relevant values were:

```bash
export POLICY_ASSIGNMENT_ID='/providers/Microsoft.Management/managementGroups/<tenant-root-management-group>/providers/Microsoft.Authorization/policyAssignments/MCAPSGovDeployPolicies'
export POLICY_REFERENCE_ID='storageaccountpublicnetworkmodify'
```

Do not exempt the entire policy set. Use `--policy-definition-reference-ids` to exempt only the storage public-network rule.

If no policy rewrites the setting, skip the exemption steps.

## 5. Create a Narrow, Expiring Exemption

Use a short expiry as a backstop. The exemption must still be deleted during cleanup.

```bash
export EXEMPTION_NAME='foundry-dataset-upload-storage-pna'
export EXEMPTION_EXPIRES_ON="$(date -u -v+1H '+%Y-%m-%dT%H:%M:%SZ')"

az policy exemption create \
  --name "$EXEMPTION_NAME" \
  --display-name 'Temporary public network access for Foundry dataset upload' \
  --policy-assignment "$POLICY_ASSIGNMENT_ID" \
  --policy-definition-reference-ids "$POLICY_REFERENCE_ID" \
  --exemption-category 'Waiver' \
  --description 'Temporary one-hour exemption for a versioned Foundry dataset upload; remove after verification.' \
  --expires-on "$EXEMPTION_EXPIRES_ON" \
  --scope "$STORAGE_RESOURCE_ID"
```

Verify the exemption before updating storage:

```bash
az policy exemption show \
  --name "$EXEMPTION_NAME" \
  --scope "$STORAGE_RESOURCE_ID" \
  --query '{name:name,expiresOn:expiresOn,category:exemptionCategory,referenceIds:policyDefinitionReferenceIds,assignment:policyAssignmentId}' \
  -o json
```

The expiry command above uses macOS `date`. On Linux with GNU `date`, use:

```bash
export EXEMPTION_EXPIRES_ON="$(date -u -d '+1 hour' '+%Y-%m-%dT%H:%M:%SZ')"
```

## 6. Try Selected-Network Access First

Use the caller's current IPv4 address as the narrowest first attempt:

```bash
export CLIENT_IP="$(curl -4 -fsS https://api.ipify.org)"

az storage account network-rule add \
  --resource-group "$RESOURCE_GROUP" \
  --account-name "$STORAGE_ACCOUNT" \
  --ip-address "$CLIENT_IP"
```

Enable the public endpoint while retaining a deny-by-default firewall:

```bash
az rest \
  --method PATCH \
  --uri "https://management.azure.com${STORAGE_RESOURCE_ID}?api-version=2025-06-01" \
  --headers 'Content-Type=application/json' \
  --body "{\"properties\":{\"publicNetworkAccess\":\"Enabled\",\"networkAcls\":{\"defaultAction\":\"Deny\",\"bypass\":\"AzureServices\",\"ipRules\":[{\"value\":\"${CLIENT_IP}\",\"action\":\"Allow\"}],\"virtualNetworkRules\":[]}}}"
```

Test Entra-authenticated data-plane access:

```bash
az storage container list \
  --account-name "$STORAGE_ACCOUNT" \
  --auth-mode login \
  --query '[].name' \
  -o json
```

If this succeeds, continue to the upload. If it fails with a storage-network message, verify the public endpoint, firewall rule, DNS resolution, and current egress IP before widening access.

### Observed managed-device fallback

In the AADB run on August 11, 2026, three external IP services and the storage rule all reported the same IPv4 address, but Blob Storage still returned network-layer `AuthorizationFailure`. The cause was not proven. The selected-IP route did not work in that environment.

The successful fallback was a brief authenticated public endpoint. Before using it, verify all of these controls:

```bash
az storage account show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_ACCOUNT" \
  --query '{allowBlobPublicAccess:allowBlobPublicAccess,allowSharedKeyAccess:allowSharedKeyAccess,minimumTlsVersion:minimumTlsVersion,httpsOnly:enableHttpsTrafficOnly}' \
  -o json
```

Required values:

- `allowBlobPublicAccess=false`
- `allowSharedKeyAccess=false`
- `minimumTlsVersion=TLS1_2`
- `httpsOnly=true`

Then temporarily set only the firewall default action to `Allow`:

```bash
az rest \
  --method PATCH \
  --uri "https://management.azure.com${STORAGE_RESOURCE_ID}?api-version=2025-06-01" \
  --headers 'Content-Type=application/json' \
  --body '{"properties":{"publicNetworkAccess":"Enabled","networkAcls":{"defaultAction":"Allow","bypass":"AzureServices","ipRules":[],"virtualNetworkRules":[]}}}'
```

This exposes the endpoint to network traffic, but it does not grant data access. Microsoft Entra authorization is still required because anonymous blob access and shared-key authentication remain disabled. Keep this window as short as possible.

Validate both sides:

```bash
# Expected to fail because anonymous blob access is disabled.
curl -4 -sS -D - -o /dev/null \
  "https://${STORAGE_ACCOUNT}.blob.core.windows.net/?comp=list"

# Expected to succeed for an authorized Entra identity.
az storage container list \
  --account-name "$STORAGE_ACCOUNT" \
  --auth-mode login \
  --query '[].name' \
  -o json
```

## 7. Upload the Versioned Dataset

Force `DefaultAzureCredential` to use the current Azure CLI login for this operation:

```bash
AZURE_TOKEN_CREDENTIALS=AzureCliCredential .venv/bin/python - <<'PY'
import os

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

with DefaultAzureCredential() as credential:
    with AIProjectClient(
        endpoint=os.environ["PROJECT_ENDPOINT"],
        credential=credential,
    ) as client:
        upload_args = {
            "name": os.environ["DATASET_NAME"],
            "version": os.environ["DATASET_VERSION"],
            "file_path": os.environ["DATASET_FILE"],
        }
        if os.environ.get("STORAGE_CONNECTION_NAME"):
            upload_args["connection_name"] = os.environ["STORAGE_CONNECTION_NAME"]

        dataset = client.datasets.upload_file(**upload_args)
        print({
            "id": dataset.id,
            "name": dataset.name,
            "version": dataset.version,
        })
PY
```

Do not overwrite an approved remote version with different content. Increment the dataset version instead.

## 8. Verify Registration and Content

Retrieve the registered dataset through Foundry and compare the backing blob with the local file. This requires the operator's Entra identity to have blob read access.

```bash
AZURE_TOKEN_CREDENTIALS=AzureCliCredential .venv/bin/python - <<'PY'
import hashlib
import os

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobClient

with open(os.environ["DATASET_FILE"], "rb") as local_file:
    local_bytes = local_file.read()

with DefaultAzureCredential() as credential:
    with AIProjectClient(
        endpoint=os.environ["PROJECT_ENDPOINT"],
        credential=credential,
    ) as client:
        dataset = client.datasets.get(
            name=os.environ["DATASET_NAME"],
            version=os.environ["DATASET_VERSION"],
        )

    remote_bytes = BlobClient.from_blob_url(
        dataset.data_uri,
        credential=credential,
    ).download_blob().readall()

local_hash = hashlib.sha256(local_bytes).hexdigest()
remote_hash = hashlib.sha256(remote_bytes).hexdigest()

print({
    "id": dataset.id,
    "data_uri": dataset.data_uri,
    "local_sha256": local_hash,
    "remote_sha256": remote_hash,
    "match": local_hash == remote_hash,
})

if local_hash != remote_hash:
    raise SystemExit("Remote dataset content does not match the local version")
PY
```

Record these fields in `.foundry/evaluation-metadata.json` only after verification succeeds:

- Foundry dataset ID
- Dataset name and remote version
- Backing `dataUri`
- Local and verified remote SHA-256
- A note distinguishing prior inline runs from future named-dataset runs

## 9. Restore Network Isolation

Cleanup order matters: close storage first, verify it is closed, and only then remove the policy exemption.

```bash
az rest \
  --method PATCH \
  --uri "https://management.azure.com${STORAGE_RESOURCE_ID}?api-version=2025-06-01" \
  --headers 'Content-Type=application/json' \
  --body '{"properties":{"publicNetworkAccess":"Disabled","networkAcls":{"defaultAction":"Deny","bypass":"AzureServices","ipRules":[],"virtualNetworkRules":[]}}}'
```

If the account had pre-existing IP or VNet rules, restore the captured original values instead of the empty arrays shown above.

Verify raw ARM state:

```bash
az rest \
  --method GET \
  --uri "https://management.azure.com${STORAGE_RESOURCE_ID}?api-version=2025-06-01" \
  --query '{publicNetworkAccess:properties.publicNetworkAccess,defaultAction:properties.networkAcls.defaultAction,allowBlobPublicAccess:properties.allowBlobPublicAccess,allowSharedKeyAccess:properties.allowSharedKeyAccess}' \
  -o json
```

Expected final values:

```json
{
  "allowBlobPublicAccess": false,
  "allowSharedKeyAccess": false,
  "defaultAction": "Deny",
  "publicNetworkAccess": "Disabled"
}
```

Delete and verify removal of the exemption:

```bash
az policy exemption delete \
  --name "$EXEMPTION_NAME" \
  --scope "$STORAGE_RESOURCE_ID"

az policy exemption list \
  --scope "$STORAGE_RESOURCE_ID" \
  --query "[?name=='${EXEMPTION_NAME}'].name" \
  -o json
```

Expected exemption query result:

```json
[]
```

The permanent project RBAC assignment should remain.

## Troubleshooting by Error Transition

| Error or observation | Meaning | Next check |
| --- | --- | --- |
| `ResourceMsiTokenDoesntHavePermissionsOnStorage` from Foundry `pending_upload` | The Foundry project identity is missing storage data-plane access, the role targets the parent account identity, or RBAC has not propagated | Resolve the child project resource identity and verify `Storage Blob Data Contributor` at the storage-account scope |
| Storage update succeeds but `publicNetworkAccess` remains `Disabled` | An Azure Policy `modify` effect rewrote the request | Query policy state, create a narrow exemption for the exact policy-set reference, then use a direct ARM PATCH |
| SDK reaches `upload_blob` but returns `AuthorizationFailure` | The Foundry pending-upload step succeeded; Blob Storage is still rejecting the client, commonly at the network layer | Test `az storage container list --auth-mode login` from the same machine |
| Unauthenticated request returns `PublicAccessNotPermitted` while Entra container listing succeeds | Network access is open but anonymous blob access remains blocked | Expected state for the short authenticated upload window |
| Foundry `datasets.get` succeeds after storage is closed | The dataset registration remains in Foundry | This does not prove the backing blob is downloadable while the firewall is closed |

## AADB Reference Record

The successful August 11, 2026 registration used:

| Item | Value |
| --- | --- |
| Subscription | `7a28b21e-0d3e-4435-a686-d92889d4ee96` |
| Tenant | `a172a259-b1c7-4944-b2e1-6d551f954711` |
| Resource group | `AQ-FOUNDRY-RG` |
| Foundry account | `r2d2-foundry-001` |
| Foundry project | `Main-Project` |
| Project principal ID | `ec62541e-2ab4-4000-8cc6-9b7f0481c284` |
| Parent account principal ID, not used | `bfa2a386-2f35-4be9-9f86-4840ff169ef3` |
| Storage account | `staqmainhub339573983327` |
| Permanent role | `Storage Blob Data Contributor` |
| Permanent role assignment | `6ba93c4b-2013-4181-a959-4eb342fd9dd9` |
| Enforcing policy | `StorageAccount_PublicNetwork_Modify` |
| Policy-set reference | `storageaccountpublicnetworkmodify` |
| Dataset | `aadb-eval-seed`, version `1` |
| Dataset ID | `azureai://accounts/r2d2-foundry-001/projects/Main-Project/data/aadb-eval-seed/versions/1` |
| Verified SHA-256 | `96e9605a7c50e4be2aa7aa4da447a11406e494365e17294d1ebe29ad1316a496` |

Final measured state:

- Foundry resolves `aadb-eval-seed:1`.
- The backing blob matched the local file byte-for-byte before network closure.
- Storage public network access is disabled.
- Storage firewall default action is deny.
- Anonymous blob and shared-key access are disabled.
- The temporary policy exemption was deleted.
- Main-Project retains the permanent Blob Data Contributor assignment.

## References

- [Troubleshoot Foundry evaluation storage access](https://learn.microsoft.com/azure/foundry/observability/how-to/troubleshooting)
- [Run cloud evaluations with the Foundry SDK](https://learn.microsoft.com/azure/foundry/how-to/develop/cloud-evaluation)
- [Azure Policy exemption structure](https://learn.microsoft.com/azure/governance/policy/concepts/exemption-structure)
- [Azure Storage private endpoints](https://learn.microsoft.com/azure/storage/common/storage-private-endpoints)
- [Foundry network isolation](https://learn.microsoft.com/azure/foundry/how-to/configure-private-link)
