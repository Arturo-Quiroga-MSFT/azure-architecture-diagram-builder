# Azure Pricing API Experiment Scripts

Scripts for fetching and analyzing Azure pricing data using curl commands.

## Prerequisites

- `curl` - HTTP client
- `jq` - JSON processor (install with: `brew install jq` on macOS)

## Scripts

### 1. `test-azure-pricing-api.sh`
Quick API connectivity test and response structure verification.

```bash
./scripts/test-azure-pricing-api.sh
```

**What it does:**
- Tests basic API connectivity
- Fetches sample Virtual Machines pricing for East US
- Shows the JSON response structure

---

### 2. `discover-services.sh`
Discovers all available Azure services from the Pricing API.

```bash
./scripts/discover-services.sh
```

**Output:**
- `available_services_TIMESTAMP.txt` - Line-separated service names
- `available_services_TIMESTAMP.json` - JSON array of service names

---

### 3. `fetch-multi-region-pricing.sh`
Legacy exploratory fetch helper for the 14 bundled region codes. It is not the
authoritative snapshot refresh because it does not provide atomic replacement,
complete pagination validation, or the canonical 80-query inventory.

```bash
./scripts/fetch-multi-region-pricing.sh
```

**What it does:**
- Downloads its embedded service list across 14 regions
- Organizes data by region in separate directories
- Limits to 100 items per service/region for testing
- Includes small delays to avoid rate limiting

**Output directory structure:**
```
pricing_data_TIMESTAMP/
├── eastus2/
│   ├── azure_app_service.json
│   ├── virtual_machines.json
│   └── ...
├── swedencentral/
│   └── ...
└── westeurope/
    └── ...
```

---

### 4. `fetch-all-pricing-paginated.sh`
Downloads ALL pricing data for a specific region with pagination.

```bash
# Default: eastus2
./scripts/fetch-all-pricing-paginated.sh

# Specify region
./scripts/fetch-all-pricing-paginated.sh swedencentral
```

**What it does:**
- Fetches all pricing items for a region using pagination
- Handles NextPageLink for complete data download
- Safety limit of 50 pages (~5000 items) - remove if you want everything
- Combines all pages into single JSON file
- Shows summary of unique services found

**Output:**
- `all_services_pricing_TIMESTAMP.json` - Complete pricing data

⚠️ **Note:** This can download 100MB+ of data and take several minutes.

---

### 5. `compare-regional-pricing.sh`
Generates a comparison report showing price differences across regions.

```bash
./scripts/compare-regional-pricing.sh
```

**What it does:**
- Compares pricing for 5 key services across all 14 bundled regions
- Shows top 3 SKUs per service/region
- Generates readable text report

**Output:**
- `pricing_comparison_TIMESTAMP.txt` - Comparison report
- Also displays report in terminal

---

## API Details

**Endpoint:** `https://prices.azure.com/api/retail/prices`

**Query Parameters:**
- `api-version` - API version (currently: `2023-01-01-preview`)
- `$filter` - OData filter expression
- `$top` - Number of items per page (max: 100)
- `$skip` - Pagination offset

**Common Filters:**
```bash
# Service in specific region
serviceName eq 'Virtual Machines' and armRegionName eq 'eastus'

# Consumption pricing only (exclude reservations)
priceType eq 'Consumption'

# Combine filters
serviceName eq 'Storage' and armRegionName eq 'eastus' and priceType eq 'Consumption'
```

**Response Structure:**
```json
{
  "BillingCurrency": "USD",
  "CustomerEntityId": "Default",
  "CustomerEntityType": "Retail",
  "Items": [
    {
      "currencyCode": "USD",
      "tierMinimumUnits": 0.0,
      "retailPrice": 0.096,
      "unitPrice": 0.096,
      "armRegionName": "eastus",
      "location": "US East",
      "effectiveStartDate": "2023-01-01T00:00:00Z",
      "meterId": "...",
      "meterName": "D2 v3",
      "productId": "...",
      "skuId": "...",
      "productName": "Virtual Machines Dv3 Series",
      "skuName": "D2 v3",
      "serviceName": "Virtual Machines",
      "serviceId": "...",
      "serviceFamily": "Compute",
      "unitOfMeasure": "1 Hour",
      "type": "Consumption",
      "isPrimaryMeterRegion": true,
      "armSkuName": "Standard_D2_v3"
    }
  ],
  "NextPageLink": "...",
  "Count": 5000
}
```

## Examples

### Fetch specific service for one region
```bash
curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$filter=serviceName eq 'Azure Cosmos DB' and armRegionName eq 'eastus'&\$top=10" | jq '.'
```

### Count items for a service
```bash
curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$filter=serviceName eq 'Storage'&\$top=1" | jq '.Count'
```

### Get all regions for a service
```bash
curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$filter=serviceName eq 'Virtual Machines'&\$top=100" | jq -r '.Items[].armRegionName' | sort -u
```

## Tips

1. **Rate Limiting:** The API doesn't publicly document rate limits, but adding small delays (0.3-0.5s) between requests is recommended
2. **Pagination:** Use `$skip` and `NextPageLink` for complete data
3. **Filtering:** Combine filters with `and` operator for precise queries
4. **Service Names:** Use exact matches - case sensitive!
5. **Regional Codes:** Use `armRegionName` (e.g., 'eastus', 'westeurope') not display names

## Next Steps

For production snapshot work:
1. Update `src/data/pricingRegions.ts`, then align the non-TypeScript refresh/audit lists that consume the same region IDs.
2. Run `npm run pricing:refresh` for paginated, staged, atomic replacement.
3. Run `npm run pricing:audit`, `npm run pricing:audit-semantics`, `npm run test:pricing-mode`, `npm run build`, and the MCP contract suite.
4. Keep `src/utils/pricingHelpers.ts`, audit region lists, docs, and MCP discovery metadata aligned with the canonical bundle.
