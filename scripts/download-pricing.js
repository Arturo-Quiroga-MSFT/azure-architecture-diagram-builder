/**
 * Script to download Azure pricing data from the Azure Retail Prices API
 * Usage: node scripts/download-pricing.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Services to download pricing for
const SERVICES = [
  { name: 'Azure Front Door', filename: 'azure_front_door' },
  { name: 'Static Web Apps', filename: 'static_web_apps' },
  { name: 'Azure Database for PostgreSQL', filename: 'azure_database_for_postgresql' },
  { name: 'Azure Key Vault', filename: 'azure_key_vault' },
  { name: 'Application Insights', filename: 'application_insights' },
  { name: 'Azure Data Factory', filename: 'azure_data_factory' },
  { name: 'Azure Event Hubs', filename: 'azure_event_hubs' },
  { name: 'Container Registry', filename: 'container_registry' },
  { name: 'Azure Data Lake Storage', filename: 'azure_data_lake_storage' },
  { name: 'Azure Functions', filename: 'azure_functions' },
  { name: 'Logic Apps', filename: 'logic_apps' },
  { name: 'Azure Service Bus', filename: 'azure_service_bus' },
  { name: 'Azure Cache for Redis', filename: 'azure_cache_for_redis' },
  { name: 'Azure CDN', filename: 'azure_cdn' },
];

// Regions to download for
const REGIONS = [
  { id: 'eastus2', armName: 'eastus2' },
  { id: 'swedencentral', armName: 'swedencentral' },
  { id: 'westeurope', armName: 'westeurope' },
];

const BASE_URL = 'https://prices.azure.com/api/retail/prices';
const OUTPUT_DIR = path.join(__dirname, '../src/data/pricing/regions');

/**
 * Make HTTPS request with promise
 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download all pricing items for a service in a region
 */
async function downloadServicePricing(serviceName, region, maxPages = 50) {
  console.log(`\n📥 Downloading ${serviceName} pricing for ${region.id}...`);
  
  const filter = `serviceName eq '${serviceName}' and armRegionName eq '${region.armName}'`;
  const initialUrl = `${BASE_URL}?$filter=${encodeURIComponent(filter)}`;
  
  let allItems = [];
  let nextUrl = initialUrl;
  let pageCount = 0;
  
  while (nextUrl && pageCount < maxPages) {
    try {
      const response = await httpsGet(nextUrl);
      allItems = allItems.concat(response.Items || []);
      nextUrl = response.NextPageLink;
      pageCount++;
      
      console.log(`  Page ${pageCount}: ${response.Items?.length || 0} items (Total: ${allItems.length})`);
      
      // Small delay to avoid rate limiting
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`  ❌ Error on page ${pageCount + 1}:`, error.message);
      break;
    }
  }
  
  return allItems;
}

/**
 * Save pricing data to JSON file
 */
function savePricingData(service, region, items) {
  const regionDir = path.join(OUTPUT_DIR, region.id);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(regionDir)) {
    fs.mkdirSync(regionDir, { recursive: true });
  }
  
  const filePath = path.join(regionDir, `${service.filename}.json`);
  
  const data = {
    BillingCurrency: items.length > 0 ? items[0].currencyCode : 'USD',
    Items: items
  };
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  ✅ Saved ${items.length} items to ${filePath}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Azure pricing download...\n');
  console.log(`Services: ${SERVICES.length}`);
  console.log(`Regions: ${REGIONS.length}`);
  console.log(`Total downloads: ${SERVICES.length * REGIONS.length}\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const service of SERVICES) {
    for (const region of REGIONS) {
      try {
        const items = await downloadServicePricing(service.name, region);
        
        if (items.length > 0) {
          savePricingData(service, region, items);
          successCount++;
        } else {
          console.log(`  ⚠️  No items found for ${service.name} in ${region.id}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`  ❌ Failed to download ${service.name} for ${region.id}:`, error.message);
        errorCount++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(60));
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
