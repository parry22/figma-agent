"use strict";
(() => {
  // plugin/code.ts
  function rgbToHex(r, g, b) {
    const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }
  function extractColors(node) {
    const colors = [];
    if ("fills" in node && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === "SOLID" && fill.visible !== false) {
          colors.push(rgbToHex(fill.color.r, fill.color.g, fill.color.b));
        }
      }
    }
    if ("strokes" in node && Array.isArray(node.strokes)) {
      for (const stroke of node.strokes) {
        if (stroke.type === "SOLID" && stroke.visible !== false) {
          colors.push(rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b));
        }
      }
    }
    return colors;
  }
  function extractTypography(node) {
    if (node.type !== "TEXT") return void 0;
    const textNode = node;
    const fontName = textNode.fontName === figma.mixed ? textNode.getRangeFontName(0, 1) : textNode.fontName;
    const fontSize = textNode.fontSize === figma.mixed ? textNode.getRangeFontSize(0, 1) : textNode.fontSize;
    let lineHeight = null;
    const lh = textNode.lineHeight === figma.mixed ? textNode.getRangeLineHeight(0, 1) : textNode.lineHeight;
    if (lh.unit === "PIXELS") {
      lineHeight = lh.value;
    } else if (lh.unit === "PERCENT") {
      lineHeight = lh.value / 100 * fontSize;
    }
    let letterSpacing = null;
    const ls = textNode.letterSpacing === figma.mixed ? textNode.getRangeLetterSpacing(0, 1) : textNode.letterSpacing;
    if (ls.unit === "PIXELS") {
      letterSpacing = ls.value;
    } else if (ls.unit === "PERCENT") {
      letterSpacing = ls.value / 100 * fontSize;
    }
    return {
      family: fontName.family,
      style: fontName.style,
      size: fontSize,
      lineHeight,
      letterSpacing
    };
  }
  function extractSpacing(node) {
    if (!("layoutMode" in node)) return void 0;
    const frame = node;
    if (frame.layoutMode === "NONE") return void 0;
    return {
      paddingTop: frame.paddingTop,
      paddingRight: frame.paddingRight,
      paddingBottom: frame.paddingBottom,
      paddingLeft: frame.paddingLeft,
      gap: frame.itemSpacing
    };
  }
  function extractCornerRadius(node) {
    if (!("cornerRadius" in node)) return void 0;
    const cr = node.cornerRadius;
    if (cr === figma.mixed) return "mixed";
    if (typeof cr === "number" && cr > 0) return cr;
    return void 0;
  }
  function traverseNode(node, results, depth) {
    const parent = node.parent;
    const data = {
      id: node.id,
      name: node.name,
      type: node.type,
      colors: extractColors(node),
      typography: extractTypography(node),
      spacing: extractSpacing(node),
      cornerRadius: extractCornerRadius(node),
      isComponentInstance: node.type === "INSTANCE",
      componentName: void 0,
      // Context fields
      parentName: parent && parent.type !== "PAGE" ? parent.name : null,
      parentType: parent ? parent.type : null,
      depth,
      width: Math.round("width" in node ? node.width : 0),
      height: Math.round("height" in node ? node.height : 0),
      childCount: "children" in node ? node.children.length : 0,
      layoutMode: void 0
    };
    if ("layoutMode" in node) {
      const frame = node;
      if (frame.layoutMode !== "NONE") {
        data.layoutMode = frame.layoutMode;
      }
    }
    if (node.type === "INSTANCE") {
      const instance = node;
      if (instance.mainComponent) {
        data.componentName = instance.mainComponent.name;
      }
    }
    const hasData = data.colors.length > 0 || data.typography !== void 0 || data.spacing !== void 0 || data.cornerRadius !== void 0 || data.isComponentInstance;
    if (hasData) {
      results.push(data);
    }
    if ("children" in node) {
      for (const child of node.children) {
        traverseNode(child, results, depth + 1);
      }
    }
  }
  function buildAuditPayload() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "Please select a frame to audit."
      });
      return null;
    }
    const rootNode = selection[0];
    const nodes = [];
    traverseNode(rootNode, nodes, 0);
    if (nodes.length === 0) {
      figma.ui.postMessage({
        type: "error",
        message: "No auditable nodes found in the selection."
      });
      return null;
    }
    return {
      frameName: rootNode.name,
      nodes
    };
  }
  figma.showUI(__html__, { width: 420, height: 600, themeColors: true });
  figma.ui.onmessage = (msg) => {
    if (msg.type === "run-audit") {
      const payload = buildAuditPayload();
      if (payload) {
        figma.ui.postMessage({
          type: "audit-payload",
          payload,
          fileKey: figma.fileKey
        });
      }
    }
    if (msg.type === "notify") {
      figma.notify(msg.message);
    }
    if (msg.type === "focus-node") {
      const node = figma.getNodeById(msg.nodeId);
      if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      }
    }
  };
})();
