// Versioned print and editor defaults. Explicit document properties take precedence.
export const BOOKLET_HOUSE_STYLE = Object.freeze({
  version: '1.0.0', name: 'MathsMap booklet',
  colours: Object.freeze({ ink:'#24282d', blue:'#268cff', red:'#ef6068', green:'#4f9b63', orange:'#ef8b2c', tableLabel:'#d3e8fc', border:'#cccccc', skipped:'#c7c7c7' }),
  typography: Object.freeze({ bodyPt:11, bodyLineHeight:1.32, keyIdeasLineHeight:1.5 }),
  tables: Object.freeze({ borderMm:.2, paddingMm:1, numericWidthMm:10, labelWidthMm:38, skippedWidthMm:4 }),
});
export function clozeWidthMm(answer='') {
  const length=String(answer).replace(/\$|\\[a-z]+|[{}]/gi,'').trim().length;
  return length ? Math.max(8,Math.min(100,Math.ceil(length*2.2+6))) : 24;
}
export function houseStyleVariables(version) {
  if(version!==BOOKLET_HOUSE_STYLE.version)return '';
  return '--document-cloze-line:none;--document-cloze-dots:block;--document-table-cloze-dots:none;--document-table-cloze-line:none;--booklet-key-ideas-line-height:1.5;';
}
export const HOUSE_STYLE_PROMPT = `House style ${BOOKLET_HOUSE_STYLE.version}: preserve source teaching arrangements, source order, every meaningful heading, exam attribution and scaffold. Use dotted cloze with widths suited to handwritten answers; key ideas lineHeight 1.5. Keep question numbers and part labels outside prompt prose. Use native maths for variables and numeric table values. Tables have blue ${BOOKLET_HOUSE_STYLE.colours.tableLabel} label cells, ${BOOKLET_HOUSE_STYLE.colours.border} thin borders, compact numeric columns and wider worded labels. Skipped-value columns are narrow grey ${BOOKLET_HOUSE_STYLE.colours.skipped}; they are not student response cells. Preserve table arrows and graph lines, labelled intersections and annotations. Use blue ${BOOKLET_HOUSE_STYLE.colours.blue}, red ${BOOKLET_HOUSE_STYLE.colours.red} and green ${BOOKLET_HOUSE_STYLE.colours.green} consistently by meaning. Plots use blue #268cff for the primary graph and orange #ef8b2c for a secondary graph on the same axes. Axes and grids stay neutral. Keep semantic algebra annotation colours. No duplicate blanks when scaffolds supply the response area. Do not align independent equations as a solution chain. Do not hide omitted content by shrinking or replacing it with images. Flag unsupported features.`;
