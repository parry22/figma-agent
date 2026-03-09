// ── Deterministic Audit Engine ──
// Pure-function checks against design tokens. No LLM needed.
// PHILOSOPHY: Only flag genuinely impactful issues. No guesswork.
// - Wrong font family → always an error
// - Truly off-brand color → error
// - Tiny touch target on interactive element → error
// - Detached component candidate → warning
// Everything else is left to designer discretion.

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

interface PaletteEntry {
  hex: string;
  name: string;
  lab: Lab;
}

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

// ── Check: Colors ──
// Only flag colors that are genuinely off-brand (Delta-E > tolerance).
// Near-misses are left alone — designers often tweak colors intentionally.

function checkColors(nodes: NodeData[], tokens: DesignTokens, palette: PaletteEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const paletteHexSet = new Set(palette.map((p) => p.hex));

  for (const node of nodes) {
    if (node.isComponentInstance || node.colors.length === 0) continue;

    for (const color of node.colors) {
      const upper = color.toUpperCase();

      // Exact match → pass
      if (paletteHexSet.has(upper)) continue;

      const { entry, distance } = findClosestColor(upper, palette);

      // Within tolerance → close enough, pass
      if (distance <= tokens.colors.toleranceDeltaE) continue;

      // Truly off-palette → flag as error
      flags.push({
        node: node.name,
        nodeId: node.id,
        category: "color",
        severity: "error",
        issue: `Off-palette color ${upper} — nearest token is ${entry.name} (${entry.hex})`,
        fix: `Replace with ${entry.hex} or another token color`,
      });
    }
  }
  return flags;
}

// ── Check: Typography ──
// ONLY flag wrong font family. Font sizes and line heights are left to designers —
// they often use custom values intentionally and flagging every deviation is noise.

function checkTypography(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const familiesLower = tokens.typography.allowedFamilies.map((f) => f.toLowerCase());

  for (const node of nodes) {
    if (node.isComponentInstance || !node.typography) continue;

    if (!familiesLower.includes(node.typography.family.toLowerCase())) {
      flags.push({
        node: node.name,
        nodeId: node.id,
        category: "typography",
        severity: "error",
        issue: `Font family "${node.typography.family}" is not allowed`,
        fix: `Use Haffer`,
      });
    }
  }
  return flags;
}

// ── Check: Touch targets ──
// Only flag interactive elements that are too small to tap.
// General spacing-grid checks are removed — too noisy for real designs.

function checkTouchTargets(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const flags: AuditFlag[] = [];

  for (const node of nodes) {
    if (node.isComponentInstance) continue;

    const isInteractive = /button|btn|chip|link|cta|toggle|switch/i.test(node.name) ||
      (node.componentName && /button|btn|chip|link|cta|toggle|switch/i.test(node.componentName));

    if (isInteractive && node.height > 0 && node.height < tokens.spacing.minTouchTarget) {
      flags.push({
        node: node.name,
        nodeId: node.id,
        category: "spacing",
        severity: "error",
        issue: `Interactive element is only ${node.height}px tall — below ${tokens.spacing.minTouchTarget}px min touch target`,
        fix: `Increase height to at least ${tokens.spacing.minTouchTarget}px`,
      });
    }
  }
  return flags;
}

// ── Check: Detached components ──
// Non-instance nodes whose name exactly matches a required component name.

function checkComponents(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const requiredLower = tokens.components.requiredNames.map((n) => n.toLowerCase());

  for (const node of nodes) {
    if (node.isComponentInstance) continue;
    if (node.depth < tokens.components.detectionMinDepth) continue;

    const nameLower = node.name.toLowerCase();
    const match = requiredLower.find((req) => nameLower === req);

    if (match) {
      const original = tokens.components.requiredNames[requiredLower.indexOf(match)];
      flags.push({
        node: node.name,
        nodeId: node.id,
        category: "component",
        severity: "warning",
        issue: `"${node.name}" looks like a detached ${original} — not using a library component`,
        fix: `Replace with the ${original} component instance from the library`,
      });
    }
  }
  return flags;
}

// ── Severity ranking for sorting ──
const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 };

// ── Main entry point ──

const MAX_FLAGS = 10;

export function runDeterministicAudit(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const palette = buildPaletteLookup(tokens.colors.palette);

  const flags: AuditFlag[] = [
    ...checkColors(nodes, tokens, palette),
    ...checkTypography(nodes, tokens),
    ...checkTouchTargets(nodes, tokens),
    ...checkComponents(nodes, tokens),
  ];

  // Sort: errors first, then warnings, then info. Cap at MAX_FLAGS.
  flags.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2));
  return flags.slice(0, MAX_FLAGS);
}
