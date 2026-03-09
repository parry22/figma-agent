import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

const anthropic = new Anthropic();

// Load design system tokens at cold start
const tokensPath = join(process.cwd(), "design-system", "tokens.md");
let designSystemTokens: string;
try {
  designSystemTokens = readFileSync(tokensPath, "utf-8");
} catch {
  designSystemTokens = "Design system tokens file not found.";
}

const SYSTEM_PROMPT = `You are a design system auditor for Hashira (Garden & PossibleWorks products).

You receive two inputs:
1. The design system tokens (colors, typography, spacing, component rules)
2. Extracted node data from a Figma frame

Your job: compare every extracted value against the design system and identify mismatches.

For each mismatch, return:
- "node": the node name from the extracted data
- "nodeId": the node ID for navigation
- "issue": a clear, concise description of the violation
- "severity": one of "error", "warning", or "info"
- "fix": a specific suggestion to fix it (e.g., "Change color from #FF0000 to #EF4444 (error token)")

Severity levels:
- error: directly breaks the system (wrong component used, off-brand color, completely wrong font)
- warning: drift from system (spacing slightly off, non-standard font size, close but not exact color)
- info: suggestion (an existing component could be used, or a best practice note)

Rules:
- Only flag actual mismatches. Do not flag nodes that conform to the system.
- Colors must be compared case-insensitively.
- Spacing values must come from the defined spacing scale. Flag any value not on the scale.
- Typography must match the type scale (font family, size, weight).
- Component instances from the library are fine. Non-instance nodes that appear to be common UI patterns (buttons, inputs, cards) should be flagged as potential detached components.
- If no issues are found, return an empty flags array.

Return ONLY valid JSON in this exact format:
{
  "flags": [
    {
      "node": "string",
      "nodeId": "string",
      "issue": "string",
      "severity": "error" | "warning" | "info",
      "fix": "string"
    }
  ],
  "summary": {
    "totalNodes": number,
    "errors": number,
    "warnings": number,
    "info": number
  }
}`;

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  setCorsHeaders(res);

  // Handle CORS preflight
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
${JSON.stringify(nodes, null, 2)}
\`\`\`

Audit these nodes against the design system and return the results as JSON.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
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

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
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
