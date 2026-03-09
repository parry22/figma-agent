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

  // Test basic outbound connectivity
  try {
    const r = await fetch("https://httpbin.org/get");
    checks.outboundOk = true;
    checks.outboundStatus = r.status;
  } catch (err: any) {
    checks.outboundOk = false;
    checks.outboundError = err.message;
  }

  // Test direct fetch to Anthropic API
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say ok" }],
      }),
    });
    const data = await r.json();
    checks.directFetchOk = true;
    checks.directFetchStatus = r.status;
    checks.directFetchResponse = data;
  } catch (err: any) {
    checks.directFetchOk = false;
    checks.directFetchError = err.message;
  }

  // Test Anthropic SDK
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: "Say ok" }],
    });
    checks.sdkOk = true;
    checks.sdkResponse = msg.content[0];
  } catch (err: any) {
    checks.sdkOk = false;
    checks.sdkError = err.message;
    checks.sdkErrorType = err.constructor.name;
    checks.sdkCause = err.cause?.message;
  }

  res.status(200).json(checks);
}
