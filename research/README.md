# Azure Pricing API Research

This directory contains scripts and data for understanding the Azure Retail Prices API structure.

## Scripts

### `analyze-pricing-api.sh`
Fetches fresh data from the Azure Retail Prices API and analyzes:
- Service names that work vs don't work
- Response structure (fields, SKUs, price types)
- Sample data for different services
- Complete list of available service names

**Usage:**
```bash
cd research
chmod +x analyze-pricing-api.sh
./analyze-pricing-api.sh
```

### `analyze-existing-data.sh`
Analyzes the pricing data we've already downloaded:
- Shows what services have data vs empty results
- Displays price ranges and item counts
- Identifies which regions have data

**Usage:**
```bash
cd research
chmod +x analyze-existing-data.sh
./analyze-existing-data.sh
```

## Output

Both scripts create data in the `samples/` subdirectory:
- `*_eastus2.json` - Full API responses for each service
- `*_sample.json` - Single item structure examples
- `all_service_names.txt` - Complete list of service names from API

## Goals

1. Understand Azure Retail Prices API response structure
2. Identify correct service names for AI services
3. Learn about SKUs, tiers, and pricing models
4. Map user-facing service names to API service names
