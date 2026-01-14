/**
 * Version Storage Service
 * Manages diagram version history using IndexedDB for local persistence
 */

export interface DiagramVersion {
  versionId: string;
  timestamp: number;
  diagramName: string;
  architecturePrompt?: string;
  validationScore?: number;
  parentVersionId?: string;
  improvementsApplied?: string[];
  notes?: string;
  nodes: any[];
  edges: any[];
  metadata?: any;
  workflow?: any[];
  titleBlockData?: any;
}

const DB_NAME = 'AzureDiagramVersions';
const STORE_NAME = 'versions';
const DB_VERSION = 1;

/**
 * Initialize IndexedDB database
 */
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'versionId' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('diagramName', 'diagramName', { unique: false });
      }
    };
  });
};

/**
 * Save a new diagram version
 */
export const saveVersion = async (version: DiagramVersion): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(version);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get all versions sorted by timestamp (newest first)
 */
export const getAllVersions = async (): Promise<DiagramVersion[]> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const versions = request.result as DiagramVersion[];
      // Sort by timestamp descending (newest first)
      versions.sort((a, b) => b.timestamp - a.timestamp);
      resolve(versions);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get a specific version by ID
 */
export const getVersion = async (versionId: string): Promise<DiagramVersion | null> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(versionId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete a specific version
 */
export const deleteVersion = async (versionId: string): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(versionId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete all versions
 */
export const clearAllVersions = async (): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Generate a unique version ID
 */
export const generateVersionId = (): string => {
  return `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a snapshot of current diagram state
 */
export const createSnapshot = async (
  nodes: any[],
  edges: any[],
  diagramName: string,
  options?: {
    architecturePrompt?: string;
    validationScore?: number;
    parentVersionId?: string;
    improvementsApplied?: string[];
    notes?: string;
    metadata?: any;
    workflow?: any[];
    titleBlockData?: any;
  }
): Promise<DiagramVersion> => {
  const version: DiagramVersion = {
    versionId: generateVersionId(),
    timestamp: Date.now(),
    diagramName,
    nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
    edges: JSON.parse(JSON.stringify(edges)), // Deep clone
    ...options
  };

  await saveVersion(version);
  return version;
};

/**
 * Get version count
 */
export const getVersionCount = async (): Promise<number> => {
  const versions = await getAllVersions();
  return versions.length;
};
