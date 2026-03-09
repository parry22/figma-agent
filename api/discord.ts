import type { VercelRequest, VercelResponse } from "@vercel/node";

interface AuditFlag {
  node: string;
  nodeId: string;
  issue: string;
  severity: "error" | "warning" | "info";
  fix: string;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  footer: { text: string };
  timestamp: string;
}

const SEVERITY_EMOJI: Record<string, string> = {
  error: "🔴",
  warning: "🟡",
  info: "🔵",
};

const EMBED_COLORS = {
  error: 0xef4444,   // red
  warning: 0xf59e0b, // amber
  clean: 0x10b981,   // green
};

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

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    res.status(500).json({ error: "Discord webhook URL not configured" });
    return;
  }

  try {
    const { frameName, flags, summary } = req.body as {
      frameName: string;
      flags: AuditFlag[];
      summary: { errors: number; warnings: number; info: number; totalNodes: number };
    };

    // Determine embed color based on worst severity
    let embedColor = EMBED_COLORS.clean;
    if (summary.errors > 0) embedColor = EMBED_COLORS.error;
    else if (summary.warnings > 0) embedColor = EMBED_COLORS.warning;

    // Build summary line
    const summaryParts: string[] = [];
    if (summary.errors > 0) summaryParts.push(`🔴 ${summary.errors} error${summary.errors !== 1 ? "s" : ""}`);
    if (summary.warnings > 0) summaryParts.push(`🟡 ${summary.warnings} warning${summary.warnings !== 1 ? "s" : ""}`);
    if (summary.info > 0) summaryParts.push(`🔵 ${summary.info} info`);
    const summaryLine = summaryParts.length > 0
      ? summaryParts.join("  ·  ")
      : "✅ No issues found";

    // Build fields (max 25 per Discord embed, truncate if needed)
    const fields = flags.slice(0, 20).map((flag) => ({
      name: `${SEVERITY_EMOJI[flag.severity]} ${flag.node}`,
      value: `${flag.issue}\n*Fix: ${flag.fix}*`,
      inline: false,
    }));

    if (flags.length > 20) {
      fields.push({
        name: "...",
        value: `+${flags.length - 20} more issues (see Figma plugin for full list)`,
        inline: false,
      });
    }

    const embed: DiscordEmbed = {
      title: `Design Audit: ${frameName}`,
      description: `${summaryLine}\n\n${summary.totalNodes} nodes scanned`,
      color: embedColor,
      fields,
      footer: { text: "Design Auditor · Hashira" },
      timestamp: new Date().toISOString(),
    };

    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Design Auditor",
        embeds: [embed],
      }),
    });

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      res.status(502).json({ error: "Discord webhook failed", detail: errorText });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Discord error:", error);
    res.status(500).json({
      error: "Failed to send to Discord",
      message: error?.message || "Unknown error",
    });
  }
}
