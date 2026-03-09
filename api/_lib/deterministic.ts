// ── Deterministic Audit Engine ──
// Pure-function checks against design tokens. No LLM needed.
//
// SEVERITY GUIDE — each level must earn its place:
//   error   (Severe) → wrong font family, truly off-brand color, tiny touch target
//   warning (Medium) → color near-miss, font size significantly off, detached component
//   info    (Low)    → line-height drift, non-standard corner radius
//
// Target: 3-8 flags per audit, spread across at least 2 severity levels.

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
// error  → Delta-E > tolerance (10): truly off-brand
// warning → Delta-E 7–10: noticeably off, worth a look

const COLOR_WARNING_THRESHOLD = 7;

function checkColors(nodes: NodeData[], tokens: DesignTokens, palette: PaletteEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const paletteHexSet = new Set(palette.map((p) => p.hex));

  for (const node of nodes) {
    if (node.isComponentInstance || node.colors.length === 0) continue;

    for (const color of node.colors) {
      const upper = color.toUpperCase();
      if (paletteHexSet.has(upper)) continue;

      const { entry, distance } = findClosestColor(upper, palette);

      if (distance <= COLOR_WARNING_THRESHOLD) {
        // Close enough — skip entirely
        continue;
      } else if (distance <= tokens.colors.toleranceDeltaE) {
        // Near-miss: noticeably off but in the ballpark → warning
        flags.push({
          node: node.name,
          nodeId: node.id,
          category: "color",
          severity: "warning",
          issue: `Color ${upper} is close to ${entry.name} (${entry.hex}) but slightly off`,
          fix: `Snap to ${entry.hex}`,
        });
      } else {
        // Truly off-palette → error
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
  }
  return flags;
}

// ── Typography ──
// error   → wrong font family (always wrong)
// warning → font size >4px off the nearest allowed size (likely unintentional)
// info    → line height doesn't match the spec for its scale entry

const FONT_SIZE_WARNING_THRESHOLD = 4;

function checkTypography(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const familiesLower = tokens.typography.allowedFamilies.map((f) => f.toLowerCase());
  const sizeSet = new Set(tokens.typography.allowedSizes);

  for (const node of nodes) {
    if (node.isComponentInstance || !node.typography) continue;
    const typo = node.typography;

    // Font family → error
    if (!familiesLower.includes(typo.family.toLowerCase())) {
      flags.push({
        node: node.name,
        nodeId: node.id,
        category: "typography",
        severity: "error",
        issue: `Font family "${typo.family}" is not allowed`,
        fix: `Use Haffer`,
      });
      continue; // Don't pile on size/lineHeight if the family is already wrong
    }

    // Font size → warning (only if significantly off)
    if (!sizeSet.has(typo.size)) {
      const sorted = tokens.typography.allowedSizes.slice().sort((a, b) => Math.abs(a - typo.size) - Math.abs(b - typo.size));
      const nearest = sorted[0];
      const diff = Math.abs(typo.size - nearest);

      if (diff > FONT_SIZE_WARNING_THRESHOLD) {
        const scaleEntry = tokens.typography.scale.find((s) => s.size === nearest);
        const label = scaleEntry ? `${nearest}px (${scaleEntry.name})` : `${nearest}px`;
        flags.push({
          node: node.name,
          nodeId: node.id,
          category: "typography",
          severity: "warning",
          issue: `Font size ${typo.size}px is not on the type scale — nearest is ${label}`,
          fix: `Use ${label}`,
        });
      }
    }

    // Line height → info (only if using an on-scale size but wrong line height)
    if (typo.lineHeight !== null && sizeSet.has(typo.size)) {
      const scaleEntry = tokens.typography.scale.find((s) => s.size === typo.size);
      if (scaleEntry) {
        const lhDiff = Math.abs(typo.lineHeight - scaleEntry.lineHeight);
        if (lhDiff > tokens.typography.lineHeightTolerance) {
          flags.push({
            node: node.name,
            nodeId: node.id,
            category: "typography",
            severity: "info",
            issue: `Line height ${typo.lineHeight}px doesn't match ${scaleEntry.name} spec (expected ${scaleEntry.lineHeight}px)`,
            fix: `Set line height to ${scaleEntry.lineHeight}px`,
          });
        }
      }
    }
  }
  return flags;
}

// ── Touch targets ──
// error → interactive element too small to tap

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

// ── Corner radius ──
// info → significantly non-standard radius (>8px off nearest token)
//        Only for non-trivial nodes (depth ≥ 2, has visible radius)

const RADIUS_INFO_THRESHOLD = 8;

function checkCornerRadius(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const tokenSet = new Set(tokens.cornerRadius.tokens);

  for (const node of nodes) {
    if (node.isComponentInstance) continue;
    if (node.cornerRadius === undefined || node.cornerRadius === "mixed") continue;
    if (node.depth < 2) continue; // Skip top-level layout frames
    const radius = node.cornerRadius;
    if (radius === 0) continue;

    if (tokenSet.has(radius)) continue;

    // Find nearest token
    let nearest = tokens.cornerRadius.tokens[0];
    let minDiff = Infinity;
    for (const t of tokens.cornerRadius.tokens) {
      const diff = Math.abs(t - radius);
      if (diff < minDiff) { minDiff = diff; nearest = t; }
    }

    if (minDiff <= RADIUS_INFO_THRESHOLD) continue; // Close enough

    flags.push({
      node: node.name,
      nodeId: node.id,
      category: "corner-radius",
      severity: "info",
      issue: `Non-standard corner radius ${radius}px — nearest token is ${nearest}px`,
      fix: `Use ${nearest}px`,
    });
  }
  return flags;
}

// ── Detached components ──
// warning → non-instance whose name exactly matches a required component

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
    ...checkCornerRadius(nodes, tokens),
    ...checkComponents(nodes, tokens),
  ];

  // Sort: errors first, then warnings, then info. Cap at MAX_FLAGS.
  flags.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 2) - (SEVERITY_RANK[b.severity] ?? 2));
  return flags.slice(0, MAX_FLAGS);
}
