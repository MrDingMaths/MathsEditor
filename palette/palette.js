// @ts-check
'use strict';

window.MathsEditor = window.MathsEditor || {};

(function () {
  // ── State ────────────────────────────────────────────────────────────────────

  /** @type {HTMLDivElement|null} */
  let _el = null;
  /** @type {HTMLInputElement|null} */
  let _searchInput = null;
  /** @type {HTMLUListElement|null} */
  let _resultsList = null;

  /** @type {Element|null} */
  let _anchor = null;
  /** @type {{ onInsert: (latex: string) => void, onClose: (reason: string) => void }|null} */
  let _options = null;

  let _open = false;
  let _highlightIndex = -1;
  /** @type {HTMLLIElement[]} */
  let _visibleItems = [];

  // Bound listeners stored so they can be removed cleanly
  let _boundResize = null;
  let _boundMousedown = null;
  let _builtFor = null; // catalogue reference used when DOM was last built

  // ── Pure filter function ─────────────────────────────────────────────────────

  /**
   * Filter catalogue entries by query string.
   * Returns all entries when query is empty (for grouped display).
   * Otherwise returns three tiers: name-prefix, alias-prefix, substring.
   *
   * @param {string} query
   * @param {Array} catalogue
   * @returns {Array}
   */
  function filter(query, catalogue) {
    if (!query) return catalogue;
    const q = query.toLowerCase();
    const tier1 = [], tier2 = [], tier3 = [];
    for (const entry of catalogue) {
      const nameLower = entry.name.toLowerCase();
      if (nameLower.startsWith(q)) {
        tier1.push(entry);
        continue;
      }
      const aliases = entry.aliases || [];
      if (aliases.some(a => a.toLowerCase().startsWith(q))) {
        tier2.push(entry);
        continue;
      }
      if (nameLower.includes(q) || aliases.some(a => a.toLowerCase().includes(q))) {
        tier3.push(entry);
      }
    }
    return [...tier1, ...tier2, ...tier3];
  }

  // ── DOM construction ─────────────────────────────────────────────────────────

  function _buildDOM(catalogue) {
    _el = document.createElement('div');
    _el.className = 'me-palette';
    _el.setAttribute('role', 'dialog');
    _el.setAttribute('aria-modal', 'true');
    _el.hidden = true;

    _searchInput = document.createElement('input');
    _searchInput.className = 'me-palette-search';
    _searchInput.placeholder = 'Start typing to search';
    _searchInput.autocomplete = 'off';
    _searchInput.spellcheck = false;
    _el.appendChild(_searchInput);

    _resultsList = document.createElement('ul');
    _resultsList.className = 'me-palette-results';
    _resultsList.setAttribute('role', 'listbox');
    _el.appendChild(_resultsList);

    // Build one group header + one item per catalogue entry
    const categories = [];
    const categoryMap = new Map();

    for (const entry of catalogue) {
      if (!categoryMap.has(entry.category)) {
        categoryMap.set(entry.category, []);
        categories.push(entry.category);
      }
      categoryMap.get(entry.category).push(entry);
    }

    for (const cat of categories) {
      const groupEl = document.createElement('li');
      groupEl.className = 'me-palette-group';
      groupEl.dataset.category = cat;
      groupEl.textContent = cat;
      groupEl.setAttribute('aria-hidden', 'true');
      _resultsList.appendChild(groupEl);

      for (const entry of categoryMap.get(cat)) {
        const itemEl = document.createElement('li');
        itemEl.className = 'me-palette-item';
        itemEl.setAttribute('role', 'option');
        itemEl.setAttribute('tabindex', '-1');
        itemEl.dataset.id = entry.id;
        itemEl.dataset.category = entry.category;
        itemEl.dataset.name = entry.name.toLowerCase();
        itemEl.dataset.aliases = (entry.aliases || []).join('\t').toLowerCase();

        const previewEl = document.createElement('span');
        previewEl.className = 'me-palette-preview';
        previewEl.innerHTML = _renderPreview(entry.preview);
        itemEl.appendChild(previewEl);

        const nameEl = document.createElement('span');
        nameEl.className = 'me-palette-name';
        nameEl.textContent = entry.name;
        itemEl.appendChild(nameEl);

        itemEl.addEventListener('mousedown', (e) => {
          // mousedown (not click) so it fires before the palette loses focus
          e.preventDefault();
          _accept(entry.id);
        });

        _resultsList.appendChild(itemEl);
      }
    }

    _searchInput.addEventListener('input', _onSearchInput);
    _searchInput.addEventListener('keydown', _onSearchKeydown);

    document.body.appendChild(_el);
    _builtFor = catalogue;
  }

  function _renderPreview(latexStr) {
    if (typeof MathLive !== 'undefined' && typeof MathLive.convertLatexToMarkup === 'function') {
      try {
        return MathLive.convertLatexToMarkup(latexStr);
      } catch (_) { /* fall through */ }
    }
    const mf = document.createElement('math-field');
    mf.setAttribute('readonly', '');
    mf.textContent = latexStr;
    return mf.outerHTML;
  }

  // ── Positioning ───────────────────────────────────────────────────────────────

  function _position() {
    if (!_el || !_anchor) return;
    const rect = _anchor.getBoundingClientRect();
    const paletteHeight = _el.offsetHeight || 360;
    const gap = 4;

    let top = rect.bottom + gap;
    // Flip above if not enough room below
    if (top + paletteHeight > window.innerHeight) {
      top = rect.top - paletteHeight - gap;
    }

    let left = rect.left;
    const width = parseInt(getComputedStyle(_el).getPropertyValue('--me-palette-width') || '320', 10);
    if (left + width > window.innerWidth) {
      left = Math.max(0, window.innerWidth - width - 8);
    }

    _el.style.top = `${Math.max(0, top)}px`;
    _el.style.left = `${Math.max(0, left)}px`;
  }

  // ── Filtering / highlight ─────────────────────────────────────────────────────

  function _applyFilter(query) {
    if (!_el) return;
    const catalogue = window.MathsEditor.catalogue || [];
    const matches = filter(query, catalogue);
    const matchIds = new Set(matches.map(e => e.id));
    const hasQuery = query.length > 0;

    // Show/hide items and group headers
    const groups = _resultsList.querySelectorAll('.me-palette-group');
    groups.forEach(g => {
      g.hidden = hasQuery;
    });

    const items = /** @type {NodeListOf<HTMLLIElement>} */ (
      _resultsList.querySelectorAll('.me-palette-item')
    );
    items.forEach(item => {
      item.hidden = !matchIds.has(item.dataset.id);
      item.setAttribute('aria-selected', 'false');
    });

    // Rebuild visible items list
    _visibleItems = [...items].filter(item => !item.hidden);
    _highlightIndex = -1;

    if (_visibleItems.length > 0) {
      _setHighlight(0);
    }
  }

  function _setHighlight(index) {
    if (_visibleItems.length === 0) return;
    // Clamp with wrap
    index = ((index % _visibleItems.length) + _visibleItems.length) % _visibleItems.length;

    if (_highlightIndex >= 0 && _highlightIndex < _visibleItems.length) {
      _visibleItems[_highlightIndex].setAttribute('aria-selected', 'false');
    }
    _highlightIndex = index;
    const target = _visibleItems[_highlightIndex];
    target.setAttribute('aria-selected', 'true');
    target.scrollIntoView({ block: 'nearest' });
  }

  // ── Accept / close ────────────────────────────────────────────────────────────

  function _accept(id) {
    const catalogue = window.MathsEditor.catalogue || [];
    const entry = catalogue.find(e => e.id === id);
    if (!entry) return;
    if (_options && _options.onInsert) {
      _options.onInsert(entry.latex);
    }
    _closeInternal('insert');
  }

  function _acceptHighlighted() {
    if (_highlightIndex < 0 || _highlightIndex >= _visibleItems.length) return;
    const id = _visibleItems[_highlightIndex].dataset.id;
    _accept(id);
  }

  function _closeInternal(reason) {
    if (!_el) return;
    _el.hidden = true;
    _open = false;

    if (_boundResize) {
      window.removeEventListener('resize', _boundResize);
      _boundResize = null;
    }
    if (_boundMousedown) {
      document.removeEventListener('mousedown', _boundMousedown, true);
      _boundMousedown = null;
    }

    if (_options && _options.onClose) {
      _options.onClose(reason);
    }
    _options = null;
    _anchor = null;
  }

  // ── Search input event handlers ───────────────────────────────────────────────

  function _onSearchInput() {
    _applyFilter(_searchInput.value);
  }

  function _onSearchKeydown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        _setHighlight(_highlightIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        _setHighlight(_highlightIndex - 1);
        break;
      case 'Enter':
        e.preventDefault();
        _acceptHighlighted();
        break;
      case 'Escape':
        e.preventDefault();
        _closeInternal('escape');
        break;
      case 'Tab':
        e.preventDefault();
        _closeInternal('tab');
        break;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  window.MathsEditor.Palette = {
    /**
     * Open the palette anchored to anchorElement.
     * @param {Element} anchorElement - The focused math-field.
     * @param {{ onInsert: (latex: string) => void, onClose: (reason: string) => void }} options
     */
    open(anchorElement, options) {
      const catalogue = window.MathsEditor.catalogue || [];

      // Build DOM on first open, or if catalogue changed
      if (!_el || _builtFor !== catalogue) {
        if (_el) _el.remove();
        _buildDOM(catalogue);
      }

      // If already open (shouldn't normally happen), close first
      if (_open) {
        _closeInternal('replaced');
      }

      _anchor = anchorElement;
      _options = options;
      _open = true;

      // Propagate the nearest data-theme to the palette so per-instance theming works.
      // The palette lives at document.body level, outside any editor's CSS cascade.
      let _themeNode = /** @type {Element|null} */ (anchorElement);
      let _theme = null;
      while (_themeNode) {
        if (_themeNode.hasAttribute('data-theme')) {
          _theme = _themeNode.getAttribute('data-theme');
          break;
        }
        _themeNode = _themeNode.parentElement;
      }
      if (_theme === null && document.documentElement.hasAttribute('data-theme')) {
        _theme = document.documentElement.getAttribute('data-theme');
      }
      if (_theme !== null) {
        _el.setAttribute('data-theme', _theme);
      } else {
        _el.removeAttribute('data-theme');
      }

      // Reset search
      _searchInput.value = '';
      _applyFilter('');

      // Show and position
      _el.hidden = false;
      _position();

      // Focus the search input
      _searchInput.focus();

      // Re-position on resize
      _boundResize = _position.bind(null);
      window.addEventListener('resize', _boundResize);

      // Click-outside detection (capture phase, mousedown so palette gets it first)
      _boundMousedown = (e) => {
        if (_el && !_el.contains(e.target)) {
          _closeInternal('click-outside');
        }
      };
      document.addEventListener('mousedown', _boundMousedown, true);
    },

    close() {
      if (_open) _closeInternal('programmatic');
    },

    isOpen() {
      return _open;
    },
  };
})();
