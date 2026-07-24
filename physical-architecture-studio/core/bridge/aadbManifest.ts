/**
 * AADB interchange schema — the "az prototype Manifest v1.0" that the main
 * Azure Architecture Diagram Builder (AADB) imports and exports as JSON.
 *
 * This is the contract for the AADB <-> Physical Architecture Studio bridge.
 * Source of truth in AADB: src/services/azPrototypeService.ts (AzPrototypeManifest).
 * We mirror it here as a Zod schema so the bridge can validate both directions.
 */
import { z } from "zod";

export const aadbServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Canonical Azure service name from the AADB catalog, e.g. "Azure OpenAI". */
  type: z.string(),
  category: z.string().default("other"),
  description: z.string().default(""),
  groupId: z.string().nullable().default(null),
});
export type AadbService = z.infer<typeof aadbServiceSchema>;

export const aadbConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().default(""),
  type: z.enum(["sync", "async", "optional"]).default("sync"),
});
export type AadbConnection = z.infer<typeof aadbConnectionSchema>;

export const aadbGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const aadbWorkflowStepSchema = z.object({
  step: z.number(),
  description: z.string(),
  services: z.array(z.string()).default([]),
});

export const aadbManifestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  source: z.enum(["azure-diagram-builder", "az-prototype", "physical-architecture-studio"]),
  createdAt: z.string(),
  project: z.object({
    name: z.string(),
    location: z.string().default("eastus2"),
    iacTool: z.enum(["bicep", "terraform"]).default("bicep"),
  }),
  architecture: z.object({
    services: z.array(aadbServiceSchema).default([]),
    connections: z.array(aadbConnectionSchema).default([]),
    groups: z.array(aadbGroupSchema).default([]),
    workflow: z.array(aadbWorkflowStepSchema).default([]),
  }),
  metadata: z.record(z.unknown()).optional(),
});

export type AadbManifest = z.infer<typeof aadbManifestSchema>;

export function parseAadbManifest(input: unknown): AadbManifest {
  return aadbManifestSchema.parse(input);
}

export function safeParseAadbManifest(input: unknown) {
  return aadbManifestSchema.safeParse(input);
}
