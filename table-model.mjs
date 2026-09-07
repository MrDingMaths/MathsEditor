// Logical table operations; physical row arrays hold only cell origins.
const clone=x=>JSON.parse(JSON.stringify(x));
const id=()=>globalThis.crypto.randomUUID();
const empty=style=>({...clone(style??{}),id:id(),type:'cell',rowspan:1,colspan:1,blocks:[{id:id(),type:'paragraph',inlines:[]}]});
export function tableGrid(table) {
  const grid=Array.from({length:table.rows.length},()=>[]),entries=[],byId=new Map();
  table.rows.forEach((row,r)=>{let col=0;row.forEach(cell=>{
    while(grid[r][col])col++;
    const h=cell.rowspan??1,w=cell.colspan??1;
    if(r+h>grid.length)throw new Error('A table cell spans beyond the last row.');
    const entry={cell,row:r,col,rows:h,cols:w};
    if(byId.has(cell.id))throw new Error('Duplicate table cell identity.');
    for(let y=r;y<r+h;y++)for(let x=col;x<col+w;x++){if(grid[y][x])throw new Error('Overlapping table cells.');grid[y][x]=entry;}
    entries.push(entry);byId.set(cell.id,entry);col+=w;
  });});
  const columns=Math.max(0,...grid.map(r=>r.length));
  if(!columns||grid.some(r=>Array.from({length:columns},(_,i)=>r[i]).some(c=>!c)))throw new Error('The table has uncovered grid positions.');
  return {grid,entries,byId,columns,rows:grid.length};
}
function rebuild(table,entries,rows) {
  table.rows=Array.from({length:rows},()=>[]);
  entries.sort((a,b)=>a.row-b.row||a.col-b.col).forEach(e=>table.rows[e.row].push(e.cell));
  tableGrid(table);
}
const style=cell=>Object.fromEntries(['header','align','verticalAlign','background','colour','bold','rotation','border','borderColour','borderWidthMm'].filter(k=>cell[k]!==undefined).map(k=>[k,clone(cell[k])]));
function styles(e) {return Array.from({length:e.rows},(_,r)=>Array.from({length:e.cols},(_,c)=>({row:r,col:c,style:clone(e.cell.splitStyles?.find(s=>s.row===r&&s.col===c)?.style??style(e.cell))}))).flat();}
export function mergeCells(table,cellId,direction) {
  const map=tableGrid(table),a=map.byId.get(cellId);
  const b=direction==='right'?map.grid[a.row]?.[a.col+a.cols]:map.grid[a.row+a.rows]?.[a.col];
  if(!b)throw new Error('There is no adjacent cell in that direction.');
  const bottom=Math.max(a.row+a.rows,b.row+b.rows),right=Math.max(a.col+a.cols,b.col+b.cols);
  const involved=map.entries.filter(e=>e.row<bottom&&e.row+e.rows>a.row&&e.col<right&&e.col+e.cols>a.col);
  if(involved.some(e=>e.row<a.row||e.col<a.col||e.row+e.rows>bottom||e.col+e.cols>right))throw new Error('These cells do not form a rectangle.');
  a.cell.splitStyles=involved.flatMap(e=>styles(e).map(s=>({...s,row:s.row+e.row-a.row,col:s.col+e.col-a.col})));
  a.cell.blocks=involved.flatMap(e=>e.cell.blocks);a.cell.rowspan=bottom-a.row;a.cell.colspan=right-a.col;
  const removed=new Set(involved.filter(e=>e!==a).map(e=>e.cell.id));
  for(const annotation of table.annotations??[])for(const key of ['cellId','toCellId'])if(removed.has(annotation[key]))annotation[key]=a.cell.id;
  rebuild(table,map.entries.filter(e=>!removed.has(e.cell.id)),map.rows);
}
export function splitCell(table,cellId) {
  const map=tableGrid(table),e=map.byId.get(cellId),entries=map.entries.filter(x=>x!==e);
  const formats=styles(e);
  for(let r=0;r<e.rows;r++)for(let c=0;c<e.cols;c++){
    const format=formats.find(s=>s.row===r&&s.col===c).style;
    const cell=r===0&&c===0?Object.assign(e.cell,format,{rowspan:1,colspan:1}):empty(format);
    delete cell.splitStyles;entries.push({cell,row:e.row+r,col:e.col+c});
  }
  rebuild(table,entries,map.rows);
}
export function editTrack(table,axis,index,remove=false,max=190) {
  const map=tableGrid(table),row=axis==='row',key=row?'row':'col',span=row?'rowspan':'colspan',size=row?map.rows:map.columns;
  if(remove&&size===1)throw new Error('The final '+axis+' cannot be removed.');
  const originalWidths=trackWidths(table,table.widthMm??80);
  const entries=[];
  for(const e of map.entries){
    const start=e[key],length=e.cell[span]??1,end=start+length;
    if(remove&&start===index&&length===1)continue;
    if(remove?start>index:start>=index)e[key]+=remove?-1:1;
    else if(remove?start<=index&&end>index:start<index&&end>index){
      const old=styles(e),offset=index-start;e.cell[span]=length+(remove?-1:1);
      e.cell.splitStyles=old.filter(s=>!remove||s[key]!==offset).map(s=>({...s,[key]:s[key]>offset||(!remove&&s[key]>=offset)?s[key]+(remove?-1:1):s[key]}));
    }
    entries.push(e);
  }
  if(!remove){const across=row?map.columns:map.rows;for(let i=0;i<across;i++){
    const r=row?index:i,c=row?i:index;
    if(!entries.some(e=>r>=e.row&&r<e.row+(e.cell.rowspan??1)&&c>=e.col&&c<e.col+(e.cell.colspan??1)))entries.push({row:r,col:c,cell:empty()});
  }}
  if(row){table.rowHeights??=[];table.rowHeights.splice(index,remove?1:0,...(remove?[]:[10]));}
  else {const widths=originalWidths,newWidth=Math.min(widths[Math.min(index,widths.length-1)],max-widths.reduce((a,b)=>a+b,0));if(!remove&&newWidth<5)throw new Error('Reduce table width to make room for another column (at least 5 mm).');widths.splice(index,remove?1:0,...(remove?[]:[newWidth]));table.widths=widths;table.widthMm=widths.reduce((a,b)=>a+b,0);}
  rebuild(table,entries,map.rows+(row?(remove?-1:1):0));
}
export function trackWidths(table,total=table.widthMm??80) {
  const count=tableGrid(table).columns,weights=Array.from({length:count},(_,i)=>table.widths?.[i]??1),sum=weights.reduce((a,b)=>a+b,0);
  return weights.map(w=>total*w/sum);
}
export function setColumnWidth(table,index,width,total=table.widthMm??80,max=190) {
  const widths=trackWidths(table,total);
  if(!Number.isFinite(width)||width<5)throw new Error('Column width must be at least 5 mm.');
  widths[index]=width;const next=widths.reduce((a,b)=>a+b,0);
  if(next>max+.001)throw new Error('The table would exceed the available page width.');
  table.widthMm=next;table.widths=widths;
}
export function moveBoundary(table,index,delta,total=table.widthMm??80) {
  const widths=trackWidths(table,total),lo=Math.min(5,widths[index]),hi=Math.min(5,widths[index+1]);
  delta=Math.max(lo-widths[index],Math.min(widths[index+1]-hi,delta));
  widths[index]+=delta;widths[index+1]-=delta;table.widthMm=total;table.widths=widths;
}
export function unresolvedAnnotations(table) {
  const ids=new Set(table.rows.flat().map(c=>c.id));
  return (table.annotations??[]).filter(a=>!ids.has(a.cellId)||(a.type==='arrow'&&!ids.has(a.toCellId)));
}
