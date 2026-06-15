---
name: Foundry
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#4a4455'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#7b7487'
  outline-variant: '#ccc3d8'
  surface-tint: '#732ee4'
  primary: '#630ed4'
  on-primary: '#ffffff'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#d2bbff'
  secondary: '#516072'
  on-secondary: '#ffffff'
  secondary-container: '#d2e1f7'
  on-secondary-container: '#556477'
  tertiary: '#7d3d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#a15100'
  on-tertiary-container: '#ffe0cd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#d4e4fa'
  secondary-fixed-dim: '#b9c8de'
  on-secondary-fixed: '#0d1c2d'
  on-secondary-fixed-variant: '#39485a'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb784'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#713700'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.04em
  code:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is built on the principles of clarity, modularity, and cognitive ease. It targets knowledge workers and developers who require a structured environment to architect learning paths. The aesthetic is **Modern Minimalist**, heavily influenced by the "tool-for-thought" movement. 

The UI prioritizes content over chrome. It uses a vast amount of whitespace and a subtle background texture to provide a sense of infinite canvas. The emotional response is one of organized calm—reducing the friction of complex information architecture through a clean, systematic interface that feels both powerful and approachable.

## Colors

The palette is anchored by a high-chroma primary purple, used sparingly for calls to action, active states, and progress indicators. 

- **Primary (#7C3AED):** The "Foundry Purple." Used for core interaction points and the primary path of travel.
- **Surface & Background:** The main workspace is pure `#FFFFFF`. A secondary surface color `#F8FAFC` is used for sidebars and secondary navigation to provide subtle contrast.
- **Grays/Locked States:** We use a scale of cool grays. `#94A3B8` represents "locked" or "inactive" content, providing enough legibility to be seen but enough desaturation to indicate it is not yet accessible.
- **Success/Warning/Error:** Use standard semantic colors but desaturated to match the professional tone.

## Typography

The typography system utilizes **Inter** for all primary UI and prose elements due to its exceptional legibility and neutral, professional character. For labels, badges, and technical metadata, we introduce **Geist** to provide a subtle "developer-focused" feel without sacrificing friendliness.

- **Headlines:** Feature tight tracking and high weights to anchor sections.
- **Body:** Standardized on a 16px base for optimal long-form reading of learning materials.
- **Labels:** Used for status badges and small caps. These are slightly tracked out for clarity at small sizes.

## Layout & Spacing

This design system employs a **Fluid Grid** with fixed-width constraints for the central content container (max-width: 1200px) to ensure readability. 

- **The Grid:** A subtle 24px x 24px dotted grid pattern is applied to the main background of the "Path Builder" canvas.
- **Rhythm:** An 8px linear scale is used for all layout spacing. 
- **Connectors:** Learning modules are connected by 2px dashed lines (`#CBD5E1`) to represent the flow of the curriculum.
- **Mobile:** Margins shrink to 16px, and multi-column card layouts collapse into a single vertical stack.

## Elevation & Depth

Depth is used sparingly to signify interactivity and hierarchy. We avoid heavy shadows in favor of "Ambient Depth."

- **Level 0 (Canvas):** Pure white with the dotted grid.
- **Level 1 (Cards):** White fill with a 1px border (`#E2E8F0`) and a soft, diffused shadow (0 4px 6px -1px rgba(0,0,0,0.05)).
- **Level 2 (Active/Hover):** When a card is hovered or selected, the shadow deepens and the border color shifts to the Primary Purple.
- **Locked State:** Cards in a locked state have no shadow and use a semi-transparent opacity (0.6) to appear recessed into the canvas.

## Shapes

The shape language is "Soft Geometric." We use a 0.5rem (8px) base radius for all standard cards and input fields to maintain a modern, friendly appearance. 

- **Components:** Buttons and input fields use the base 8px radius.
- **Badges:** Use a fully rounded (pill-shaped) radius for status indicators to distinguish them from actionable elements.
- **Path Connectors:** Connector lines use 16px radius curves for 90-degree turns to avoid "sharp" industrial corners.

## Components

### Buttons
- **Primary:** Solid purple background, white text. No gradient.
- **Secondary:** White background, 1px gray border, purple text on hover.
- **Ghost:** No background, gray text, light gray background on hover.

### Cards
- Standard containers for learning modules.
- Include a 1px border and the "Level 1" shadow.
- Header area for the module title and an icon slot.

### Status Badges
- **Completed:** Emerald green background (low opacity), dark green text.
- **In Progress:** Primary purple background (low opacity), dark purple text.
- **Locked:** Light gray background, medium gray text. Accompanied by a small padlock icon.

### Input Fields
- Subtle 1px border. On focus, the border transitions to Primary Purple with a 2px outer glow (ring) of the same color at 20% opacity.

### Path Connectors
- Vertical or horizontal dashed lines that connect cards. 
- Use an SVG-based drawing system to ensure lines always meet the center-edge of cards.