// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Draft Storage Service
 * Autosaves the working diagram so an accidental reload or tab close does not
 * discard it. Deliberately a separate IndexedDB database from version history:
 * the draft is overwritten constantly and must never risk the user's snapshots.
 */

export interface DiagramDraft {
  savedAt: number;
  diagramName: string;
  nodes: any[];
  edges: any[];
  architecturePrompt?: string;
  originalPrompt?: string;
  workflow?: any[];
  titleBlockData?: any;
}

const DB_NAME = 'AzureDiagramDraft';
const STORE_NAME = 'draft';
const DB_VERSION = 1;
const DRAFT_KEY = 'current';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

/** Overwrites the single draft record. Never throws: autosave must not break editing. */
export const saveDraft = async (draft: DiagramDraft): Promise<void> => {
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      // JSON round-trip drops anything structured-clone would reject.
      const request = store.put(JSON.parse(JSON.stringify(draft)), DRAFT_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Autosave failed; continuing without saving this change.', error);
  }
};

export const loadDraft = async (): Promise<DiagramDraft | null> => {
  try {
    const db = await initDB();
    return await new Promise<DiagramDraft | null>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DRAFT_KEY);
      request.onsuccess = () => resolve((request.result as DiagramDraft) || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Could not read the autosaved draft.', error);
    return null;
  }
};

export const clearDraft = async (): Promise<void> => {
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(DRAFT_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Could not clear the autosaved draft.', error);
  }
};
