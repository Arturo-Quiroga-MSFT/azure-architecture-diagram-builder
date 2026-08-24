import { useCallback, useState } from 'react';
import type { BlueprintArchitecture } from '../services/blueprintArchitectureAI';
import type { ReferenceArchitecture } from '../services/referenceArchitectureAI';

export interface GeneratedModel {
  name: string;
  timeMs?: number;
}

export interface GenerationWorkflowStep {
  step: number;
  description: string;
  services: string[];
}

interface RestoreGenerationSession {
  architecturePrompt?: string;
  originalPrompt?: string;
  workflow?: GenerationWorkflowStep[];
}

export function useGenerationSession() {
  const [architecturePrompt, setArchitecturePrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [workflow, setWorkflow] = useState<GenerationWorkflowStep[]>([]);
  const [generatedWithModel, setGeneratedWithModel] = useState<GeneratedModel | null>(null);
  const [lastReferenceArchitecture, setLastReferenceArchitecture] = useState<ReferenceArchitecture | null>(null);
  const [lastBlueprintArchitecture, setLastBlueprintArchitecture] = useState<BlueprintArchitecture | null>(null);

  const resetGenerationSession = useCallback(() => {
    setArchitecturePrompt('');
    setOriginalPrompt('');
    setWorkflow([]);
    setGeneratedWithModel(null);
    setLastReferenceArchitecture(null);
    setLastBlueprintArchitecture(null);
  }, []);

  const beginGeneration = useCallback((prompt: string, isRefinement: boolean) => {
    setArchitecturePrompt(prompt);
    if (!isRefinement) setOriginalPrompt(prompt);
    setWorkflow([]);
    setGeneratedWithModel(null);
    setLastReferenceArchitecture(null);
    setLastBlueprintArchitecture(null);
  }, []);

  const restoreGenerationSession = useCallback((session: RestoreGenerationSession) => {
    const prompt = session.architecturePrompt || '';
    setArchitecturePrompt(prompt);
    setOriginalPrompt(session.originalPrompt || prompt);
    setWorkflow(Array.isArray(session.workflow) ? session.workflow : []);
    setGeneratedWithModel(null);
    setLastReferenceArchitecture(null);
    setLastBlueprintArchitecture(null);
  }, []);

  return {
    architecturePrompt,
    originalPrompt,
    workflow,
    setWorkflow,
    generatedWithModel,
    setGeneratedWithModel,
    lastReferenceArchitecture,
    setLastReferenceArchitecture,
    lastBlueprintArchitecture,
    setLastBlueprintArchitecture,
    beginGeneration,
    resetGenerationSession,
    restoreGenerationSession,
  };
}