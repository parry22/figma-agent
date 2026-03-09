# Design System Tokens — Garden

> Source of truth for the Design Auditor plugin. Compiled from the Garden Brand Kit, Figma design variables, and component-level specs extracted from the GARDEN_Product Figma file.

---

## Colors

### Brand Core

These are Garden's foundational brand colors. All UI colors derive from these.

| Token | Hex | Brand Name | Usage |
|-------|-----|------------|-------|
| brand-rose | #FC79C1 | Garden Rose | Primary brand color, CTAs, interactive elements |
| brand-rose-light | #FFC4E4 | Secondary Rose | Light accent, tertiary actions, hover tints |
| brand-rose-soft | #F29FCD | — | Softer rose variant (brand kit alternate) |
| brand-iris | #473C75 | Iris | Secondary brand color, text, secondary buttons |
| brand-mist | #E4EBF2 | Mist | Backgrounds, surfaces |
| brand-elderberry | #181325 | Elderberry | Dark backgrounds, dark mode base |

### Action / Interactive

| Token | Hex | Usage |
|-------|-----|-------|
| action-primary | #FC79C1 | Primary action buttons, CTA, links |
| action-primary-hover | #FF65BA | Primary action hover state |
| action-secondary | #473C75 | Secondary action buttons, alternatives |
| action-secondary-hover | #402E8E | Secondary action hover state |
| action-tertiary | #FFC4E4 | Tertiary buttons, light action |
| action-disabled | — | Disabled state (reduced opacity of the type variant) |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| text-primary | #473C75 | Body text, headings, main content |
| text-secondary | #908AAD | Descriptions, labels, muted text, placeholders |
| text-on-action | #FFFFFF | Text on primary/secondary buttons |
| text-on-dark | #FFFFFF | Text on dark backgrounds |

### Background & Surface

| Token | Hex | Usage |
|-------|-----|-------|
| bg-base | #E4EBF2 | Primary page background |
| bg-white | #FFFFFF | Card surfaces, panels, inputs |
| bg-dark | #181325 | Dark mode background (Elderberry) |
| bg-black | #000000 | Pure black accents |

### Overlays

| Token | Color | Opacity | Usage |
|-------|-------|---------|-------|
| overlay-strong | #FFFFFF | 70% | Modals, dialogs, menus |
| overlay-mid | #FFFFFF | 50% | Dropdown overlays |
| overlay-soft | #FFFFFF | 30% | Hover state backgrounds |
| overlay-subtle | #FFFFFF | 10% | Very faint hover, selection |
| overlay-dark-soft | #22242B | 30% | Dark scrim, dimmed backgrounds |

### Status & Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| status-success | #1DC089 | Success states, confirmations, positive |
| status-error | #FF005C | Error states, destructive actions, alerts |

### Extended Palette (all recognized colors)

Any color used in the design should match one of the tokens above. The full set of recognized hex values:

```
#FC79C1  #FF65BA  #FFC4E4  #F29FCD
#473C75  #402E8E  #908AAD
#E4EBF2  #FFFFFF  #000000  #181325  #22242B
#1DC089  #FF005C
```

**Tolerance:** Colors within a Delta-E of 5 (barely perceptible) of a recognized color are acceptable. Beyond that, flag as "off-palette color".

---

## Typography

### Font Family

- **Primary (and only):** Haffer
  - Also appears as "Haffer-TRIAL" in some contexts — treat both as the same family.
  - **No other font family is allowed.** Any node using a different font family should be flagged.

### Font Weights

| Weight Name | Numeric Value | Usage |
|-------------|---------------|-------|
| Regular | 400 | Body text, descriptions, secondary headings |
| Medium | 570 | Headings, buttons, emphasis, labels |

> **Important:** Medium weight is 570 in Figma (not the typical 500). Both 500 and 570 should be accepted as "Medium."

### Type Scale

| Token | Size (px) | Line Height (px) | Weight | Letter Spacing | Usage |
|-------|-----------|-------------------|--------|----------------|-------|
| h1 | 32 | 40 | Medium (570) | 0 | Hero headings, page titles |
| h2 | 20 | 24 | Medium (570) | 0 | Section titles, card headings |
| h2-regular | 20 | 24 | Regular (400) | 0 | Section subtitles |
| h3 | 16 | 20 | Medium (570) | 0 | Sub-section headings, card titles |
| h3-regular | 16 | 20 | Regular (400) | 0 | Body large, chip text |
| h4 | 14 | 20 | Medium (570) | 0 | Labels, small headings |
| h4-regular | 14 | 20 | Regular (400) | 0 | Body text default |
| h5 | 12 | 16 | Medium (570) | 0 | Small labels, metadata |
| h5-regular | 12 | 16 | Regular (400) | 0 | Captions, fine print |
| h6 | 10 | 12 | Medium (570) | 0 | Extra small, badges |
| h6-regular | 10 | 12 | Regular (400) | 0 | Extra small secondary |

### Allowed Font Sizes

Only these sizes should appear in the design:

```
10  12  14  16  20  32
```

Any text node using a size not in this list is a violation.

---

## Corner Radius

| Token | Value (px) | Usage |
|-------|-----------|-------|
| radius-sm | 8 | Small elements, inner nested corners |
| radius-md | 12 | Buttons (all sizes), cards, inputs |
| radius-lg | 16 | Outer containers, large cards |
| radius-xl | 24 | Chips, tags, pill-shaped elements |
| radius-full | 999 | Circles, fully rounded pills, avatars |

**Rules:**
- 0px (sharp corners) is always acceptable.
- Values within 4px of a recognized token are near-matches — warn but don't flag as error.
- Buttons must always use 12px radius.
- Chips must always use 24px radius.

---

## Spacing Scale

All spacing (padding, gap, margins) must come from this 4px-base scale:

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
| space-14 | 56 |
| space-16 | 64 |
| space-20 | 80 |

**Rules:**
- The spacing scale applies to UI-level components (buttons, cards, form elements, badges, chips).
- Page-level layout containers (navbars, hero sections, sidebars, footers) may use any spacing — these are intentional layout decisions, not violations.
- Minimum touch target: 44px height for interactive elements.
- Tolerance: Values within 2px of a scale value are acceptable (e.g., 23px is close enough to 24px).

---

## Effects

| Token | Type | Value | Usage |
|-------|------|-------|-------|
| blur-bg | Background blur | 150px | Glass morphism overlays, frosted panels |
| shadow-none | — | — | Garden uses blur-based depth, not drop shadows |

**Rules:**
- Garden's visual language relies on background blur and overlay opacity for depth — not box shadows.
- If a drop shadow is found, flag it as a potential deviation from the design system unless it's on a notification toast or modal.

---

## Layout & Breakpoints

| Token | Width (px) | Usage |
|-------|-----------|-------|
| breakpoint-desktop | 1440 | Desktop layout, max content width |
| breakpoint-mobile | 360 | Mobile layout |
| modal-width | 600 | Popup modals (e.g., connect wallet) |
| modal-height | 336 | Popup modal height |

---

## Icon Specifications

| Property | Value |
|----------|-------|
| Standard size | 20 x 20 px |
| Grid | Must sit on 20px grid |

### Recognized Icon Names

Directional: up, down, left, right, north_west, north_east, south_west, south_east, keyboard_arrow_up/down/left/right

Actions: add, remove, close, check, open_in_full, logout, edit, copy, menu, search, settings, link, lock, info, page info, notification, error, star, star filled, timer, clock, referral person, exchange, globe

Brand/Crypto: wallet, garden logo, gmx logo, radient, BTC, WBTC, Ethereum, Arbitrum, Polygon, Solana, Base, Hyperliquid, Starknet, Berachain, cbBTC, citrea, Unichain, USDC, tether

UI: circle empty, circle checked

---

## Component Specifications

### Buttons

All buttons use Haffer Medium, white text, center-aligned, rounded-12.

| Size | Height | Padding (h / v) | Font Size | Line Height | Min Width |
|------|--------|-----------------|-----------|-------------|-----------|
| Large | 48px | 24px / 12px | 16px (h3) | 20px | 120px |
| Medium | 40px | 24px / 12px | 14px (h4) | 20px | 120px |
| Small | 36px | 24px / 12px | 12px (h5) | 16px | 120px |

| Type | Background | Text Color |
|------|-----------|------------|
| Primary | #FC79C1 | #FFFFFF |
| Secondary | #473C75 | #FFFFFF |
| Tertiary | #FFC4E4 | #473C75 |
| Disabled | Reduced opacity | Reduced opacity |

### Chips

Pill-shaped elements with rounded-24.

| Size | Height | Padding (l / r / v) | Font Size | Weight |
|------|--------|---------------------|-----------|--------|
| Default | 32px | 12px / 8px / 4px | 16px | Regular (400) |
| Mobile | 32px | 12px / 8px / 4px | 16px | Regular (400) |
| Small | 24px | 8px / 8px / 4px | 12px | Regular (400) |
| Chip Button | 48px | 12px / 12px / 8px | 16px | Medium (570) |

- Background: #FFFFFF (white)
- Text color: #473C75 (iris)
- Icon gap: 8px
- Variants: No icon, Leading icon, Trailing icon, Both icons, Icon only

### Cards / SEED Cards

- Size: 160 x 160px (square)
- Multiple variants: card 01, 03, 04, 06, 08

### Tab Switch

- Available in desktop and mobile sizes
- Active state indicator required

### Input Fields

- Swap component contains: Asset Select, Asset Value, Stake Input
- Variations: Send, Receive, Fees, Refund address
- Each has Input=Yes and Input=No states

---

## Component Hierarchy

Garden's design system follows Atomic Design methodology:

### Atoms (primitives)
- Spacing scale
- Typography scale
- Color tokens
- Icons (20x20 standard)
- Buttons (Large / Medium / Small)
- SEED cards

### Molecules (simple combinations)
- Chip (icon + text pill)

### Organisms (complex components)
- Swap Components (Asset Select, Asset Value, Stake Input)
- Wallet Card (Address, Receive, Bitcoin, EVM compatible, Send)
- Wallet Selection (L1 / L2 networks)
- Connect Wallet (desktop + mobile, multiple connection states)
- Header / Footer (desktop + mobile)
- Notification Card / Toast (desktop + mobile)
- Blog Card (desktop + mobile)
- Paginator
- Search Bar
- Tab Switch (desktop + mobile)

---

## Component Detection Rules

The following UI patterns **must** use library components (not rebuilt custom):

| Pattern | Required Component | Detection Hints |
|---------|--------------------|-----------------|
| Buttons | Button | Height 36/40/48, rounded-12, solid bg from action palette |
| Chips / Tags | Chip | Height 24/32/48, rounded-24, white bg, icon+text |
| Text inputs | Input | Text field with placeholder, border or bg-white |
| Dropdowns | Select / Dropdown | Input with chevron/arrow icon |
| Cards | Card | Container with bg-white, rounded-12/16, padding |
| Avatars | Avatar | Circle image, rounded-full |
| Badges | Badge | Small pill with status color |
| Modals | Dialog / Modal | 600px wide overlay, connect wallet pattern |
| Tooltips | Tooltip | Hover-triggered popover |
| Navigation tabs | Tab Switch | Horizontal tab bar with active indicator |
| Breadcrumbs | Breadcrumb | Slash-separated navigation |
| Alerts / Toasts | Notification Toast | System message with icon + dismiss |
| Search | Search Bar | Input with search icon |
| Pagination | Paginator | Page number navigation |
| Wallet UI | Wallet Card | Address display, network indicator |
| Header | Header | Top navigation bar |
| Footer | Footer | Bottom site links |

**Detection rules (when to flag as detached component):**
1. The node is NOT a component instance (`isComponentInstance` is false)
2. The node name is an exact case-insensitive match to a required component name
3. The node's visual structure resembles the expected component (size, colors, children)
4. The node is at depth 2+ (not a top-level layout frame)

---

## Audit Severity Guidelines

### Error (red) — Must fix
- Off-palette color (not in recognized hex list, beyond Delta-E 5)
- Wrong font family (not Haffer)
- Font size not in allowed scale (10, 12, 14, 16, 20, 32)
- Detached component that should use a library instance
- Button with wrong radius (not 12px)
- Interactive element under 44px touch target

### Warning (yellow) — Should review
- Font weight not 400 or 570 (500 is acceptable as Medium)
- Spacing value not on the 4px scale (but within 2px tolerance)
- Corner radius not matching any token (but within 4px tolerance)
- Color close to palette but slightly off (Delta-E 3-5)
- Typography line-height mismatch (off by more than 2px from spec)

### Info (blue) — Awareness
- Node using opacity overlay patterns
- Large layout containers with custom spacing (expected, not a violation)
- Mixed font weights in a text node (may be intentional rich text)
- Background blur applied (valid pattern, just noting it)

---
