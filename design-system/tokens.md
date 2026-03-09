# Design System Tokens — Garden

> Design system tokens exported from Figma. This file is the source of truth for the Design Auditor.

---

## Colors

### Brand Primary (Action)
| Token | Hex | Usage |
|-------|-----|-------|
| action-primary | #FC79C1 | Primary action buttons, CTA, links |
| action-primary-hover | #FF65BA | Primary action hover state |
| action-secondary | #473C75 | Secondary action buttons, alternatives |
| action-secondary-hover | #402E8E | Secondary action hover state |
| action-tertiary | #FFC4E4 | Light action, tertiary button |

### Text
| Token | Hex | Usage |
|-------|-----|-------|
| text-primary | #473C75 | Body text, headings, main content |
| text-secondary | #908AAD | Secondary text, descriptions, muted |

### Background
| Token | Hex | Usage |
|-------|-----|-------|
| bg-base | #E4EBF2 | Primary background, page base |
| bg-white | #FFFFFF | White card backgrounds, overlays |
| bg-overlay-strong | #FFFFFF @ 70% | Strong overlay (modals, menus) |
| bg-overlay-mid | #FFFFFF @ 50% | Medium overlay |
| bg-overlay-soft | #FFFFFF @ 30% | Soft overlay (hover states) |
| bg-overlay-subtle | #FFFFFF @ 10% | Very subtle overlay |
| bg-dark-soft | #22242B @ 30% | Dark soft overlay |

### Status & Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| status-success | #1DC089 | Success states, confirmations |
| status-error | #FF005C | Error states, destructive actions |

---

## Typography

### Font Family
- **Primary**: Haffer (all UI text)

### Type Scale
| Name | Size (px) | Weight | Line Height | Usage |
|------|-----------|--------|-------------|-------|
| h1 | 32 | Medium | 40 | Hero headings |
| h2 | 20 | Medium | 24 | Page titles, major sections |
| h3 | 16 | Medium | 20 | Section headings, card titles |
| h4 | 14 | Medium | 20 | Sub-section headings |
| h5 | 12 | Medium | 16 | Small headings, labels |
| h6 | 10 | Medium | 12 | Extra small, metadata |
| body | 14-16 | Regular | 20 | Body text |

### Allowed Font Weights
- Regular (400)
- Medium (500)

---

## Corner Radius

| Token | Value (px) | Usage |
|-------|-----------|-------|
| radius-inner | 12 | Inner element corners |
| radius-outer | 16 | Outer element, card corners |
| radius-full | 999 | Fully rounded (pills, circles) |

**Tolerance:**
- 0px (sharp corners) is always acceptable
- Values within 4px of a token (e.g., 8, 10, 14, 20) are near-matches, not hard violations

---

## Spacing Scale

All spacing (padding, gap, margins) must be from this scale:

| Token | Value (px) |
|-------|-----------|
| space-1 | 4 |
| space-2 | 8 |
| space-3 | 12 |
| space-4 | 16 |
| space-5 | 20 |
| space-6 | 24 |
| space-8 | 32 |
| space-10 | 40 |
| space-12 | 48 |
| space-16 | 64 |
| space-20 | 80 |

**Rules:**
- The spacing scale applies to UI-level components (buttons, cards, form elements, badges)
- Page-level layout containers (navbars, hero sections, sidebars, footers) may use any spacing for visual layout — these are intentional design decisions, not violations
- Minimum touch target: 44px (for interactive elements)

---

## Component Rules

The following UI patterns **must** use library components (not rebuilt custom):

| Pattern | Required Component | Notes |
|---------|--------------------|-------|
| Buttons | Button | Primary, secondary, tertiary variants |
| Text inputs | Input | Text fields, search |
| Dropdowns | Select / Dropdown | — |
| Checkboxes | Checkbox | — |
| Radio buttons | Radio | — |
| Toggle switches | Switch | — |
| Cards | Card | Container with standard padding |
| Avatars | Avatar | User images, profile pictures |
| Badges | Badge | Status indicators |
| Modals | Dialog / Modal | Overlay dialogs |
| Tooltips | Tooltip | Hover information |
| Navigation tabs | Tabs | Tab navigation |
| Breadcrumbs | Breadcrumb | Navigation breadcrumbs |
| Alerts | Alert / Banner | System messages |

**Detection:** A node should only be flagged as a detached component if ALL of the following are true:
1. The node is NOT a component instance (isComponentInstance is false)
2. The node name is an exact case-insensitive match to a required component name above
3. The node's child structure resembles the expected component (e.g., a "Button" has a text child)
4. The node is at depth 2+ (not a top-level layout frame)

---
