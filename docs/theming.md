# Maths Editor — Theming Reference

The editor and its symbol palette are styled entirely through CSS custom
properties (tokens). Changing a token changes the visual appearance without
touching the component's own CSS files.

---

## Token reference

All tokens with their component scope, purpose, and default values.

### Host editor tokens

Defined on `maths-editor { }` in `maths-editor.css`.

| Token | Purpose | Light default | Dark default |
|---|---|---|---|
| `--me-font-family` | Font stack | `system-ui, sans-serif` | _(unchanged)_ |
| `--me-font-size` | Base text size | `1rem` | _(unchanged)_ |
| `--me-font-size-small` | Small text (e.g. palette labels) | `0.875rem` | _(unchanged)_ |
| `--me-line-height` | Line height | `1.6` | _(unchanged)_ |
| `--me-text-colour` | Editor text colour | `#1a1a1a` | `#e6e6e6` |
| `--me-background` | Editor background | `#ffffff` | `#1c1f26` |
| `--me-selection-background` | Selected-text highlight | `#b3d4fc` | `#2c5282` |
| `--me-caret-colour` | Text cursor colour | `#1a1a1a` | `#e6e6e6` |
| `--me-placeholder-colour` | Placeholder text colour | `#888888` | `#6a737d` |
| `--me-border` | Editor border | `1px solid #e0e0e0` | `1px solid #2d333b` |
| `--me-border-radius` | Corner radius (editor + islands) | `6px` | _(unchanged)_ |
| `--me-focus-ring` | Focus box-shadow | `0 0 0 3px rgba(74,144,226,0.4)` | `0 0 0 3px rgba(88,166,255,0.4)` |
| `--me-padding` | Inner padding | `0.5rem 0.75rem` | _(unchanged)_ |
| `--me-min-height` | Minimum editor height | `3rem` | _(unchanged)_ |
| `--me-transition-duration` | Focus ring fade duration | `120ms` | _(unchanged)_ |

### Math island tokens

Defined on `maths-editor { }` in `maths-editor.css`. Applied to `.me-math-island`.

| Token | Purpose | Light default | Dark default |
|---|---|---|---|
| `--me-math-island-background` | Island background | `#f5f7fa` | `#22272e` |
| `--me-math-island-border` | Island border | `1px solid #d0d7de` | `1px solid #373e47` |
| `--me-math-island-padding` | Island inner padding | `0.1em 0.3em` | _(unchanged)_ |
| `--me-math-island-focus-ring` | Island focus box-shadow | `0 0 0 2px rgba(74,144,226,0.4)` | _(unchanged)_ |

### Palette tokens

Defined on `.me-palette { }` in `palette/palette.css`.

> **Note:** The palette is appended to `document.body`, not inside the
> `<maths-editor>` element. Tokens set on `maths-editor` do not cascade to
> the palette. The palette defines its own token defaults independently. The
> shared token names (e.g. `--me-border-radius`, `--me-font-size-small`) use
> the same name as the host tokens as a naming convention — the values are
> declared separately.

| Token | Purpose | Light default | Dark default |
|---|---|---|---|
| `--me-palette-background` | Palette background | `#ffffff` | `#22272e` |
| `--me-palette-border` | Palette border and separators | `1px solid #e0e0e0` | `1px solid #373e47` |
| `--me-palette-shadow` | Drop shadow | `0 4px 16px rgba(0,0,0,0.12)` | `0 4px 16px rgba(0,0,0,0.4)` |
| `--me-palette-text-colour` | Default text colour | `#1a1a1a` | `#e6e6e6` |
| `--me-palette-width` | Palette width | `320px` | _(unchanged)_ |
| `--me-palette-max-height` | Results list max height | `360px` | _(unchanged)_ |
| `--me-palette-highlight-background` | Selected-item background | `#e8f0fe` | `#2d3340` |
| `--me-palette-highlight-text-colour` | Selected-item text colour | `#1a1a1a` | `#e6e6e6` |
| `--me-palette-group-text-colour` | Category header colour | `#6a737d` | `#8b949e` |
| `--me-palette-group-padding` | Category header padding | `0.3rem 0.75rem 0.15rem` | _(unchanged)_ |
| `--me-palette-search-background` | Search input background | `#ffffff` | `#1c1f26` |
| `--me-palette-search-border` | Search input border | `1px solid #e0e0e0` | `1px solid #373e47` |
| `--me-palette-search-text-colour` | Search input text | `#1a1a1a` | `#e6e6e6` |
| `--me-palette-search-placeholder-colour` | Search placeholder | `#888888` | `#6a737d` |
| `--me-palette-item-padding` | Item row padding | `0.3rem 0.75rem` | _(unchanged)_ |
| `--me-palette-item-hover-background` | Hovered item background | `#f0f0f0` | `#2d333b` |
| `--me-palette-preview-background` | Symbol thumbnail background | `#f3f4f6` | `#2d333b` |
| `--me-palette-preview-colour` | Symbol thumbnail colour | `#1a1a1a` | `#e6e6e6` |
| `--me-border-radius` | Corner radius | `6px` | _(unchanged)_ |
| `--me-font-size-small` | Font size (mirrors editor token) | `0.875rem` | _(unchanged)_ |
| `--me-transition-duration` | Motion duration (mirrors editor token) | `120ms` | _(unchanged)_ |

---

## Three ways to apply a theme

### 1. No theme file — light defaults

The light theme is built into `maths-editor.css` and `palette/palette.css`.
No additional file is needed:

```html
<link rel="stylesheet" href="maths-editor.css">
<link rel="stylesheet" href="palette/palette.css">
```

### 2. Opt-in dark theme (`themes/dark.css`)

Load the dark stylesheet and add `data-theme="dark"` to the target element:

```html
<link rel="stylesheet" href="maths-editor.css">
<link rel="stylesheet" href="palette/palette.css">
<link rel="stylesheet" href="themes/dark.css">
```

**Page-wide dark mode** — add the attribute to `<html>`:

```html
<html data-theme="dark">
```

**Per-instance dark mode** — add the attribute to a single editor:

```html
<maths-editor data-theme="dark"></maths-editor>
```

### 3. System-driven auto theme (`themes/auto.css`)

Load the auto stylesheet and the editor follows the OS light/dark preference
with no attributes required:

```html
<link rel="stylesheet" href="maths-editor.css">
<link rel="stylesheet" href="palette/palette.css">
<link rel="stylesheet" href="themes/auto.css">
```

The editor updates automatically when the user changes their OS theme setting.

> **Trade-off:** Do not load both `dark.css` and `auto.css` at the same time.
> The `[data-theme="dark"]` selectors in `dark.css` have higher specificity
> than the `@media` block in `auto.css`, so `dark.css` always wins regardless
> of the OS setting. Use one or the other.

---

## Per-instance theming

Two editors on the same page can run different themes:

```html
<link rel="stylesheet" href="themes/dark.css">

<maths-editor id="editor-light"></maths-editor>
<maths-editor id="editor-dark" data-theme="dark"></maths-editor>
```

The symbol palette is a singleton appended to `document.body`. When it opens,
it automatically walks up the DOM from the focused math island to find the
nearest `data-theme` attribute and copies it onto the palette element. This
means the palette always matches its host editor, even when two editors with
different themes are on the same page.

No JavaScript is needed to enable this behaviour — it is built into
`palette/palette.js`.

---

## Build your own theme

Create a CSS file that sets tokens under a custom `data-theme` attribute.
Load it alongside the base files:

```html
<link rel="stylesheet" href="maths-editor.css">
<link rel="stylesheet" href="palette/palette.css">
<link rel="stylesheet" href="themes/my-brand.css">
```

**`themes/my-brand.css`** — example brand theme:

```css
/* Brand theme for Example Corp
   Colour palette: deep navy, warm white, gold accent */

[data-theme="my-brand"] maths-editor,
maths-editor[data-theme="my-brand"] {
  --me-font-family:          Georgia, serif;
  --me-text-colour:          #1a1830;
  --me-background:           #fdfbf7;
  --me-selection-background: #f5e6a3;
  --me-caret-colour:         #1a1830;
  --me-placeholder-colour:   #9e9b8e;
  --me-border:               1px solid #d4c9a8;
  --me-border-radius:        3px;
  --me-focus-ring:           0 0 0 3px rgba(180, 140, 40, 0.35);
  --me-math-island-background: #f5f0e8;
  --me-math-island-border:     1px solid #d4c9a8;
}

.me-palette[data-theme="my-brand"] {
  --me-palette-background:         #fdfbf7;
  --me-palette-border:             1px solid #d4c9a8;
  --me-palette-text-colour:        #1a1830;
  --me-palette-highlight-background:  #f5e6a3;
  --me-palette-highlight-text-colour: #1a1830;
  --me-palette-group-text-colour:  #9e9b8e;
  --me-palette-search-background:  #fdfbf7;
  --me-palette-search-border:      1px solid #d4c9a8;
  --me-palette-search-text-colour: #1a1830;
  --me-palette-search-placeholder-colour: #9e9b8e;
  --me-palette-item-hover-background: #f0ebe0;
  --me-palette-preview-background: #f0ebe0;
  --me-palette-preview-colour:     #1a1830;
  --me-border-radius:              3px;
}
```

Apply the theme:

```html
<maths-editor data-theme="my-brand"></maths-editor>
```

---

## MathLive variable cross-reference

MathLive exposes its own CSS custom properties for the internals of the
`<math-field>` element (caret, selection, virtual keyboard). These are
**independent** of the `--me-*` token system — they live in MathLive's own
shadow DOM and are not wrapped or duplicated under `--me-*` names.

Set these directly alongside your `--me-*` tokens for full visual coherence:

| MathLive variable | What it controls | Dark theme value |
|---|---|---|
| `--contains-highlight-background-color` | Selection background inside the math field | `#2c5282` |
| `--primary-color` | MathLive accent colour (cursor, selection ring) | `#58a6ff` |

The `--contains-highlight-background-color` variable is already wired inside
`.me-math-island { }` in `maths-editor.css` — it reads `var(--me-selection-background)`,
so overriding `--me-selection-background` in a custom theme also updates the
math-field selection highlight automatically.

For `--primary-color` and other MathLive internals, set them on the
`maths-editor` or `.me-math-island` selector in your theme file:

```css
[data-theme="my-brand"] maths-editor,
maths-editor[data-theme="my-brand"] {
  --me-focus-ring: 0 0 0 3px rgba(180, 140, 40, 0.35);
  --primary-color: #b48c28;   /* MathLive accent — cursor and selection ring */
}
```

A full list of MathLive's CSS variables is available in the
[MathLive documentation](https://cortexjs.io/mathlive/guides/style/).

---

## WCAG AA contrast

Any custom theme should meet WCAG 2.1 AA contrast ratios for normal text:
**4.5:1** minimum between text and its immediate background.

Key pairs to check:

- `--me-text-colour` on `--me-background` (editor body text)
- `--me-palette-text-colour` on `--me-palette-background` (palette item names)
- `--me-palette-highlight-text-colour` on `--me-palette-highlight-background` (selected item)
- `--me-palette-group-text-colour` on `--me-palette-background` (category headers)
- `--me-palette-search-text-colour` on `--me-palette-search-background` (search input)

Use a contrast checker such as the
[WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) or
your browser's developer tools accessibility panel.

Both the built-in light and dark themes exceed the 4.5:1 requirement for
all body-text pairs listed above.
