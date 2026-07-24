/**
 * Unified AADB import — auto-detects and accepts either AADB export format:
 *   - the az-prototype Manifest v1.0 (schemaVersion "1.0"), or
 *   - the current ReactFlow scene export (nodes/edges/metadata).
 *
 * Both are normalized to an az-prototype manifest and then promoted into a
 * physical manifest via the deterministic promoter.
 */
import { safeParseAadbManifest } from "./aadbManifest.js";
import { promoteFromAadb, type PromotionResult } from "./promote.js";
import { isReactFlowScene, sceneToAadbManifest } from "./sceneImport.js";

export type AadbImportFormat = "manifest" | "scene";

export interface AadbImportSuccess extends PromotionResult {
  ok: true;
  format: AadbImportFormat;
}
export interface AadbImportFailure {
  ok: false;
  error: string;
}
export type AadbImportOutcome = AadbImportSuccess | AadbImportFailure;

export function importAnyAadb(raw: unknown): AadbImportOutcome {
  // 1. Try the documented az-prototype manifest first.
  const asManifest = safeParseAadbManifest(raw);
  if (asManifest.success) {
    return { ok: true, format: "manifest", ...promoteFromAadb(asManifest.data) };
  }

  // 2. Fall back to the ReactFlow scene export.
  if (isReactFlowScene(raw)) {
    const manifest = sceneToAadbManifest(raw);
    const promotion = promoteFromAadb(manifest);
    return { ok: true, format: "scene", ...promotion };
  }

  return {
    ok: false,
    error:
      "Unrecognized file. Expected an AADB az-prototype manifest (schemaVersion 1.0) " +
      "or an AADB diagram JSON export (with a nodes array).",
  };
}
