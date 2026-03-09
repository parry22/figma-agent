import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

// Client created lazily so env vars are guaranteed to be loaded first
let _anthropic: Anthropic | null = null;
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// Load design system tokens at cold start
const tokensPath = join(process.cwd(), "design-system", "tokens.md");
let designSystemTokens: string;
try {
  designSystemTokens = readFileSync(tokensPath, "utf-8");
} catch {
  designSystemTokens = "Design system tokens file not found.";
}

const SYSTEM_PROMPT = `Design system reviewer for Garden. Use contextual judgment — only flag genuinely impactful issues.

Each node has context: depth (0=root), width/height, childCount, parentName, layoutMode, cornerRadius.

SKIP spacing audit on: depth 0-1, frames >500px wide or >300px tall, childCount>5, names containing nav/header/footer/sidebar/section/page/wrapper/hero/content/layout/screen/row/column.
SKIP: font size within 2px of scale. cornerRadius 0 is valid. Component instances pass automatically. Decorative fills at depth 0-1.

ERRORS only: wrong font family (not Haffer), completely off-brand color (not near any token), detached component (non-instance at depth 2+ named exactly like Button/Card/Input with matching child structure).
WARNINGS: color near-miss, font size >2px off scale, spacing off-scale on small UI components (<400px), non-standard cornerRadius.
INFO: component opportunity, font weight not Regular/Medium, minor spacing drift.

When in doubt, don't flag. Target 3-8 flags max. Return ONLY JSON:
{"flags":[{"node":"","nodeId":"","category":"color"|"typography"|"spacing"|"corner-radius"|"component","issue":"","severity":"error"|"warning"|"info","fix":""}],"summary":{"totalNodes":0,"errors":0,"warnings":0,"info":0}}`;

function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers.origin as string) || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

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
    const { frameName, nodes } = req.body;

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      res.status(400).json({ error: "No nodes provided in payload" });
      return;
    }

    const userMessage = `## Design System Tokens

${designSystemTokens}

---

## Extracted Figma Node Data

Frame: "${frameName}"
Total nodes extracted: ${nodes.length}

\`\`\`json
${JSON.stringify(nodes)}
\`\`\`

Audit these nodes against the design system and return the results as JSON.`;

    const message = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text content from Claude's response
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      res.status(500).json({ error: "No text response from Claude" });
      return;
    }

    // Extract JSON from response — handle code blocks, trailing text, and truncation
    let jsonText = textBlock.text.trim();

    // Strip markdown code fences
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

    // Extract the outermost JSON object (ignore any text before/after)
    const firstBrace = jsonText.indexOf("{");
    if (firstBrace === -1) {
      res.status(500).json({ error: "No JSON object found in Claude response" });
      return;
    }
    jsonText = jsonText.substring(firstBrace);

    // Find the matching closing brace by counting braces
    let depth = 0;
    let inString = false;
    let escape = false;
    let endPos = -1;
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
    } else if (message.stop_reason === "max_tokens") {
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

    const auditResult = JSON.parse(jsonText);
    res.status(200).json(auditResult);
  } catch (error: any) {
    console.error("Audit error:", error);

    if (error?.status === 429) {
      res.status(429).json({ error: "Rate limited. Please try again shortly." });
      return;
    }

    res.status(500).json({
      error: "Audit failed",
      message: error?.message || "Unknown error",
    });
  }
}
