// ── Shared types for the Design Auditor API ──

// Flag schema — the API contract with the plugin UI
export interface AuditFlag {
  node: string;
  nodeId: string;
  category: "color" | "typography" | "spacing" | "corner-radius" | "component";
  issue: string;
  severity: "error" | "warning" | "info";
  fix: string;
}

export interface AuditSummary {
  totalNodes: number;
  errors: number;
  warnings: number;
  info: number;
}

export interface AuditResult {
  flags: AuditFlag[];
  summary: AuditSummary;
}

// Node data — mirrors plugin/code.ts NodeData
export interface NodeData {
  id: string;
  name: string;
  type: string;
  colors: string[];
  typography?: {
    family: string;
    style: string;
    size: number;
    lineHeight: number | null;
    letterSpacing: number | null;
  };
  spacing?: {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    gap: number;
  };
  cornerRadius?: number | "mixed";
  isComponentInstance: boolean;
  componentName?: string;
  parentName: string | null;
  parentType: string | null;
  depth: number;
  width: number;
  height: number;
  childCount: number;
  layoutMode?: "HORIZONTAL" | "VERTICAL";
}

// Slim node — stripped-down version sent to the LLM
export interface SlimNode {
  id: string;
  name: string;
  type: string;
  isComponentInstance: boolean;
  componentName?: string;
  parentName: string | null;
  depth: number;
  width: number;
  height: number;
  childCount: number;
  layoutMode?: "HORIZONTAL" | "VERTICAL";
}

// ── Design Tokens schema (mirrors tokens.json) ──

export interface ColorToken {
  name: string;
  usage: string;
}

export interface TypoScaleEntry {
  name: string;
  size: number;
  lineHeight: number;
}

export interface DesignTokens {
  colors: {
    palette: Record<string, ColorToken>;
    toleranceDeltaE: number;
  };
  typography: {
    allowedFamilies: string[];
    allowedWeights: number[];
    scale: TypoScaleEntry[];
    allowedSizes: number[];
    lineHeightTolerance: number;
  };
  spacing: {
    scale: number[];
    tolerance: number;
    minTouchTarget: number;
    skip: {
      maxDepth: number;
      maxWidth: number;
      maxHeight: number;
      maxChildCount: number;
      namePatterns: string[];
    };
  };
  cornerRadius: {
    tokens: number[];
    tolerance: number;
    componentRules: Record<string, number>;
  };
  components: {
    requiredNames: string[];
    detectionMinDepth: number;
  };
}
