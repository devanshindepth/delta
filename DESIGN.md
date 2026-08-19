---
version: alpha
name: delta-design-system
description: |
  Delta is a monospaced learning environment for developers. The entire interface runs on Geist Mono — every label, heading, body line, and status message is rendered in the same monospaced face. The chrome reads like a well-maintained CLI tool: warm cream canvas (#fdfcfc), near-black ink (#201d1d), 4px-radius rectangles for interactive elements, and bracketed ASCII prefixes ([~], [+], [-], [?], [>], [#], [×]) used as the sole iconography. Dark surfaces appear once per view, reserved for terminal-style proof blocks. Nothing floats, nothing glows, no gradients.

colors:
  primary: "#201d1d"
  on-primary: "#fdfcfc"
  ink: "#201d1d"
  ink-deep: "#0f0000"
  charcoal: "#302c2c"
  body: "#424245"
  mute: "#646262"
  stone: "#6e6e73"
  ash: "#9a9898"
  canvas: "#fdfcfc"
  surface-soft: "#f8f7f7"
  surface-card: "#f1eeee"
  surface-dark: "#201d1d"
  surface-dark-elevated: "#302c2c"
  hairline: "rgba(15,0,0,0.12)"
  hairline-strong: "#646262"
  on-dark: "#fdfcfc"
  on-dark-mute: "#9a9898"
  accent: "#007aff"
  accent-hover: "#0056b3"
  accent-active: "#004085"
  warning: "#ff9f0a"
  warning-hover: "#cc7f08"
  warning-active: "#995f06"
  danger: "#ff3b30"
  danger-hover: "#d70015"
  danger-active: "#a50011"
  success: "#30d158"

typography:
  display-xl:
    fontFamily: Geist Mono
    fontSize: 38px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  heading-md:
    fontFamily: Geist Mono
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: 0
  body-md:
    fontFamily: Geist Mono
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-strong:
    fontFamily: Geist Mono
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0
  body-tight:
    fontFamily: Geist Mono
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  link-md:
    fontFamily: Geist Mono
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button-md:
    fontFamily: Geist Mono
    fontSize: 16px
    fontWeight: 500
    lineHeight: 2
    letterSpacing: 0
  caption-md:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 2
    letterSpacing: 0
  label-sm:
    fontFamily: Geist Mono
    fontSize: 13px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.18em

rounded:
  none: 0px
  sm: 4px
  full: 9999px

spacing:
  xxs: 1px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 4px 20px
    height: 36px
  button-primary-active:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline-strong}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 4px 12px
    height: 32px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
  button-tab:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    typography: "{typography.button-md}"
    rounded: "{rounded.none}"
    borderBottom: "2px solid transparent"
  button-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.none}"
    borderBottom: "2px solid {colors.ash}"
  button-disabled:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ash}"
    rounded: "{rounded.sm}"
  badge-default:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  badge-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  badge-mute:
    backgroundColor: "transparent"
    textColor: "{colors.mute}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  badge-success:
    backgroundColor: "transparent"
    textColor: "{colors.success}"
    border: "1px solid {colors.success}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  badge-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    border: "1px solid {colors.danger}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  badge-warning:
    backgroundColor: "transparent"
    textColor: "{colors.warning}"
    border: "1px solid {colors.warning}"
    typography: "{typography.caption-md}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  text-input:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 8px 12px
    height: 40px
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.ink}"
    rounded: "{rounded.sm}"
  textarea:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
  proof-block:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 16px
  section-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: 12px 0px
  sidebar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    width: 220px
    borderRight: "1px solid {colors.hairline}"
  sidebar-wordmark:
    height: 72px
    borderBottom: "1px solid {colors.hairline}"
    padding: 0 16px
  sidebar-link-active:
    textColor: "{colors.ink}"
    fontWeight: 500
  sidebar-link-default:
    textColor: "{colors.mute}"
    fontWeight: 400
  sidebar-prefix:
    textColor: "{colors.ash}"
    fontWeight: 400
---

## Overview

Delta is a monospaced learning environment for developers — a focused tool for breaking down technical concepts from first principles, then proving understanding through real code. The UI carries the same discipline: every character is rendered in Geist Mono, the cream canvas reads like a printed code listing, and the interactive chrome is minimal enough that the content is always what you're looking at.

The brand identity is low-decoration by design. The wordmark is `DELTA` — all caps, wide letter-spacing (`0.18em`), 13px, 700 weight, centered below a small delta-symbol icon. ASCII bracket prefixes (`[~]`, `[+]`, `[-]`, `[?]`, `[>]`, `[#]`, `[×]`) take the place of icons throughout the app. A single dark surface (`{colors.surface-dark}`) appears in views where terminal-style output needs to stand apart from the reading surface — notably the "proof method" block in the understand view.

No shadows. No gradients. No illustration. Everything is flat on cream.

**Key Characteristics:**
- 100% Geist Mono (with IBM Plex Mono → ui-monospace fallback chain) across every text role
- Warm cream `{colors.canvas}` (`#fdfcfc`) as the body background — no section banding
- Dark surface (`{colors.surface-dark}`) reserved for terminal-output proof blocks and code sandboxes
- `4px` radius on every interactive element; all containers are sharp rectangles with `1px {colors.hairline}` borders
- ASCII bracket prefixes (`[~]` learn, `[?]` understand, `[>]` practice, `[#]` history, `[-]` settings, `[+]` item, `[×]` dismiss) as the app's sole iconography
- `DELTA` wordmark: 13px / 700 / letter-spacing 0.18em / all caps, paired with the delta SVG icon above it
- `96px` top padding on every page view; `32px` below section headers; `48px` before content begins

## Product Context

Delta has four primary sections, each with a dedicated sidebar prefix:

| Prefix | Section | Purpose |
|---|---|---|
| `[~]` | learn | Home — query input + recent sessions |
| `[?]` | understand | First-principles breakdown of a concept + concept diagram |
| `[>]` | practice | Code sandbox challenges generated from learning sessions |
| `[#]` | history | Past sessions and completed challenges |
| `[-]` | settings | User preferences |

The learning loop is: **learn → understand → practice**. The understand view breaks a topic down into structured sections (what it is, prerequisites, why it matters, gaps, next steps, how to prove it) before routing to a code challenge.

## Colors

### Brand & Ink
- **Ink** (`{colors.ink}` — `#201d1d`): headlines, body text, primary CTA fill, sidebar active links, focused input border. Warm near-black rather than pure black — readable on cream without harshness.
- **Ink Deep** (`{colors.ink-deep}` — `#0f0000`): pressed state for the primary CTA. Carries the same warm undertone as the canvas.
- **Canvas** (`{colors.canvas}` — `#fdfcfc`): the only body background. Also used as on-primary text color (white-on-dark buttons and badges).

### Surface
- **Canvas** (`{colors.canvas}` — `#fdfcfc`): every page body, card background, sidebar.
- **Soft Surface** (`{colors.surface-soft}` — `#f8f7f7`): default text-input and textarea background.
- **Surface Card** (`{colors.surface-card}` — `#f1eeee`): suggestion chips, skeleton loaders, disabled button fill, slightly-elevated row tint.
- **Surface Dark** (`{colors.surface-dark}` — `#201d1d`): terminal proof blocks (`$ command`), code sandbox chrome, the Monaco editor override. Same value as `{colors.ink}` — one near-black for both text and dark containers.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` — `#302c2c`): prompt-row insets inside dark surfaces.
- **Hairline** (`{colors.hairline}` — `rgba(15,0,0,0.12)`): every 1px border on sections, inputs, cards. The warm translucent tint harmonizes with the cream canvas.
- **Hairline Strong** (`{colors.hairline-strong}` — `#646262`): secondary button border, left-border on blockquotes, dot-separator in metadata rows.

### Text
- **Ink** (`{colors.ink}` — `#201d1d`): page headings, section labels, active nav links, form labels.
- **Charcoal** (`{colors.charcoal}` — `#302c2c`): subtly softer than full ink; used in tight inline labels.
- **Body** (`{colors.body}` — `#424245`): default paragraph and list-row text inside understand and history views.
- **Mute** (`{colors.mute}` — `#646262`): section prefix labels (`[~] learn`), sidebar default links, secondary metadata, placeholder-level annotation.
- **Stone** (`{colors.stone}` — `#6e6e73`): challenge description excerpts, session timestamps, least-emphasis row captions.
- **Ash** (`{colors.ash}` — `#9a9898`): sidebar prefix characters (`[~]`, `[>]` etc.), terminal prompt color (`$ `), dismiss actions (`[×]`).

### Semantic
Used for status indicators in challenges and session results. On learning-content pages these colors appear in outlined badges only — never as fill backgrounds in the main chrome.

- **Accent** (`{colors.accent}` — `#007aff`): informational links, future TUI highlights.
- **Success** (`{colors.success}` — `#30d158`): challenge passed badge, correct verification indicator.
- **Danger** (`{colors.danger}` — `#ff3b30`): error state border and text, destructive confirmation.
- **Warning** (`{colors.warning}` — `#ff9f0a`): caution callout, non-blocking notice.

## Typography

### Font Family
**Geist Mono** is loaded via `next/font/google` at weights 400, 500, and 700. The CSS fallback chain is: `IBM Plex Mono → ui-monospace → SFMono-Regular → Menlo → Monaco → Consolas → Liberation Mono → Courier New → monospace`. Every element inherits from the `*` rule in `globals.css` — `font-family: var(--font-mono), monospace`.

The single-font decision defines the product feel. Delta is a tool for developers who spend their day in terminals and editors. Rendering the entire UI in monospace means the interface and the content it teaches live in the same visual register.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 38px | 700 | 1.5 | 0 | Page title (`What do you want to learn?`, topic name in understand view) |
| `{typography.heading-md}` | 16px | 700 | 1.5 | 0 | Section labels in bold (`[+] what it is`, `[>] next steps`) |
| `{typography.body-md}` | 16px | 400 | 1.5 | 0 | Body copy, understand sections, session descriptions, challenge descriptions |
| `{typography.body-strong}` | 16px | 500 | 1.5 | 0 | Sidebar nav active label, inline emphasis, challenge title in list rows |
| `{typography.body-tight}` | 16px | 500 | 1 | 0 | Compact single-line label |
| `{typography.link-md}` | 16px | 400 | 1.5 | 0 | Inline anchor, `open →` row action, `← back` nav |
| `{typography.button-md}` | 16px | 500 | 2 | 0 | Every button label |
| `{typography.caption-md}` | 14px | 400 | 2 | 0 | Section prefix labels, session timestamps, badge text, metadata row captions |
| `{typography.label-sm}` | 13px | 700 | 1 | 0.18em | Sidebar wordmark (`DELTA`), all-caps compact label |

### Principles
The hierarchy is weight and size on a single face. Display (38px / 700) and section headings (16px / 700) share weight — size is the only differentiator. Body and link are identical in rendering; only context distinguishes them. Buttons get `lineHeight: 2` so labels feel unhurried inside their 36px pill. The sidebar wordmark uses the widest letter-spacing in the system (`0.18em`) as a deliberate contrast to dense body text.

Casing is lowercase by default. UI labels read in lowercase: `learn`, `understand`, `practice`, `open →`, `start learning →`. The one exception is the `DELTA` wordmark and any all-caps display treatment. This lowercase convention reinforces the terminal-native feel.

## Layout

### Spacing System
- **Base unit:** 8px. Finer steps (1, 2, 4px) available for hairline gaps.
- **Tokens:** `{spacing.xxs}` (1px) · `{spacing.xs}` (4px) · `{spacing.sm}` (8px) · `{spacing.md}` (12px) · `{spacing.lg}` (16px) · `{spacing.xl}` (24px) · `{spacing.xxl}` (32px) · `{spacing.section}` (96px).
- **Page top padding:** every view uses `py-[96px]` — the same as `{spacing.section}` — to open breathing room from the sidebar chrome.
- **Section header rhythm:** section prefix label has `mb-3` (12px), the h1 runs immediately after, description copy uses `mt-3` (12px), then `pb-32px` before the `1px hairline` separator and `mb-48px` before content.

### Shell & Sidebar
- **Sidebar:** 220px fixed, `height: 100vh`, `position: sticky top-0`, hidden below `lg` breakpoint.
- **Sidebar structure:** wordmark block (72px tall, hairline bottom border) → nav links (flex-1, `px-4 py-6`) → settings links (hairline top border, `pb-6`).
- **Content area:** `flex: 1`, `max-w-[720px] mx-auto px-8` on every page view. The 720px cap keeps reading lines comfortable on wide displays.
- **Workspace (practice `[id]`):** the sidebar is hidden entirely; the code editor is full-screen with its own chrome.

### Grid
- Single-column reading layout at all main views.
- 720px content column centered within the flex-1 main area.
- Section rows within a view are full-width within that column, separated by `1px {colors.hairline}` bottom borders, `py-[12px]` vertical rhythm.

### Whitespace Philosophy
Delta reads like a code listing. Sections sit 48px below their hairline separator with no decorative dividers. List rows use `py-[12px]` vertical padding — tight enough to feel dense, generous enough to be scannable. Blank states are centered and text-only with no illustration. Loading skeletons are plain `animate-pulse` rectangles in `{colors.surface-card}`.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | No border, no shadow | Body sections, nav links, skeleton loaders |
| 1 — Hairline | `1px solid {colors.hairline}` | Input borders, card borders, row separators, sidebar column rule |
| 2 — Hairline Strong | `1px solid {colors.hairline-strong}` | Secondary button border, blockquote left-border, metadata dot separator |
| 3 — Dark Surface | `{colors.surface-dark}` fill | Terminal proof block (`$ command`), Monaco editor background, code sandbox chrome |

No drop shadows anywhere in the system. Depth comes from color inversion (dark surface) and border weight, not from shadow or blur.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | All containers — sidebar, cards, section blocks, proof blocks, editor |
| `{rounded.sm}` | 4px | Every interactive element — buttons, inputs, textareas, badges, suggestion chips, skeleton tiles |
| `{rounded.full}` | 9999px | Not currently in use; reserved for avatar circles if needed |

The vocabulary is two values: 4px for clickable / focusable elements, 0px for everything else. Consistency is strict — no 6px, no 8px, no 12px radius anywhere.

## Components

> Default and Active/Pressed states documented. Hover is `hover:` transition only — no documented hover-only component spec.

### Buttons

**`button-primary`** — the primary CTA
- Background `{colors.primary}`, text `{colors.on-primary}`, `{typography.button-md}`, padding `4px 20px`, height ~36px, `{rounded.sm}`.
- Used for: `explain from first principles →`, `start practice challenge →`, `start learning →`.
- Disabled: `opacity-40 pointer-events-none`.
- Active / hover: background → `{colors.ink-deep}`.

**`button-secondary`** — lower-emphasis action
- Background `{colors.canvas}`, text `{colors.ink}`, `1px solid {colors.hairline-strong}` border, `{typography.button-md}`, padding `4px 12px`, height ~32px, `{rounded.sm}`.
- Used for: `open →` row action on challenge lists, secondary navigation actions.
- Hover: border → `1px solid {colors.ink}`.

**`button-ghost`** — minimal inline action
- Transparent background, text `{colors.mute}`, `{typography.button-md}`, `{rounded.sm}`.
- Used for: dismiss actions, inline text links styled as buttons.
- Hover: text → `{colors.ink}`.

**`button-tab` / `button-tab-active`** — view-level tab strip
- Default: transparent, text `{colors.mute}`, `border-b-2 border-transparent`.
- Active: text `{colors.ink}`, `border-b-2 border-[{colors.ash}]`.

### Badges

**`badge-default`** — surface chip with hairline border
- `{colors.surface-card}` fill, `{colors.ink}` text, `1px {colors.hairline}` border, `{typography.caption-md}`, `{rounded.sm}`, `px-2 py-0.5`.
- Used for: topic suggestion chips on the learn home.

**`badge-mute`** — outlined, low-emphasis label
- Transparent fill, `{colors.mute}` text, `1px {colors.hairline}` border.
- Used for: difficulty levels (`beginner`, `intermediate`, `advanced`) on challenge rows.

**`badge-dark`** — inverted chip
- `{colors.surface-dark}` fill, `{colors.on-dark}` text.
- Used for: status tags that need maximum contrast.

**`badge-success` / `badge-danger` / `badge-warning`** — semantic outlined chips
- Transparent fill, semantic border + text color.
- Used for: challenge pass/fail status, error callout tags.

### Inputs & Forms

**`text-input`** + **`text-input-focused`**
- Default: `{colors.surface-soft}` background, `{colors.ink}` text, `1px {colors.hairline}`, `{typography.body-md}`, padding `8px 12px`, height ~40px, `{rounded.sm}`.
- Focused: background flips to `{colors.canvas}`, border becomes `1px solid {colors.ink}`. No glow, no halo.

**`textarea`**
- Same treatment as `text-input` but multi-row with `padding: 12px`. The `rows` attribute drives height — no fixed height set. `resize-none`.
- Used for: topic query input on the learn home page.

### Cards & Containers

**`proof-block`** — terminal-style output
- `{colors.surface-dark}` fill, `{colors.on-dark}` text, `{typography.body-md}`, `padding: 16px`, `{rounded.none}`.
- Prefixed with `$ ` in `{colors.ash}`. Renders the "how to prove it" section in the understand view.
- This is the system's only dark-surface component in the reading UI. One per view maximum.

**`section-row`** — content row with hairline separator
- `{colors.canvas}` background, `{colors.body}` text, `{typography.body-md}`, `padding: 12px 0`, `1px {colors.hairline}` bottom border.
- Used in understand sections, challenge list rows, session history rows.
- Row metadata (language, duration, difficulty) sits 8px below the title in `{typography.caption-md}` `{colors.stone}`, dot-separated using `{colors.hairline-strong}`.

**`skeleton`** — loading placeholder
- `{colors.surface-card}` fill, `animate-pulse`, no border. `h-16` or `h-20` depending on row type.
- Always shown as 2–3 stacked rectangles, never spinner-based.

### Sidebar

**Structure**
```
┌─────────────────────────────────────┐  ← 220px wide
│  [delta icon]  ← 24×24px SVG        │  ← 72px tall, hairline bottom
│  DELTA         ← 13px 700 0.18em    │
├─────────────────────────────────────┤
│  [~]  learn                          │  ← active: ink 500
│  [?]  understand                     │  ← default: mute 400, prefix ash
│  [>]  practice                       │
│  [#]  history                        │
│                      flex-1          │
├─────────────────────────────────────┤  ← hairline top
│  [-]  settings                       │  ← pb-6
└─────────────────────────────────────┘
```

**Link states**
- Default: text `{colors.mute}`, weight 400. Prefix character in `{colors.ash}`, weight 400.
- Active: text `{colors.ink}`, weight 500. Prefix stays `{colors.ash}`.
- No background fill on active — the weight shift is the only visual signal.

### Page Header

Every view uses the same header pattern:
```
[prefix] section-name        ← caption-md, {colors.mute}, mb-3
Page Title Here               ← display-xl, {colors.ink}
Description sentence here.    ← body-md, {colors.body}, mt-3
────────────────────────────  ← 1px hairline bottom border, pb-32px, mb-48px
```

The prefix label (`[~] learn`, `[?] understand`, etc.) is always lowercase caption text — it anchors where you are in the app before the large headline.

### Section Labels (within a view)

Used inside the understand view to label each content block:
```
[+] what it is         ← heading-md (bold), {colors.ink}, mb-3
[>] next steps         ← same
[-] gaps to fill       ← same
```

The bracket prefix is part of the text string, not a separate icon element.

## ASCII Prefix System

The bracket prefix vocabulary is semantic, not decorative:

| Prefix | Meaning | Where Used |
|---|---|---|
| `[~]` | home / current state | Sidebar learn link, concept diagram section label |
| `[+]` | additive / present / available | Feature items, prerequisites, "what it is" |
| `[-]` | subtractive / absent / settings | Gaps, empty states, settings nav |
| `[?]` | inquiry / understanding | Sidebar understand link |
| `[>]` | action / forward / execution | Practice, next steps, "how to prove it" |
| `[#]` | record / history / count | History nav, recent sessions list |
| `[×]` | dismiss / delete | Session delete button, error close |

All prefixes render in `{colors.ash}` when used as sidebar nav prefixes. Inside content sections, the prefix is embedded in the label string and inherits the label's color.

## Voice & Copy Conventions

Delta's copy is direct and developer-appropriate — no marketing language, no cheerfulness, no hedging.

- **Lowercase everywhere:** UI labels, button text, section prefixes, empty states. (`no challenges yet`, `start learning →`, `preparing...`).
- **Arrow suffix on forward actions:** `explain from first principles →`, `start practice challenge →`, `open →`, `start learning →`. The `→` is a literal character, never an SVG icon.
- **Ellipsis on loading states:** `preparing...`, `building challenge...`. Conveys work in progress without a spinner.
- **`[-]` prefix on empty states:** `[-] no challenges yet`, `[-] no sessions yet. ask your first question above.` — flat, factual, lowercase.
- **"from first principles"** is a brand phrase used on the primary learn CTA and in the product description. Retain it.
- **Product tagline:** `Learn what you need. Prove it. Move forward.` — used in page metadata only, not in UI chrome.

## Do's and Don'ts

### Do
- Render every text role in Geist Mono. The single-font decision defines the product feel.
- Keep `{colors.canvas}` (`#fdfcfc`) as the only body background. No gray section bands, no alternating row tints.
- Use ASCII bracket prefixes as the sole iconography — no SVG icons in nav, section headers, or list items.
- Reserve `{colors.surface-dark}` for terminal / code-output surfaces. One per view.
- Apply `{rounded.sm}` (4px) to every interactive element. Apply `{rounded.none}` to every container.
- Write all UI copy in lowercase. Use `→` as the forward-action suffix.
- Use `animate-pulse` skeleton loaders in `{colors.surface-card}`, not spinners.
- Keep button and input touch targets at or above 36px height.

### Don't
- Don't introduce a sans-serif, display, or italic face. Geist Mono carries everything.
- Don't add drop shadows, gradients, blurs, or glow effects. The system is flat-on-cream.
- Don't replace ASCII bracket prefixes with SVG or emoji icons.
- Don't use `{colors.accent}` (Apple Blue) or other semantic colors on interactive chrome. They are reserved for status badges only.
- Don't increase border radius beyond 4px on any element. No 6px, 8px, or 12px variants.
- Don't introduce new spacing values outside the defined token set.
- Don't use sentence case or title case for UI labels — lowercase is the standard.
- Don't use more than one dark surface block per view.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| desktop | 1024px+ | Sidebar visible (`lg:flex`), 720px content column |
| tablet | 768–1023px | Sidebar hidden; content full-width with `px-8` padding |
| mobile | < 768px | Single-column; `px-8` padding maintained; display headline scales down from 38px |

### Sidebar Collapse
The sidebar is hidden below `lg` (1024px) with `hidden lg:flex`. No hamburger drawer is currently implemented — the content area fills full width on smaller screens. Mobile navigation is a future consideration.

### Content Column
The `max-w-[720px] mx-auto` constraint on the content area keeps lines readable at all desktop widths. On tablet/mobile, the full viewport width is used with `px-8` horizontal padding.

### Touch Targets
- `button-primary`: ~36px height — meets WCAG AA.
- `button-secondary`: ~32px height — acceptable for secondary actions.
- `text-input`: 40px — standard touch target.
- Sidebar nav links: `py-[8px]` with `text-[16px]` gives ~40px effective height.
- Suggestion chips: `py-1` with `text-[14px] leading-[2]` gives ~28px — acceptable for supplementary tap targets.
