# Recognition API

`<maths-editor>` provides an extension surface for handwriting and OCR recognition. Host pages supply a provider object; the editor manages the request lifecycle, AbortSignal, and lifecycle events. No real provider ships with the editor — see [Why no built-in provider?](#why-no-built-in-provider).

---

## Why no built-in provider?

Binding a specific recognition service would:

- **Couple the editor to a vendor** — Mathpix, MyScript, Google Cloud Vision, and similar services each have their own billing models, API keys, and rate limits. The editor makes no assumptions about which one you use.
- **Require bundling credentials** — API keys must not be shipped in a shared library.
- **Add licensing complexity** — vendor SDKs have separate licence terms.

The provider interface is deliberately minimal so any HTTP-based service can be wrapped in a few lines.

---

## Provider interfaces

Two shapes are supported, one per input kind. Both are plain JS objects assigned via `setImageProvider` / `setInkProvider`.

### Image provider

```js
{
  name: 'Mathpix',     // optional — shown in recognition-start event
  version: '1.0',      // optional — metadata only

  recognise: async function(blob, options) {
    // blob    — a Blob or File of an image
    // options — { signal?: AbortSignal }
    //
    // Returns: { latex: string, confidence?: number, alternatives?: string[] }
    // Throws on failure
  }
}
```

### Ink provider

```js
{
  name: 'MyScript',
  version: '1.0',

  recognise: async function(strokes, options) {
    // strokes — array of strokes; each stroke is an array of point objects:
    //   { x: number, y: number, t: number, pressure?: number }
    // options — { signal?: AbortSignal }
    //
    // Returns: { latex: string, confidence?: number, alternatives?: string[] }
    // Throws on failure
  }
}
```

### Return value fields

| Field | Type | Description |
|---|---|---|
| `latex` | `string` | The recognised LaTeX. Empty string means no match. |
| `confidence` | `number?` | Optional confidence score (0–1 or service-defined range). |
| `alternatives` | `string[]?` | Optional list of alternative LaTeX strings in descending confidence. |

---

## Editor methods

### Provider registration

```js
editor.setImageProvider(provider | null)
editor.setInkProvider(provider | null)
```

Passing `null` clears the provider. Providers are per-instance — two editors on the same page hold independent providers.

### Utility tier

```js
editor.recogniseImage(blob, options?)  → Promise<{ latex, confidence?, alternatives? }>
editor.recogniseInk(strokes, options?) → Promise<{ latex, confidence?, alternatives? }>
```

Calls the provider's `recognise` method and manages the AbortController. Does **not** modify the document. Throws if no provider is registered.

The `options` object is merged into the call to `provider.recognise`. The editor always adds its own `signal` property; the provider receives `{ signal, ...options }`.

### Insertion tier

```js
editor.insertFromImage(blob, options?)  → Promise<math-field element | null>
editor.insertFromInk(strokes, options?) → Promise<math-field element | null>
```

Calls the utility methods, then on success inserts the recognised LaTeX into the document:

- **If focus is inside an existing maths island** when these are called, that island's content is **replaced** with the recognised LaTeX. No new island is created.
- **Otherwise**, a new maths island is inserted at the current caret position using `insertMath(latex)`.

Resolves with the `<math-field>` element that was created or updated, or `null` if the result was empty or non-string.

The insertion target is captured at call time, before the async provider call. If the caret moves while recognition is in progress, the insertion still targets the original position.

### Cancellation

```js
editor.cancelRecognition(kind?) → boolean
```

Aborts any in-flight recognition.

| Argument | Effect |
|---|---|
| *(none)* | Cancels both image and ink in-flight requests |
| `'image'` | Cancels only the in-flight image request |
| `'ink'` | Cancels only the in-flight ink request |

Returns `true` if anything was cancelled. The cancelled promise rejects with a `DOMException` with `name === 'AbortError'`.

The editor holds at most one in-flight request per kind. Starting a new request of the same kind auto-cancels the previous one. Image and ink requests are independent — cancelling one does not affect the other.

---

## Lifecycle events

All four events are dispatched on the editor element with `bubbles: true` and `composed: false`. Listen on the `<maths-editor>` element or any ancestor.

### `recognition-start`

Fires when a provider call begins.

```js
event.detail = {
  kind: 'image' | 'ink',
  provider: string,  // provider.name, or the kind if name is absent
}
```

### `recognition-success`

Fires when a provider call resolves successfully and was not subsequently cancelled.

```js
event.detail = {
  kind: 'image' | 'ink',
  latex: string,
  confidence: number | undefined,
  alternatives: string[] | undefined,
  durationMs: number,
}
```

### `recognition-error`

Fires when a provider call rejects with a non-abort error.

```js
event.detail = {
  kind: 'image' | 'ink',
  error: Error,      // the rejection value
  durationMs: number,
}
```

### `recognition-cancel`

Fires when a request is cancelled, either by `cancelRecognition()` or by a new request auto-cancelling the previous one.

```js
event.detail = {
  kind: 'image' | 'ink',
  durationMs: number,
}
```

`durationMs` is measured from `recognition-start` to when the cancellation is processed. For providers that ignore the signal and resolve late, this reflects the actual wall time before the late result was discarded.

---

## AbortSignal contract

The editor creates an `AbortController` per request and passes `signal` to the provider via `options`. 

**If the provider honours `signal`:** it should throw a `DOMException` with `name === 'AbortError'` when `signal.aborted` becomes true. The editor catches this, fires `recognition-cancel`, and rejects the returned promise with the same `AbortError`.

**If the provider ignores `signal`:** the provider may still resolve after the editor has cancelled the request. The editor detects this by checking `signal.aborted` after `await provider.recognise(...)` returns. If the signal is already aborted, the late result is discarded, `recognition-cancel` is fired, no content is inserted, and no `recognition-success` event fires.

---

## Stub provider factory

`recognition.js` exposes a factory for testing. Load the script before use:

```html
<script src="recognition.js"></script>
```

### `MathsEditor.makeStubProvider(config) → provider`

```js
const stub = MathsEditor.makeStubProvider({
  kind: 'image',           // required — 'image' | 'ink'
  delay: 800,              // ms before resolving (default 800)
  response: '\\frac{1}{2}',// LaTeX returned on success (default '\\frac{1}{2}')
  failureMode: null,       // null | 'error' | 'timeout' | 'invalid' | 'no-match'
  name: 'Stub',            // shown in recognition-start event (default 'Stub')
});

editor.setImageProvider(stub);
```

| `failureMode` | Behaviour |
|---|---|
| `null` | Resolves with `{ latex: response }` after `delay` ms |
| `'error'` | Rejects immediately with `new Error('Stub provider error')` |
| `'timeout'` | Returns a promise that never resolves; cancellation via `AbortSignal` works normally |
| `'invalid'` | Resolves after `delay` ms with `{ latex: 42 }` — exercises the non-string result path |
| `'no-match'` | Resolves after `delay` ms with `{ latex: '' }` — exercises the empty-result path |

All modes honour `AbortSignal`.

---

## Writing a provider

### Mathpix-style HTTP image provider

```js
function makeMathpixProvider({ endpoint, appId, appKey }) {
  return {
    name: 'Mathpix',

    async recognise(blob, options = {}) {
      // Convert Blob to base64
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const body = JSON.stringify({
        src: `data:${blob.type || 'image/png'};base64,${base64}`,
        formats: ['latex_simplified'],
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'app_id': appId,
          'app_key': appKey,
        },
        body,
        signal: options.signal,  // pass through for cancellation
      });

      if (!response.ok) {
        throw new Error(`Mathpix error ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();

      // TODO: map Mathpix response fields to the provider interface.
      // Actual field names depend on the Mathpix API version you are using.
      return {
        latex: json.latex_simplified ?? '',
        confidence: json.confidence,
        alternatives: json.alternatives,
      };
    },
  };
}

// Usage:
// editor.setImageProvider(makeMathpixProvider({
//   endpoint: 'https://api.mathpix.com/v3/text',
//   appId: 'your_app_id',
//   appKey: 'your_app_key',
// }));
```

### MyScript-style HTTP ink provider

```js
function makeMyScriptProvider({ endpoint, applicationKey, hmacKey }) {
  return {
    name: 'MyScript',

    async recognise(strokes, options = {}) {
      // TODO: format strokes to MyScript's strokeGroups/pointerEvents shape.
      // Actual request/response format depends on the MyScript iink REST API version.
      const body = JSON.stringify({
        configuration: { lang: 'en_US' },
        // strokes: strokes.map(stroke => ({ ... })),
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'applicationKey': applicationKey,
          // HMAC computation omitted — see MyScript documentation
        },
        body,
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`MyScript error ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();

      // TODO: extract LaTeX from the MyScript response.
      return {
        latex: json.exports?.['application/x-latex'] ?? '',
      };
    },
  };
}

// Usage:
// editor.setInkProvider(makeMyScriptProvider({
//   endpoint: 'https://webdemoapi.myscript.com/api/v4.0/iink/batch',
//   applicationKey: 'your_application_key',
//   hmacKey: 'your_hmac_key',
// }));
```

---

## Privacy and consent

When `insertFromImage` or `insertFromInk` is called with a real provider, the image or stroke data is transmitted to a third-party service. This data **leaves the user's device**.

Host pages that integrate a real recognition provider must:

1. Inform users that recognition data is sent to a third party.
2. Obtain any consent required by applicable law (e.g. GDPR, Australian Privacy Act).
3. Disclose the data transfer in the page's privacy policy.

The stub provider (`makeStubProvider`) processes all data locally and makes no network requests.
