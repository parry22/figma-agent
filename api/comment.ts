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

  // Trim to remove any trailing newlines from env var
  const figmaToken = process.env.FIGMA_ACCESS_TOKEN?.trim();
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

    // Step 1: Verify file access
    const verifyRes = await fetch(
      `https://api.figma.com/v1/files/${fileKey}?depth=1`,
      {
        headers: { "X-Figma-Token": figmaToken },
      }
    );

    if (!verifyRes.ok) {
      const status = verifyRes.status;
      let hint = "Cannot access Figma file.";
      if (status === 404) hint = "File not found — check the Figma URL.";
      else if (status === 403) hint = "Access denied — token can't access this file.";
      res.status(502).json({ error: hint, step: "verify", status });
      return;
    }

    const emoji = SEVERITY_EMOJI[flag.severity] || "⚪";
    const message = `${emoji} ${flag.issue}\n\n💡 Fix: ${flag.fix}`;

    // Step 2: Try posting comment pinned to the node (FrameOffset format)
    let figmaRes = await fetch(
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

    // Step 3: If FrameOffset failed, fall back to simple Vector (file-level comment)
    if (!figmaRes.ok) {
      const firstError = await figmaRes.text();
      console.error(`FrameOffset comment failed (${figmaRes.status}):`, firstError);

      figmaRes = await fetch(
        `https://api.figma.com/v1/files/${fileKey}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Figma-Token": figmaToken,
          },
          body: JSON.stringify({
            message: `${message}\n\n📍 Node: ${flag.node} (${nodeId})`,
            client_meta: { x: 100, y: 100 },
          }),
        }
      );
    }

    if (!figmaRes.ok) {
      const errorText = await figmaRes.text();
      const status = figmaRes.status;
      console.error(`Figma comment API ${status}:`, errorText);
      res.status(502).json({
        error: `Figma rejected comment (${status})`,
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
