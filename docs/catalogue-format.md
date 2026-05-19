# Catalogue format reference

This document describes how to read, extend, and maintain the symbol palette catalogue at `palette/catalogue.js`.

---

## Overview

The catalogue is a plain JavaScript array (`window.MathsEditor.catalogue`) that drives the symbol palette. When a user presses Tab inside a maths field, the palette loads all entries from this array and displays them, either grouped by category (when the search box is empty) or filtered by the typed query (when the user types).

Each entry in the array represents one insertable symbol or template. The palette renders a preview of the entry and inserts its `latex` string into the maths field when the user selects it.

The file is intentionally a single plain JavaScript file with no build step. Open `tests/catalogue-health.html` in a browser to verify your changes at any time.

---

## Entry shape

Every entry must have exactly these six fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Unique identifier. Lowercase, hyphens between words. Must be unique across the entire catalogue. |
| `name` | string | yes | Display name shown in the palette. Sentence case, no trailing punctuation. |
| `latex` | string | yes | LaTeX inserted into the maths field when the entry is selected. May contain `#@` and `#?` markers (see below). |
| `category` | string | yes | One of the 18 category names (see the Categories section). Controls grouping in the empty-query view. |
| `aliases` | string[] | yes | Extra search terms beyond `name`. Must be lowercase. At least one alias is required. |
| `preview` | string | yes | Short LaTeX rendered as a thumbnail in the results list. Should use example variables (a, b, x, n, θ) rather than placeholder markers, so it renders as readable maths. |

Example of a well-formed entry:

```js
{
  id: 'integral-definite',
  name: 'Definite integral',
  latex: '\\int_{#?}^{#?} #? \\, d#?',
  category: 'Calculus',
  aliases: ['integral', 'int', 'definite', 'antiderivative'],
  preview: '\\int_a^b f(x)\\,dx',
}
```

---

## The `#@` and `#?` markers

These two markers control what happens when MathLive inserts an entry.

**`#@`** — wrap current selection.  
If the user has selected text in the maths field before opening the palette, that selection is substituted in place of `#@`. If nothing is selected, `#@` is treated as an empty placeholder. Use `#@` for operations that are typically applied to existing content — for example, wrapping content in a square root: `\\sqrt{#@}`.

**`#?`** — placeholder.  
MathLive inserts a tab-stop placeholder at each `#?` position. After insertion, the cursor lands in the first `#?` and the user can press Tab to move through subsequent ones. Use `#?` for values the user must fill in.

If an entry has no markers (for example a bare symbol like `\\pi`), the symbol is inserted at the cursor position with no placeholder navigation.

---

## Categories

Entries are grouped by category in the empty-query view, displayed in the order below. Use exactly these strings for the `category` field.

| # | Category | Description |
|---|---|---|
| 1 | Numbers and constants | Standalone mathematical constants: π, e, i, ∞, ° |
| 2 | Basic operators | Arithmetic and relational operators: ×, ÷, ±, ≠, ≤, ≥, ≈, ≡ |
| 3 | Powers, indices, roots | Exponents, square and nth roots |
| 4 | Fractions | Fraction, display fraction, mixed numeral, binomial coefficient |
| 5 | Subscripts and superscripts | Subscript, superscript, and combined forms |
| 6 | Greek letters | Full lower-case set plus common upper-case letters |
| 7 | Trigonometry | Six trig functions and their six inverses |
| 8 | Logarithms and exponentials | log, log base b, ln, e^x |
| 9 | Calculus | Derivatives, integrals, summation, product, limit, del |
| 10 | Vectors | Arrow notation, underline notation, magnitude, dot and cross products, unit vectors |
| 11 | Complex numbers | i, conjugate, Re, Im, modulus, argument, cis, polar form |
| 12 | Probability and statistics | P(A), conditional, expected value, variance, mean, standard deviation, nCr, nPr |
| 13 | Sets | ∈, ∉, ⊂, ⊆, ∪, ∩, ∅, ℕ, ℤ, ℝ |
| 14 | Logic | ⇒, ⇔, ∀, ∃, ∴, ∵, ¬, ∧ |
| 15 | Matrices | 2×2 and 3×3 bracket and paren matrices, determinants, transpose, inverse, column vectors |
| 16 | Geometry | ∥, ⊥, ≅, ~, △, ∠, arc |
| 17 | Arrows | →, ←, ↔, ↦, and long right arrow |
| 18 | Accents and decorations | hat, bar, dot, double dot, tilde, vector arrow, overline, underline |

---

## Alias conventions

Aliases extend the set of search terms beyond the entry's `name`. The palette matches user input against `name` and all `aliases` (case-insensitive substring match).

Follow these rules when writing aliases:

1. **All lowercase.** Aliases are matched case-insensitively, but write them lowercase for consistency.
2. **Include the LaTeX command name** without the leading backslash. For example, if the `latex` field is `\\frac{…}{…}`, include `frac` as an alias.
3. **Include spoken synonyms.** For `\\times`, include `multiply`, `times`, `cross`.
4. **Include common abbreviations.** For infinity, include `infty`, `inf`. For integral, include `int`.
5. **Include natural plurals** where a user might type them: `reals`, `integers`, `degrees`.
6. **At least one alias** is required — the array must not be empty.

Poor aliases:

```js
aliases: ['']  // empty string is not useful
aliases: ['a'] // too short to be meaningful in most cases
```

Good aliases for a "Summation" entry:

```js
aliases: ['sum', 'summation', 'sigma', 'series', 'Sigma']
```

---

## Worked example: adding a new entry

Suppose you want to add the floor function ⌊x⌋ for use in Stage 6 Extension work.

### Step 1 — Pick an id

Choose a lowercase, hyphen-separated identifier that does not already exist in the catalogue. Check `tests/catalogue-health.html` to confirm uniqueness.

```
id: 'floor'
```

### Step 2 — Write the entry

```js
{
  id: 'floor',
  name: 'Floor function',
  latex: '\\lfloor #@ \\rfloor',
  category: 'Basic operators',
  aliases: ['floor', 'floor function', 'lfloor', 'greatest integer'],
  preview: '\\lfloor x \\rfloor',
},
```

- `#@` wraps any selected content; if nothing is selected, it leaves an empty gap.
- The `preview` uses `x` so the rendered thumbnail shows a readable example.

### Step 3 — Add it to the catalogue

Open `palette/catalogue.js` and find the `// ── Basic operators ──` comment block. Insert your entry at a logical position within the block (alphabetical, or by similarity to neighbouring entries).

### Step 4 — Verify

Open `tests/catalogue-health.html` in a browser. Confirm:

- Total entry count incremented by one.
- No duplicate ID errors.
- No missing field errors.
- The new row renders the preview and the filled template without an ERR badge.

Use the search box to type `floor` and confirm the new entry appears.

### Step 5 — Test insertion

Open `tests/phase5.html`, press Tab to open the palette, type `floor`, select the entry, and confirm the symbol inserts at the cursor in the maths field.

---

## Wishlist

Entries that were considered but not included to keep the catalogue at ≤ 170 entries are listed in a `/* WISHLIST */` comment block at the bottom of `palette/catalogue.js`. If you want to promote a wishlist entry to the catalogue, follow the steps above. If you want to add a new candidate but are unsure whether it belongs, add it to the wishlist comment instead.
