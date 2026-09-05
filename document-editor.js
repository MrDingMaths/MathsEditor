import { copy, uid, paragraph, normalizeDocument, fromSource, toSource, renderDocument, visitDocument, template } from './document-model.mjs';

// Document transactions own history across prose, MathLive, tables and assets.
export class DocumentEditor {
  constructor(host, initial = '') {
    this.host = host; this.doc = normalizeDocument(typeof initial === 'string' ? fromSource(initial) : initial);
    this.history = []; this.index = -1; this.selectedId = this.doc.blocks[0]?.id; this.range = null;
    host.replaceChildren(); host.classList.add('me-document-editor');
    this.toolbar = document.createElement('div'); this.toolbar.className = 'me-toolbar'; this.toolbar.setAttribute('role','toolbar'); this.toolbar.setAttribute('aria-label','Document formatting');
    this.surface = document.createElement('div'); this.surface.className = 'me-content editor-surface'; this.surface.contentEditable = String(!host.readonly); this.surface.setAttribute('role','textbox'); this.surface.setAttribute('aria-label','Document content'); this.surface.setAttribute('aria-multiline','true');
    this.inspector = document.createElement('div'); this.inspector.className = 'me-properties';
    this.message = document.createElement('output'); this.message.setAttribute('aria-live','polite');
    host.append(this.toolbar,this.inspector,this.surface,this.message);
    this.buildToolbar(); this.render(); this.remember();
    this.surface.addEventListener('input', () => { this.capture(); this.remember(); this.emit(); });
    this.surface.addEventListener('focusin', e => { this.select(e.target); });
    this.surface.addEventListener('click', e => { this.select(e.target); });
    this.surface.addEventListener('keyup', () => this.saveRange());
    this.surface.addEventListener('mouseup', () => this.saveRange());
    this.surface.addEventListener('paste', e => this.paste(e));
    this.surface.addEventListener('copy', e => this.clipboard(e));
    this.surface.addEventListener('cut', e => { if (this.host.readonly) return; this.clipboard(e); const sel=window.getSelection(); if(sel?.rangeCount) { sel.getRangeAt(0).deleteContents(); this.capture(); this.remember(); this.emit(); } });
    host.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && ['z','y'].includes(e.key.toLowerCase())) { e.preventDefault(); e.stopImmediatePropagation(); this.undo(e.key.toLowerCase() === 'y' || e.shiftKey ? 1 : -1); }
      else if ((e.ctrlKey || e.metaKey) && ['b','i','u'].includes(e.key.toLowerCase())) { e.preventDefault(); this.mark({b:'bold',i:'italic',u:'underline'}[e.key.toLowerCase()]); }
    }, true);
  }
  saveRange() { const s=window.getSelection(); if(s?.rangeCount && this.surface.contains(s.anchorNode)) this.range=s.getRangeAt(0).cloneRange(); }
  restoreRange() { if(this.range && this.surface.contains(this.range.commonAncestorContainer)) { const s=window.getSelection(); s.removeAllRanges(); s.addRange(this.range); } }
  select(target) { const n=target.closest?.('[data-id]'); if(n) this.selectedId=n.dataset.id; this.saveRange(); this.properties(); }
  get selected() { let found; visitDocument(this.doc,n=>{if(n.id===this.selectedId)found=n;}); return found; }
  capture() { this.doc = this.read(this.surface); }
  read(root, original = this.doc) {
    const originals=new Map(); visitDocument(original,n=>originals.set(n.id,n));
    const inline = (node, marks=[]) => {
      if(node.nodeType===3) return [{type:'text',text:node.textContent,marks}];
      if(node.nodeType!==1) return [];
      if(node.matches('[data-math],math-field')) { const mf=node.matches('math-field')?node:node.querySelector('math-field'); return [{type:'math',latex:mf?.getValue?.('latex') ?? mf?.textContent ?? '',display:node.dataset.display==='true'}]; }
      if(node.hasAttribute('data-cloze')) return [{type:'cloze',answer:node.dataset.cloze,width:Number(node.dataset.width)}];
      if(node.tagName==='BR') return [{type:'break'}];
      const m={STRONG:'bold',B:'bold',EM:'italic',I:'italic',U:'underline'}[node.tagName];
      return [...node.childNodes].flatMap(n=>inline(n,m?[...new Set([...marks,m])]:marks));
    };
    const children = el => [...el.childNodes].flatMap(n=>block(n));
    const block = el => {
      if(el.nodeType===3) return el.textContent ? [paragraph(inline(el))] : [];
      if(el.nodeType!==1 || ['SCRIPT','STYLE','IFRAME','OBJECT'].includes(el.tagName)) return [];
      const old=copy(originals.get(el.dataset.id) ?? {}), id=old.id ?? uid();
      if(el.tagName==='TABLE') return [{...old,id,type:'table',rows:[...el.rows].map(r=>[...r.cells].map(c=>({id:c.dataset.id ?? uid(),type:'cell',header:c.tagName==='TH',colspan:c.colSpan,rowspan:c.rowSpan,blocks:children(c)})))}];
      if(el.dataset.type==='image' || el.tagName==='IMG') { const img=el.tagName==='IMG'?el:el.querySelector('img'); return [{...old,id,type:'image',src:img?.getAttribute('src') ?? '',alt:img?.alt ?? '',caption:el.querySelector('figcaption')?.textContent ?? old.caption ?? ''}]; }
      if(el.dataset.type==='spacer') return [old];
      if(el.dataset.type==='layout') return [{...old,id,type:'layout',slots:[...el.querySelectorAll(':scope > div > [data-slot]')].map(s=>({id:s.dataset.slot,blocks:children(s)}))}];
      return [{...old,id,type:'paragraph',inlines:[...el.childNodes].flatMap(n=>inline(n))}];
    };
    return normalizeDocument({blocks:children(root)});
  }
  render() { this.surface.innerHTML=renderDocument(this.doc,{editable:true}); this.surface.querySelectorAll('math-field').forEach(m=>m.readOnly=this.host.readonly); this.properties(); }
  remember() { const value=JSON.stringify(this.doc); if(this.history[this.index]===value)return; this.history=this.history.slice(0,this.index+1); this.history.push(value); if(this.history.length>200)this.history.shift(); this.index=this.history.length-1; }
  emit() { this.host.dispatchEvent(new CustomEvent('document-change',{bubbles:true,detail:{document:copy(this.doc),source:toSource(this.doc)}})); }
  set(value) { this.doc=normalizeDocument(value); this.selectedId=this.doc.blocks[0]?.id; this.render(); this.history=[]; this.index=-1; this.remember(); }
  undo(direction=-1) { if(this.host.readonly)return; const index=this.index+direction; if(index<0 || index>=this.history.length)return; this.index=index; this.doc=JSON.parse(this.history[index]); this.render(); this.emit(); }
  transact(fn) { if(this.host.readonly)return; try { this.capture(); const next=copy(this.doc); fn(next); this.doc=normalizeDocument(next); this.render(); this.remember(); this.emit(); this.message.textContent=''; } catch(e) {this.message.textContent=e.message;} }
  modify(fn) { this.transact(doc=>visitDocument(doc,n=>{if(n.id===this.selectedId)fn(n);})); }
  insert(node) { this.transact(doc=>{ const at=doc.blocks.findIndex(n=>n.id===this.selectedId); doc.blocks.splice(at<0?doc.blocks.length:at+1,0,node); this.selectedId=node.id; }); }
  insertMath(latex='') {
    if(this.host.readonly)return; this.restoreRange();
    const island=document.createElement('span'); island.dataset.math='true'; island.dataset.display='false'; island.contentEditable='false';
    const mf=document.createElement('math-field'); mf.value=latex; island.append(mf);
    const sel=window.getSelection();
    if(sel?.rangeCount && this.surface.contains(sel.anchorNode)) { const range=sel.getRangeAt(0); range.deleteContents(); range.insertNode(island); }
    else { const p=this.surface.querySelector('p') ?? this.surface.appendChild(document.createElement('p')); p.append(island); }
    this.capture(); this.remember(); this.emit(); mf.focus(); return mf;
  }
  mark(mark) { if(this.host.readonly)return; this.restoreRange(); const sel=window.getSelection(); if(!sel?.rangeCount || !this.surface.contains(sel.anchorNode) || sel.isCollapsed)return;
    const range=sel.getRangeAt(0), wrapper=document.createElement({bold:'strong',italic:'em',underline:'u'}[mark]); wrapper.append(range.extractContents()); range.insertNode(wrapper); range.selectNodeContents(wrapper); sel.removeAllRanges(); sel.addRange(range); this.saveRange(); this.capture(); this.remember(); this.emit(); }
  clipboard(e) {
    // MathLive owns selection inside its shadow tree.
    if(e.target.closest?.('math-field'))return;
    const s=window.getSelection(); if(!s?.rangeCount || s.isCollapsed)return;
    e.preventDefault(); const root=document.createElement('div'); root.append(s.getRangeAt(0).cloneContents());
    const data=this.read(root); e.clipboardData.setData('application/x-maths-editor+json',JSON.stringify(data)); e.clipboardData.setData('text/plain',toSource(data));
  }
  paste(e) {
    if(e.target.closest?.('math-field'))return;
    e.preventDefault(); if(this.host.readonly)return;
    const data=e.clipboardData, image=[...data.files].find(f=>/^image\/(png|jpeg|webp|gif)$/.test(f.type));
    if(image) { this.addImage(image); return; }
    try {
      const rich=data.getData('application/x-maths-editor+json');
      if(rich) { const doc=normalizeDocument(JSON.parse(rich)); visitDocument(doc,n=>{n.id=uid(); if(n.slots)n.slots.forEach(s=>s.id=uid());}); this.transact(next=>next.blocks.push(...doc.blocks)); return; }
      const text=data.getData('text/plain'); this.restoreRange();
      const fragment=document.createDocumentFragment();
      // Parse maths while treating all incoming prose as text, never executable HTML.
      const p=document.createElement('div'); p.innerHTML=renderDocument(fromSource(text),{editable:true}); fragment.append(...p.childNodes);
      const s=window.getSelection(); if(s?.rangeCount && this.surface.contains(s.anchorNode)) { const r=s.getRangeAt(0); r.deleteContents(); r.insertNode(fragment); } else this.surface.append(fragment);
      this.capture(); this.render(); this.remember(); this.emit();
    } catch(error) { this.message.textContent=error.message; }
  }
  async addImage(file) { if(file.size>5*1024*1024) {this.message.textContent='Choose an image smaller than 5 MB.';return;} if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){this.message.textContent='Choose PNG, JPEG, WebP or GIF.';return;} const reader=new FileReader(); reader.onload=()=>this.insert({id:uid(),type:'image',src:reader.result,alt:file.name,width:80}); reader.readAsDataURL(file); }
  button(parent,label,action) { const b=document.createElement('button'); b.type='button'; b.textContent=label; b.disabled=this.host.readonly; b.addEventListener('mousedown',e=>e.preventDefault()); b.onclick=action; parent.append(b); return b; }
  buildToolbar() {
    const b=(label,fn)=>this.button(this.toolbar,label,fn);
    b('Undo',()=>this.undo()); b('Redo',()=>this.undo(1)); ['bold','italic','underline'].forEach(m=>b(m[0].toUpperCase()+m.slice(1),()=>this.mark(m)));
    b('Math',()=>this.insertMath()); b('Paragraph',()=>this.insert(paragraph()));
    b('Table',()=>this.insert({id:uid(),type:'table',rows:Array.from({length:2},()=>Array.from({length:2},()=>({id:uid(),type:'cell',blocks:[paragraph()]})))}));
    b('Image',()=>this.file.click()); this.file=document.createElement('input'); this.file.type='file'; this.file.accept='image/png,image/jpeg,image/webp,image/gif'; this.file.hidden=true; this.file.onchange=()=>{if(this.file.files[0])this.addImage(this.file.files[0]);}; this.toolbar.append(this.file);
    b('Working space',()=>this.insert({id:uid(),type:'spacer',height:15}));
    for(const arrangement of ['investigation','parallel','worked-rows','scaffold']) b(arrangement,()=>this.insert(template(arrangement)));
  }
  field(label,value,action,type='number',options=null) {
    const wrap=document.createElement('label'); wrap.textContent=label+' '; const input=document.createElement(options?'select':'input'); input.setAttribute('aria-label',label); input.disabled=this.host.readonly;
    if(options) options.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;input.append(o);}); else input.type=type;
    input.value=value??''; input.onchange=()=>action(type==='number'&&!options?Number(input.value):input.value); wrap.append(input); this.inspector.append(wrap);
  }
  properties() {
    this.inspector.replaceChildren(); const n=this.selected; if(!n)return;
    const f=(label,key,type='number',options=null)=>this.field(label,n[key],v=>this.modify(node=>node[key]=v),type,options);
    if(n.type==='paragraph') { f('Align','align','text',['left','center','right','justify']); f('Before (mm)','spaceBefore'); f('After (mm)','spaceAfter'); f('Line spacing','lineHeight'); f('Indent (mm)','indent'); }
    if(n.type==='image') {f('Width (mm)','width'); f('Placement','align','text',['left','center','right','inline']);f('Alternative text','alt','text');f('Caption','caption','text'); ['Top','Right','Bottom','Left'].forEach((label,i)=>this.field('Crop '+label+' (%)',n.crop[i],v=>this.modify(node=>node.crop[i]=v)));}
    if(n.type==='spacer') f('Height (mm)','height');
    if(n.type==='layout') {f('Title','title','text'); f('Arrangement','arrangement','text',['investigation','parallel','worked-rows','scaffold']);f('Columns','columns');}
    let table; visitDocument(this.doc,t=>{if(t.type==='table' && (t.id===n.id || t.rows.flat().some(c=>c.id===n.id || c.blocks.some(p=>p.id===n.id)))) table=t;});
    if(table) {
      const edit=fn=>this.transact(doc=>visitDocument(doc,t=>{if(t.id===table.id)fn(t);}));
      const cellRow=table.rows.findIndex(r=>r.some(c=>c.id===n.id || c.blocks.some(p=>p.id===n.id))), ri=Math.max(0,cellRow);
      const ci=Math.max(0,table.rows[ri].findIndex(c=>c.id===n.id || c.blocks.some(p=>p.id===n.id)));
      const simple=t=>{if(t.rows.flat().some(c=>c.colspan!==1||c.rowspan!==1))throw new Error('Split merged cells before changing rows or columns.');};
      this.button(this.inspector,'Add row',()=>edit(t=>{simple(t);t.rows.splice(ri+1,0,t.rows[0].map(()=>({id:uid(),type:'cell',blocks:[paragraph()]})));}));
      this.button(this.inspector,'Remove row',()=>edit(t=>{simple(t);if(t.rows.length>1)t.rows.splice(ri,1);}));
      this.button(this.inspector,'Add column',()=>edit(t=>{simple(t);t.rows.forEach(r=>r.splice(ci+1,0,{id:uid(),type:'cell',blocks:[paragraph()]}));t.widths=[];}));
      this.button(this.inspector,'Remove column',()=>edit(t=>{simple(t);if(t.rows[0].length>1)t.rows.forEach(r=>r.splice(ci,1));t.widths=[];}));
      this.button(this.inspector,'Merge right',()=>edit(t=>{const a=t.rows[ri][ci],b=t.rows[ri][ci+1];if(!b || a.rowspan!==b.rowspan)throw new Error('Select adjacent cells with matching row spans.');a.colspan+=b.colspan;a.blocks.push(...b.blocks);t.rows[ri].splice(ci+1,1);}));
      this.button(this.inspector,'Split cell',()=>edit(t=>{const c=t.rows[ri][ci],count=c.colspan;c.colspan=1;for(let i=1;i<count;i++)t.rows[ri].splice(ci+i,0,{id:uid(),type:'cell',blocks:[paragraph()]});}));
      this.button(this.inspector,table.border?'Hide borders':'Show borders',()=>edit(t=>t.border=!t.border));
      this.field('Cell padding (mm)',table.padding,v=>edit(t=>t.padding=v));
      this.field('Column widths',table.widths.join(', '),v=>edit(t=>{const widths=v.split(',').map(Number);if(widths.length!==t.rows[0].reduce((s,c)=>s+c.colspan,0)||widths.some(w=>!Number.isFinite(w)||w<=0))throw new Error('Enter one positive width per column.');t.widths=widths;}),'text');
    }
    this.button(this.inspector,'Delete selected block',()=>this.transact(doc=>{const i=doc.blocks.findIndex(b=>b.id===n.id);if(i<0)throw new Error('Select a top-level block to delete.');doc.blocks.splice(i,1);if(!doc.blocks.length)doc.blocks.push(paragraph());this.selectedId=doc.blocks[0].id;}));
  }
}
