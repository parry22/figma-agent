// Design Auditor — Figma Plugin Sandbox
// Handles node traversal, value extraction, and message passing with the UI

interface NodeData {
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
  isComponentInstance: boolean;
  componentName?: string;
}

interface AuditPayload {
  frameName: string;
  nodes: NodeData[];
}

// Convert Figma RGB (0-1) to hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Extract color hex values from a node's fills and strokes
function extractColors(node: SceneNode): string[] {
  const colors: string[] = [];

  if ("fills" in node && Array.isArray(node.fills)) {
    for (const fill of node.fills as Paint[]) {
      if (fill.type === "SOLID" && fill.visible !== false) {
        colors.push(rgbToHex(fill.color.r, fill.color.g, fill.color.b));
      }
    }
  }

  if ("strokes" in node && Array.isArray(node.strokes)) {
    for (const stroke of node.strokes as Paint[]) {
      if (stroke.type === "SOLID" && stroke.visible !== false) {
        colors.push(rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b));
      }
    }
  }

  return colors;
}

// Extract typography info from text nodes
function extractTypography(
  node: SceneNode
): NodeData["typography"] | undefined {
  if (node.type !== "TEXT") return undefined;

  const textNode = node as TextNode;

  // Handle mixed fonts — take the first segment
  const fontName =
    textNode.fontName === figma.mixed
      ? textNode.getRangeFontName(0, 1)
      : textNode.fontName;

  const fontSize =
    textNode.fontSize === figma.mixed
      ? textNode.getRangeFontSize(0, 1)
      : textNode.fontSize;

  let lineHeight: number | null = null;
  const lh =
    textNode.lineHeight === figma.mixed
      ? textNode.getRangeLineHeight(0, 1)
      : textNode.lineHeight;
  if (lh.unit === "PIXELS") {
    lineHeight = lh.value;
  } else if (lh.unit === "PERCENT") {
    lineHeight = (lh.value / 100) * (fontSize as number);
  }

  let letterSpacing: number | null = null;
  const ls =
    textNode.letterSpacing === figma.mixed
      ? textNode.getRangeLetterSpacing(0, 1)
      : textNode.letterSpacing;
  if (ls.unit === "PIXELS") {
    letterSpacing = ls.value;
  } else if (ls.unit === "PERCENT") {
    letterSpacing = (ls.value / 100) * (fontSize as number);
  }

  return {
    family: fontName.family,
    style: fontName.style,
    size: fontSize as number,
    lineHeight,
    letterSpacing,
  };
}

// Extract spacing info from auto-layout frames
function extractSpacing(node: SceneNode): NodeData["spacing"] | undefined {
  if (!("layoutMode" in node)) return undefined;
  const frame = node as FrameNode;
  if (frame.layoutMode === "NONE") return undefined;

  return {
    paddingTop: frame.paddingTop,
    paddingRight: frame.paddingRight,
    paddingBottom: frame.paddingBottom,
    paddingLeft: frame.paddingLeft,
    gap: frame.itemSpacing,
  };
}

// Recursively extract data from all nodes in a tree
function traverseNode(node: SceneNode, results: NodeData[]): void {
  const data: NodeData = {
    id: node.id,
    name: node.name,
    type: node.type,
    colors: extractColors(node),
    typography: extractTypography(node),
    spacing: extractSpacing(node),
    isComponentInstance: node.type === "INSTANCE",
    componentName: undefined,
  };

  if (node.type === "INSTANCE") {
    const instance = node as InstanceNode;
    if (instance.mainComponent) {
      data.componentName = instance.mainComponent.name;
    }
  }

  // Only include nodes that have meaningful data
  const hasData =
    data.colors.length > 0 ||
    data.typography !== undefined ||
    data.spacing !== undefined ||
    data.isComponentInstance;

  if (hasData) {
    results.push(data);
  }

  // Recurse into children
  if ("children" in node) {
    for (const child of (node as FrameNode).children) {
      traverseNode(child, results);
    }
  }
}

// Build the full audit payload from the current selection
function buildAuditPayload(): AuditPayload | null {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select a frame to audit.",
    });
    return null;
  }

  const rootNode = selection[0];
  const nodes: NodeData[] = [];
  traverseNode(rootNode, nodes);

  if (nodes.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "No auditable nodes found in the selection.",
    });
    return null;
  }

  return {
    frameName: rootNode.name,
    nodes,
  };
}

// --- Plugin entry point ---

figma.showUI(__html__, { width: 420, height: 600, themeColors: true });

figma.ui.onmessage = (msg: { type: string; [key: string]: any }) => {
  if (msg.type === "run-audit") {
    const payload = buildAuditPayload();
    if (payload) {
      // Send extracted data to UI so it can make the HTTP call
      figma.ui.postMessage({ type: "audit-payload", payload });
    }
  }

  if (msg.type === "notify") {
    figma.notify(msg.message);
  }

  if (msg.type === "focus-node") {
    const node = figma.getNodeById(msg.nodeId);
    if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
    }
  }
};
