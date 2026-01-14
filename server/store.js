import fs from 'node:fs/promises';
import path from 'node:path';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';

function getEnv(name, fallback) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : fallback;
}

function createCosmosClientFromEnv() {
  const endpoint = getEnv('AZURE_COSMOS_ENDPOINT', undefined);
  if (!endpoint) return null;

  const key = getEnv('AZURE_COSMOS_KEY', undefined);
  if (key) {
    return new CosmosClient({ endpoint, key });
  }

  // Use DefaultAzureCredential (Azure CLI for dev, Managed Identity for prod)
  const credential = new DefaultAzureCredential();
  return new CosmosClient({ endpoint, aadCredentials: credential });
}

function createCosmosDbDiagramStore() {
  const cosmosClient = createCosmosClientFromEnv();
  if (!cosmosClient) return null;

  const databaseId = getEnv('COSMOS_DATABASE_ID', 'diagrams-db');
  const containerId = getEnv('COSMOS_CONTAINER_ID', 'diagrams');

  let ensured = false;
  const ensureContainerAndDb = async () => {
    if (ensured) return;
    try {
      // Create database if not exists
      const { database } = await cosmosClient.databases.createIfNotExists({ id: databaseId });
      console.log(`✓ Cosmos DB database ready: ${databaseId}`);
      
      // Create container if not exists (partition key: /id)
      const { container } = await database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: ['/id'] },
      });
      console.log(`✓ Cosmos DB container ready: ${containerId}`);
      
      ensured = true;
    } catch (e) {
      console.error(`✗ Failed to ensure Cosmos DB container ${containerId}:`, {
        message: e?.message,
        code: e?.code,
        statusCode: e?.statusCode,
      });
      throw e;
    }
  };

  const database = cosmosClient.database(databaseId);
  const container = database.container(containerId);

  return {
    kind: 'cosmos-db',

    async save(id, payload) {
      try {
        await ensureContainerAndDb();
        const item = {
          id,
          ...payload,
          createdAt: payload.createdAt || new Date().toISOString(),
        };
        await container.items.upsert(item);
        console.log(`✓ Saved diagram ${id} to Cosmos DB (${databaseId}/${containerId})`);
      } catch (e) {
        console.error(`✗ Cosmos DB save failed for ${id}:`, {
          message: e?.message,
          code: e?.code,
          statusCode: e?.statusCode,
        });
        throw e;
      }
    },

    async get(id) {
      await ensureContainerAndDb();
      try {
        const { resource } = await container.item(id, id).read();
        return resource || null;
      } catch (e) {
        // Cosmos DB returns 404 for not found
        const statusCode = e && typeof e === 'object' ? e.statusCode || e.code : undefined;
        if (statusCode === 404) return null;
        throw e;
      }
    },
  };
}

function createFsDiagramStore() {
  const defaultDir = process.env.NODE_ENV === 'production' ? '/tmp/diagrams' : path.resolve(process.cwd(), '.data/diagrams');
  const dir = getEnv('LOCAL_DIAGRAM_STORE_DIR', defaultDir);

  let ensured = false;
  const ensureDir = async () => {
    if (ensured) return;
    await fs.mkdir(dir, { recursive: true });
    ensured = true;
  };

  return {
    kind: 'fs',

    async save(id, payload) {
      await ensureDir();
      const filePath = path.join(dir, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(payload), 'utf8');
    },

    async get(id) {
      await ensureDir();
      const filePath = path.join(dir, `${id}.json`);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw);
      } catch (e) {
        if (e && typeof e === 'object' && e.code === 'ENOENT') return null;
        throw e;
      }
    },
  };
}

export function createDiagramStore() {
  const cosmos = createCosmosDbDiagramStore();
  const fs = createFsDiagramStore();
  
  if (!cosmos) {
    console.log('⚠ No Cosmos DB config found, using filesystem store');
    return fs;
  }

  // Wrap Cosmos store with automatic fallback to filesystem on auth/permission errors
  return {
    kind: 'cosmos-db-with-fallback',

    async save(id, payload) {
      try {
        await cosmos.save(id, payload);
      } catch (e) {
        const statusCode = e?.statusCode || e?.code;
        if (statusCode === 401 || statusCode === 403 || e?.message?.includes('Unauthorized')) {
          console.warn(`⚠ Cosmos DB unavailable (${statusCode}), falling back to filesystem`);
          await fs.save(id, payload);
        } else {
          throw e;
        }
      }
    },

    async get(id) {
      try {
        return await cosmos.get(id);
      } catch (e) {
        const statusCode = e?.statusCode || e?.code;
        if (statusCode === 401 || statusCode === 403 || e?.message?.includes('Unauthorized')) {
          console.warn(`⚠ Cosmos DB unavailable (${statusCode}), falling back to filesystem`);
          return await fs.get(id);
        }
        // For 404s and other errors, let them bubble up
        throw e;
      }
    },
  };
}
