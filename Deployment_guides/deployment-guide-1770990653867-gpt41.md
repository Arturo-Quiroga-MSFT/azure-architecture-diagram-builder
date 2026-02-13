# Deploy Secure Web Application Architecture with WAF, Private Link, Redis, and Monitoring on Azure

## Overview

This guide enables deployment of a secure and highly-available web application architecture on Azure. It incorporates a Web Application Firewall (WAF) with Azure Front Door, App Service for application hosting, Azure Cache for Redis for caching, secure connectivity using Azure Private Link and Azure DNS, centralized monitoring via Azure Monitor, Application Insights, and Log Analytics, plus SIEM integration through Microsoft Sentinel.

**Estimated Time:** 45-60 minutes

**Estimated Cost:** $202.32/month

## Prerequisites

- Azure subscription (Owner or Contributor access)
- Azure CLI 2.50.0+ installed
- Bicep CLI 0.22+ (az bicep install)
- App Service source package (e.g. .zip) ready for deployment
- Permissions to register resource providers, create networking and security resources

## Deployment Steps

### Step 1: Authenticate and Set Subscription

Login to your Azure account and set the active subscription.

**Commands:**
```bash
az login
az account set --subscription <your-subscription-id>
```

**Notes:**
- 💡 Ensure your account has the required permissions for all resource types.

### Step 2: Initialize Deployment Variables

Set environment variables for consistent naming and ease of use.

**Commands:**
```bash
export AZ_RG=rg-secureweb-${USER}
export AZ_LOCATION=eastus
export AZ_ENV=prod
```

**Notes:**
- 💡 Adjust AZ_LOCATION and AZ_ENV as needed for your environment.

### Step 3: Create Resource Group

Provision the central resource group for all resources.

**Commands:**
```bash
az group create --name $AZ_RG --location $AZ_LOCATION
```

**Notes:**
- 💡 Resource group names must be unique within your subscription.

### Step 4: Deploy Infrastructure with Bicep

Provision all services using the provided Bicep templates. Ensure files are present in your working directory.

**Commands:**
```bash
az deployment group create --resource-group $AZ_RG --template-file main.bicep --parameters environment=$AZ_ENV location=$AZ_LOCATION
```

**Notes:**
- 💡 Deployment will output resource endpoints and secrets for later steps.

### Step 5: Deploy Application Code to App Service

Deploy your application source package or container to the newly created App Service.

**Commands:**
```bash
az webapp deployment source config-zip --resource-group $AZ_RG --name <appServiceName> --src <your-app.zip>
```

**Notes:**
- 💡 Replace <appServiceName> and <your-app.zip> with actual values from Bicep outputs.

## Configuration

### Application Insights & Monitor

| Setting | Value | Description |
|---------|-------|-------------|
| `APPINSIGHTS_INSTRUMENTATIONKEY` | <instrumentationKeyFromOutput> | Enables Application Insights telemetry in App Service. Add to App Service Application Settings. |

### Web Application Firewall

| Setting | Value | Description |
|---------|-------|-------------|
| `WAF_POLICY` | Default or custom rules for request inspection | Adjust the policy in the Bicep parameters as per compliance requirements. |

### Private DNS

| Setting | Value | Description |
|---------|-------|-------------|
| `DNS_ZONE_NAME` | <privateDnsZone> | Configure in Azure DNS for Private Link resource name resolution. |

### Connections

| Setting | Value | Description |
|---------|-------|-------------|
| `Redis Host/Key` | <from Bicep outputs> | Add Redis connection info to App Service settings for runtime usage. |
| `SQL Connection String` | <from Bicep outputs> | Use Secure connection string; ensure integration with Private Link. |

## Post-Deployment Validation

- [ ] Navigate to the App Service URL via Azure Front Door (WAF-protected endpoint) and verify public access.
- [ ] Access Azure Cache for Redis and SQL Database only via Private Endpoint (private IP addressing).
- [ ] Confirm Application Insights is collecting custom telemetry/traces from the app.
- [ ] Ensure logs from Azure Monitor are visible in Log Analytics Workspace and surfaced through Microsoft Sentinel SIEM dashboards.
- [ ] Check Azure DNS private zones for correct resolution of private endpoints (SQL, Redis).

## Troubleshooting

**Issue:** Validation failed: One or more resource providers not registered.

**Solution:** Register with: az provider register --namespace Microsoft.<ProviderName>

**Issue:** App Service cannot connect to Redis/SQL

**Solution:** Verify Private Endpoint DNS configuration; check NSGs and RBAC for network restrictions.

**Issue:** No telemetry appears in Application Insights

**Solution:** Ensure the APPINSIGHTS_INSTRUMENTATIONKEY is set in Application Settings and that the application is properly instrumented.

**Issue:** Azure Front Door shows 502 errors

**Solution:** Check WAF rules and App Service health. Ensure App Service is accessible from Azure Front Door and WAF.

**Issue:** Microsoft Sentinel is not receiving logs

**Solution:** Validate workspace connections and that diagnostic settings are enabled on monitored resources.

---

*Generated: 2026-02-13, 8:48:44 a.m.*
