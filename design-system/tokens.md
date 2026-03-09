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
- No arbitrary spacing (e.g., 5px, 13px, 15px, 22px are violations)
- Spacing values must match exactly from the scale above
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

**Detection:** If a frame/group matches a component name (e.g., "Button", "Card") but is NOT an instance of the library component, flag it as detached or custom-built.

---
