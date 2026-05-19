// @ts-check
'use strict';

window.MathsEditor = window.MathsEditor || {};

/**
 * Parse a $...$-delimited string into a segments array.
 * @param {string} str
 * @returns {Array<{type:'text',value:string}|{type:'math',latex:string}>}
 */
window.MathsEditor.parse = function parse(str) {
  // Step 1: Collect positions of unescaped $ delimiters.
  // A $ is unescaped when the count of consecutive backslashes immediately
  // before it is even (including zero). Odd count means it is escaped.
  const delimPositions = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== '$') continue;
    let bsCount = 0;
    let j = i - 1;
    while (j >= 0 && str[j] === '\\') { bsCount++; j--; }
    if (bsCount % 2 === 0) delimPositions.push(i);
  }

  // Step 2: Odd number of delimiters → last one is unbalanced.
  let warnUnbalanced = false;
  if (delimPositions.length % 2 === 1) {
    warnUnbalanced = true;
    delimPositions.pop();
  }

  // Step 3: Build raw slices from delimiter pairs.
  // rawParts alternates: text, math, text, math …
  // We collect them as {type, raw|latex} objects before decoding.
  const rawParts = [];
  let pos = 0;

  for (let d = 0; d < delimPositions.length; d += 2) {
    const openPos  = delimPositions[d];
    const closePos = delimPositions[d + 1];

    if (openPos > pos) {
      rawParts.push({ type: 'text', raw: str.slice(pos, openPos) });
    }

    const latex = str.slice(openPos + 1, closePos);
    if (latex.length > 0) {
      rawParts.push({ type: 'math', latex });
    }
    // Empty latex ($$) produces no segment — silently dropped.

    pos = closePos + 1;
  }

  // Remaining tail after the last delimiter pair (or the whole string if none).
  if (pos < str.length) {
    rawParts.push({ type: 'text', raw: str.slice(pos) });
  }

  // Step 4: Decode text raws and merge adjacent text segments.
  // Only \$ → $ is decoded inside text; maths content is opaque.
  const segments = [];

  for (const part of rawParts) {
    if (part.type === 'math') {
      segments.push({ type: 'math', latex: part.latex });
    } else {
      const value = part.raw.replace(/\\\$/g, '$');
      const last = segments[segments.length - 1];
      if (last && last.type === 'text') {
        last.value += value;
      } else {
        segments.push({ type: 'text', value });
      }
    }
  }

  if (warnUnbalanced) {
    console.warn(
      'maths-editor serialiser: unbalanced $ in input — ' +
      'the trailing $ and everything after it has been treated as literal text.'
    );
  }

  return segments;
};

/**
 * Serialise a segments array back to a $...$-delimited string.
 * @param {Array<{type:'text',value:string}|{type:'math',latex:string}>} segments
 * @returns {string}
 */
window.MathsEditor.stringify = function stringify(segments) {
  let result = '';
  for (const seg of segments) {
    if (seg.type === 'text') {
      // Encode literal $ in text values as \$
      result += seg.value.replace(/\$/g, () => '\\$');
    } else {
      result += '$' + seg.latex + '$';
    }
  }
  return result;
};
