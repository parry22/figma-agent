import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

// Client created lazily so env vars are guaranteed to be loaded first
let _anthropic: Anthropic | null = null;
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ── Compact design tokens (embedded, not loaded from file) ──
// This is a token-efficient representation of the full design-system/tokens.md.
// The full markdown file remains the documentation source of truth.
const DESIGN_TOKENS = `GARDEN DESIGN TOKENS

COLORS (all recognized hex values):
#FC79C1 rose/action-primary | #FF65BA action-primary-hover | #FFC4E4 tertiary/light-rose | #F29FCD brand-rose-soft
#473C75 iris/action-secondary/text-primary | #402E8E action-secondary-hover | #908AAD text-secondary/mid-grey
#E4EBF2 bg-base/mist | #FFFFFF white/cards/text-on-action | #000000 black | #181325 elderberry/dark-bg | #22242B dark-overlay-base
#1DC089 status-success | #FF005C status-error
Overlays: #FFFFFF@70%(strong) @50%(mid) @30%(soft) @10%(subtle) | #22242B@30%(dark-soft)
Tolerance: colors within Delta-E 5 of a recognized color are acceptable.

TYPOGRAPHY:
Font: Haffer only (also appears as "Haffer-TRIAL"). Any other font = ERROR.
Weights: Regular=400, Medium=570 (also accept 500 as Medium).
Scale (size/lineHeight): 32/40(h1) | 20/24(h2) | 16/20(h3) | 14/20(h4) | 12/16(h5) | 10/12(h6)
Each level has Medium and Regular variants. Allowed sizes: 10,12,14,16,20,32.

CORNER RADIUS: 0(always ok) | 8(sm) | 12(buttons/inputs) | 16(cards/outer) | 24(chips/pills) | 999(circles)
Tolerance: within 4px of token = near-match, not error. Buttons must be 12. Chips must be 24.

SPACING (4px base): 4|8|12|16|20|24|32|40|48|56|64|80
Skip spacing checks on: depth 0-1, >500px wide, >300px tall, childCount>5, layout containers (nav/header/footer/sidebar/section/page/wrapper/hero/content/layout/screen).
Tolerance: within 2px of scale value is acceptable. Min touch target: 44px.

BUTTONS: Large=48h,px24,16px/20,Medium-weight | Med=40h,px24,14px/20 | Small=36h,px24,12px/16. All rounded-12, text-white.
Types: Primary=#FC79C1 | Secondary=#473C75 | Tertiary=#FFC4E4(text=#473C75) | Disabled=reduced-opacity.

CHIPS: Default=32h,rounded-24,pl12/pr8/py4,16px,Regular,bg-white,text=#473C75,gap-8 | Small=24h,12px | ChipButton=48h.

ICONS: Standard 20x20px.

EFFECTS: Background blur 150px for glass/frosted panels. Garden uses blur not drop-shadows.

LAYOUT: Desktop=1440w | Mobile=360w | Modal=600x336.

COMPONENTS (must use library instances, flag if detached):
Button, Chip, Input, Select, Card, Avatar, Badge, Dialog/Modal, Tooltip, TabSwitch, Breadcrumb, NotificationToast, SearchBar, Paginator, WalletCard, Header, Footer.
Flag as detached only if: non-instance AND name matches AND depth 2+ AND child structure matches.

SEVERITY:
ERROR: wrong font family, completely off-brand color, detached component, visually broken layout.
WARNING: color near-miss, font size >2px off scale, off-scale spacing on small UI, non-standard radius, inconsistent visual spacing, poor contrast.
INFO: component opportunity, unusual font weight, minor spacing drift, visual hierarchy suggestion.`;

const SYSTEM_PROMPT = `You are a design system reviewer for Garden. Use contextual judgment — only flag genuinely impactful issues.

You receive structured node data (colors, fonts, spacing, radii, component status) with context: depth, size, childCount, parentName, layoutMode. When a screenshot is attached, also check for visual issues (alignment, spacing consistency, contrast, hierarchy, truncated text, layout balance).

Component instances pass automatically. When in doubt, don't flag. Target 3-8 flags max.

Return ONLY valid JSON — no markdown, no explanation:
{"flags":[{"node":"","nodeId":"","category":"color"|"typography"|"spacing"|"corner-radius"|"component","issue":"","severity":"error"|"warning"|"info","fix":""}],"summary":{"totalNodes":0,"errors":0,"warnings":0,"info":0}}

${DESIGN_TOKENS}`;

function setCorsHeaders(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers.origin as string) || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

// Retry helper with exponential backoff for rate limits
async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.status === 429 && attempt < maxRetries) {
        // Parse retry-after header or use exponential backoff
        const retryAfter = error?.headers?.["retry-after"]
          ? parseInt(error.headers["retry-after"], 10) * 1000
          : (attempt + 1) * 3000; // 3s, 6s
        console.log(`Rate limited, retrying in ${retryAfter}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, retryAfter));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
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
    const { frameName, nodes, screenshot } = req.body;

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      res.status(400).json({ error: "No nodes provided in payload" });
      return;
    }

    // User message: only node data (tokens are in the cached system prompt)
    const userText = `Frame: "${frameName}" | ${nodes.length} nodes\n${JSON.stringify(nodes)}${screenshot ? "\n\nScreenshot attached — check for visual issues too." : ""}`;

    // Build multimodal content: screenshot (if available) + text
    const contentBlocks: any[] = [];
    if (screenshot) {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: screenshot,
        },
      });
    }
    contentBlocks.push({ type: "text", text: userText });

    const message = await callWithRetry(() =>
      getClient().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        // System prompt + tokens cached together — repeat calls within 5 min
        // use cached version at 90% lower token cost
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
      res.status(429).json({ error: "Rate limited — please wait 10 seconds and try again." });
      return;
    }

    res.status(500).json({
      error: "Audit failed",
      message: error?.message || "Unknown error",
    });
  }
}
