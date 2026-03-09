import type { VercelRequest, VercelResponse } from "@vercel/node";

const SEVERITY_EMOJI: Record<string, string> = {
  error: "🔴",
  warning: "🟡",
  info: "🔵",
};

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

  const figmaToken = process.env.FIGMA_ACCESS_TOKEN;
  if (!figmaToken) {
    res.status(500).json({ error: "Figma access token not configured" });
    return;
  }

  try {
    const { fileKey, nodeId, flag } = req.body as {
      fileKey: string;
      nodeId: string;
      flag: {
        node: string;
        issue: string;
        fix: string;
        severity: string;
      };
    };

    if (!fileKey || !nodeId || !flag) {
      res.status(400).json({ error: "Missing fileKey, nodeId, or flag" });
      return;
    }

    const emoji = SEVERITY_EMOJI[flag.severity] || "⚪";
    const message = `${emoji} ${flag.issue}\n\n💡 Fix: ${flag.fix}`;

    const figmaRes = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Figma-Token": figmaToken,
        },
        body: JSON.stringify({
          message,
          client_meta: {
            node_id: nodeId,
            node_offset: { x: 1, y: 1 },
          },
        }),
      }
    );

    if (!figmaRes.ok) {
      const errorText = await figmaRes.text();
      const status = figmaRes.status;
      let hint = "";
      if (status === 404) hint = "File not found — check the Figma URL.";
      else if (status === 403) hint = "Access denied — token may lack permissions for this file.";
      else if (status === 400) hint = "Bad request — node ID may be invalid.";
      console.error(`Figma API ${status}:`, errorText);
      res.status(502).json({
        error: hint || "Figma API failed",
        status,
        detail: errorText,
      });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Comment error:", error);
    res.status(500).json({
      error: "Failed to post comment",
      message: error?.message || "Unknown error",
    });
  }
}
