import referenceArchitectures from '../data/referenceArchitectures.json';
import { createEmbedding, cosineSimilarity } from './embeddingService';

interface ReferenceArchitecture {
  id: string;
  name: string;
  description: string;
  services: string[];
  pattern: string;
  url: string;
  embedding?: number[];
}

// In-memory cache of architectures with embeddings
let architecturesWithEmbeddings: ReferenceArchitecture[] = [];
let isInitialized = false;

export async function initializeReferenceArchitectures(): Promise<void> {
  if (isInitialized) return;

  console.log('Initializing reference architectures with embeddings...');
  
  try {
    // Create embeddings for all reference architectures
    architecturesWithEmbeddings = await Promise.all(
      referenceArchitectures.map(async (arch) => {
        const embedding = await createEmbedding(arch.description);
        return { ...arch, embedding };
      })
    );
    
    isInitialized = true;
    console.log(`✓ Initialized ${architecturesWithEmbeddings.length} reference architectures`);
  } catch (error) {
    console.error('Failed to initialize reference architectures:', error);
    // Fall back to architectures without embeddings
    architecturesWithEmbeddings = referenceArchitectures as ReferenceArchitecture[];
  }
}

export async function findSimilarArchitectures(
  userDescription: string,
  topK: number = 3
): Promise<ReferenceArchitecture[]> {
  // Initialize if needed
  if (!isInitialized) {
    await initializeReferenceArchitectures();
  }

  // If no embeddings available, return empty
  if (!architecturesWithEmbeddings[0]?.embedding) {
    return [];
  }

  try {
    // Create embedding for user description
    const queryEmbedding = await createEmbedding(userDescription);

    // Calculate similarity scores
    const scores = architecturesWithEmbeddings.map((arch) => ({
      architecture: arch,
      score: arch.embedding ? cosineSimilarity(queryEmbedding, arch.embedding) : 0,
    }));

    // Sort by score descending and return top K
    scores.sort((a, b) => b.score - a.score);
    
    return scores.slice(0, topK).map((s) => s.architecture);
  } catch (error) {
    console.error('Error finding similar architectures:', error);
    return [];
  }
}

export function getAllReferenceArchitectures(): ReferenceArchitecture[] {
  return referenceArchitectures as ReferenceArchitecture[];
}
