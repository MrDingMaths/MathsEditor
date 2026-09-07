import {normalizeAnnotatedEquation,renderAnnotatedEquation} from './annotated-equation.mjs';
import {clozeLeader} from './cloze-leader.mjs';
import { clozeWidthMm } from './house-style.mjs';
import { tableGrid } from './table-model.mjs';
export const DOCUMENT_FORMAT = 'maths-editor-document-v1';
export const DOCUMENT_VERSION = 1;
export const copy = value => JSON.parse(JSON.stringify(value));
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `me-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const limit = (v, fallback, min = 0, max = 300) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
const colour = (v,fallback) => /^#[0-9a-f]{6}$/i.test(v??'')?v:fallback;
const choice = (v, values, fallback) => values.includes(v) ? v : fallback;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
export function safeImage(src) {
  const value = String(src ?? '');
  return /^(data:image\/(png|jpeg|webp|gif);base64,|https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(value) ? value : '';
}
export const paragraph = (inlines = []) => ({ id: uid(), type: 'paragraph', inlines });
export const sourceBullet = line => /^([ \t]*)[-+*•◦▪]\s+(.*)$/.exec(line);
export function sourceListMarker(line){const bullet=sourceBullet(line);if(bullet)return {indent:bullet[1].replace(/\t/g,'    ').length,text:bullet[2],ordered:false};const numbered=/^([ \t]*)(\d+)[.)]\s+(.*)$/.exec(line);return numbered?{indent:numbered[1].replace(/\t/g,'    ').length,text:numbered[3],ordered:true,value:Number(numbered[2])}:null;}
// Leading bullets are structure; minus signs inside maths remain prose.
export function readSourceList(lines, start) {
  if(!sourceListMarker(lines[start]))return null;
  const parse=(at,depth=0)=>{
    if(depth>7)throw new Error('List nesting exceeds eight levels');
    const first=sourceListMarker(lines[at]),indent=first.indent,list={id:uid(),type:'list',ordered:first.ordered,start:first.value??1,items:[]};
    let nextValue=list.start;
    while(at<lines.length){
      const match=sourceListMarker(lines[at]);
      if(!match||match.indent<indent)break;
      if(match.indent>indent){const nested=parse(at,depth+1);list.items.at(-1).blocks.push(nested.list);at=nested.next;continue;}
      if(match.ordered!==list.ordered)break;
      const p={...paragraph(inlinesFromSource(match.text)),spaceAfter:0};
      list.items.push({id:uid(),type:'list-item',...(match.ordered&&match.value!==nextValue?{value:match.value}:{}),blocks:[p]});nextValue=(match.value??0)+1;at++;
      while(at<lines.length&&!sourceListMarker(lines[at])&&lines[at].trim()&&/^\s/.test(lines[at])&&lines[at].length-lines[at].trimStart().length>indent){p.inlines.push({type:'break'},...inlinesFromSource(lines[at].trim()));at++;}
    }
    return {list,next:at};
  };
  return parse(start);
}
export function tableCells(line) {
  const value=String(line??'').trim();if(!value.startsWith('|')||!value.endsWith('|'))return null;
  const body=value.slice(1,-1),cells=[];let cell='',math=false,cloze=false;
  for(let i=0;i<body.length;i++){
    const c=body[i];if(c==='\\'&&i+1<body.length){cell+=c+body[++i];continue;}
    if(body.slice(i,i+2)==='[[')cloze=true;
    if(body.slice(i,i+2)===']]')cloze=false;
    if(c==='$'&&!cloze){math=!math;if(body[i+1]==='$'){cell+='$$';i++;continue;}}
    if(c==='|'&&!math&&!cloze){cells.push(cell.trim());cell='';}else cell+=c;
  }
  cells.push(cell.trim());return cells;
}
export function inlinesFromSource(source) {
  const nodes = [];
  const re = /(?<!\\)(\$\$[\s\S]*?(?<!\\)\$\$|\$[^$\n]*?(?<!\\)\$)|\[\[([^|\]]*)\|(\d+)\]\]|(\*\*[^*]+\*\*)|(_[^_\n]+_)/g;
  let start = 0;
  const text = str => str.split('\n').forEach((s, i) => { if (i) nodes.push({ type: 'break' }); s.split('\t').forEach((part,j)=>{if(j)nodes.push({type:'tab'});if(part)nodes.push({type:'text',text:part.replace(/\\\$/g,'$'),marks:[]});}); });
  for (const m of String(source).matchAll(re)) {
    text(source.slice(start, m.index));
    if (m[1]) { const display = m[1].startsWith('$$'); nodes.push({ type:'math', latex:m[1].slice(display ? 2 : 1, display ? -2 : -1), display }); }
    else if (m[2] !== undefined) nodes.push({ type:'cloze', answer:m[2], width:Number(m[3]) });
    else nodes.push({ type:'text', text:m[0].slice(m[4] ? 2 : 1, m[4] ? -2 : -1), marks:[m[4] ? 'bold' : 'italic'] });
    start = m.index + m[0].length;
  }
  text(String(source).slice(start));
  return nodes;
}
export function fromSource(source = '') {
  const lines = String(source).replace(/\r/g, '').split('\n');
  const blocks = []; let prose = [];
  const flush = () => { if (prose.length) blocks.push(paragraph(inlinesFromSource(prose.join('\n')))); prose = []; };
  for (let i = 0; i < lines.length; i++) {
    const list=readSourceList(lines,i);
    if(list){flush();blocks.push(list.list);i=list.next-1;continue;}
    if (/^\s*\|/.test(lines[i]) && /^\s*\|[\s:|\-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      flush(); const rows = []; let first = true;
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        if (!/^\s*\|[\s:|\-]+\|\s*$/.test(lines[i])) rows.push(tableCells(lines[i]).map(s => ({ id:uid(), type:'cell', header:first, blocks:[paragraph(inlinesFromSource(s))] })));
        first = false; i++;
      }
      i--; blocks.push({ id:uid(), type:'table', rows });
    } else if (!lines[i].trim()) flush(); else prose.push(lines[i]);
  }
  flush(); return normalizeDocument({ blocks:blocks.length ? blocks : [paragraph()] });
}
export function normalizeDocument(raw = {}) {
  if (typeof raw === 'string') return fromSource(raw);
  if (raw.format && raw.format !== DOCUMENT_FORMAT) {
    if (raw.paragraphs) return normalizeDocument({ blocks:raw.paragraphs.map(p => ({ ...p, type:'paragraph' })) });
    throw new Error(`Unsupported document format: ${raw.format}`);
  }
  if (raw.version && raw.version !== DOCUMENT_VERSION) throw new Error('Unsupported document version');
  const ids = new Set();
  const id = v => { const next = v || uid(); if (ids.has(next)) throw new Error(`Duplicate document identity: ${next}`); ids.add(next); return next; };
  const blocks = (items, depth = 0) => {
    if (depth > 8) throw new Error('Document nesting exceeds eight levels');
    return (items ?? []).map(rawNode => {
      const n = copy(rawNode);if(n.type==='annotated-equation')return normalizeAnnotatedEquation(n,{id,blocks:items=>blocks(items,depth+1)});const base = { id:id(n.id), type:n.type };
      if (n.type === 'paragraph') return { ...base, fontSize:n.fontSize==null?null:limit(n.fontSize,11,6,48), align:choice(n.align,['left','center','right','justify'],'left'), spaceBefore:limit(n.spaceBefore,0), spaceAfter:limit(n.spaceAfter,2), lineHeight:limit(n.lineHeight,1.4,1,3), indent:limit(n.indent,0), ...(n.tabStops?{tabStops:normalizeTabStops(n.tabStops)}:{}), inlines:(n.inlines ?? []).map(x => {
        if (x.type === 'inline-image') return {type:'inline-image',id:id(x.id),src:safeImage(x.src),alt:String(x.alt??''),width:limit(x.width,20,.5,190),aspectRatio:limit(x.aspectRatio,1,.01,100),verticalAlign:choice(x.verticalAlign,['baseline','middle','top','bottom'],'middle')};
        if (x.type === 'math') return { type:'math', latex:String(x.latex ?? ''), display:!!x.display };
        if (x.type === 'tab') return {type:'tab'};
        if (x.type === 'break') return { type:'break' };
        if (x.type === 'cloze') return { type:'cloze', answer:String(x.answer ?? ''), width:limit(x.width,clozeWidthMm(x.answer),8,120) };
        if (x.type !== 'text') throw new Error(`Unsupported inline: ${x.type}`);
        return { type:'text', text:String(x.text ?? x.value ?? ''), marks:(x.marks ?? []).filter(m => ['bold','italic','underline'].includes(m)) };
      }) };
      if (n.type === 'table') return { ...base, widthMm:n.widthMm==null?null:limit(n.widthMm,80,10,190), marginBefore:limit(n.marginBefore,2,0,30), marginAfter:limit(n.marginAfter,2,0,30), borderColour:colour(n.borderColour,'#a9b7c6'), borderWidthMm:limit(n.borderWidthMm,.26,0,2), rowHeights:(n.rowHeights??[]).map(v=>limit(v,10,4,80)), annotations:(n.annotations??[]).map(a=>({id:String(a.id??uid()),type:choice(a.type,['arrow','circle','box'],'circle'),cellId:String(a.cellId??''),toCellId:String(a.toCellId??''),side:choice(a.side,['top','bottom'],'bottom'),label:String(a.label??''),labelBox:!!a.labelBox,colour:/^#[0-9a-f]{6}$/i.test(a.colour??'')?a.colour:'#268cff',...(a.thicknessMm!=null?{thicknessMm:limit(a.thicknessMm,.45,.1,2)}:{}),...(a.curveMm!=null?{curveMm:limit(a.curveMm,4,0,30)}:{}),...(a.distanceMm!=null?{distanceMm:limit(a.distanceMm,.8,0,20)}:{}),...(a.heads?{heads:choice(a.heads,['none','start','end','both'],'end')}:{})})), border:n.border !== false, padding:limit(n.padding,2,0,20), widths:(n.widths ?? []).map(v => limit(v,1,.001,1000000)), rows:(n.rows ?? []).map(row => row.map(c => ({ id:id(c.id), type:'cell', ...(c.splitStyles?{splitStyles:normalizeSplitStyles(c.splitStyles)}:{}), header:!!c.header, align:choice(c.align,['left','center','right'],'center'), verticalAlign:choice(c.verticalAlign,['top','middle','bottom'],'middle'), background:/^#[0-9a-f]{6}$/i.test(c.background??'')?c.background:'transparent', colour:/^#[0-9a-f]{6}$/i.test(c.colour??'')?c.colour:'inherit', bold:!!c.bold, borderColour:colour(c.borderColour,null),borderWidthMm:c.borderWidthMm==null?null:limit(c.borderWidthMm,.26,0,2), border:c.border??null,rotation:choice(c.rotation,[-90,0,90],0),colspan:Math.round(limit(c.colspan,1,1,20)), rowspan:Math.round(limit(c.rowspan,1,1,20)), blocks:blocks(c.blocks,depth+1) }))) };
      if (n.type === 'image') return { ...base, src:safeImage(n.src), alt:String(n.alt ?? ''), caption:String(n.caption ?? ''), width:limit(n.width,80,5,190), aspectRatio:limit(n.aspectRatio,1,0.01,100), align:choice(n.align,['left','center','right','inline','beside-left','beside-right'],'center'), crop:Array.from({length:4},(_,i)=>limit(n.crop?.[i],0,0,45)) };
      if (n.type === 'list') return {...base,ordered:!!n.ordered,start:Math.round(limit(n.start,1,1,10000)),indent:limit(n.indent,7,1,50),items:(n.items??[]).map(item=>({id:id(item.id),type:'list-item',...(item.value!=null?{value:Math.round(limit(item.value,1,0,10000))}:{}),blocks:blocks(item.blocks,depth+1)}))};
      if (n.type === 'spacer') return { ...base, height:limit(n.height,15,0,250) };
      if (n.type === 'layout') return { ...base, arrangement:choice(n.arrangement,['investigation','parallel','worked-rows','scaffold','cards'],'parallel'), title:String(n.title ?? ''),border:n.border!==false,padding:limit(n.padding,3,0,20),margin:limit(n.margin,3,0,20),gap:limit(n.gap,3,0,20), columns:Math.round(limit(n.columns,2,1,6)), ...(n.tracks?{tracks:n.tracks.map(v=>limit(v,1,.01,1000))}:{}), slots:(n.slots ?? []).map(slot => ({ id:id(slot.id), blocks:blocks(slot.blocks,depth+1) })) };
      throw new Error(`Unsupported document block: ${n.type}`);
    });
  };
  const result={ format:DOCUMENT_FORMAT, version:DOCUMENT_VERSION, blocks:blocks(raw.blocks ?? raw.paragraphs ?? [paragraph()]) };visitDocument(result,n=>{if(n.type==='table')tableGrid(n);});return result;
}
export function visitDocument(doc, fn) {
  const walk = nodes => nodes.forEach(n => { fn(n); if(n.items)n.items.forEach(item=>{fn(item);walk(item.blocks);}); if(n.inlines)n.inlines.filter(i=>i.id).forEach(fn);if(n.type==='annotated-equation')n.annotations.forEach(a=>walk(a.blocks)); if(n.rows) n.rows.flat().forEach(c => { fn(c); walk(c.blocks); }); if(n.slots) n.slots.forEach(s => walk(s.blocks)); });
  walk(doc.blocks); return doc;
}
export function toSource(raw) {
  const doc = normalizeDocument(raw);
  const inline = n => n.type === 'tab' ? '\t' : n.type === 'inline-image' ? `[Image ${JSON.stringify(n.alt)} source=${JSON.stringify(n.src)}]` : n.type === 'math' ? (n.display ? '$$' : '$') + n.latex + (n.display ? '$$' : '$') : n.type === 'break' ? '\n' : n.type === 'cloze' ? `[[${n.answer}|${n.width}]]` : (n.marks.includes('bold') ? '**' : n.marks.includes('italic') ? '_' : '') + n.text.replace(/\$/g, '\\$') + (n.marks.includes('bold') ? '**' : n.marks.includes('italic') ? '_' : '');
  const text = nodes => nodes.map(n => n.type === 'paragraph' ? n.inlines.map(inline).join('') : n.type === 'list' ? n.items.map((item,i)=>(n.ordered?n.items.slice(0,i+1).reduce((value,item)=>item.value??value+1,n.start-1)+'. ':'- ')+item.blocks.map(b=>text([b])).join('\n').split('\n').join('\n  ')).join('\n') : n.type === 'table' ? n.rows.map(row => row.map(c => text(c.blocks)).join('\t')).join('\n') : n.type === 'annotated-equation' ? '$'+n.latex+'$\n'+n.annotations.map(a=>text(a.blocks)).join('\n') : n.type === 'layout' ? n.slots.map(s => text(s.blocks)).join('\n') : n.type === 'image' ? `[Image: ${n.alt || n.caption}]` : '').join('\n\n');
  return text(doc.blocks);
}
export function renderDocument(raw, { math = latex => escapeHtml(latex), editable = false, fillCloze = false, annotationMath = math } = {}) {
  const doc = normalizeDocument(raw), e = escapeHtml;
  const inline = n => n.type === 'tab' ? '<span data-tab contenteditable="false" aria-label="Tab" style="display:inline-block;width:10mm;white-space:nowrap;vertical-align:baseline;overflow:hidden">&#8203;</span>' : n.type === 'inline-image' ? renderInlineImage(n,editable) : n.type === 'text' ? n.marks.reduce((s,m) => `<${{bold:'strong',italic:'em',underline:'u'}[m]}>${s}</${{bold:'strong',italic:'em',underline:'u'}[m]}>`, e(n.text)) : n.type === 'break' ? '<br>' : n.type === 'cloze' ? `<span data-cloze="${e(n.answer)}" data-width="${n.width}" contenteditable="false" style="position:relative;display:inline-block;min-width:${n.width}mm;border-bottom:1px var(--document-cloze-line,solid)">${fillCloze ? e(n.answer) : '&nbsp;'}${clozeLeader(n.width)}</span>` : `<span data-math="true" data-display="${n.display}" contenteditable="false" style="${n.display ? 'display:block;' : 'display:inline-block;vertical-align:baseline;'}${/\\(?:d?frac|tfrac|cfrac)\b/.test(n.latex)?'padding-block:.15em;':''}">${editable ? `<math-field>${e(n.latex)}</math-field>` : math(n.latex,n.display)}</span>`;
  const render = nodes => nodes.map(n => {
    const attr = `data-id="${e(n.id)}" data-type="${n.type}"`;
    if(n.type === 'annotated-equation')return renderAnnotatedEquation(n,{e,render,math:annotationMath,editable});
    if(n.type === 'list'){const tag=n.ordered?'ol':'ul';return `<${tag} ${attr} ${n.ordered?`start="${n.start}"`:''} style="margin:0 0 2mm;padding-left:${n.indent}mm;list-style-position:outside;list-style-type:${n.ordered?'decimal':'disc'}">${n.items.map(item=>`<li ${item.value!=null?`value="${item.value}"`:""} data-id="${e(item.id)}" data-type="list-item" style="display:list-item;margin:0 0 1mm;padding:0">${render(item.blocks)}</li>`).join('')}</${tag}>`;}
    if(n.type === 'paragraph') return `<p ${attr} ${n.tabStops?`data-tab-stops="${e(JSON.stringify(n.tabStops))}"`:""} style="${n.fontSize?`font-size:${n.fontSize}pt;`:''}text-align:${n.align};margin:${n.spaceBefore}mm 0 ${n.spaceAfter}mm;padding-left:${n.indent}mm;line-height:${n.lineHeight}">${n.inlines.map(inline).join('') || '<br>'}</p>`;
    if(n.type === 'spacer') return `<div ${attr} contenteditable="false" style="height:${n.height}mm">${editable ? 'Working space' : ''}</div>`;
    if(n.type === 'image') { const [t,r,b,l] = n.crop, floating=n.align.startsWith('beside-'); return `<figure ${attr} contenteditable="false" style="width:${n.width}mm;max-width:100%;${floating?'float:'+n.align.slice(7)+';':''}display:${n.align === 'inline' ? 'inline-block' : 'block'};margin:2mm ${floating?'3mm':n.align === 'left' || n.align === 'inline' ? 'auto 2mm 0' : n.align === 'right' ? '0 2mm auto' : 'auto'}"><div style="overflow:hidden;position:relative;aspect-ratio:${n.aspectRatio*(100-l-r)/(100-t-b)}"><img src="${e(n.src)}" alt="${e(n.alt)}" style="position:absolute;max-width:none;width:${10000/(100-l-r)}%;left:${-100*l/(100-l-r)}%;top:${-100*t/(100-t-b)}%"></div><figcaption>${e(n.caption)}</figcaption></figure>`; }
    if(n.type === 'table') {
      const reserve=side=>Math.max(0,...n.annotations.filter(a=>a.type==='arrow'&&a.side===side&&(a.curveMm!=null||a.distanceMm!=null)).map(a=>(a.distanceMm??.794)+(a.curveMm??8)+(a.label?7:2)));
      const marginTop=n.annotations.some(a=>a.type==='arrow'&&a.side==='top')?Math.max(9,n.marginBefore,reserve('top')):n.marginBefore, marginBottom=n.annotations.some(a=>a.type==='arrow'&&a.side==='bottom')?Math.max(n.annotations.some(a=>a.labelBox)?14:10,n.marginAfter,reserve('bottom')):n.marginAfter;
      return `<div data-table-wrap style="position:relative;width:${n.widthMm?n.widthMm+'mm':'100%'};max-width:100%;margin:${marginTop}mm 0 ${marginBottom}mm"><table ${attr} data-annotations="${e(JSON.stringify(n.annotations))}" style="--document-cloze-line:var(--document-table-cloze-line,solid);--document-cloze-dots:var(--document-table-cloze-dots,none);width:100%;border-collapse:collapse;table-layout:fixed"><colgroup>${Array.from({length:tableGrid(n).columns},(_,i)=>n.widths[i]??1).map(w => `<col style="width:${100*w/(n.widths.reduce((a,b)=>a+b,0) || tableGrid(n).columns || 1)}%">`).join('')}</colgroup><tbody>${n.rows.map((row,ri) => `<tr style="${n.rowHeights[ri]?'height:'+n.rowHeights[ri]+'mm':''}">${row.map(c => `<${c.header?'th':'td'} data-id="${e(c.id)}" colspan="${c.colspan}" rowspan="${c.rowspan}" style="vertical-align:${c.verticalAlign};text-align:${c.align};background:${c.background};color:${c.colour};font-weight:${c.bold?700:400};padding:${n.padding}mm;border:${(c.border??n.border)?`${c.borderWidthMm??n.borderWidthMm}mm solid ${c.borderColour??n.borderColour}`:'0'};overflow-wrap:anywhere">${c.rotation?`<div style="min-height:${n.rowHeights[ri]??24}mm;display:flex;align-items:center;justify-content:center"><div data-cell-content style="transform:rotate(${c.rotation}deg);white-space:nowrap;flex:none;width:max-content">${render(c.blocks)}</div></div>`:render(c.blocks.map(b=>b.type==='paragraph'?{...b,align:c.align,spaceAfter:0}:b))}</${c.header?'th':'td'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    return `<section ${attr} contenteditable="false" class="me-layout me-${n.arrangement}" style="margin:${n.margin}mm 0;padding:${n.padding}mm;border:${n.border?'1px solid #becbdd':'0'}">${n.title?`<strong>${e(n.title)}</strong>`:''}<div style="display:grid;grid-template-columns:${n.arrangement==='worked-rows'?'minmax(0,1fr)':Array.from({length:n.columns},(_,i)=>`minmax(0,${n.tracks?.[i]??1}fr)`).join(' ')};gap:${n.gap}mm">${n.slots.map(s => `<div data-slot="${e(s.id)}" style="${n.arrangement==='cards'?'border:.25mm solid #9eabb9;box-shadow:1mm 1mm #ddd;padding:2mm;text-align:center':''}" ${editable?'contenteditable="true"':''}>${render(s.blocks)}</div>`).join('')}</div></section>`;
  }).join('');
  return render(doc.blocks);
}
export function template(arrangement) {
  return { id:uid(), type:'layout', arrangement, title:{investigation:'Investigation',parallel:'Example and guided practice','worked-rows':'Worked example',scaffold:'Scaffold'}[arrangement], columns:arrangement === 'worked-rows'?1:2, slots:Array.from({length:arrangement === 'worked-rows'?3:2}, () => ({id:uid(),blocks:[paragraph()]})) };
}

// Formatting snapshots contain no content or identities; edits never resurrect old prose.
function normalizeSplitStyles(styles) {
  return (styles??[]).slice(0,400).map(s=>({row:Math.max(0,Math.floor(Number(s.row)||0)),col:Math.max(0,Math.floor(Number(s.col)||0)),style:{
    header:!!s.style?.header,align:choice(s.style?.align,['left','center','right'],'center'),verticalAlign:choice(s.style?.verticalAlign,['top','middle','bottom'],'middle'),
    background:colour(s.style?.background,'transparent'),colour:colour(s.style?.colour,'inherit'),bold:!!s.style?.bold,rotation:choice(s.style?.rotation,[-90,0,90],0),
    border:s.style?.border==null?null:!!s.style.border,borderColour:colour(s.style?.borderColour,null),borderWidthMm:s.style?.borderWidthMm==null?null:limit(s.style.borderWidthMm,.26,0,2)
  }}));
}
export function renderInlineImage(n,editable=false) {
  const e=escapeHtml;
  return `<span data-id="${e(n.id)}" data-type="inline-image" data-image="${e(JSON.stringify(n))}" contenteditable="false" ${editable?'tabindex="0" role="button"':''} aria-label="Image: ${e(n.alt||'Add alternative text')}" style="display:inline-block;position:relative;width:${n.width}mm;max-width:100%;aspect-ratio:${n.aspectRatio};vertical-align:${n.verticalAlign};line-height:1"><img src="${e(n.src)}" alt="${e(n.alt)}" width="${Math.round(n.width*96/25.4)}" height="${Math.round(n.width*96/25.4/n.aspectRatio)}" style="display:block;width:100%;height:100%;object-fit:contain"><span data-image-error hidden style="position:absolute;inset:0;background:#fff1ed;font:10px sans-serif;overflow:hidden">Image unavailable: ${e(n.alt)}</span></span>`;
}
export function exportSource(raw) {
  const doc=normalizeDocument(raw), losses=[];
  visitDocument(doc,n=>{if(n.type==='paragraph'&&(n.tabStops?.length||n.inlines.some(i=>i.type==='tab')))losses.push({id:n.id,type:'tabs',message:'Plain text retains tab characters but loses tab positions, alignment and leaders.'});if(['inline-image','image','table','layout','spacer','annotated-equation'].includes(n.type))losses.push({id:n.id,type:n.type,message:'Plain source is a lossy projection. Use structured JSON or rich clipboard for lossless transfer.'});});
  return {text:toSource(doc),losses};
}
export function freshDocument(raw) {
  const doc=normalizeDocument(raw),ids=new Map();
  visitDocument(doc,n=>{ids.set(n.id,uid());if(n.slots)for(const s of n.slots)ids.set(s.id,uid());});
  visitDocument(doc,n=>{n.id=ids.get(n.id);if(n.type==='annotated-equation'){const anchors=new Map(n.anchors.map(a=>[a.id,uid()]));for(const a of n.anchors)a.id=anchors.get(a.id);for(const a of n.annotations)a.targetId=anchors.get(a.targetId)??a.targetId;}if(n.slots)for(const s of n.slots)s.id=ids.get(s.id);if(n.annotations)for(const a of n.annotations){a.id=uid();a.cellId=ids.get(a.cellId)??a.cellId;a.toCellId=ids.get(a.toCellId)??a.toCellId;}});
  return doc;
}
export function mountImageFeedback(root) {
  const update=e=>{const img=e.target,wrap=img.closest?.('[data-type="inline-image"]');if(wrap){const failed=e.type==='error'||(!img.naturalWidth&&img.complete);wrap.querySelector('[data-image-error]').hidden=!failed;}};
  root.addEventListener('error',update,true);root.addEventListener('load',update,true);
  root.querySelectorAll('[data-type="inline-image"] img').forEach(target=>update({target,type:'check'}));
  return {destroy(){root.removeEventListener('error',update,true);root.removeEventListener('load',update,true);}};
}

export function normalizeTabStops(stops=[]) {
  const seen=new Set();return stops.map(s=>({position:limit(s.position,10,.1,190),align:choice(s.align,['left','center','right','decimal'],'left'),leader:choice(s.leader,['none','dots','underline'],'none')})).sort((a,b)=>a.position-b.position).filter(s=>{if(seen.has(s.position))return false;seen.add(s.position);return true;});
}
