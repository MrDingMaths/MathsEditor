export const DOCUMENT_FORMAT = 'maths-editor-document-v1';
export const DOCUMENT_VERSION = 1;
export const copy = value => JSON.parse(JSON.stringify(value));
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `me-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const limit = (v, fallback, min = 0, max = 300) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
const choice = (v, values, fallback) => values.includes(v) ? v : fallback;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
export function safeImage(src) {
  const value = String(src ?? '');
  return /^(data:image\/(png|jpeg|webp|gif);base64,|https?:\/\/|\/(?!\/)|\.\.?\/)/i.test(value) ? value : '';
}
export const paragraph = (inlines = []) => ({ id: uid(), type: 'paragraph', inlines });
export function inlinesFromSource(source) {
  const nodes = [];
  const re = /(?<!\\)(\$\$[\s\S]*?(?<!\\)\$\$|\$[^$\n]*?(?<!\\)\$)|\[\[([^|\]]*)\|(\d+)\]\]|(\*\*[^*]+\*\*)|(_[^_\n]+_)/g;
  let start = 0;
  const text = str => str.split('\n').forEach((s, i) => { if (i) nodes.push({ type: 'break' }); if (s) nodes.push({ type: 'text', text: s.replace(/\\\$/g, '$'), marks: [] }); });
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
    if (/^\s*\|/.test(lines[i]) && /^\s*\|[\s:|\-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      flush(); const rows = []; let first = true;
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        if (!/^\s*\|[\s:|\-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(s => ({ id:uid(), type:'cell', header:first, blocks:[paragraph(inlinesFromSource(s.trim()))] })));
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
      const n = copy(rawNode), base = { id:id(n.id), type:n.type };
      if (n.type === 'paragraph') return { ...base, align:choice(n.align,['left','center','right','justify'],'left'), spaceBefore:limit(n.spaceBefore,0), spaceAfter:limit(n.spaceAfter,2), lineHeight:limit(n.lineHeight,1.4,1,3), indent:limit(n.indent,0), inlines:(n.inlines ?? []).map(x => {
        if (x.type === 'math') return { type:'math', latex:String(x.latex ?? ''), display:!!x.display };
        if (x.type === 'break') return { type:'break' };
        if (x.type === 'cloze') return { type:'cloze', answer:String(x.answer ?? ''), width:limit(x.width,24,8,120) };
        if (x.type !== 'text') throw new Error(`Unsupported inline: ${x.type}`);
        return { type:'text', text:String(x.text ?? x.value ?? ''), marks:(x.marks ?? []).filter(m => ['bold','italic','underline'].includes(m)) };
      }) };
      if (n.type === 'table') return { ...base, border:n.border !== false, padding:limit(n.padding,2,0,20), widths:(n.widths ?? []).map(v => limit(v,1,1,100)), rows:(n.rows ?? []).map(row => row.map(c => ({ id:id(c.id), type:'cell', header:!!c.header, colspan:Math.round(limit(c.colspan,1,1,20)), rowspan:Math.round(limit(c.rowspan,1,1,20)), blocks:blocks(c.blocks,depth+1) }))) };
      if (n.type === 'image') return { ...base, src:safeImage(n.src), alt:String(n.alt ?? ''), caption:String(n.caption ?? ''), width:limit(n.width,80,5,190), align:choice(n.align,['left','center','right','inline'],'center'), crop:(n.crop ?? [0,0,0,0]).map(v => limit(v,0,0,45)) };
      if (n.type === 'spacer') return { ...base, height:limit(n.height,15,0,250) };
      if (n.type === 'layout') return { ...base, arrangement:choice(n.arrangement,['investigation','parallel','worked-rows','scaffold'],'parallel'), title:String(n.title ?? ''), columns:Math.round(limit(n.columns,2,1,4)), slots:(n.slots ?? []).map(slot => ({ id:id(slot.id), blocks:blocks(slot.blocks,depth+1) })) };
      throw new Error(`Unsupported document block: ${n.type}`);
    });
  };
  return { format:DOCUMENT_FORMAT, version:DOCUMENT_VERSION, blocks:blocks(raw.blocks ?? raw.paragraphs ?? [paragraph()]) };
}
export function visitDocument(doc, fn) {
  const walk = nodes => nodes.forEach(n => { fn(n); if(n.rows) n.rows.flat().forEach(c => { fn(c); walk(c.blocks); }); if(n.slots) n.slots.forEach(s => walk(s.blocks)); });
  walk(doc.blocks); return doc;
}
export function toSource(raw) {
  const doc = normalizeDocument(raw);
  const inline = n => n.type === 'math' ? (n.display ? '$$' : '$') + n.latex + (n.display ? '$$' : '$') : n.type === 'break' ? '\n' : n.type === 'cloze' ? `[[${n.answer}|${n.width}]]` : (n.marks.includes('bold') ? '**' : n.marks.includes('italic') ? '_' : '') + n.text.replace(/\$/g, '\\$') + (n.marks.includes('bold') ? '**' : n.marks.includes('italic') ? '_' : '');
  const text = nodes => nodes.map(n => n.type === 'paragraph' ? n.inlines.map(inline).join('') : n.type === 'table' ? n.rows.map(row => row.map(c => text(c.blocks)).join('\t')).join('\n') : n.type === 'layout' ? n.slots.map(s => text(s.blocks)).join('\n') : n.type === 'image' ? `[Image: ${n.alt || n.caption}]` : '').join('\n\n');
  return text(doc.blocks);
}
export function renderDocument(raw, { math = latex => escapeHtml(latex), editable = false, fillCloze = false } = {}) {
  const doc = normalizeDocument(raw), e = escapeHtml;
  const inline = n => n.type === 'text' ? n.marks.reduce((s,m) => `<${{bold:'strong',italic:'em',underline:'u'}[m]}>${s}</${{bold:'strong',italic:'em',underline:'u'}[m]}>`, e(n.text)) : n.type === 'break' ? '<br>' : n.type === 'cloze' ? `<span data-cloze="${e(n.answer)}" data-width="${n.width}" contenteditable="false" style="display:inline-block;min-width:${n.width}mm;border-bottom:1px solid">${fillCloze ? e(n.answer) : '&nbsp;'}</span>` : `<span data-math="true" data-display="${n.display}" contenteditable="false" style="${n.display ? 'display:block;' : ''}">${editable ? `<math-field>${e(n.latex)}</math-field>` : math(n.latex,n.display)}</span>`;
  const render = nodes => nodes.map(n => {
    const attr = `data-id="${e(n.id)}" data-type="${n.type}"`;
    if(n.type === 'paragraph') return `<p ${attr} style="text-align:${n.align};margin:${n.spaceBefore}mm 0 ${n.spaceAfter}mm;padding-left:${n.indent}mm;line-height:${n.lineHeight}">${n.inlines.map(inline).join('') || '<br>'}</p>`;
    if(n.type === 'spacer') return `<div ${attr} contenteditable="false" style="height:${n.height}mm">${editable ? 'Working space' : ''}</div>`;
    if(n.type === 'image') { const [t,r,b,l] = n.crop; return `<figure ${attr} contenteditable="false" style="width:${n.width}mm;max-width:100%;display:${n.align === 'inline' ? 'inline-block' : 'block'};margin:2mm ${n.align === 'left' || n.align === 'inline' ? 'auto 2mm 0' : n.align === 'right' ? '0 2mm auto' : 'auto'}"><div style="overflow:hidden"><img src="${e(n.src)}" alt="${e(n.alt)}" style="display:block;width:100%;clip-path:inset(${t}% ${r}% ${b}% ${l}%);transform:scale(${100/(100-Math.max(t+b,l+r))})"></div><figcaption>${e(n.caption)}</figcaption></figure>`; }
    if(n.type === 'table') return `<table ${attr} style="width:100%;border-collapse:collapse;table-layout:fixed"><colgroup>${(n.widths.length ? n.widths : n.rows[0]?.map(() => 1) ?? []).map(w => `<col style="width:${100*w/(n.widths.reduce((a,b)=>a+b,0) || n.rows[0]?.length || 1)}%">`).join('')}</colgroup><tbody>${n.rows.map(row => `<tr>${row.map(c => `<${c.header?'th':'td'} data-id="${e(c.id)}" colspan="${c.colspan}" rowspan="${c.rowspan}" style="vertical-align:top;padding:${n.padding}mm;border:${n.border?'1px solid #a9b7c6':'0'}">${render(c.blocks)}</${c.header?'th':'td'}>`).join('')}</tr>`).join('')}</tbody></table>`;
    return `<section ${attr} contenteditable="false" class="me-layout me-${n.arrangement}" style="margin:3mm 0;padding:3mm;border:1px solid #becbdd"><strong>${e(n.title)}</strong><div style="display:grid;grid-template-columns:repeat(${n.arrangement === 'worked-rows' ? 1 : n.columns},minmax(0,1fr));gap:3mm">${n.slots.map(s => `<div data-slot="${e(s.id)}" ${editable?'contenteditable="true"':''}>${render(s.blocks)}</div>`).join('')}</div></section>`;
  }).join('');
  return render(doc.blocks);
}
export function template(arrangement) {
  return { id:uid(), type:'layout', arrangement, title:{investigation:'Investigation',parallel:'Example and guided practice','worked-rows':'Worked example',scaffold:'Scaffold'}[arrangement], columns:arrangement === 'worked-rows'?1:2, slots:Array.from({length:arrangement === 'worked-rows'?3:2}, () => ({id:uid(),blocks:[paragraph()]})) };
}
