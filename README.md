# Maths Editor — Phase 1 Smoke Test

A minimal offline maths input page using [MathLive](https://cortexjs.io/mathlive/), vendored as pre-built files. No build step, no bundler, no CDN — open `index.html` directly in a browser.

---

## Vendored dependencies

| File | Source package | Version | Date vendored |
|---|---|---|---|
| `vendor/mathlive.min.js` | `mathlive` | 0.109.2 | 2026-05-17 |
| `vendor/mathlive-static.css` | `mathlive` | 0.109.2 | 2026-05-17 |
| `vendor/fonts/` (20 files) | `mathlive` | 0.109.2 | 2026-05-17 |
| `vendor/compute-engine.min.js` | `@cortex-js/compute-engine` | 0.58.0 | 2026-05-17 |

---

## Running the smoke test

Open `index.html` directly in Chrome, Firefox, or Safari — no web server required:

```
file:///path/to/maths-editor/index.html
```

Type a formula into the editor. The output panel updates in real time showing:

- **LaTeX** — the raw LaTeX string
- **MathJSON** — a structured expression tree (provided by Compute Engine)
- **Spoken text** — a human-readable English description

The **Copy LaTeX** button copies the current formula to the clipboard.
> **Note:** `navigator.clipboard` requires HTTPS or `localhost`. On `file://` URLs some browsers block it; the button falls back to an `alert()` dialogue showing the LaTeX string.

---

## Offline guarantee

Every resource loaded by `index.html` is vendored locally:

| Resource | Source |
|---|---|
| JavaScript (MathLive, Compute Engine) | `vendor/` |
| Component styles | `vendor/mathlive-static.css` |
| KaTeX fonts (22 × woff2) | `vendor/fonts/` |

Sound files are suppressed at runtime (`MathfieldElement.soundsDirectory = null`) so no `.wav` requests are made. Once the directory is saved to disk, the page works fully offline with zero network calls.

---

## Refreshing vendored files

To update to a new version, run these commands in PowerShell from this repository's root. Replace the version numbers as appropriate.

```powershell
# 1. Download fresh tarballs into a temp directory
$tmp = "$env:TEMP\mathlive-vendor-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
Push-Location $tmp
npm pack mathlive@0.109.2
npm pack "@cortex-js/compute-engine@0.58.0"
Pop-Location

# 2. Extract
$mlStage = "$tmp\ml-stage"
$ceStage = "$tmp\ce-stage"
New-Item -ItemType Directory -Path $mlStage, $ceStage -Force | Out-Null
tar -xzf "$tmp\mathlive-0.109.2.tgz"                       -C $mlStage
tar -xzf "$tmp\cortex-js-compute-engine-0.58.0.tgz"        -C $ceStage

# 3. Copy into vendor/  (MathLive files are at the package root, not dist/)
$vendor = ".\maths-editor\vendor"
New-Item -ItemType Directory -Path "$vendor\fonts" -Force | Out-Null
Copy-Item "$mlStage\package\mathlive.min.js"                  "$vendor\mathlive.min.js"
Copy-Item "$mlStage\package\mathlive-static.css"              "$vendor\mathlive-static.css"
Copy-Item "$mlStage\package\fonts\*"                          "$vendor\fonts\" -Recurse -Force
Copy-Item "$ceStage\package\dist\compute-engine.min.umd.cjs"  "$vendor\compute-engine.min.js"

# 4. Clean up
Remove-Item -Path $tmp -Recurse -Force
```

After running the above, update the **Vendored dependencies** table in this file with the new versions and today's date.

---

## File layout

```
maths-editor/
  index.html                    smoke-test page (Phase 1)
  maths-editor.js               host custom element (Phase 2+)
  maths-editor.css              host styles and theme tokens (Phase 2, updated Phase 8)
  serialiser.js                 pure parse/stringify functions (Phase 4)
  clipboard.js                  MathsEditor.serialiseSelection (Phase 7)
  recognition.js                MathsEditor.makeStubProvider factory (Phase 9)
  README.md                     this file
  palette/
    catalogue.js                symbol catalogue entries (Phase 5)
    palette.js                  palette overlay component (Phase 5)
    palette.css                 palette styles and theme tokens (Phase 5, updated Phase 8)
  themes/
    dark.css                    dark theme overrides (Phase 8)
    auto.css                    prefers-color-scheme switcher (Phase 8)
  docs/
    catalogue-format.md         catalogue entry shape and conventions (Phase 5)
    theming.md                  token reference and theming guide (Phase 8)
    recognition.md              recognition API reference and integration guide (Phase 9)
  tests/
    phase2.html                 interactive test harness for the host element
    phase3.html                 interactive test harness for maths islands
    phase4.html                 round-trip serialiser test harness (Phase 4)
    serialiser-tests.html       pure-function unit tests for serialiser (Phase 4)
    phase5.html                 palette test harness (Phase 5)
    phase7.html                 two-editor clipboard test harness (Phase 7)
    theme-preview.html          side-by-side theme preview with token reference (Phase 8)
    phase9.html                 recognition extension hooks test harness (Phase 9)
  vendor/
    mathlive.min.js             MathLive UMD bundle (script-tag safe)
    mathlive-static.css         component styles + KaTeX @font-face rules
    compute-engine.min.js       Cortex Compute Engine UMD bundle (MathJSON)
    fonts/
      KaTeX_AMS-Regular.woff2
      KaTeX_Caligraphic-Bold.woff2
      KaTeX_Caligraphic-Regular.woff2
      KaTeX_Fraktur-Bold.woff2
      KaTeX_Fraktur-Regular.woff2
      KaTeX_Main-Bold.woff2
      KaTeX_Main-BoldItalic.woff2
      KaTeX_Main-Italic.woff2
      KaTeX_Main-Regular.woff2
      KaTeX_Math-BoldItalic.woff2
      KaTeX_Math-Italic.woff2
      KaTeX_SansSerif-Bold.woff2
      KaTeX_SansSerif-Italic.woff2
      KaTeX_SansSerif-Regular.woff2
      KaTeX_Script-Regular.woff2
      KaTeX_Size1-Regular.woff2
      KaTeX_Size2-Regular.woff2
      KaTeX_Size3-Regular.woff2
      KaTeX_Size4-Regular.woff2
      KaTeX_Typewriter-Regular.woff2
      (20 files total)
```

---

## Host element (Phase 2)

`<maths-editor>` is a vanilla-JS custom element that provides a plain-text
`contenteditable` editor with a clean property/event API. Maths input is not
yet implemented — that arrives in Phase 3.

### Embedding

```html
<link rel="stylesheet" href="maths-editor.css">
<script type="module" src="maths-editor.js"></script>

<maths-editor placeholder="Type here…"></maths-editor>
```

No build step. No external dependencies. Works on `file://` URLs.

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `placeholder` | string | Text shown when the editor is empty |
| `readonly` | boolean (presence) | Disables editing when present |
| `value` | string | Sets the initial plain-text content |

### Properties

| Property | Type | Description |
|---|---|---|
| `.placeholder` | string | Reflects the `placeholder` attribute |
| `.readonly` | boolean | Reflects the `readonly` attribute |
| `.value` | string | Gets or sets the editor content as a `$…$`-delimited string. Getter serialises islands as `$latex$`. Setter parses the string and rebuilds the DOM with maths islands. Silent — fires no `input` event. |

### Methods

| Method | Description |
|---|---|
| `.focus()` | Focus the editable region |
| `.blur()` | Remove focus |
| `.clear()` | Remove all content and restore the placeholder |

### Events

Both events bubble and carry a `detail` object with a `value` property.

| Event | When |
|---|---|
| `input` | Every user content mutation. Suppressed during IME composition. |
| `change` | On blur, only when the value changed since the last focus. |

```js
editor.addEventListener('input', e => console.log(e.detail.value));
editor.addEventListener('change', e => console.log('committed:', e.detail.value));
```

### CSS custom properties

Set on `maths-editor { … }` in the consuming page to theme the editor without
touching its internals.

| Property | Default | Description |
|---|---|---|
| `--me-font-family` | `system-ui, sans-serif` | Font stack |
| `--me-font-size` | `1rem` | Text size |
| `--me-line-height` | `1.6` | Line height |
| `--me-text-colour` | `#1a1a1a` | Text colour |
| `--me-background` | `#ffffff` | Editor background |
| `--me-padding` | `0.5rem 0.75rem` | Inner padding |
| `--me-border` | `1px solid #ccc` | Border |
| `--me-border-radius` | `4px` | Corner radius |
| `--me-focus-ring` | `0 0 0 3px rgba(59,130,246,0.4)` | Focus outline (box-shadow) |
| `--me-placeholder-colour` | `#9ca3af` | Placeholder text colour |
| `--me-min-height` | `3rem` | Minimum editor height |

### Test harness

Open `tests/phase2.html` directly in a browser to exercise every property,
method, and event interactively. The page includes a live value display and a
timestamped event log.

---

## Phase 3: Maths islands

### Embedding with maths support

Load Compute Engine, then MathLive, then `maths-editor.js`. Order matters:
Compute Engine must register before MathLive reads it (for MathJSON output).

```html
<script src="vendor/compute-engine.min.js"></script>
<script src="vendor/mathlive.min.js"></script>
<script>MathfieldElement.soundsDirectory = null;</script>
<link rel="stylesheet" href="vendor/mathlive-static.css">
<link rel="stylesheet" href="maths-editor.css">
<script type="module" src="maths-editor.js"></script>

<maths-editor placeholder="Type here, Tab to insert maths…"></maths-editor>
```

### Keyboard model

| Key | Context | Effect |
|---|---|---|
| `Tab` | Text mode | Inserts a maths island at the caret and focuses it |
| `Tab` | Inside maths | Opens the symbol palette anchored to the math-field |
| `Esc` | Inside maths | Exits to text mode; caret placed after island. Island removed if empty. |
| `←` / `→` at boundary | Inside maths | Exits island; caret placed before/after it. Island removed if empty. |
| `Backspace` after island | Text mode | Removes island as a single unit (browser default) |
| `Delete` before island | Text mode | Removes island as a single unit (browser default) |

Clicking outside a focused maths island also exits it and applies the
empty-on-exit removal rule.

### `.value` property with maths islands

The `.value` getter serialises maths islands as `$latex$`:

```
"The area is $\frac{1}{2}bh$ where b is the base."
```

The `.value` setter parses the same `$…$` format and rebuilds the document
with properly rendered maths islands. See Phase 4 for full round-trip details.

### New properties

| Property | Type | Description |
|---|---|---|
| `.maths` | `Array<{ latex: string, mathJson: any }>` | Read-only. Returns all maths islands in document order, each with its current LaTeX string and MathJSON value. Requires Compute Engine to be loaded for MathJSON; returns a fallback expression otherwise. |

### New methods

| Method | Returns | Description |
|---|---|---|
| `.insertMath(latex = '')` | `HTMLElement \| null` | Inserts a maths island at the current caret position (replacing any selection), focuses the new `math-field`, and returns the `math-field` element. Silently no-ops and returns `null` if the editor is readonly or not yet connected. Programmatic — fires no `input` event. |

### New events

| Event | When | Detail |
|---|---|---|
| `maths-input` | When a maths island's content changes | `{ index: number, latex: string, mathJson: any }` |

`maths-input` is always accompanied by a standard `input` event (reflecting the
full serialised `.value` including all islands).

```js
editor.addEventListener('maths-input', (e) => {
  const { index, latex, mathJson } = e.detail;
  console.log(`Island ${index}: ${latex}`);
});
```

### Island CSS custom properties

Set on `maths-editor { … }` to theme the island appearance.

| Property | Default | Description |
|---|---|---|
| `--me-math-island-background` | `#f0f4ff` | Island background colour |
| `--me-math-island-border` | `1px solid #93c5fd` | Island border |
| `--me-math-island-padding` | `0.1em 0.3em` | Island inner padding |
| `--me-math-island-focus-ring` | `0 0 0 2px rgba(59,130,246,0.5)` | Box-shadow when island is focused |

### Test harness

Open `tests/phase3.html` directly in a browser. The harness includes buttons
for programmatic island insertion, a live `.value` display, a per-island panel
showing LaTeX and MathJSON updated in real time, and a colour-coded event log
(`input` in blue, `change` in purple, `maths-input` in green).

---

## Phase 4: Round-trip serialiser

### Embedding `serialiser.js`

Load `serialiser.js` as a plain `<script>` tag **before** `maths-editor.js`.
It has no DOM dependency and attaches to `window.MathsEditor`.

```html
<script src="serialiser.js"></script>
<script type="module" src="maths-editor.js"></script>
```

### Segment shape

The structured representation of a document is an array of segments:

```js
[
  { type: 'text', value: 'The area is ' },
  { type: 'math', latex: '\\frac{1}{2}bh' },
  { type: 'text', value: ' where b is the base.' },
]
```

Each segment is either `{ type: 'text', value: string }` or
`{ type: 'math', latex: string }`.

### `MathsEditor.parse(string) → segments`

Parses a `$…$`-delimited string into a segments array.

```js
const segs = MathsEditor.parse('Area: $\\frac{1}{2}bh$');
// → [{ type:'text', value:'Area: ' }, { type:'math', latex:'\\frac{1}{2}bh' }]
```

### `MathsEditor.stringify(segments) → string`

Serialises a segments array back to a `$…$`-delimited string.

```js
MathsEditor.stringify([
  { type: 'text', value: 'Area: ' },
  { type: 'math', latex: '\\frac{1}{2}bh' },
]);
// → 'Area: $\\frac{1}{2}bh$'
```

### Delimiter and escape rules

| Situation | Rule |
|---|---|
| `$` in source | Opens or closes a maths island |
| `\$` in source | Escaped: treated as a literal `$` inside text |
| `\$` inside a maths island | Opaque to the parser; preserved verbatim in LaTeX |
| `\\$` (even backslashes + `$`) | The `$` is a delimiter (even count → unescaped) |
| `\\\$` (odd backslashes + `$`) | The `$` is escaped (odd count → not a delimiter) |
| `$$` | Empty maths island: silently dropped. Surrounding text is preserved and merged. |
| Unbalanced trailing `$` | The `$` and everything after it is treated as literal text. A `console.warn` is emitted once per call. |
| `$` in a text segment value | Encoded as `\$` when stringifying |

The even/odd rule: count consecutive backslashes immediately before `$`. Even
count (including zero) → delimiter. Odd count → escaped.

### New methods

| Method | Returns | Description |
|---|---|---|
| `.toSegments()` | `Array` | Returns the current document as a segments array. Read-only snapshot. |
| `.fromSegments(segments)` | `void` | Equivalent to the setter but accepts a segments array directly. Silent — fires no `input` event. |

```js
const segs = editor.toSegments();
// → [{ type:'text', value:'...' }, { type:'math', latex:'...' }, …]

editor.fromSegments([
  { type: 'text', value: 'Hello ' },
  { type: 'math', latex: '\\sqrt{2}' },
]);
```

### Invariants

- `parse(stringify(s))` deep-equals `s` for any well-formed segment array.
- `stringify(parse(x))` equals `x` except when `x` contains `$$` (empty maths
  dropped) or an unbalanced trailing `$` (re-encoded as `\$`).

### Usage guidance

The `$…$` string format is designed for **save/load and editor-to-editor
transfer**. If you need to feed LaTeX into an algebra engine, use `.maths` or
listen to the `maths-input` event — those give you per-island LaTeX directly
without going through the string representation.

Clipboard paste does not parse `$…$` in Phase 4. That feature arrives in
Phase 7.

### Test harnesses

| Page | Description |
|---|---|
| `tests/serialiser-tests.html` | Pure-function unit tests for `parse` and `stringify`. No MathLive or DOM required. Open directly in any browser. |
| `tests/phase4.html` | Interactive round-trip harness. Load pre-canned samples or type freely, then press "Round-trip check". |

---

## Phase 5: Symbol palette

### Embedding the palette

Load the catalogue and palette scripts as plain `<script>` tags **before** `maths-editor.js`, and link `palette.css` alongside `maths-editor.css`.

```html
<link rel="stylesheet" href="maths-editor.css">
<link rel="stylesheet" href="palette/palette.css">
<script src="vendor/compute-engine.min.js"></script>
<script src="vendor/mathlive.min.js"></script>
<script>MathfieldElement.soundsDirectory = null;</script>
<script src="serialiser.js"></script>
<script src="palette/catalogue.js"></script>
<script src="palette/palette.js"></script>
<script type="module" src="maths-editor.js"></script>
```

Plain scripts run synchronously before the deferred module, so `window.MathsEditor.Palette` is available when `maths-editor.js` executes.

### Keyboard flow

| Key | Context | Effect |
|---|---|---|
| `Tab` | Inside maths | Opens the symbol palette anchored below the math-field |
| `↑` / `↓` | Palette open | Move the highlight up / down (wraps) |
| `Enter` | Palette open | Insert the highlighted entry and close the palette |
| `Esc` | Palette open | Close without inserting; focus returns to the math-field |
| `Tab` | Palette open | Close without inserting; focus returns to the math-field |
| Type any text | Palette open | Filters results in real time |

Clicking an entry inserts it. Clicking outside the palette closes it without inserting.

### Catalogue entry shape

Each entry in `window.MathsEditor.catalogue` follows this shape:

```js
{
  id: 'frac',             // unique string key
  name: 'Fraction',       // displayed in the palette
  latex: '\\frac{#@}{#?}',// LaTeX inserted on accept
                          //   #@ wraps current selection
                          //   #? marks MathLive placeholders
  category: 'Structures', // used for grouping in the empty-query view
  aliases: ['over', '/'], // extra search terms (beyond `name`)
  preview: '\\frac{a}{b}' // short LaTeX rendered as a thumbnail
}
```

### Extending the catalogue

Add entries to the array in `palette/catalogue.js`. Categories appear in the order their first entry appears in the array. See [docs/catalogue-format.md](docs/catalogue-format.md) for the full entry shape, alias conventions, and a step-by-step guide to adding a new entry. After any edit, verify the catalogue using [tests/catalogue-health.html](tests/catalogue-health.html).

### `MathsEditor.Palette` API

The palette is a singleton. At most one palette is open at a time across the page regardless of how many `<maths-editor>` elements exist.

```js
// Open the palette anchored to a math-field element.
MathsEditor.Palette.open(mathFieldElement, {
  onInsert(latex) { /* called with the selected entry's latex string */ },
  onClose(reason) { /* reason: 'insert' | 'escape' | 'click-outside' | 'tab' | 'programmatic' */ },
});

// Close the palette programmatically (fires onClose with reason 'programmatic').
MathsEditor.Palette.close();

// Returns true if the palette is currently visible.
MathsEditor.Palette.isOpen(); // → boolean
```

### Palette CSS custom properties

Set on `.me-palette { … }` or any ancestor to theme the palette.

| Property | Default | Description |
|---|---|---|
| `--me-palette-background` | `#ffffff` | Palette background colour |
| `--me-palette-border` | `1px solid #d1d5db` | Border around the palette and search separator |
| `--me-palette-shadow` | `0 4px 16px rgba(0,0,0,0.12)` | Drop shadow |
| `--me-palette-text-colour` | `#1a1a1a` | Default text colour |
| `--me-palette-highlight-background` | `#eff6ff` | Background of the highlighted item |
| `--me-palette-highlight-text-colour` | `#1d4ed8` | Text colour of the highlighted item |
| `--me-palette-group-text-colour` | `#6b7280` | Category header text colour |
| `--me-palette-width` | `320px` | Width of the palette overlay |
| `--me-palette-max-height` | `360px` | Maximum height of the results list |

### Test harness

Open `tests/phase5.html` directly in a browser. The harness includes:

- An editor with instructional placeholder text for the Tab → palette flow.
- "Open palette at active math-field" and "Close palette" buttons for programmatic testing.
- A colour-coded event log showing `palette-open` and `palette-close` with reason.
- A catalogue inspection table listing every entry with `id`, `name`, `category`, and `latex`.
- A round-trip check button (from Phase 4) confirming that documents built via the palette still serialise cleanly.

---

## Phase 6: Expanded catalogue

Phase 6 replaces the 30-entry starter catalogue with 160 entries covering NSW Mathematics Stages 4–6 (Years 7–12 including Extension 1 and 2). No palette behaviour changed — this is a content-only update.

### Categories (in display order)

1. Numbers and constants
2. Basic operators
3. Powers, indices, roots
4. Fractions
5. Subscripts and superscripts
6. Greek letters
7. Trigonometry
8. Logarithms and exponentials
9. Calculus
10. Vectors
11. Complex numbers
12. Probability and statistics
13. Sets
14. Logic
15. Matrices
16. Geometry
17. Arrows
18. Accents and decorations

### Adding palette entries

See [docs/catalogue-format.md](docs/catalogue-format.md) for the complete entry shape, the 18 category names, alias conventions, and a worked example of adding a new entry from scratch.

After editing the catalogue, open [tests/catalogue-health.html](tests/catalogue-health.html) in a browser to verify there are no duplicate IDs, missing fields, or rendering errors.

---

## Phase 7: Clipboard integration

Phase 7 wires copy, cut, and paste through the host editor so documents move
cleanly between editor instances and to/from external tools. The clipboard
format reuses the `$...$` serialiser from Phase 4. MathLive's internal
copy/paste inside a focused math-field is unchanged.

### Script loading order

Add `clipboard.js` after `serialiser.js` and before `maths-editor.js`:

```html
<script src="serialiser.js"></script>
<script src="clipboard.js"></script>
<!-- catalogue, palette, then: -->
<script type="module" src="maths-editor.js"></script>
```

### Clipboard contract

#### Copy from the host editor (text-mode focus)

When the user copies a selection in the host's `contenteditable`:

- The native copy event is intercepted (`preventDefault`).
- The selection is serialised to a segments array via `MathsEditor.serialiseSelection`.
- The segments are stringified via `MathsEditor.stringify` to produce a `$...$`-delimited string.
- The string is written to the clipboard as `text/plain`.
- No `text/html` payload — external apps receive plain dollar-delimited text.

#### Cut from the host editor

Same as copy, then the selection is deleted. The host fires one `input` event.

#### Paste into the host editor (text-mode focus)

- The native paste event is intercepted (`preventDefault`).
- `text/plain` is read from the clipboard.
- Line endings are normalised (`\r\n` and `\r` → `\n`).
- If the clipboard text produces any maths segments when parsed by
  `MathsEditor.parse`, the content is inserted as mixed text+island nodes at
  the cursor. The host fires one `input` event.
- If no maths segments result (no unescaped `$`), the text is inserted as
  plain text via `execCommand('insertText')` — the Phase 2 behaviour.
- The caret is placed after the last inserted node.

#### Copy/paste inside a focused math-field

MathLive's own handlers run. The host's copy and paste handlers check
`document.activeElement` and yield to MathLive when a math-field is active.

### `MathsEditor.serialiseSelection(range, hostElement) → string`

Serialises the given DOM `Range` to a `$...$`-delimited string.

```js
// Example: serialise whatever the user has selected inside an editor
const range = window.getSelection().getRangeAt(0);
const text  = MathsEditor.serialiseSelection(range, editor._content);
// → 'Hello $x^2+1$ world'
```

- Text nodes are included verbatim, respecting `startOffset`/`endOffset` on
  boundary nodes.
- `<br>` elements become `\n`.
- `.me-math-island` elements become a `$latex$` segment with the child
  math-field's current LaTeX.
- Other element types are recursed into (not reached in the current flat
  document structure, but supported for future-proofing).
- Adjacent text segments are merged before stringifying.

### Documented limitations

1. **Pasting `$...$` form into a math-field shows literal dollar signs.**
   MathLive's own paste handler runs inside the math-field, treating the
   clipboard text as LaTeX. The surrounding `$` delimiters appear verbatim in
   the rendered output. Undo and edit manually.

2. **Plain text containing incidental `$` is parsed as maths.**
   Clipboard text such as `Buy for $5 or $10` contains unescaped dollar signs,
   so `MathsEditor.parse` interprets `5 or $10` as LaTeX. The result will not
   match the intended plain text. Undo and re-type or paste via the manual
   source textarea.

3. **Copy to Word or other external apps produces `$...$` plain text, not
   rendered maths.** Rendered output for external apps (MathML, OMML) is a
   future enhancement.

### Test harness

Open `tests/phase7.html` directly in a browser. The harness includes:

- Two `<maths-editor>` instances side by side (Source pre-loaded with mixed
  text and maths content, Target empty).
- "Copy selection from Source" and "Cut selection from Source" buttons that
  exercise the real copy/cut pathway via `document.execCommand`.
- "Paste into Target at cursor" and "Clear Target" buttons.
- "Read clipboard" — calls `navigator.clipboard.readText()` and shows the
  result in a `<pre>` for inspection.
- A "Manual paste source" textarea for confirming that clipboard content from
  non-editor sources is parsed and inserted correctly.
- Round-trip check buttons on each editor (verifying Phase 4 stability after
  the Phase 7 setter refactor).
- A colour-coded event log counting every `input` and `change` event from
  both editors.

---

## Phase 8: Theming

Phase 8 audits the full CSS custom property (token) surface, fills gaps from
earlier phases, and ships two reference themes alongside a token reference
document. No behaviour changes, no visual redesign.

### Theme modes

| Mode | How to enable | File |
|---|---|---|
| Light (default) | Load base stylesheets only — no extra file needed | — |
| Dark (opt-in) | Load `themes/dark.css` and add `data-theme="dark"` to the target element | `themes/dark.css` |
| Auto (OS-driven) | Load `themes/auto.css` — no attribute required | `themes/auto.css` |

Do not load both `dark.css` and `auto.css` at the same time. See
[docs/theming.md](docs/theming.md) for the specificity trade-off.

### Dark theme — page-wide

```html
<html data-theme="dark">
<head>
  <link rel="stylesheet" href="maths-editor.css">
  <link rel="stylesheet" href="palette/palette.css">
  <link rel="stylesheet" href="themes/dark.css">
```

### Dark theme — per-instance

Two editors on the same page can run different themes:

```html
<link rel="stylesheet" href="themes/dark.css">

<maths-editor></maths-editor>                          <!-- light -->
<maths-editor data-theme="dark"></maths-editor>        <!-- dark -->
```

The symbol palette is a singleton at the document level. When it opens, it
walks up from the focused math island to find the nearest `data-theme`
attribute and copies it to the palette element automatically.

### Auto theme

```html
<link rel="stylesheet" href="themes/auto.css">
<!-- No data-theme attribute needed — follows OS setting -->
```

### Theming reference

Full token list, worked custom-theme example, MathLive variable cross-reference,
and WCAG AA contrast guidance: see [docs/theming.md](docs/theming.md).

### Test harness

Open `tests/theme-preview.html` directly in a browser. The harness includes:

- Two `<maths-editor>` instances side by side, pre-loaded with a mixed
  text and maths sample.
- A theme toggle at the top (Light / Dark / Auto) that switches both editors.
- A token reference panel showing every `--me-*` token with its current
  resolved value and a colour swatch or length display.
- A custom theme panel where CSS overrides can be pasted and applied live.

---

## Phase 9: Recognition extension hooks

Phase 9 adds an API surface for handwriting and OCR recognition. No real
provider ships with the editor — host pages supply a provider object and the
editor manages the request lifecycle. See
[docs/recognition.md](docs/recognition.md) for the full reference.

### Script loading

Load `recognition.js` after the other scripts if you want the stub provider
factory for testing. It has no DOM dependency and attaches to
`window.MathsEditor`.

```html
<script src="recognition.js"></script>
```

### Provider kinds

| Kind | Input | Typical use |
|---|---|---|
| Image | `Blob` or `File` | OCR from a photograph or screenshot |
| Ink | Array of stroke arrays (`[{ x, y, t, pressure? }]`) | Handwriting captured from pointer events |

### New methods

| Method | Returns | Description |
|---|---|---|
| `.setImageProvider(provider \| null)` | `void` | Register or clear the image provider |
| `.setInkProvider(provider \| null)` | `void` | Register or clear the ink provider |
| `.recogniseImage(blob, options?)` | `Promise<{ latex, … }>` | Call the provider without modifying the document |
| `.recogniseInk(strokes, options?)` | `Promise<{ latex, … }>` | Call the provider without modifying the document |
| `.insertFromImage(blob, options?)` | `Promise<math-field \| null>` | Recognise and insert at the caret (or replace a focused island) |
| `.insertFromInk(strokes, options?)` | `Promise<math-field \| null>` | Recognise and insert at the caret (or replace a focused island) |
| `.cancelRecognition(kind?)` | `boolean` | Abort in-flight request(s); returns `true` if anything was cancelled |

### Lifecycle events

| Event | When | Key detail fields |
|---|---|---|
| `recognition-start` | Provider call begins | `kind`, `provider` |
| `recognition-success` | Provider resolves successfully | `kind`, `latex`, `confidence`, `alternatives`, `durationMs` |
| `recognition-error` | Provider rejects (non-abort) | `kind`, `error`, `durationMs` |
| `recognition-cancel` | Request is cancelled | `kind`, `durationMs` |

### Stub provider (for testing)

```js
const stub = MathsEditor.makeStubProvider({
  kind: 'image',             // 'image' | 'ink'
  delay: 800,                // ms before resolving
  response: '\\frac{1}{2}', // LaTeX returned on success
  failureMode: null,         // null | 'error' | 'timeout' | 'invalid' | 'no-match'
});
editor.setImageProvider(stub);
```

No real provider ships with the editor. To integrate Mathpix, MyScript, or
another service, see the worked examples in [docs/recognition.md](docs/recognition.md).

### Test harness

Open `tests/phase9.html` directly in a browser. The harness covers:

- Registering success, error, slow, timeout, invalid, and no-match stubs for both kinds.
- Triggering both the utility and insertion tiers.
- Manual and automatic cancellation.
- In-flight status display updated every 100 ms.
- Two-editor isolation test confirming providers are per-instance.
- Event log with timestamped detail payloads for all four lifecycle events.
