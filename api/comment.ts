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

// Sanitize node ID for Figma Comment API.
// Instance nodes have composite IDs like "I123:456;789:101" which the API rejects.
// Extract just the first simple "123:456" segment.
function sanitizeNodeId(id: string): string {
  // Strip leading "I" prefix from instance IDs
  let clean = id.startsWith("I") ? id.substring(1) : id;
  // Take only the first segment before any semicolon
  const semiIdx = clean.indexOf(";");
  if (semiIdx > 0) clean = clean.substring(0, semiIdx);
  return clean;
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

  const figmaToken = process.env.FIGMA_ACCESS_TOKEN?.trim();
  if (!figmaToken) {
    res.status(500).json({ error: "Figma access token not configured" });
    return;
  }

  try {
    const { fileKey, nodeId, rootNodeId, flag } = req.body as {
      fileKey: string;
      nodeId: string;
      rootNodeId?: string;
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
    const message = `${emoji} [${flag.node}] ${flag.issue}\n\n💡 Fix: ${flag.fix}`;

    // Try posting with the sanitized flag node ID first
    const anchorId = sanitizeNodeId(nodeId);

    const postComment = async (anchorNodeId: string) => {
      return fetch(
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
              node_id: anchorNodeId,
              node_offset: { x: 1, y: 1 },
            },
          }),
        }
      );
    };

    let figmaRes = await postComment(anchorId);

    // If the node ID was rejected (400), fallback to the root frame ID
    if (figmaRes.status === 400 && rootNodeId) {
      const fallbackId = sanitizeNodeId(rootNodeId);
      if (fallbackId !== anchorId) {
        console.log(`Node ID ${anchorId} rejected, falling back to root ${fallbackId}`);
        figmaRes = await postComment(fallbackId);
      }
    }

    if (!figmaRes.ok) {
      const errorText = await figmaRes.text();
      const status = figmaRes.status;
      let hint = `Figma API error (${status})`;
      if (status === 404) hint = "File not found — check your Figma access token permissions.";
      else if (status === 403) hint = "Access denied — token can't access this file.";
      else if (status === 400) hint = "Bad request — could not anchor comment to this node.";
      else if (status === 429) hint = "Rate limited — wait a moment and try again.";
      console.error(`Figma API ${status}:`, errorText);
      res.status(502).json({ error: hint, status, detail: errorText });
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
