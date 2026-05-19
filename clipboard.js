// @ts-check
'use strict';

window.MathsEditor = window.MathsEditor || {};

/**
 * Serialise the given Selection Range to a $...$-delimited string.
 *
 * Walks the direct children of hostElement that fall within the range,
 * building a segments array:
 *   - Text nodes   → 'text' segment, respecting startOffset/endOffset on
 *                    boundary nodes.
 *   - <br>         → '\n' appended to the current text segment.
 *   - .me-math-island → 'math' segment with the child math-field's LaTeX.
 *   - Other elements → recurse into children (future-proofing; not reached
 *                      in the current flat document structure).
 *
 * Adjacent text segments are merged. Returns the result of
 * MathsEditor.stringify(segments).
 *
 * @param {Range}       range
 * @param {HTMLElement} hostElement   The editor's _content div.
 * @returns {string}
 */
window.MathsEditor.serialiseSelection = function serialiseSelection(range, hostElement) {
  const segments = [];

  function addText(str) {
    if (!str) return;
    const last = segments[segments.length - 1];
    if (last && last.type === 'text') last.value += str;
    else segments.push({ type: 'text', value: str });
  }

  function walkChildren(parent) {
    for (const node of parent.childNodes) {
      if (!range.intersectsNode(node)) continue;

      if (node.nodeType === Node.TEXT_NODE) {
        const start = (node === range.startContainer) ? range.startOffset : 0;
        const end   = (node === range.endContainer)   ? range.endOffset   : node.textContent.length;
        addText(node.textContent.slice(start, end));
      } else if (node.nodeName === 'BR') {
        addText('\n');
      } else if (node.nodeType === Node.ELEMENT_NODE
                 && /** @type {Element} */ (node).classList.contains('me-math-island')) {
        const mf = node.querySelector('math-field');
        segments.push({ type: 'math', latex: mf ? mf.getValue('latex') : '' });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        walkChildren(node);
      }
    }
  }

  walkChildren(hostElement);

  return window.MathsEditor.stringify(segments);
};
