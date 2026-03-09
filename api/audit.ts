// ── Hybrid Audit Orchestrator ──
// Thin entry point: deterministic checks → optional LLM → merge → respond.
// If LLM fails (rate limit, timeout), deterministic results still returned.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readFileSync } from "fs";
import { join } from "path";

import type { NodeData, DesignTokens, AuditFlag } from "./_lib/types";
import { runDeterministicAudit } from "./_lib/deterministic";
import { buildSlimNodes, shouldCallLLM, runLLMAudit } from "./_lib/llm";
import { mergeFlags, buildSummary } from "./_lib/merge";

// ── Load tokens.json once at cold start ──
let _tokens: DesignTokens | null = null;
function getTokens(): DesignTokens {
  if (!_tokens) {
    const raw = readFileSync(
      join(__dirname, "..", "design-system", "tokens.json"),
      "utf-8"
    );
    _tokens = JSON.parse(raw) as DesignTokens;
    console.log("Loaded tokens.json:", Object.keys(_tokens).join(", "));
  }
  return _tokens;
}

// ── CORS ──
function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers.origin as string) || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

// ── Handler ──
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { frameName, nodes, screenshot } = req.body as {
      frameName: string;
      nodes: NodeData[];
      screenshot?: string;
    };

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      res.status(400).json({ error: "No nodes provided in payload" });
      return;
    }

    // 1. Load design tokens
    const tokens = getTokens();

    // 2. Run deterministic audit (color, typography, spacing, radius, components)
    const deterministicFlags = runDeterministicAudit(nodes, tokens);
    console.log(
      `Deterministic: ${deterministicFlags.length} flags from ${nodes.length} nodes`
    );

    // 3. Build slim nodes for LLM, decide if LLM is needed
    const slimNodes = buildSlimNodes(nodes, deterministicFlags);
    const needLLM = shouldCallLLM(slimNodes, screenshot, deterministicFlags);
    console.log(
      `LLM decision: ${needLLM ? "YES" : "SKIP"} (${slimNodes.length} slim nodes, screenshot=${!!screenshot})`
    );

    // 4. Optionally call LLM — wrapped in try/catch for graceful fallback
    let llmFlags: AuditFlag[] = [];
    if (needLLM) {
      try {
        llmFlags = await runLLMAudit(
          slimNodes,
          frameName,
          screenshot,
          deterministicFlags
        );
        console.log(`LLM: ${llmFlags.length} additional flags`);
      } catch (llmError: any) {
        // LLM failed — log it but continue with deterministic results
        console.error(
          "LLM audit failed, falling back to deterministic only:",
          llmError?.message || llmError
        );
        // If it's a rate limit, still pass through the 429 hint to client
        // but don't fail the whole audit
        if (llmError?.status === 429) {
          console.warn("Rate limited on LLM — returning deterministic results only");
        }
      }
    }

    // 5. Merge flags and build summary
    const flags = mergeFlags(deterministicFlags, llmFlags);
    const summary = buildSummary(nodes.length, flags);

    console.log(
      `Final: ${flags.length} flags (${summary.errors}E/${summary.warnings}W/${summary.info}I)`
    );

    // 6. Return
    res.status(200).json({ flags, summary });
  } catch (error: any) {
    console.error("Audit error:", error);

    if (error?.status === 429) {
      res
        .status(429)
        .json({ error: "Rate limited — please wait 10 seconds and try again." });
      return;
    }

    res.status(500).json({
      error: "Audit failed",
      message: error?.message || "Unknown error",
    });
  }
}
