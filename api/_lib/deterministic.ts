// ── Deterministic Audit Engine ──
// Pure-function checks against design tokens. No LLM needed.
//
// DESIGN PRINCIPLE: Each check produces AT MOST 1 flag per severity.
// If multiple nodes share the same problem, report it ONCE with a count.
// This prevents the audit from flooding the UI with repetitive flags.
//
// Only flag things a designer would genuinely thank you for catching.
//   error   (Severe) → wrong font family, truly alien color, tiny touch target
//   warning (Medium) → color near-miss, font size significantly off, detached component
//   info    (Low)    → visual suggestion from LLM only (no deterministic info flags)

import type { NodeData, AuditFlag, DesignTokens } from "./types";

// ── Color utilities (CIE76 Delta-E) ──

type Lab = [number, number, number];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function rgbToLab(r: number, g: number, b: number): Lab {
  let rl = r / 255, gl = g / 255, bl = b / 255;
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaE(lab1: Lab, lab2: Lab): number {
  return Math.sqrt(
    (lab1[0] - lab2[0]) ** 2 +
    (lab1[1] - lab2[1]) ** 2 +
    (lab1[2] - lab2[2]) ** 2
  );
}

interface PaletteEntry { hex: string; name: string; lab: Lab; }

function buildPaletteLookup(palette: Record<string, { name: string; usage: string }>): PaletteEntry[] {
  return Object.entries(palette).map(([hex, info]) => ({
    hex: hex.toUpperCase(),
    name: info.name,
    lab: rgbToLab(...hexToRgb(hex)),
  }));
}

function findClosestColor(hex: string, palette: PaletteEntry[]): { entry: PaletteEntry; distance: number } {
  const lab = rgbToLab(...hexToRgb(hex));
  let closest = palette[0];
  let minDist = Infinity;
  for (const entry of palette) {
    const d = deltaE(lab, entry.lab);
    if (d < minDist) { minDist = d; closest = entry; }
  }
  return { entry: closest, distance: minDist };
}

// ── Colors ──
// Produces MAX 1 error + MAX 1 warning. Deduped across all nodes.
//   error   → Delta-E > 15: truly alien color, not in the brand at all
//   warning → Delta-E 10–15: noticeably off, worth checking

const COLOR_WARN_MIN = 10;
const COLOR_ERROR_MIN = 15;

function checkColors(nodes: NodeData[], _tokens: DesignTokens, palette: PaletteEntry[]): AuditFlag[] {
  const paletteHexSet = new Set(palette.map((p) => p.hex));

  // Track worst offenders per severity
  let worstError: { node: NodeData; color: string; entry: PaletteEntry; distance: number } | null = null;
  let errorCount = 0;
  let worstWarning: { node: NodeData; color: string; entry: PaletteEntry; distance: number } | null = null;
  let warningCount = 0;

  for (const node of nodes) {
    if (node.isComponentInstance || node.colors.length === 0) continue;

    for (const color of node.colors) {
      const upper = color.toUpperCase();
      if (paletteHexSet.has(upper)) continue;

      const { entry, distance } = findClosestColor(upper, palette);

      if (distance > COLOR_ERROR_MIN) {
        errorCount++;
        if (!worstError || distance > worstError.distance) {
          worstError = { node, color: upper, entry, distance };
        }
      } else if (distance > COLOR_WARN_MIN) {
        warningCount++;
        if (!worstWarning || distance > worstWarning.distance) {
          worstWarning = { node, color: upper, entry, distance };
        }
      }
    }
  }

  const flags: AuditFlag[] = [];

  if (worstError) {
    const more = errorCount > 1 ? ` (and ${errorCount - 1} more)` : "";
    flags.push({
      node: worstError.node.name,
      nodeId: worstError.node.id,
      category: "color",
      severity: "error",
      issue: `Off-palette color ${worstError.color} — nearest token is ${worstError.entry.name} (${worstError.entry.hex})${more}`,
      fix: `Replace with ${worstError.entry.hex} or another token color`,
    });
  }

  if (worstWarning) {
    const more = warningCount > 1 ? ` (and ${warningCount - 1} more)` : "";
    flags.push({
      node: worstWarning.node.name,
      nodeId: worstWarning.node.id,
      category: "color",
      severity: "warning",
      issue: `Color ${worstWarning.color} is close to ${worstWarning.entry.name} (${worstWarning.entry.hex}) but noticeably off${more}`,
      fix: `Snap to ${worstWarning.entry.hex}`,
    });
  }

  return flags;
}

// ── Typography ──
// Produces MAX 1 error + MAX 1 warning. Deduped across all nodes.
//   error   → wrong font family
//   warning → font size >6px off the nearest scale value

const FONT_SIZE_WARN_THRESHOLD = 6;

function checkTypography(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const familiesLower = tokens.typography.allowedFamilies.map((f) => f.toLowerCase());
  const sizeSet = new Set(tokens.typography.allowedSizes);

  // Track first match + total count for dedup
  let firstWrongFamily: { node: NodeData; family: string } | null = null;
  let wrongFamilyCount = 0;

  let worstSizeOff: { node: NodeData; size: number; nearest: number; label: string; diff: number } | null = null;
  let sizeOffCount = 0;

  for (const node of nodes) {
    if (node.isComponentInstance || !node.typography) continue;
    const typo = node.typography;

    // Font family
    if (!familiesLower.includes(typo.family.toLowerCase())) {
      wrongFamilyCount++;
      if (!firstWrongFamily) {
        firstWrongFamily = { node, family: typo.family };
      }
      continue; // Don't also check size if family is wrong
    }

    // Font size — only significantly off
    if (!sizeSet.has(typo.size)) {
      const sorted = tokens.typography.allowedSizes.slice().sort((a, b) => Math.abs(a - typo.size) - Math.abs(b - typo.size));
      const nearest = sorted[0];
      const diff = Math.abs(typo.size - nearest);

      if (diff > FONT_SIZE_WARN_THRESHOLD) {
        sizeOffCount++;
        if (!worstSizeOff || diff > worstSizeOff.diff) {
          const scaleEntry = tokens.typography.scale.find((s) => s.size === nearest);
          worstSizeOff = {
            node,
            size: typo.size,
            nearest,
            label: scaleEntry ? `${nearest}px (${scaleEntry.name})` : `${nearest}px`,
            diff,
          };
        }
      }
    }
  }

  const flags: AuditFlag[] = [];

  if (firstWrongFamily) {
    const more = wrongFamilyCount > 1 ? ` — ${wrongFamilyCount} nodes affected` : "";
    flags.push({
      node: firstWrongFamily.node.name,
      nodeId: firstWrongFamily.node.id,
      category: "typography",
      severity: "error",
      issue: `Font family "${firstWrongFamily.family}" is not allowed${more}`,
      fix: `Use Haffer`,
    });
  }

  if (worstSizeOff) {
    const more = sizeOffCount > 1 ? ` (and ${sizeOffCount - 1} more)` : "";
    flags.push({
      node: worstSizeOff.node.name,
      nodeId: worstSizeOff.node.id,
      category: "typography",
      severity: "warning",
      issue: `Font size ${worstSizeOff.size}px is not on the type scale${more}`,
      fix: `Use ${worstSizeOff.label}`,
    });
  }

  return flags;
}

// ── Touch targets ──
// Produces MAX 1 error. Deduped.

function checkTouchTargets(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  let smallest: { node: NodeData; height: number } | null = null;
  let count = 0;

  for (const node of nodes) {
    if (node.isComponentInstance) continue;

    const isInteractive = /button|btn|chip|link|cta|toggle|switch/i.test(node.name) ||
      (node.componentName && /button|btn|chip|link|cta|toggle|switch/i.test(node.componentName));

    if (isInteractive && node.height > 0 && node.height < tokens.spacing.minTouchTarget) {
      count++;
      if (!smallest || node.height < smallest.height) {
        smallest = { node, height: node.height };
      }
    }
  }

  if (!smallest) return [];

  const more = count > 1 ? ` (${count} elements affected)` : "";
  return [{
    node: smallest.node.name,
    nodeId: smallest.node.id,
    category: "spacing",
    severity: "error",
    issue: `Interactive element is only ${smallest.height}px tall — below ${tokens.spacing.minTouchTarget}px min touch target${more}`,
    fix: `Increase height to at least ${tokens.spacing.minTouchTarget}px`,
  }];
}

// ── Detached components ──
// Produces MAX 1 warning. Deduped.

function checkComponents(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const requiredLower = tokens.components.requiredNames.map((n) => n.toLowerCase());

  let firstMatch: { node: NodeData; original: string } | null = null;
  let count = 0;

  for (const node of nodes) {
    if (node.isComponentInstance) continue;
    if (node.depth < tokens.components.detectionMinDepth) continue;

    const nameLower = node.name.toLowerCase();
    const match = requiredLower.find((req) => nameLower === req);

    if (match) {
      count++;
      if (!firstMatch) {
        const original = tokens.components.requiredNames[requiredLower.indexOf(match)];
        firstMatch = { node, original };
      }
    }
  }

  if (!firstMatch) return [];

  const more = count > 1 ? ` (and ${count - 1} more)` : "";
  return [{
    node: firstMatch.node.name,
    nodeId: firstMatch.node.id,
    category: "component",
    severity: "warning",
    issue: `"${firstMatch.node.name}" looks like a detached ${firstMatch.original}${more}`,
    fix: `Replace with the ${firstMatch.original} component instance from the library`,
  }];
}

// ── Severity ranking ──
const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

// ── Main entry point ──

export function runDeterministicAudit(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const palette = buildPaletteLookup(tokens.colors.palette);

  const flags: AuditFlag[] = [
    ...checkColors(nodes, tokens, palette),
    ...checkTypography(nodes, tokens),
    ...checkTouchTargets(nodes, tokens),
    ...checkComponents(nodes, tokens),
  ];

  // Sort: errors first, then warnings, then info.
  // Max possible: 2 color + 2 typo + 1 touch + 1 component = 6 flags.
  // No cap needed — dedup already limits it.
  flags.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2));
  return flags;
}
