// ── Design Tokens — Runtime Source of Truth ──
// Embedded as code so it works everywhere (Vercel, local dev) with zero filesystem I/O.
// The design-system/tokens.json file remains as documentation reference.

import type { DesignTokens } from "./types";

export const TOKENS: DesignTokens = {
  colors: {
    palette: {
      "#FC79C1": { name: "brand-rose", usage: "Primary brand, CTAs, interactive elements" },
      "#FF65BA": { name: "action-primary-hover", usage: "Primary hover state" },
      "#FFC4E4": { name: "brand-rose-light", usage: "Tertiary actions, light accent" },
      "#F29FCD": { name: "brand-rose-soft", usage: "Softer rose variant" },
      "#473C75": { name: "brand-iris", usage: "Secondary brand, text-primary, secondary buttons" },
      "#402E8E": { name: "action-secondary-hover", usage: "Secondary hover state" },
      "#908AAD": { name: "text-secondary", usage: "Descriptions, labels, muted text" },
      "#E4EBF2": { name: "brand-mist", usage: "Backgrounds, surfaces" },
      "#FFFFFF": { name: "white", usage: "Cards, panels, text on buttons" },
      "#000000": { name: "black", usage: "Pure black accents" },
      "#181325": { name: "brand-elderberry", usage: "Dark backgrounds" },
      "#22242B": { name: "dark-overlay-base", usage: "Dark overlay base" },
      "#1DC089": { name: "status-success", usage: "Success states, confirmations" },
      "#FF005C": { name: "status-error", usage: "Error states, destructive actions" },
    },
    toleranceDeltaE: 10,
  },
  typography: {
    allowedFamilies: ["Haffer", "Haffer-TRIAL"],
    allowedWeights: [400, 500, 570],
    scale: [
      { name: "h1", size: 32, lineHeight: 40 },
      { name: "h2", size: 20, lineHeight: 24 },
      { name: "h3", size: 16, lineHeight: 20 },
      { name: "h4", size: 14, lineHeight: 20 },
      { name: "h5", size: 12, lineHeight: 16 },
      { name: "h6", size: 10, lineHeight: 12 },
    ],
    allowedSizes: [10, 12, 14, 16, 20, 32],
    lineHeightTolerance: 2,
  },
  spacing: {
    scale: [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80],
    tolerance: 2,
    minTouchTarget: 44,
    skip: {
      maxDepth: 1,
      maxWidth: 500,
      maxHeight: 300,
      maxChildCount: 5,
      namePatterns: [
        "nav", "header", "footer", "sidebar", "section", "page",
        "wrapper", "hero", "content", "layout", "screen", "row", "column",
      ],
    },
  },
  cornerRadius: {
    tokens: [0, 8, 12, 16, 24, 999],
    tolerance: 4,
    componentRules: { button: 12, chip: 24 },
  },
  components: {
    requiredNames: [
      "Button", "Chip", "Input", "Select", "Card", "Avatar", "Badge",
      "Dialog", "Modal", "Tooltip", "TabSwitch", "Breadcrumb",
      "NotificationToast", "SearchBar", "Paginator", "WalletCard",
      "Header", "Footer",
    ],
    detectionMinDepth: 2,
  },
};
