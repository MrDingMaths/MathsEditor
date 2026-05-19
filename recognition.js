// @ts-check
'use strict';

window.MathsEditor = window.MathsEditor || {};

/**
 * Creates a stub recognition provider for testing.
 *
 * @param {{
 *   kind: 'image' | 'ink',
 *   delay?: number,
 *   response?: string,
 *   failureMode?: null | 'error' | 'timeout' | 'invalid' | 'no-match',
 *   name?: string,
 * }} config
 * @returns {{ name: string, recognise: Function }}
 */
window.MathsEditor.makeStubProvider = function makeStubProvider(config) {
  const {
    kind,
    delay = 800,
    response = '\\frac{1}{2}',
    failureMode = null,
    name = 'Stub',
  } = config;

  if (kind !== 'image' && kind !== 'ink') {
    throw new Error(`makeStubProvider: kind must be 'image' or 'ink', got '${kind}'`);
  }

  return {
    name,

    recognise(input, options = {}) {
      const signal = options.signal ?? null;

      if (failureMode === 'error') {
        return Promise.reject(new Error('Stub provider error'));
      }

      return new Promise((resolve, reject) => {
        function onAbort() {
          reject(new DOMException('Recognition cancelled', 'AbortError'));
        }

        if (signal) {
          if (signal.aborted) { onAbort(); return; }
          signal.addEventListener('abort', onAbort, { once: true });
        }

        if (failureMode === 'timeout') {
          // Never resolves; only the abort path above can settle it.
          return;
        }

        const timer = setTimeout(() => {
          if (signal) signal.removeEventListener('abort', onAbort);

          if (failureMode === 'invalid') {
            resolve({ latex: 42 }); // non-string to exercise type-check path
          } else if (failureMode === 'no-match') {
            resolve({ latex: '' });
          } else {
            resolve({ latex: response });
          }
        }, delay);

        if (signal) {
          signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
        }
      });
    },
  };
};
