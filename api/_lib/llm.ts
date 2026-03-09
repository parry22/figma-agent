// ── Slimmed LLM Layer ──
// Only called for semantic/visual checks that deterministic code can't handle.
// Pre-filters nodes to minimize token usage.

import Anthropic from "@anthropic-ai/sdk";
import type { NodeData, SlimNode, AuditFlag } from "./types";

// Lazy-init Claude client
let _anthropic: Anthropic | null = null;
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ── System prompt — conservative, uses all severity levels ──
const SYSTEM_PROMPT = `You are a design system reviewer for Garden. Be conservative — only flag issues that genuinely matter.

Deterministic checks ALREADY verified: colors, font families, font sizes, line heights, corner radii, and touch targets. Do NOT re-check any of those.

Your job (ONLY when there's clear evidence):
1. DETACHED COMPONENTS: If candidates are listed, confirm only if genuinely detached. Reject false positives (layout frames, wrappers). Use severity "warning".
2. VISUAL ISSUES (screenshot only):
   - "error" for clearly broken layout, overlapping elements, or invisible text
   - "warning" for obvious misalignment or inconsistent spacing between similar elements
   - "info" for minor visual refinements (e.g., visual hierarchy suggestion, tighter grouping)
3. SEMANTIC: "error" if interactive element has no label; "warning" for accessibility concerns; "info" for best-practice suggestions.

Use the CORRECT severity — not everything is an error. Most issues should be "warning" or "info". Only use "error" for things that are clearly broken.

Return 1-3 flags. If nothing is wrong, return {"flags":[]}.

Return ONLY valid JSON:
{"flags":[{"node":"","nodeId":"","category":"color"|"typography"|"spacing"|"corner-radius"|"component","issue":"","severity":"error"|"warning"|"info","fix":""}]}`;

// ── Pre-filter: strip nodes down for the LLM ──

export function buildSlimNodes(
  nodes: NodeData[],
  deterministicFlags: AuditFlag[]
): SlimNode[] {
  // Nodes with deterministic flags (by nodeId)
  const flaggedIds = new Set(deterministicFlags.map((f) => f.nodeId));

  return nodes
    .filter((node) => {
      // Always exclude clean component instances — nothing more to check
      if (node.isComponentInstance && !flaggedIds.has(node.id)) return false;
      // Include everything else (LLM may find structural/semantic issues)
      return true;
    })
    .map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      isComponentInstance: node.isComponentInstance,
      componentName: node.componentName,
      parentName: node.parentName,
      depth: node.depth,
      width: node.width,
      height: node.height,
      childCount: node.childCount,
      layoutMode: node.layoutMode,
    }));
}

// ── Should we call the LLM at all? ──

export function shouldCallLLM(
  slimNodes: SlimNode[],
  screenshot: string | undefined,
  deterministicFlags: AuditFlag[]
): boolean {
  // If there's a screenshot, call LLM for visual analysis
  if (screenshot) return true;

  // If there are detached-component warnings, LLM can confirm/reject
  if (deterministicFlags.some((f) => f.category === "component")) return true;

  // Otherwise, deterministic results are sufficient — don't waste an API call
  return false;
}

// ── Retry helper with exponential backoff ──

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.status === 429 && attempt < maxRetries) {
        const retryAfter = error?.headers?.["retry-after"]
          ? parseInt(error.headers["retry-after"], 10) * 1000
          : (attempt + 1) * 3000;
        console.log(`Rate limited, retrying in ${retryAfter}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, retryAfter));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

// ── Extract JSON from Claude response ──

function extractJSON(text: string, stopReason: string | null | undefined): any {
  let jsonText = text.trim();

  // Strip markdown code fences
  jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  const firstBrace = jsonText.indexOf("{");
  if (firstBrace === -1) return { flags: [] };
  jsonText = jsonText.substring(firstBrace);

  // Find matching closing brace
  let depth = 0, inString = false, escape = false, endPos = -1;
  for (let i = 0; i < jsonText.length; i++) {
    const ch = jsonText[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) { endPos = i; break; } }
  }

  if (endPos > 0) {
    jsonText = jsonText.substring(0, endPos + 1);
  } else if (stopReason === "max_tokens") {
    // Truncated — close open structures
    const lastBrace = jsonText.lastIndexOf("}");
    if (lastBrace > 0) {
      jsonText = jsonText.substring(0, lastBrace + 1);
      const ob = (jsonText.match(/{/g) || []).length;
      const cb = (jsonText.match(/}/g) || []).length;
      const oB = (jsonText.match(/\[/g) || []).length;
      const cB = (jsonText.match(/]/g) || []).length;
      for (let i = 0; i < oB - cB; i++) jsonText += "]";
      for (let i = 0; i < ob - cb; i++) jsonText += "}";
    }
  }

  return JSON.parse(jsonText);
}

// ── Main LLM audit function ──

export async function runLLMAudit(
  slimNodes: SlimNode[],
  frameName: string,
  screenshot: string | undefined,
  deterministicFlags: AuditFlag[]
): Promise<AuditFlag[]> {
  // Build user message — much smaller than before
  const detachedWarnings = deterministicFlags
    .filter((f) => f.category === "component")
    .map((f) => `- ${f.node} (${f.nodeId}): ${f.issue}`)
    .join("\n");

  let userText = `Frame: "${frameName}" | ${slimNodes.length} nodes (pre-filtered, deterministic checks already done)\n`;
  userText += JSON.stringify(slimNodes);

  if (detachedWarnings) {
    userText += `\n\nDetached component candidates to confirm/reject:\n${detachedWarnings}`;
  }

  if (screenshot) {
    userText += "\n\nScreenshot attached — check for visual issues (alignment, contrast, hierarchy, truncation).";
  }

  // Build multimodal content
  const contentBlocks: any[] = [];
  if (screenshot) {
    contentBlocks.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: screenshot },
    });
  }
  contentBlocks.push({ type: "text", text: userText });

  const message = await callWithRetry(() =>
    getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: contentBlocks }],
    })
  );

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  try {
    const result = extractJSON(textBlock.text, message.stop_reason);
    return Array.isArray(result.flags) ? result.flags : [];
  } catch {
    console.error("Failed to parse LLM response:", textBlock.text.substring(0, 200));
    return [];
  }
}
