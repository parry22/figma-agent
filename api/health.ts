import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const origin = (req.headers.origin as string) || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);

  const checks: Record<string, any> = {
    nodeVersion: process.version,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 10) + "...",
    hasWebhookUrl: !!process.env.DISCORD_WEBHOOK_URL,
    cwd: process.cwd(),
  };

  // Check if design-system/tokens.md is accessible
  try {
    const tokensPath = join(process.cwd(), "design-system", "tokens.md");
    const tokens = readFileSync(tokensPath, "utf-8");
    checks.tokensFound = true;
    checks.tokensLength = tokens.length;
  } catch (err: any) {
    checks.tokensFound = false;
    checks.tokensError = err.message;
  }

  // Test Anthropic API connection
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: "Say ok" }],
    });
    checks.anthropicOk = true;
    checks.anthropicResponse = msg.content[0];
  } catch (err: any) {
    checks.anthropicOk = false;
    checks.anthropicError = err.message;
    checks.anthropicErrorType = err.constructor.name;
    checks.anthropicStatus = err.status;
  }

  res.status(200).json(checks);
}
