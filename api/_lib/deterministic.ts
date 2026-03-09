// ── Deterministic Audit Engine ──
// Pure-function checks against design tokens. No LLM needed.
// Covers: colors, typography, spacing, corner radius, component detection.

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
  // sRGB → linear → XYZ → Lab
  let rl = r / 255, gl = g / 255, bl = b / 255;
  rl = rl > 0.04045 ? Math.pow((rl + 0.055) / 1.055, 2.4) : rl / 12.92;
  gl = gl > 0.04045 ? Math.pow((gl + 0.055) / 1.055, 2.4) : gl / 12.92;
  bl = bl > 0.04045 ? Math.pow((bl + 0.055) / 1.055, 2.4) : bl / 12.92;

  // D65 reference white
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

// Pre-computed palette in Lab space for fast lookups
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

// ── Check functions ──

function checkColors(nodes: NodeData[], tokens: DesignTokens, palette: PaletteEntry[]): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const paletteHexSet = new Set(palette.map((p) => p.hex));

  for (const node of nodes) {
    if (node.isComponentInstance || node.colors.length === 0) continue;

    for (const color of node.colors) {
      const upper = color.toUpperCase();

      // Exact match — pass
      if (paletteHexSet.has(upper)) continue;

      const { entry, distance } = findClosestColor(upper, palette);

      if (distance <= 3) {
        // Very close — acceptable, skip
        continue;
      } else if (distance <= tokens.colors.toleranceDeltaE) {
        // Near-miss
        flags.push({
          node: node.name,
          nodeId: node.id,
          category: "color",
          severity: "warning",
          issue: `Color ${upper} is close to ${entry.name} (${entry.hex}) but slightly off (Delta-E ${distance.toFixed(1)})`,
          fix: `Snap to ${entry.hex}`,
        });
      } else {
        // Off-palette
        flags.push({
          node: node.name,
          nodeId: node.id,
          category: "color",
          severity: "error",
          issue: `Off-palette color ${upper} — nearest token is ${entry.name} (${entry.hex}, Delta-E ${distance.toFixed(1)})`,
          fix: `Replace with ${entry.hex} or another token color`,
        });
      }
    }
  }
  return flags;
}

function checkTypography(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const familiesLower = tokens.typography.allowedFamilies.map((f) => f.toLowerCase());
  const sizeSet = new Set(tokens.typography.allowedSizes);

  for (const node of nodes) {
    if (node.isComponentInstance || !node.typography) continue;
    const typo = node.typography;

    // Font family check
    if (!familiesLower.includes(typo.family.toLowerCase())) {
      flags.push({
        node: node.name,
        nodeId: node.id,
        category: "typography",
        severity: "error",
        issue: `Font family "${typo.family}" is not allowed`,
        fix: `Use Haffer`,
      });
    }

    // Font size check
    if (!sizeSet.has(typo.size)) {
      // Find the two nearest allowed sizes for the fix message
      const sorted = tokens.typography.allowedSizes.slice().sort((a, b) => Math.abs(a - typo.size) - Math.abs(b - typo.size));
      const nearest = sorted[0];
      const secondNearest = sorted[1];
      const scaleEntry = tokens.typography.scale.find((s) => s.size === nearest);
      const scaleEntry2 = tokens.typography.scale.find((s) => s.size === secondNearest);
      const fixParts = [scaleEntry ? `${nearest}px (${scaleEntry.name})` : `${nearest}px`];
      if (secondNearest && scaleEntry2) fixParts.push(`${secondNearest}px (${scaleEntry2.name})`);

      flags.push({
        node: node.name,
        nodeId: node.id,
        category: "typography",
        severity: "error",
        issue: `Font size ${typo.size}px is not on the type scale`,
        fix: `Use ${fixParts.join(" or ")}`,
      });
    }

    // Line height check (only if size matches a scale entry)
    if (typo.lineHeight !== null && sizeSet.has(typo.size)) {
      const scaleEntry = tokens.typography.scale.find((s) => s.size === typo.size);
      if (scaleEntry) {
        const diff = Math.abs(typo.lineHeight - scaleEntry.lineHeight);
        if (diff > tokens.typography.lineHeightTolerance) {
          flags.push({
            node: node.name,
            nodeId: node.id,
            category: "typography",
            severity: "warning",
            issue: `Line height ${typo.lineHeight}px doesn't match ${scaleEntry.name} spec (expected ${scaleEntry.lineHeight}px)`,
            fix: `Set line height to ${scaleEntry.lineHeight}px`,
          });
        }
      }
    }
  }
  return flags;
}

function checkSpacing(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const scaleSet = new Set(tokens.spacing.scale);
  const skip = tokens.spacing.skip;

  for (const node of nodes) {
    if (node.isComponentInstance || !node.spacing) continue;

    // Apply skip rules
    if (node.depth <= skip.maxDepth) continue;
    if (node.width > skip.maxWidth) continue;
    if (node.height > skip.maxHeight) continue;
    if (node.childCount > skip.maxChildCount) continue;
    const nameLower = node.name.toLowerCase();
    if (skip.namePatterns.some((p) => nameLower.includes(p))) continue;

    // Check each spacing value
    const spacingValues: { label: string; value: number }[] = [
      { label: "padding-top", value: node.spacing.paddingTop },
      { label: "padding-right", value: node.spacing.paddingRight },
      { label: "padding-bottom", value: node.spacing.paddingBottom },
      { label: "padding-left", value: node.spacing.paddingLeft },
      { label: "gap", value: node.spacing.gap },
    ];

    for (const { label, value } of spacingValues) {
      if (value === 0) continue; // Zero is always fine
      if (scaleSet.has(value)) continue; // Exact match

      // Find nearest scale value
      let nearest = tokens.spacing.scale[0];
      let minDiff = Infinity;
      for (const s of tokens.spacing.scale) {
        const diff = Math.abs(s - value);
        if (diff < minDiff) { minDiff = diff; nearest = s; }
      }

      if (minDiff <= tokens.spacing.tolerance) continue; // Within tolerance

      flags.push({
        node: node.name,
        nodeId: node.id,
        category: "spacing",
        severity: "warning",
        issue: `${label} is ${value}px — not on the 4px spacing scale`,
        fix: `Use ${nearest}px`,
      });
    }

    // Touch target check for interactive elements
    const isInteractive = /button|btn|chip|link|cta|toggle|switch/i.test(node.name) ||
      (node.componentName && /button|btn|chip|link|cta|toggle|switch/i.test(node.componentName));
    if (isInteractive && node.height < tokens.spacing.minTouchTarget) {
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

function checkCornerRadius(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  const flags: AuditFlag[] = [];
  const tokenSet = new Set(tokens.cornerRadius.tokens);

  for (const node of nodes) {
    if (node.isComponentInstance) continue;
    if (node.cornerRadius === undefined || node.cornerRadius === "mixed") continue;
    const radius = node.cornerRadius;

    // 0 is always valid
    if (radius === 0) continue;

    const nameLower = node.name.toLowerCase();

    // Component-specific rules
    for (const [component, expectedRadius] of Object.entries(tokens.cornerRadius.componentRules)) {
      if (nameLower.includes(component)) {
        if (Math.abs(radius - expectedRadius) > tokens.cornerRadius.tolerance) {
          flags.push({
            node: node.name,
            nodeId: node.id,
            category: "corner-radius",
            severity: "error",
            issue: `${component} has ${radius}px radius — should be ${expectedRadius}px`,
            fix: `Set corner radius to ${expectedRadius}px`,
          });
        }
        // Skip general check if we matched a component rule
        continue;
      }
    }

    // General check
    if (tokenSet.has(radius)) continue; // Exact match

    let nearest = tokens.cornerRadius.tokens[0];
    let minDiff = Infinity;
    for (const t of tokens.cornerRadius.tokens) {
      const diff = Math.abs(t - radius);
      if (diff < minDiff) { minDiff = diff; nearest = t; }
    }

    if (minDiff <= tokens.cornerRadius.tolerance) continue; // Within tolerance

    flags.push({
      node: node.name,
      nodeId: node.id,
      category: "corner-radius",
      severity: "warning",
      issue: `Non-standard corner radius ${radius}px`,
      fix: `Use ${nearest}px`,
    });
  }
  return flags;
}

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

// ── Main entry point ──

export function runDeterministicAudit(nodes: NodeData[], tokens: DesignTokens): AuditFlag[] {
  // Pre-compute palette lookup (Lab colors cached for all checks)
  const palette = buildPaletteLookup(tokens.colors.palette);

  const flags: AuditFlag[] = [
    ...checkColors(nodes, tokens, palette),
    ...checkTypography(nodes, tokens),
    ...checkSpacing(nodes, tokens),
    ...checkCornerRadius(nodes, tokens),
    ...checkComponents(nodes, tokens),
  ];

  return flags;
}
