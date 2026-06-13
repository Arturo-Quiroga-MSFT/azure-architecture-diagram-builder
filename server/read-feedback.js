// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Read user feedback from Cosmos DB and print it to the console.
 * Keyless auth via DefaultAzureCredential (uses `az login` locally,
 * managed identity in Azure). Read-only.
 *
 * Usage:
 *   cd server && node read-feedback.js          # all feedback, newest first
 *   cd server && node read-feedback.js --json    # raw JSON output
 */

const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const ENDPOINT = process.env.AZURE_COSMOS_ENDPOINT || 'https://aqcosmosdb007.documents.azure.com:443/';
const DATABASE_ID = process.env.COSMOS_DATABASE_ID || 'diagrams-db';
const CONTAINER_ID = process.env.COSMOS_FEEDBACK_CONTAINER_ID || 'feedback';

async function main() {
  const asJson = process.argv.includes('--json');
  const client = new CosmosClient({ endpoint: ENDPOINT, aadCredentials: new DefaultAzureCredential() });
  const container = client.database(DATABASE_ID).container(CONTAINER_ID);

  const { resources } = await container.items
    .query('SELECT c.id, c.rating, c.category, c.comment, c.context, c.createdAt FROM c ORDER BY c.createdAt DESC')
    .fetchAll();

  if (asJson) {
    console.log(JSON.stringify(resources, null, 2));
    return;
  }

  console.log(`\n📋 ${resources.length} feedback ${resources.length === 1 ? 'entry' : 'entries'} (newest first)\n`);
  const emoji = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '🤩' };
  for (const r of resources) {
    const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : 'unknown';
    console.log('─'.repeat(72));
    console.log(`${emoji[r.rating] || '?'}  ${r.rating}/5   [${r.category || 'General'}]   ${when}`);
    console.log(`   "${r.comment && r.comment.trim() ? r.comment : '(no comment)'}"`);
    if (r.context && (r.context.model || r.context.diagramName)) {
      console.log(`   ↳ model=${r.context.model || '-'}  diagram=${r.context.diagramName || '-'}  services=${r.context.serviceCount ?? '-'}`);
    }
  }
  console.log('─'.repeat(72));
}

main().catch((err) => {
  console.error('Failed to read feedback:', err.message);
  process.exit(1);
});
