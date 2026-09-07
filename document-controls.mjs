import { BOOKLET_HOUSE_STYLE } from './house-style.mjs';
import {copy,uid,normalizeDocument,paragraph,visitDocument} from './document-model.mjs';
import {tableGrid} from './table-model.mjs';
const colours=/^#[0-9a-f]{6}$/i;
export const layoutControls={
 installLayoutEvents(){
  this.surface.addEventListener('keydown',e=>{
   if(e.target.closest('math-field,button,input,select'))return;
   if(e.key==='Escape'){if(this.leaveWithTab){this.leaveWithTab=false;return;}this.leaveWithTab=true;e.preventDefault();e.stopPropagation();return;}
   if(e.key==='Tab'){if(this.leaveWithTab){this.leaveWithTab=false;return;}if(e.target.closest('li')||getSelection()?.anchorNode?.parentElement?.closest('li')){e.preventDefault();this.saveRange();this.listCommand(e.shiftKey?'outdent':'indent');return;}if(e.shiftKey)return;e.preventDefault();this.saveRange();this.insertTab();}else this.leaveWithTab=false;
  });
  this.surface.addEventListener('mouseup',()=>{const r=getSelection()?.rangeCount?getSelection().getRangeAt(0):null;if(!r||r.collapsed){this.selectedCells=null;return;}const cells=[...this.surface.querySelectorAll('td[data-id],th[data-id]')].filter(c=>r.intersectsNode(c)).map(c=>c.dataset.id);if(JSON.stringify(cells)!==JSON.stringify(this.selectedCells)){this.selectedCells=cells;this.properties();}});
 },
 insertTab(){this.insertDocument(normalizeDocument({blocks:[paragraph([{type:'tab'}])]}));this.tabsObserver?.update();},
 replaceDots(){
  this.restoreRange();const sel=getSelection();if(!sel?.rangeCount||sel.isCollapsed||!this.surface.contains(sel.anchorNode))return;
  if(!/^[.\u2026\u2024\s]+$/.test(sel.toString())){this.message.textContent='Select only the dots you want to replace.';return;}
  const p=(sel.anchorNode.nodeType===1?sel.anchorNode:sel.anchorNode.parentElement).closest('p');if(!p)return;
  const index=this.index;this.insertDocument(normalizeDocument({blocks:[paragraph([{type:'tab'},{type:'tab'}])]}));const id=p.dataset.id,available=p.clientWidth*25.4/96,stops=[{position:Math.min(22,available/2),align:'left',leader:'none'},{position:Math.min(44,available),align:'left',leader:'dots'}];visitDocument(this.doc,n=>{if(n.id===id)n.tabStops=stops;});p.dataset.tabStops=JSON.stringify(stops);this.history=this.history.slice(0,index+1);this.index=index;this.remember();this.patchLayout();this.emit();this.properties();
 },
 tabProperties(n){
  if(this.host.getAttribute('controls')==='contextual'){
   const hint=document.createElement('p');hint.className='me-tab-default';hint.textContent='Tab advances to the next 1 cm stop (1, 2, 3 cm…). Escape, then Tab leaves the editor.';this.inspector.append(hint);
   if(n.tabStops?.length){const note=document.createElement('p');note.textContent='This paragraph uses saved custom stops.';this.inspector.append(note);this.button(this.inspector,'Use 1 cm default tabs',()=>this.modify(x=>delete x.tabStops));}
   return;
  }
  const area=document.createElement('div');area.className='me-tab-properties';this.inspector.append(area);
  const help=document.createElement('details');help.className='me-tab-help';help.innerHTML='<summary>How tab stops work</summary><p>A stop is a position on this paragraph’s ruler. Insert a tab in the text to move to that position.</p><svg viewBox="0 0 260 90" role="img" aria-label="Name, then a tab, then an answer aligned at 25 millimetres"><path d="M15 18H245 M130 12V78" stroke="#268cff" stroke-dasharray="3 2"/><text x="112" y="11" font-size="11">25 mm</text><text x="15" y="44" font-size="14">Name</text><text x="72" y="44" font-size="14" fill="#268cff">Tab →</text><text x="134" y="44" font-size="14">Alex</text><text x="15" y="70" font-size="14">Class</text><text x="72" y="70" font-size="14" fill="#268cff">Tab →</text><text x="134" y="70" font-size="14">8A</text></svg><ol><li>Add a tab stop and choose its position.</li><li>Place the caret between the items and choose Insert tab.</li><li>Copy the settings to other paragraphs to align them.</li></ol><p>Dots fills the tab gap with dotted leaders. Escape, then Tab moves keyboard focus out of the editor.</p>';area.append(help);
  const status=document.createElement('p');status.textContent=n.tabStops?.length?'This paragraph: '+n.tabStops.map(t=>t.position+' mm · '+t.align+' · '+t.leader).join('; '):'This paragraph has no custom tab stops.';status.setAttribute('role','status');area.append(status);
  const ruler=document.createElement('div');ruler.className='me-tab-ruler';ruler.setAttribute('aria-label','Paragraph tab ruler');area.append(ruler);
  const p=this.surface.querySelector(`[data-id="${CSS.escape(n.id)}"]`),available=Math.max(10,Math.min(190,((p?.clientWidth??600)-(parseFloat(p&&getComputedStyle(p).paddingLeft)||0))*25.4/96));
  const legend=document.createElement('span');legend.textContent='0 — '+available.toFixed(1)+' mm';legend.style.cssText='position:absolute;top:-2px;left:2px;font-size:14px';ruler.append(legend);
  const patch=()=>{const current=this.selected;if(p&&current){p.dataset.tabStops=JSON.stringify(current.tabStops??[]);this.tabsObserver?.update();}};
  (n.tabStops??[]).forEach((stop,i)=>{
   const handle=this.button(ruler,`${stop.position}`,()=>{});handle.setAttribute('aria-label',`Tab stop ${i+1}: ${stop.position} mm`);handle.style.left=stop.position/available*100+'%';let start;
   const move=value=>{const at=Math.round(Math.max(.1,Math.min(available,value))*10)/10;visitDocument(this.doc,x=>{if(x.id===n.id)x.tabStops[i].position=at;});handle.style.left=at/available*100+'%';handle.textContent=at;patch();this.layoutChange=true;this.emit();this.layoutChange=false;};
   const finish=cancel=>{if(!start)return;if(cancel){this.doc=start.doc;patch();handle.style.left=stop.position/available*100+'%';handle.textContent=stop.position;this.emit();}else this.remember();start=null;};
   handle.onpointerdown=e=>{e.preventDefault();this.capture();start={doc:copy(this.doc),x:e.clientX,value:stop.position};handle.setPointerCapture(e.pointerId);};handle.onpointermove=e=>{if(start)move(start.value+(e.clientX-start.x)/ruler.getBoundingClientRect().width*available);};handle.onpointerup=()=>finish(false);handle.onpointercancel=()=>finish(true);
   handle.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(true);}if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();start={doc:copy(this.doc)};move(this.selected.tabStops[i].position+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?5:1));finish(false);}};
   const label=`Tab ${i+1}`;
   this.liveField(label+' position (mm)',stop.position,(doc,v)=>{if(v<=0||v>available)throw new Error(`Tab must be between 0 and ${available.toFixed(1)} mm.`);visitDocument(doc,x=>{if(x.id===n.id)x.tabStops[i].position=v;});});
   this.field(label+' alignment',stop.align,v=>this.modify(x=>x.tabStops[i].align=v),'text',['left','center','right','decimal']);
   this.field(label+' leader',stop.leader,v=>this.modify(x=>x.tabStops[i].leader=v),'text',['none','dots','underline']);
   this.button(this.inspector,'Remove '+label,()=>this.modify(x=>x.tabStops.splice(i,1)));
  });
  this.button(area,'Add tab stop',()=>this.modify(x=>{x.tabStops??=[];x.tabStops.push({position:Math.min(available,(x.tabStops.at(-1)?.position??0)+10),align:'left',leader:'none'});}));
  this.button(area,'Copy tab settings',()=>{this.copiedTabs=copy(n.tabStops??[]);this.message.textContent='Tab settings copied. Select another paragraph and choose Paste tab settings.';});
  this.button(area,'Paste tab settings',()=>{if(this.copiedTabs)this.modify(x=>x.tabStops=copy(this.copiedTabs));});
  if(this.host.hasAttribute('question-context'))this.button(area,"Apply to this question’s parts",()=>this.host.dispatchEvent(new CustomEvent('apply-question-tabs',{bubbles:true,detail:{tabStops:copy(n.tabStops??[])}})));
 },
 layoutProperties(n){for(let i=0;i<n.columns;i++)this.field(`Layout column ${i+1} proportion`,n.tracks?.[i]??1,v=>{if(v<=0)return;this.modify(x=>{x.tracks??=Array(x.columns).fill(1);x.tracks[i]=v;});});this.field('Layout gap (mm)',n.gap,v=>this.modify(x=>x.gap=v));},
 colourField(label,value,action,special){
  const wrap=document.createElement('label');wrap.textContent=label+' ';const picker=document.createElement('input');picker.type='color';picker.disabled=this.host.readonly;picker.value=colours.test(value)?value:'#ffffff';picker.setAttribute('aria-label',label+' picker');
  const input=document.createElement('input');input.type='text';input.disabled=this.host.readonly;input.value=value??'';input.placeholder=value==null?'Mixed':'';input.setAttribute('aria-label',label);input.onchange=()=>{if(!colours.test(input.value)&&input.value!==special){input.setAttribute('aria-invalid','true');this.message.textContent='Use a six-digit hex colour'+(special?' or '+special:'')+'.';return;}action(input.value);};picker.onchange=()=>action(picker.value);wrap.append(picker,input);if(special)this.button(wrap,special==='transparent'?'No fill':'Inherit',()=>action(special));this.inspector.append(wrap);
  const swatches=document.createElement('div');swatches.className='me-colour-swatches';swatches.setAttribute('role','group');swatches.setAttribute('aria-label',label+' booklet colours');
  const names={ink:'Ink',blue:'Booklet blue',red:'Booklet red',green:'Booklet green',orange:'Booklet orange',tableLabel:'Label blue',border:'Border grey',skipped:'Skipped-value grey',white:'White'};
  for(const [key,hex] of Object.entries({...BOOKLET_HOUSE_STYLE.colours,white:'#ffffff'})){
   const button=this.button(swatches,'',()=>action(hex));button.style.backgroundColor=hex;button.title=names[key]+' ('+hex+')';button.setAttribute('aria-label',label+': '+names[key]);button.setAttribute('aria-pressed',String(value?.toLowerCase()===hex));
  }
  this.inspector.append(swatches);
 },
 tableStyleProperties(table,logical,edit){
  this.tableStyleScope??='selected cells';this.field('Apply table style to',this.tableStyleScope,v=>{this.tableStyleScope=v;this.properties();},'text',['selected cells','row','column','whole table']);
  const entries=tableGrid(table).entries,scope=this.tableStyleScope;
  const ids=entries.filter(e=>scope==='whole table'||scope==='row'&&e.row<=logical.row&&e.row+e.rows>logical.row||scope==='column'&&e.col<=logical.col&&e.col+e.cols>logical.col||scope==='selected cells'&&(this.selectedCells?.length?this.selectedCells.includes(e.cell.id):e.cell.id===logical.cell.id)).map(e=>e.cell.id);
  const cells=entries.filter(e=>ids.includes(e.cell.id)).map(e=>e.cell),value=key=>{const values=cells.map(c=>c[key]??table[key]);return values.every(v=>v===values[0])?values[0]:null;};
  const apply=(key,v)=>edit(t=>{for(const c of t.rows.flat())if(ids.includes(c.id))c[key]=v;if(scope==='whole table'&&['borderColour','borderWidthMm'].includes(key))t[key]=v;});
  this.colourField('Shading',value('background'),v=>apply('background',v),'transparent');this.colourField('Text colour',value('colour'),v=>apply('colour',v),'inherit');this.colourField('Border colour',value('borderColour'),v=>apply('borderColour',v));this.field('Border width (mm)',value('borderWidthMm'),v=>{if(v>=0&&v<=2)apply('borderWidthMm',v);else this.message.textContent='Border width must be between 0 and 2 mm.';});
 },
 annotationProperties(table,logical,edit){
  const a=table.annotations.find(a=>a.id===this.annotationId),entries=tableGrid(table).entries;
  this.button(this.inspector,'Add arrow',()=>edit(t=>{const id=uid();this.annotationId=id;t.annotations.push({id,type:'arrow',cellId:logical.cell.id,toCellId:entries.find(e=>e.row===logical.row&&e.col>logical.col)?.cell.id??logical.cell.id,side:'bottom',label:'',colour:'#268cff'});}));
  for(const item of table.annotations)this.button(this.inspector,'Edit arrow '+(item.label||table.annotations.indexOf(item)+1),()=>{this.annotationId=item.id;this.properties();});if(!a)return;
  const set=(key,value)=>edit(t=>t.annotations.find(x=>x.id===a.id)[key]=value);
  for(const [label,key] of [['Arrow start cell','cellId'],['Arrow end cell','toCellId']]){
   const options=entries.map(e=>`Row ${e.row+1}, column ${e.col+1}`),at=entries.findIndex(e=>e.cell.id===a[key]);if(at<0)options.unshift('Unresolved: '+a[key]);this.field(label,at<0?options[0]:options[at],v=>{const index=options.indexOf(v)-(at<0?1:0);if(index>=0)set(key,entries[index].cell.id);},'text',options);
  }
  this.field('Arrow label',a.label,v=>set('label',v),'text');this.colourField('Arrow colour',a.colour,v=>set('colour',v));
  this.field('Arrow thickness (mm)',a.thicknessMm??.45,v=>set('thicknessMm',v));this.field('Arrow curve (mm)',a.curveMm??null,v=>set('curveMm',v));this.field('Arrow distance (mm)',a.distanceMm??.794,v=>set('distanceMm',v));this.field('Arrowheads',a.heads??'end',v=>set('heads',v),'text',['none','start','end','both']);this.field('Arrow side',a.side,v=>set('side',v),'text',['top','bottom']);
  this.button(this.inspector,'Reset arrow geometry',()=>edit(t=>{const x=t.annotations.find(x=>x.id===a.id);for(const k of ['thicknessMm','curveMm','distanceMm','heads'])delete x[k];}));this.button(this.inspector,'Delete arrow',()=>edit(t=>t.annotations=t.annotations.filter(x=>x.id!==a.id)));
 }
};
