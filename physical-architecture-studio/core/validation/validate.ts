/**
 * Validation orchestrator — combines structural (schema) validation and
 * deterministic IPAM analysis into a single report the UI and CLI consume.
 *
 * This is the "CIDR validation: Passed" gate in the demo. It is intentionally
 * deterministic and model-free.
 */
import {
  safeParseManifest,
  type PhysicalManifest,
} from "../manifest/schema.js";
import { analyzeIpam, type IpamReport, type IpamFinding } from "../ipam/engine.js";
import { checkAlzConformance, type AlzReport } from "./alz.js";

export interface ValidationReport {
  ok: boolean;
  /** True only if the input parsed against the manifest schema. */
  schemaValid: boolean;
  schemaErrors: string[];
  ipam?: IpamReport;
  /** Azure Landing Zone conformance (advisory). */
  alz?: AlzReport;
  /** Convenience roll-up of all IPAM findings. */
  findings: IpamFinding[];
}

/**
 * Validate an unknown input end-to-end: schema first, then IPAM. If the schema
 * fails, IPAM is skipped (there is nothing safe to analyze).
 */
export function validateManifest(input: unknown): ValidationReport {
  const parsed = safeParseManifest(input);
  if (!parsed.success) {
    return {
      ok: false,
      schemaValid: false,
      schemaErrors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
      findings: [],
    };
  }

  const ipam = analyzeIpam(parsed.data);
  return {
    ok: ipam.ok,
    schemaValid: true,
    schemaErrors: [],
    ipam,
    alz: checkAlzConformance(parsed.data),
    findings: ipam.findings,
  };
}

/** Validate an already-parsed manifest (skips re-parsing). */
export function validateParsedManifest(
  manifest: PhysicalManifest,
): ValidationReport {
  const ipam = analyzeIpam(manifest);
  return {
    ok: ipam.ok,
    schemaValid: true,
    schemaErrors: [],
    ipam,
    alz: checkAlzConformance(manifest),
    findings: ipam.findings,
  };
}
