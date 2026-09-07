// Fixed-size vector dots avoid Chromium's width-dependent dotted-border spacing.
export function clozeLeader(width) {
 const mm=Math.max(1,Math.min(120,Number(width)||24));let circles='';
 for(let x=.3;x<mm-.1;x+=.8)circles+=`<circle cx="${x.toFixed(2)}" cy=".2" r=".13"/>`;
 return `<svg data-cloze-leader aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mm} .5" style="display:var(--document-cloze-dots,none);position:absolute;bottom:-.3mm;left:0;width:${mm}mm;height:.5mm;fill:currentColor;pointer-events:none">${circles}</svg>`;
}
