// ── Merge & Dedup ──
// Combines deterministic + LLM flags, deduplicates, builds summary.

import type { AuditFlag, AuditSummary } from "./types";

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

export function mergeFlags(
  deterministicFlags: AuditFlag[],
  llmFlags: AuditFlag[]
): AuditFlag[] {
  // Key: nodeId + category → deterministic flag takes precedence
  const flagMap = new Map<string, AuditFlag>();

  // Add all deterministic flags
  for (const flag of deterministicFlags) {
    const key = `${flag.nodeId}::${flag.category}`;
    flagMap.set(key, flag);
  }

  // Merge LLM flags
  for (const flag of llmFlags) {
    const key = `${flag.nodeId}::${flag.category}`;
    const existing = flagMap.get(key);

    if (existing) {
      // Same node+category already flagged deterministically.
      // Upgrade severity if LLM found something worse.
      const existingRank = SEVERITY_RANK[existing.severity] ?? 2;
      const llmRank = SEVERITY_RANK[flag.severity] ?? 2;
      if (llmRank < existingRank) {
        // LLM says it's more severe — upgrade
        existing.severity = flag.severity;
        existing.issue = flag.issue || existing.issue;
        existing.fix = flag.fix || existing.fix;
      }
    } else {
      // New flag from LLM — add it
      flagMap.set(key, flag);
    }
  }

  // Sort: errors first, then warnings, then info
  return Array.from(flagMap.values()).sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2)
  );
}

export function buildSummary(totalNodes: number, flags: AuditFlag[]): AuditSummary {
  return {
    totalNodes,
    errors: flags.filter((f) => f.severity === "error").length,
    warnings: flags.filter((f) => f.severity === "warning").length,
    info: flags.filter((f) => f.severity === "info").length,
  };
}
