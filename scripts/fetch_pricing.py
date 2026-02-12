#!/usr/bin/env python3
"""Fetch pricing data from Azure Retail Prices API for missing services."""

import json
import urllib.request
import urllib.parse
import os
import time

REGIONS = ['eastus2', 'canadacentral', 'swedencentral', 'westeurope', 'brazilsouth']

# Service name in API -> output filename
SERVICES = {
    'IoT Hub': 'iot_hub',
    'IoT Central': 'azure_iot_central',
    'Digital Twins': 'azure_digital_twins',
    'Azure Container Apps': 'azure_container_apps',
    'Load Balancer': 'azure_load_balancer',
    'Traffic Manager': 'azure_traffic_manager',
    'SignalR': 'azure_signalr_service',
    'Azure API for FHIR': 'azure_api_for_fhir',
}

# Services that use 'Global' region instead of specific regions
GLOBAL_SERVICES = {'Load Balancer', 'Traffic Manager'}

BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'data', 'pricing', 'regions')

def fetch_pricing(svc_name, region):
    filt = f"serviceName eq '{svc_name}' and armRegionName eq '{region}'"
    url = f"https://prices.azure.com/api/retail/prices?$filter={urllib.parse.quote(filt)}"
    
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    
    items = data.get('Items', [])
    
    # Handle pagination
    next_page = data.get('NextPageLink')
    while next_page:
        req2 = urllib.request.Request(next_page)
        with urllib.request.urlopen(req2, timeout=30) as resp2:
            page = json.loads(resp2.read().decode())
        items.extend(page.get('Items', []))
        next_page = page.get('NextPageLink')
        time.sleep(0.2)
    
    return items

def main():
    for svc_name, filename in SERVICES.items():
        for region in REGIONS:
            outpath = os.path.join(BASE_DIR, region, f'{filename}.json')
            
            if os.path.exists(outpath):
                print(f'SKIP {region}/{filename}.json (exists)')
                continue
            
            try:
                # Use 'Global' region for services that don't have regional pricing
                api_region = 'Global' if svc_name in GLOBAL_SERVICES else region
                items = fetch_pricing(svc_name, api_region)
                
                output = {
                    "BillingCurrency": "USD",
                    "CustomerEntityId": "Default",
                    "CustomerEntityType": "Retail",
                    "Items": items,
                    "Count": len(items)
                }
                
                os.makedirs(os.path.dirname(outpath), exist_ok=True)
                with open(outpath, 'w') as f:
                    json.dump(output, f, indent=2)
                
                print(f'OK   {region}/{filename}.json ({len(items)} items)')
                time.sleep(0.3)
            except Exception as e:
                print(f'ERR  {region}/{filename}.json: {e}')
    
    print('\nDone!')

if __name__ == '__main__':
    main()
