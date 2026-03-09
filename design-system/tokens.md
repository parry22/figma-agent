# Design System Tokens — Hashira (Garden & PossibleWorks)

> **Replace placeholder values below with your actual design system tokens.**
> This file is injected into the Claude audit prompt as the source of truth.

---

## Colors

### Brand — Garden
| Token | Hex | Usage |
|-------|-----|-------|
| garden-primary | #2563EB | Primary actions, links |
| garden-primary-hover | #1D4ED8 | Primary hover state |
| garden-secondary | #7C3AED | Secondary accents |
| garden-secondary-hover | #6D28D9 | Secondary hover state |

### Brand — PossibleWorks
| Token | Hex | Usage |
|-------|-----|-------|
| pw-primary | #059669 | Primary actions, links |
| pw-primary-hover | #047857 | Primary hover state |
| pw-secondary | #0891B2 | Secondary accents |
| pw-secondary-hover | #0E7490 | Secondary hover state |

### Shared Neutrals
| Token | Hex | Usage |
|-------|-----|-------|
| neutral-50 | #F9FAFB | Page backgrounds |
| neutral-100 | #F3F4F6 | Card backgrounds, subtle fills |
| neutral-200 | #E5E7EB | Borders, dividers |
| neutral-300 | #D1D5DB | Disabled borders |
| neutral-400 | #9CA3AF | Placeholder text |
| neutral-500 | #6B7280 | Secondary text |
| neutral-600 | #4B5563 | Body text |
| neutral-700 | #374151 | Headings |
| neutral-800 | #1F2937 | Primary text |
| neutral-900 | #111827 | High-emphasis text |
| white | #FFFFFF | White backgrounds |
| black | #000000 | Reserved for special use only |

### Semantic
| Token | Hex | Usage |
|-------|-----|-------|
| success | #10B981 | Success states, confirmations |
| success-bg | #D1FAE5 | Success background fill |
| warning | #F59E0B | Warning states |
| warning-bg | #FEF3C7 | Warning background fill |
| error | #EF4444 | Error states, destructive actions |
| error-bg | #FEE2E2 | Error background fill |
| info | #3B82F6 | Info states |
| info-bg | #DBEAFE | Info background fill |

---

## Typography

### Font Families
- **Primary**: Inter (all UI text)
- **Monospace**: JetBrains Mono (code, data)

### Type Scale
| Name | Size (px) | Weight | Line Height | Usage |
|------|-----------|--------|-------------|-------|
| display-lg | 48 | 700 | 56 | Hero headings |
| display-md | 36 | 700 | 44 | Page titles |
| heading-lg | 30 | 600 | 38 | Section headings |
| heading-md | 24 | 600 | 32 | Card titles |
| heading-sm | 20 | 600 | 28 | Sub-section headings |
| body-lg | 18 | 400 | 28 | Large body text |
| body-md | 16 | 400 | 24 | Default body text |
| body-sm | 14 | 400 | 20 | Secondary text, descriptions |
| caption | 12 | 400 | 16 | Labels, captions, metadata |
| overline | 12 | 600 | 16 | Overline text (uppercase) |

### Allowed Font Weights
- 400 (Regular)
- 500 (Medium)
- 600 (Semibold)
- 700 (Bold)

---

## Spacing Scale

All spacing values must be from this scale (4px base unit):

| Token | Value (px) |
|-------|-----------|
| space-0 | 0 |
| space-0.5 | 2 |
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
| space-24 | 96 |

**Rules:**
- Padding and gap values must use values from this scale
- No arbitrary spacing values (e.g., 13px, 22px, 37px are violations)
- Minimum touch target: 44px (for interactive elements)

---

## Component Rules

The following UI patterns **must** use library components (not rebuilt custom):

| Pattern | Required Component | Notes |
|---------|--------------------|-------|
| Buttons | Button | All variants: primary, secondary, ghost, destructive |
| Text inputs | Input / TextField | Includes search, password, etc. |
| Dropdowns | Select / Dropdown | — |
| Checkboxes | Checkbox | — |
| Radio buttons | Radio / RadioGroup | — |
| Toggle switches | Switch / Toggle | — |
| Cards | Card | Container component with standard padding |
| Avatars | Avatar | User profile images |
| Badges | Badge | Status indicators, counts |
| Modals | Dialog / Modal | Overlay dialogs |
| Tooltips | Tooltip | Hover information |
| Navigation tabs | Tabs | — |
| Breadcrumbs | Breadcrumb | — |
| Alerts | Alert / Banner | System messages |
| Icons | Icon (from icon set) | Must use library icon set, not custom SVGs |

**Detection heuristic:** If a frame/group uses the same name pattern as a library component (e.g., "Button", "Card", "Input") but is NOT an instance of the library component, flag it as a potential detached or rebuilt component.

---

## Product-Specific Overrides

### Garden
- Uses `garden-primary` (#2563EB) for all primary actions
- Default border radius: 8px
- Card shadow: 0 1px 3px rgba(0,0,0,0.1)

### PossibleWorks
- Uses `pw-primary` (#059669) for all primary actions
- Default border radius: 6px
- Card shadow: 0 2px 4px rgba(0,0,0,0.06)
