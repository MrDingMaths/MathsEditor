import { toSource, fromSource } from './document-model.mjs';
import { DocumentEditor } from './document-editor.js';
// @ts-check
'use strict';

const _window = /** @type {any} */ (window);

class MathsEditor extends HTMLElement {
  static get observedAttributes() {
    return ['placeholder', 'readonly', 'value'];
  }

  // Private fields
  #connected;
  #composing;
  #focusSnapshot;
  #focusedIsland;
  #mathInputHandlers;
  #mutationObserver;
  #paletteOpen;
  #pendingDeleteIsland;
  #imageProvider;
  #inkProvider;
  #imageController;
  #inkController;

  constructor() {
    super();
    /** @type {HTMLDivElement} */
    this._content = null;
    this.#composing = false;
    this.#focusSnapshot = '';
    this.#connected = false;
    this.#focusedIsland = null;
    this.#mathInputHandlers = new Map();
    this.#mutationObserver = null;
    this.#paletteOpen = false;
    this.#pendingDeleteIsland = null;
    this.#imageProvider = null;
    this.#inkProvider = null;
    this.#imageController = null;
    this.#inkController = null;

    // Bind event handlers once so they can be removed cleanly
    this._onKeydown = this.#onKeydown.bind(this);
    this._onPaste = this.#onPaste.bind(this);
    this._onCompositionStart = this.#onCompositionStart.bind(this);
    this._onCompositionEnd = this.#onCompositionEnd.bind(this);
    this._onInput = this.#onInput.bind(this);
    this._onFocus = this.#onFocus.bind(this);
    this._onBlur = this.#onBlur.bind(this);
    this._onMoveOut = this.#onMoveOut.bind(this);
    this._onHostBlur = this.#onHostBlur.bind(this);
    this._onMousedown = this.#onMousedown.bind(this);
    this._onCopy = this.#onCopy.bind(this);
    this._onCut = this.#onCut.bind(this);
    this._onSelectionChange = this.#onSelectionChange.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  connectedCallback() {
    if (this.#connected) return;
    this.#connected = true;
    if (this.hasAttribute('structured')) { this.documentController = new DocumentEditor(this); this._content = this.documentController.surface; }
    else this.#buildDOM();
  }

  disconnectedCallback() {
    if (!this._content) return;
    document.removeEventListener('selectionchange', this._onSelectionChange);
    this.removeEventListener('keydown', this._onKeydown, true);
    this.removeEventListener('move-out', this._onMoveOut);
    this.removeEventListener('blur', this._onHostBlur, true);
    this.removeEventListener('mousedown', this._onMousedown, true);
    this._content.removeEventListener('paste', this._onPaste);
    this._content.removeEventListener('copy', this._onCopy);
    this._content.removeEventListener('cut', this._onCut);
    this._content.removeEventListener('compositionstart', this._onCompositionStart);
    this._content.removeEventListener('compositionend', this._onCompositionEnd);
    this._content.removeEventListener('input', this._onInput);
    this._content.removeEventListener('focus', this._onFocus);
    this._content.removeEventListener('blur', this._onBlur);
    this.#mutationObserver?.disconnect();
    this.#mutationObserver = null;
    for (const [mf, handler] of this.#mathInputHandlers) {
      mf.removeEventListener('input', handler);
    }
    this.#mathInputHandlers.clear();
  }

  attributeChangedCallback(name, _old, next) {
    switch (name) {
      case 'placeholder':
        if (this._content) this._content.dataset.mePlaceholder = next ?? '';
        break;
      case 'readonly':
        // Attribute present (any value) means readonly
        if (this._content) {
          this._content.contentEditable = next === null ? 'true' : 'false';
        }
        break;
      case 'value':
        // Only set content from attribute during initial upgrade (before
        // connectedCallback has run). After connection, use the property setter.
        if (!this.#connected && next !== null) {
          // Will be picked up in #buildDOM via this.getAttribute('value')
        } else if (this._content && next !== null) {
          this.#setContentSilently(next);
        }
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Reflected properties
  // ---------------------------------------------------------------------------

  get placeholder() {
    return this.getAttribute('placeholder') ?? '';
  }

  set placeholder(val) {
    if (val == null) {
      this.removeAttribute('placeholder');
    } else {
      this.setAttribute('placeholder', String(val));
    }
  }

  get readonly() {
    return this.hasAttribute('readonly');
  }

  set readonly(val) {
    if (val) {
      this.setAttribute('readonly', '');
    } else {
      this.removeAttribute('readonly');
    }
  }

  get document() { return this.documentController ? structuredClone(this.documentController.doc) : null; }

  set document(value) {
    if (!this.documentController) { this.disconnectedCallback(); this.documentController = new DocumentEditor(this, value); this._content = this.documentController.surface; }
    else this.documentController.set(value);
  }

  get value() {
    if (this.documentController) return toSource(this.documentController.doc);
    if (!this._content) return '';
    return this.#serializeValue();
  }

  set value(val) {
    if (this.documentController) { this.documentController.set(fromSource(String(val ?? ''))); return; }
    if (!this._content) return;
    this.#setContentSilently(String(val ?? ''));
  }

  get maths() {
    if (!this._content) return [];
    return [...this._content.querySelectorAll('.me-math-island')].map(island => {
      const mf = island.querySelector('math-field');
      return {
        latex: mf ? mf.getValue('latex') : '',
        mathJson: mf ? mf.getValue('math-json') : null,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  focus() {
    this._content?.focus();
  }

  blur() {
    this._content?.blur();
  }

  clear() {
    if (this.documentController) { this.documentController.set(fromSource('')); this.documentController.emit(); return; }
    if (!this._content) return;
    this.#setContentSilently('');
  }

  insertMath(latex = '') {
    if (this.documentController) return this.documentController.insertMath(latex);
    if (!this._content || this.readonly) return null;

    const island = document.createElement('span');
    island.className = 'me-math-island';
    island.contentEditable = 'false';

    const mf = document.createElement('math-field');
    if (latex) mf.value = latex;
    island.appendChild(mf);

    // Insert at caret, replacing any selection
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0
        && this._content.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(island);
      range.setStartAfter(island);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      this._content.appendChild(island);
    }

    this.#attachMathFieldListener(mf);

    // Wait for custom element definition before focusing (resolves immediately
    // if MathLive is already loaded, which it will be in normal usage)
    customElements.whenDefined('math-field').then(() => mf.focus());

    this.#syncEmpty();
    return mf;
  }

  toSegments() {
    if (!this._content) return [];
    return this.#toSegmentsFromDOM();
  }

  fromSegments(segments) {
    if (!this._content) return;
    this.#clearContent();
    this.#buildDOMFromSegments(segments);
    this.#syncEmpty();
  }

  // ---------------------------------------------------------------------------
  // Recognition — provider registration
  // ---------------------------------------------------------------------------

  setImageProvider(provider) {
    this.#imageProvider = provider ?? null;
  }

  setInkProvider(provider) {
    this.#inkProvider = provider ?? null;
  }

  // ---------------------------------------------------------------------------
  // Recognition — utility tier
  // ---------------------------------------------------------------------------

  recogniseImage(blob, options) {
    return this.#doRecognise('image', blob, options);
  }

  recogniseInk(strokes, options) {
    return this.#doRecognise('ink', strokes, options);
  }

  // ---------------------------------------------------------------------------
  // Recognition — insertion tier
  // ---------------------------------------------------------------------------

  async insertFromImage(blob, options) {
    const target = this.#captureInsertTarget();
    const result = await this.recogniseImage(blob, options);
    return this.#applyRecognitionResult(target, result.latex);
  }

  async insertFromInk(strokes, options) {
    const target = this.#captureInsertTarget();
    const result = await this.recogniseInk(strokes, options);
    return this.#applyRecognitionResult(target, result.latex);
  }

  // ---------------------------------------------------------------------------
  // Recognition — cancellation
  // ---------------------------------------------------------------------------

  cancelRecognition(kind) {
    let cancelled = false;
    if (kind === undefined || kind === 'image') {
      if (this.#imageController) {
        this.#imageController.abort();
        this.#imageController = null;
        cancelled = true;
      }
    }
    if (kind === undefined || kind === 'ink') {
      if (this.#inkController) {
        this.#inkController.abort();
        this.#inkController = null;
        cancelled = true;
      }
    }
    return cancelled;
  }

  // ---------------------------------------------------------------------------
  // Private — DOM construction
  // ---------------------------------------------------------------------------

  #buildDOM() {
    const div = document.createElement('div');
    div.className = 'me-content';
    div.contentEditable = this.hasAttribute('readonly') ? 'false' : 'true';
    div.spellcheck = false;
    div.dataset.mePlaceholder = this.getAttribute('placeholder') ?? '';

    this._content = div;

    // Set initial value from attribute if present
    const initialValue = this.getAttribute('value');
    if (initialValue) {
      this.#setContentSilently(initialValue);
    }

    this.appendChild(div);
    this.#syncEmpty();

    // keydown on the host in capture phase so we intercept Tab before MathLive's
    // internal placeholder-navigation handler runs inside the math-field
    this.addEventListener('keydown', this._onKeydown, true);
    // move-out: MathLive fires with composed:true, bubbles up to host
    this.addEventListener('move-out', this._onMoveOut);
    // capture-phase blur on host for click-out empty-island cleanup
    this.addEventListener('blur', this._onHostBlur, true);
    // mousedown anywhere inside clears the pending-delete highlight
    this.addEventListener('mousedown', this._onMousedown, true);

    div.addEventListener('paste', this._onPaste);
    div.addEventListener('copy', this._onCopy);
    div.addEventListener('cut', this._onCut);
    div.addEventListener('compositionstart', this._onCompositionStart);
    div.addEventListener('compositionend', this._onCompositionEnd);
    div.addEventListener('input', this._onInput);
    div.addEventListener('focus', this._onFocus);
    div.addEventListener('blur', this._onBlur);

    document.addEventListener('selectionchange', this._onSelectionChange);

    // Clean up math-field listeners when browser deletes islands natively
    this.#mutationObserver = new MutationObserver(r => this.#onMutation(r));
    this.#mutationObserver.observe(this._content, { childList: true });
  }

  // ---------------------------------------------------------------------------
  // Private — state helpers
  // ---------------------------------------------------------------------------

  #syncEmpty() {
    const nodes = this._content.childNodes;
    const isEmpty =
      nodes.length === 0 ||
      (nodes.length === 1 && nodes[0].nodeName === 'BR');
    this.classList.toggle('me-empty', isEmpty);
  }

  #toSegmentsFromDOM() {
    const segments = [];

    for (const node of this._content.childNodes) {
      if (node.nodeName === 'BR') {
        const last = segments[segments.length - 1];
        if (last && last.type === 'text') {
          last.value += '\n';
        } else {
          segments.push({ type: 'text', value: '\n' });
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const last = segments[segments.length - 1];
        if (last && last.type === 'text') {
          last.value += node.textContent;
        } else {
          segments.push({ type: 'text', value: node.textContent });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE
                 && node.classList.contains('me-math-island')) {
        const mf = node.querySelector('math-field');
        segments.push({ type: 'math', latex: mf ? mf.getValue('latex') : '' });
      }
    }

    // Chromium appends a trailing <br> to non-empty content; strip the
    // corresponding trailing \n from the last text segment.
    const lastChild = this._content.lastChild;
    if (lastChild && lastChild.nodeName === 'BR' && segments.length > 0) {
      const lastSeg = segments[segments.length - 1];
      if (lastSeg.type === 'text' && lastSeg.value.endsWith('\n')) {
        const stripped = lastSeg.value.slice(0, -1);
        if (stripped.length > 0 || segments.length > 1) {
          lastSeg.value = stripped;
          if (lastSeg.value === '') segments.pop();
        }
      }
    }

    return segments;
  }

  #serializeValue() {
    return _window.MathsEditor.stringify(this.#toSegmentsFromDOM());
  }

  #clearContent() {
    for (const [mf, handler] of this.#mathInputHandlers) {
      mf.removeEventListener('input', handler);
    }
    this.#mathInputHandlers.clear();
    this._content.textContent = '';
  }

  #buildFragmentFromSegments(segments) {
    const frag = document.createDocumentFragment();
    for (const seg of segments) {
      if (seg.type === 'text') {
        const lines = seg.value.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] !== '') frag.appendChild(document.createTextNode(lines[i]));
          if (i < lines.length - 1) frag.appendChild(document.createElement('br'));
        }
      } else if (seg.type === 'math') {
        const island = document.createElement('span');
        island.className = 'me-math-island';
        island.contentEditable = 'false';
        const mf = document.createElement('math-field');
        if (seg.latex) mf.value = seg.latex;
        island.appendChild(mf);
        frag.appendChild(island);
        this.#attachMathFieldListener(mf);
      }
    }
    return frag;
  }

  #buildDOMFromSegments(segments) {
    this._content.appendChild(this.#buildFragmentFromSegments(segments));

    // Place caret at end so focus lands in a predictable position.
    try {
      const range = document.createRange();
      range.selectNodeContents(this._content);
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    } catch (_) { /* no-op if document does not have focus */ }
  }

  #setContentSilently(str) {
    this.#clearContent();
    if (str !== '') {
      this.#buildDOMFromSegments(_window.MathsEditor.parse(str));
    }
    this.#syncEmpty();
  }

  #dispatchInput() {
    const value = this.#serializeValue();
    this.dispatchEvent(new CustomEvent('input', {
      bubbles: true,
      composed: false,
      detail: { value },
    }));
  }

  #attachMathFieldListener(mf) {
    const handler = (e) => {
      // Stop propagation so this event does not reach _content's input listener
      e.stopPropagation();

      const island = mf.closest('.me-math-island');
      const islands = [...this._content.querySelectorAll('.me-math-island')];
      const index = islands.indexOf(island);
      const latex = mf.getValue('latex');
      const mathJson = mf.getValue('math-json');

      this.dispatchEvent(new CustomEvent('maths-input', {
        bubbles: true,
        composed: false,
        detail: { index, latex, mathJson },
      }));
      this.#dispatchInput();
    };
    mf.addEventListener('input', handler);
    this.#mathInputHandlers.set(mf, handler);
  }

  #exitMathField(mf, position) {
    const island = mf.closest('.me-math-island');
    if (!island) return;

    const isEmpty = mf.getValue('latex').trim() === '';

    // Build range before any DOM removal so parent+offset remain valid
    const range = document.createRange();
    if (isEmpty || position === 'before') {
      range.setStartBefore(island);
    } else {
      range.setStartAfter(island);
    }
    range.collapse(true);

    // Move focus away BEFORE removing the island, so the math-field is blurred
    // (and MathLive's focus state torn down) while it is still in the DOM.
    // Removing a still-focused math-field leaves MathLive's focus tracking
    // stale, which makes a later programmatic .focus() on the next island fail.
    this._content.focus();
    if (isEmpty) island.remove(); // MutationObserver cleans up the listener

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    this.#focusedIsland = null;
    this.#syncEmpty();
    this.#dispatchInput();
  }

  // ---------------------------------------------------------------------------
  // Private — recognition helpers
  // ---------------------------------------------------------------------------

  async #doRecognise(kind, input, options) {
    const provider = kind === 'image' ? this.#imageProvider : this.#inkProvider;
    if (!provider) throw new Error(`No ${kind} provider registered`);

    // Auto-cancel any in-flight request of the same kind.
    this.cancelRecognition(kind);

    const controller = new AbortController();
    if (kind === 'image') this.#imageController = controller;
    else this.#inkController = controller;

    const signal = controller.signal;
    const startTime = Date.now();
    const providerName = provider.name ?? kind;
    let cancelDispatched = false;

    const dispatchCancel = () => {
      cancelDispatched = true;
      this.dispatchEvent(new CustomEvent('recognition-cancel', {
        bubbles: true,
        composed: false,
        detail: { kind, durationMs: Date.now() - startTime },
      }));
    };

    this.dispatchEvent(new CustomEvent('recognition-start', {
      bubbles: true,
      composed: false,
      detail: { kind, provider: providerName },
    }));

    try {
      const result = await provider.recognise(input, { ...options, signal });

      // Provider resolved after we cancelled — treat as a cancellation.
      if (controller.signal.aborted) {
        dispatchCancel();
        throw new DOMException('Recognition cancelled', 'AbortError');
      }

      this.dispatchEvent(new CustomEvent('recognition-success', {
        bubbles: true,
        composed: false,
        detail: {
          kind,
          latex: result.latex,
          confidence: result.confidence,
          alternatives: result.alternatives,
          durationMs: Date.now() - startTime,
        },
      }));
      return result;

    } catch (err) {
      if (err.name === 'AbortError') {
        if (!cancelDispatched) dispatchCancel();
        throw err;
      }
      this.dispatchEvent(new CustomEvent('recognition-error', {
        bubbles: true,
        composed: false,
        detail: { kind, error: err, durationMs: Date.now() - startTime },
      }));
      throw err;

    } finally {
      // Only null the stored controller if it is still ours — a newer request
      // may have already replaced it.
      if (kind === 'image' && this.#imageController === controller) {
        this.#imageController = null;
      } else if (kind === 'ink' && this.#inkController === controller) {
        this.#inkController = null;
      }
    }
  }

  #captureInsertTarget() {
    const active = document.activeElement;
    if (active && active.tagName.toLowerCase() === 'math-field' && this.contains(active)) {
      return { type: 'replace', mathField: active };
    }
    const sel = window.getSelection();
    const range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
    return { type: 'insert', range };
  }

  #applyRecognitionResult(target, latex) {
    if (typeof latex !== 'string' || latex === '') return null;
    if (target.type === 'replace') {
      target.mathField.value = latex;
      return target.mathField;
    }
    if (target.range) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(target.range);
      }
    }
    return this.insertMath(latex);
  }

  // ---------------------------------------------------------------------------
  // Private — event handlers
  // ---------------------------------------------------------------------------

  #onKeydown(e) {
    const active = document.activeElement;
    const inContent = active === this._content;
    const inMathField = active?.tagName?.toLowerCase() === 'math-field'
                        && this.contains(active);

    // Any key other than Backspace/Delete cancels the pending-delete highlight
    if (inContent && e.key !== 'Backspace' && e.key !== 'Delete') {
      this.#clearPendingDelete();
    }

    if (inContent && e.key === 'Enter') {
      e.preventDefault();
      // insertLineBreak inserts a <br> rather than a block element
      document.execCommand('insertLineBreak');
      return;
    }

    if (inContent && e.key === 'Tab') {
      e.preventDefault();
      if (this.#composing) return; // IME guard: Tab mid-composition is swallowed
      this.insertMath('');
      return;
    }

    if (inContent && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key === 'ArrowRight') {
        const island = this.#getAdjacentIsland('forward');
        if (island) {
          e.preventDefault();
          /** @type {HTMLElement | null} */ (island.querySelector('math-field'))?.focus();
          return;
        }
      }
      if (e.key === 'ArrowLeft') {
        const island = this.#getAdjacentIsland('backward');
        if (island) {
          e.preventDefault();
          const mf = /** @type {any} */ (island.querySelector('math-field'));
          if (mf) {
            mf.focus();
            queueMicrotask(() => mf.executeCommand('moveToMathFieldEnd'));
          }
          return;
        }
      }
    }

    // Backspace with caret immediately after an island: two-press confirm delete
    if (inContent && e.key === 'Backspace') {
      const island = this.#getAdjacentIsland('backward');
      if (island) {
        e.preventDefault();
        if (this.#pendingDeleteIsland === island) {
          island.remove();
          this.#pendingDeleteIsland = null;
          this.#syncEmpty();
          this.#dispatchInput();
        } else {
          this.#clearPendingDelete();
          this.#pendingDeleteIsland = island;
          island.classList.add('me-island-pending-delete');
        }
        return;
      }
      this.#clearPendingDelete();
    }

    // Delete with caret immediately before an island: two-press confirm delete
    if (inContent && e.key === 'Delete') {
      const island = this.#getAdjacentIsland('forward');
      if (island) {
        e.preventDefault();
        if (this.#pendingDeleteIsland === island) {
          island.remove();
          this.#pendingDeleteIsland = null;
          this.#syncEmpty();
          this.#dispatchInput();
        } else {
          this.#clearPendingDelete();
          this.#pendingDeleteIsland = island;
          island.classList.add('me-island-pending-delete');
        }
        return;
      }
      this.#clearPendingDelete();
    }

    if (inMathField && e.key === 'Tab') {
      if (_window.MathsEditor?.Palette?.isOpen()) return; // palette handles its own Tab
      e.preventDefault();
      e.stopPropagation();
      if (!_window.MathsEditor?.Palette) return; // palette not loaded
      this.#paletteOpen = true;
      _window.MathsEditor.Palette.open(active, {
        onInsert: (latex) => {
          active.executeCommand(['insert', latex]);
        },
        onClose: (_reason) => {
          this.#paletteOpen = false;
          active.focus();
        },
      });
      return;
    }

    if (inMathField && e.key === 'Escape') {
      e.preventDefault();
      this.#exitMathField(active, 'after');
      return;
    }
    // All other keys in math-field: pass through to MathLive unchanged
  }

  #clearPendingDelete() {
    if (this.#pendingDeleteIsland) {
      this.#pendingDeleteIsland.classList.remove('me-island-pending-delete');
      this.#pendingDeleteIsland = null;
    }
  }

  #onMousedown() {
    this.#clearPendingDelete();
  }

  #onSelectionChange() {
    if (!this._content) return;
    const sel = window.getSelection();
    const islands = this._content.querySelectorAll('.me-math-island');
    islands.forEach(island => {
      let selected = false;
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        selected = sel.getRangeAt(0).intersectsNode(island);
      }
      island.classList.toggle('me-island-selected', selected);
    });
  }

  #getAdjacentIsland(direction) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!this._content.contains(range.startContainer)) return null;

    const node = range.startContainer;
    const offset = range.startOffset;
    let candidate = null;

    if (direction === 'forward') {
      if (node.nodeType === Node.TEXT_NODE) {
        if (offset === node.length) candidate = node.nextSibling;
      } else {
        candidate = node.childNodes[offset] ?? null;
      }
    } else {
      if (node.nodeType === Node.TEXT_NODE) {
        if (offset === 0) candidate = node.previousSibling;
      } else {
        candidate = offset > 0 ? node.childNodes[offset - 1] : null;
      }
    }

    return (candidate instanceof Element && candidate.classList.contains('me-math-island'))
      ? candidate : null;
  }

  #onMoveOut(e) {
    const { direction } = e.detail;
    // Only handle horizontal exits; let up/down fall through to MathLive's plonk
    if (direction !== 'forward' && direction !== 'backward') return;
    e.preventDefault(); // suppress MathLive's plonk sound for handled directions
    // composed:true means e.target is the <math-field> element (light DOM)
    this.#exitMathField(e.target, direction === 'forward' ? 'after' : 'before');
  }

  #onHostBlur(e) {
    // While the palette is open the math-field loses focus to the palette input,
    // but we must not remove the empty island during that window.
    if (this.#paletteOpen) return;

    const losing = e.target;
    const gaining = e.relatedTarget;

    if (losing?.tagName?.toLowerCase() === 'math-field' && this.contains(losing)) {
      // Focus is leaving a math-field inside this editor
      if (!gaining || !this.contains(gaining)) {
        // Focus left the editor entirely — apply empty-on-exit rule
        const island = losing.closest('.me-math-island');
        if (island) {
          const isEmpty = losing.getValue('latex').trim() === '';
          if (isEmpty) {
            island.remove();
            this.#syncEmpty();
            this.#dispatchInput();
          }
        }
        this.#focusedIsland = null;
      }
    }
  }

  #onMutation(records) {
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node.classList?.contains('me-math-island')) {
          const mf = node.querySelector('math-field');
          if (mf) {
            const handler = this.#mathInputHandlers.get(mf);
            if (handler) {
              mf.removeEventListener('input', handler);
              this.#mathInputHandlers.delete(mf);
            }
          }
          if (this.#focusedIsland === node) this.#focusedIsland = null;
          if (this.#pendingDeleteIsland === node) this.#pendingDeleteIsland = null;
        }
      }
    }
    this.#syncEmpty();
  }

  #onCopy(e) {
    // Let MathLive handle copy when a math-field is focused
    const active = document.activeElement;
    if (active?.tagName?.toLowerCase() === 'math-field' && this.contains(active)) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!this._content.contains(range.commonAncestorContainer)) return;

    e.preventDefault();
    const text = _window.MathsEditor.serialiseSelection(range, this._content);
    e.clipboardData.setData('text/plain', text);
  }

  #onCut(e) {
    const active = document.activeElement;
    if (active?.tagName?.toLowerCase() === 'math-field' && this.contains(active)) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!this._content.contains(range.commonAncestorContainer)) return;

    e.preventDefault();
    const text = _window.MathsEditor.serialiseSelection(range, this._content);
    e.clipboardData.setData('text/plain', text);

    // Delete the selection; MutationObserver cleans up island listeners
    range.deleteContents();
    this.#syncEmpty();
    this.#dispatchInput();
  }

  #onPaste(e) {
    e.preventDefault();
    let text = e.clipboardData.getData('text/plain');
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!text) return;

    // Parse once; if any math segment results, use the maths insertion path.
    // Otherwise fall back to plain-text insert (preserves phase 2 behaviour).
    const segments = _window.MathsEditor.parse(text);
    const hasMaths = segments.some(s => s.type === 'math');

    if (hasMaths) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!this._content.contains(range.commonAncestorContainer)) return;

      if (!range.collapsed) range.deleteContents();

      const frag = this.#buildFragmentFromSegments(segments);
      const lastNode = frag.lastChild;  // save before insertNode empties the fragment
      range.insertNode(frag);

      // Place caret immediately after the last inserted node
      if (lastNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }

      this.#syncEmpty();
      this.#dispatchInput();            // one event regardless of island count
    } else {
      // Plain text — execCommand fires the browser's input event via #onInput
      document.execCommand('insertText', false, text);
    }
  }

  #onCompositionStart() {
    this.#composing = true;
  }

  #onCompositionEnd() {
    this.#composing = false;
    // Fire the input event now that composition is committed
    this.#syncEmpty();
    this.#dispatchInput();
  }

  #onInput(e) {
    // Guard: math-field input events should have been stopped by the per-island
    // handler; this is a safety net for any that slip through
    if (e.target?.tagName?.toLowerCase() === 'math-field') return;
    if (this.#composing) return;
    // Stop the native InputEvent here — we replace it with our own custom
    // 'input' event (dispatched by #dispatchInput) that carries e.detail.value
    e.stopPropagation();
    this.#syncEmpty();
    this.#dispatchInput();
  }

  #onFocus(e) {
    // If focus returned from a math-field inside this editor (e.g. after Esc),
    // the value has not changed — keep the existing snapshot
    const prev = e.relatedTarget;
    if (prev?.tagName?.toLowerCase() === 'math-field' && this.contains(prev)) return;
    this.#focusSnapshot = this.#serializeValue();
  }

  #onBlur(e) {
    // If focus moved to a math-field inside this editor, this is an internal
    // transfer — do not fire `change`
    const next = e.relatedTarget;
    if (next?.tagName?.toLowerCase() === 'math-field' && this.contains(next)) return;

    const current = this.#serializeValue();
    if (current !== this.#focusSnapshot) {
      this.dispatchEvent(new CustomEvent('change', {
        bubbles: true,
        composed: false,
        detail: { value: current },
      }));
    }
  }
}

customElements.define('maths-editor', MathsEditor);
