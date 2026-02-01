
## Bicep Template Comparison Analysis

### Quantitative Overview

| Model | Files | Lines | Zip Size | Modules Folder |
|-------|-------|-------|----------|----------------|
| **GPT-4.1-mini** | 8 | 215 | 6.9 KB | Yes (`/modules`) |
| **GPT-4.1** | 8 | 255 | 8.6 KB | No (flat) |
| **GPT-5.2 (low)** | 14 | 789 | 23.9 KB | Yes (`/modules`) |
| **GPT-5.2 (medium)** | **15** | **909** | **27.8 KB** | Yes (`/modules`) |

---

### Module Coverage

| Module | 4.1-mini | 4.1 | 5.2-low | 5.2-med |
|--------|:--------:|:---:|:-------:|:-------:|
| main.bicep | ✅ | ✅ | ✅ | ✅ |
| Event Hubs | ✅ | ✅ | ✅ | ✅ |
| Data Lake / Storage | ✅ | ✅ | ✅ | ✅ |
| Key Vault | ✅ | ✅ | ✅ | ✅ |
| Container Registry | ✅ | ✅ | ✅ | ✅ |
| Azure ML | ✅ | ✅ | ✅ | ✅ |
| API Management | ✅ | ✅ | ✅ | ✅ |
| Application Insights | ✅ | ✅ | ✅ | ✅ |
| **Log Analytics** | ❌ | ❌ | ✅ | ✅ |
| **Cosmos DB** | ❌ | ❌ | ✅ | ✅ |
| **Data Factory** | ❌ | ❌ | ✅ | ❌ |
| **App Service** | ❌ | ❌ | ✅ | ✅ |
| **Functions** | ❌ | ❌ | ✅ | ✅ |
| **RBAC Assignments** | ❌ | ❌ | ✅ | ✅ |
| **Monitor/Alerts** | ❌ | ❌ | ❌ | ✅ |
| **Connections (secrets)** | ❌ | ❌ | ❌ | ✅ |

---

### main.bicep Quality Comparison

| Feature | 4.1-mini | 4.1 | 5.2-low | 5.2-med |
|---------|:--------:|:---:|:-------:|:-------:|
| **targetScope declaration** | ❌ | ❌ | ✅ | ❌ |
| **@allowed decorator** | ❌ | ❌ | ✅ | ✅ |
| **@description decorator** | ❌ | ❌ | ✅ | ✅ |
| **@minLength/@maxLength** | ❌ | ❌ | ❌ | ✅ |
| **Environment-conditional SKUs** | ❌ | ❌ | ✅ | ❌ |
| **uniqueString for naming** | ❌ | ❌ | ✅ | ✅ |
| **Organized sections (comments)** | ❌ | ❌ | ✅ | ✅ |
| **Dependencies between modules** | Minimal | Good | Good | Good |
| **Output count** | 7 | 7 | 24 | 22 |
| **Secret URI outputs** | ❌ | ❌ | ❌ | ✅ |

---

### Key Vault Module Comparison

| Feature | 4.1-mini | 4.1 | 5.2-low | 5.2-med |
|---------|:--------:|:---:|:-------:|:-------:|
| **API Version** | 2022-07-01 | 2023-02-01 | 2023-07-01 | 2023-02-01 |
| **enableRbacAuthorization** | ❌ | ❌ | ✅ | ✅ |
| **enableSoftDelete** | ✅ | ❌ | ❌ | ❌ |
| **enablePurgeProtection** | ❌ | explicit false | ❌ | ❌ |
| **enabledForDeployment** | ❌ | ✅ | explicit false | explicit false |
| **networkAcls** | ❌ | ❌ | ✅ | ❌ |
| **publicNetworkAccess** | ❌ | ❌ | ✅ | ✅ |

---

### Advanced Features (Only in GPT-5.2)

#### **GPT-5.2 (low)** - rbac.bicep
```bicep
// Built-in role definition IDs
var kvSecretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource appKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultId, appServicePrincipalId, kvSecretsUserRoleId)
  scope: keyVaultId
  properties: {
    roleDefinitionId: kvSecretsUserRoleId
    principalId: appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}
```

#### **GPT-5.2 (medium)** - connections.bicep
- RBAC for Key Vault, Storage, Event Hubs, ACR
- **Automatically creates secrets in Key Vault**
- **Outputs secret URIs for app settings**

```bicep
resource secretEhListen 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: '${kv.name}/${secretsPrefix}-eventhubs-listen-connection'
  properties: {
    value: eventHubListenConnectionString
  }
}

output secretUri_eventHubListen string = secretEhListen.properties.secretUriWithVersion
```

---

### Syntax Issues Found

| Model | Issue |
|-------|-------|
| **GPT-4.1** | ❌ Invalid syntax: `tag: {` instead of `var tags = {` |
| **GPT-5.2-low** | ⚠️ `scope: resource(keyVaultId)` is invalid - should use existing resource reference |
| **GPT-5.2-medium** | ⚠️ Same scope issue in connections.bicep |

**Note:** GPT-4.1 main.bicep would fail to compile due to the syntax error.

---

### Bicep Best Practices Scorecard

| Practice | 4.1-mini | 4.1 | 5.2-low | 5.2-med |
|----------|:--------:|:---:|:-------:|:-------:|
| Use `@description` decorators | ❌ | ❌ | ✅ | ✅ |
| Use `@allowed` for enums | ❌ | ❌ | ✅ | ✅ |
| Use `uniqueString()` for names | ❌ | ❌ | ✅ | ✅ |
| Environment-aware configuration | ❌ | ❌ | ✅ | Partial |
| Managed Identity enabled | ❌ | ❌ | ✅ | ✅ |
| RBAC instead of access policies | ❌ | ❌ | ✅ | ✅ |
| System-assigned identity outputs | ❌ | ❌ | ✅ | ✅ |
| Key Vault secret creation | ❌ | ❌ | ❌ | ✅ |
| Proper module organization | ✅ | ❌ (flat) | ✅ | ✅ |
| Comprehensive outputs | Basic | Basic | Good | **Best** |

---

### Dependency on Deployment Guide?

**Answer: Partially, but Bicep generation is more autonomous.**

| Aspect | Dependency Level |
|--------|------------------|
| Module structure | Independent (based on architecture) |
| Resource names | Independent (model decides pattern) |
| SKU tiers | Low (generic defaults) |
| App settings | **High** (needs deployment guide context) |
| Secret names | **High** (needs app knowledge) |
| RBAC assignments | Medium (based on architecture understanding) |

The deployment guide references Bicep outputs, but **doesn't control Bicep structure**. GPT-5.2-medium's connections.bicep with automatic secret creation shows tight integration thinking.

---

### Recommendation for Bicep Generation

| Scenario | Best Model |
|----------|------------|
| Quick prototype | GPT-4.1-mini |
| **Production infrastructure** | **GPT-5.2 (medium)** ✅ |
| Learning/educational | GPT-5.2 (low) |
| Complex multi-env setup | GPT-5.2 (low or medium) |

### Verdict: **Use GPT-5.2 Medium for Bicep**

1. **4x more code** (909 vs 215 lines) with meaningful content
2. **Only model that creates secrets** in Key Vault automatically
3. **Best output set** including secret URIs for app configuration
4. **Monitor/alerting module** included
5. **Proper RBAC assignments** for all service identities

**However**, note these require manual fixes:
- Both 5.2 models have invalid `scope: resource()` syntax in RBAC modules
- GPT-4.1 has a fatal syntax error (`tag:` vs `var tags =`)

**Final recommendation:** Use **GPT-5.2 medium** for Bicep, but plan for light manual review/fixes on RBAC module scoping.