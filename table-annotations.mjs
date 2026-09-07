// Local CSS-pixel geometry: independent of the paper's display zoom.
export function tableArrowGeometry(from, to, annotation = {}) {
  const sign = annotation.side === 'top' ? -1 : 1;
  const same = annotation.cellId === annotation.toCellId;
  const center = cell => cell.left + cell.width / 2;
  const startX = center(from) - (same ? from.width * .25 : 0);
  const endX = center(to) + (same ? to.width * .25 : 0);
  const direction = Math.sign(endX - startX) || 1;
  const gap = Math.min(3.5, Math.abs(endX - startX) * .08);
  const sx = startX + direction * gap, ex = endX - direction * gap;
  const distance = annotation.distanceMm == null ? 3 : annotation.distanceMm * 96 / 25.4;
  const sy = (sign < 0 ? from.top : from.bottom) + sign * distance;
  const ey = (sign < 0 ? to.top : to.bottom) + sign * distance;
  const depth = annotation.curveMm == null ? Math.max(10, Math.abs(ex-sx)*.3) : annotation.curveMm * 96 / 25.4;
  const handle = Math.max(4, Math.abs(ex-sx)*.28);
  const c1 = [sx+direction*handle, sy+sign*depth];
  const c2 = [ex-direction*handle, ey+sign*depth];
  const head = (x,y,tx,ty) => {
    const length=Math.hypot(tx,ty)||1, ux=tx/length, uy=ty/length;
    const size=Math.max(5, Math.min(8, Math.abs(ex-sx)*.2));
    const bx=x-ux*size, by=y-uy*size, half=size*.42;
    return `M ${x} ${y} L ${bx-uy*half} ${by+ux*half} L ${bx+uy*half} ${by-ux*half} Z`;
  };
  return {
    path:`M ${sx} ${sy} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${ex} ${ey}`,
    startHead:head(sx,sy,sx-c1[0],sy-c1[1]), endHead:head(ex,ey,ex-c2[0],ey-c2[1]),
    labelX:(sx+ex)/2, labelY:(sy+ey)/2+sign*(depth*.75+12),
    start:[sx,sy], end:[ex,ey], controls:[c1,c2],
  };
}

// Measure cell anchors after fonts/layout settle; no guessed absolute page positions.
export function mountTableAnnotations(root, options = {}) {
  let frame,disposed=false;
  const ns='http://www.w3.org/2000/svg';
  const draw=()=>{
    for(const table of root.querySelectorAll('table[data-annotations]')) {
      const wrap=table.parentElement, screen=table.getBoundingClientRect();
      const width=parseFloat(getComputedStyle(table).width)||table.offsetWidth;
      const scale=screen.width/width||1;
      const rect={width,height:screen.height/scale,left:0,top:0};
      wrap.querySelector(':scope > [data-table-annotations]')?.remove();
      if(!rect.width || !rect.height)continue;
      const annotations=JSON.parse(table.dataset.annotations||'[]');const ids=new Set([...table.querySelectorAll('td[data-id],th[data-id]')].map(c=>c.dataset.id));const missing=annotations.filter(a=>!ids.has(a.cellId)||(a.type==='arrow'&&!ids.has(a.toCellId)));let warning=wrap.querySelector('[data-annotation-diagnostics]');if(missing.length){if(!warning){warning=document.createElement('output');warning.dataset.annotationDiagnostics='';warning.contentEditable='false';wrap.append(warning);}const text='Unresolved annotation anchors: '+missing.map(a=>a.id).join(', ');if(warning.textContent!==text)warning.textContent=text;}else warning?.remove();if(!annotations.length)continue;
      const svg=document.createElementNS(ns,'svg'); svg.setAttribute('data-table-annotations','');if(!options?.onselect)svg.setAttribute('aria-hidden','true');svg.setAttribute('contenteditable','false');
      svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
      svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';wrap.append(svg);
      let group;const add=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));(group??svg).append(el);return el;};
      const cells=new Map([...table.querySelectorAll('td[data-id],th[data-id]')].map(c=>[c.dataset.id,(()=>{const r=c.getBoundingClientRect();return {left:(r.left-screen.left)/scale,top:(r.top-screen.top)/scale,bottom:(r.bottom-screen.top)/scale,width:r.width/scale,height:r.height/scale};})()]));
      for(const a of annotations) {
        group=document.createElementNS(ns,'g');group.dataset.annotationId=a.id;svg.append(group);
        if(options?.onselect){group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label',`Edit ${a.type}: ${a.label||'unlabelled'}`);group.style.pointerEvents='visiblePainted';const select=e=>{e.preventDefault();e.stopPropagation();options.onselect(table.dataset.id,a.id);};group.addEventListener('click',select);group.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key))select(e);});}

        const c=cells.get(a.cellId);if(!c)continue;const x=c.left-rect.left+c.width/2,y=c.top-rect.top+c.height/2;
        const stroke=a.colour, common={fill:'none',stroke,'stroke-width':a.thicknessMm==null?1.7:a.thicknessMm*96/25.4};
        if(a.type==='circle') add('ellipse',{...common,cx:x,cy:y,rx:Math.min(c.width*.38,12),ry:Math.min(c.height*.38,12)});
        if(a.type==='box')add('rect',{...common,x:c.left-rect.left+2,y:c.top-rect.top+2,width:c.width-4,height:c.height-4});
        if(a.type==='arrow'){
          const d=cells.get(a.toCellId);if(!d)continue;
          const geometry=tableArrowGeometry(c,d,a);
          add('path',{...common,d:geometry.path,'stroke-linecap':'round'});
          if(['end','both'].includes(a.heads??'end'))add('path',{fill:stroke,d:geometry.endHead});
          if(['start','both'].includes(a.heads))add('path',{fill:stroke,d:geometry.startHead});
          if(options?.onselect)add('path',{d:geometry.path,fill:'none',stroke:'transparent','stroke-width':16,'pointer-events':'stroke'});
          const {labelX,labelY}=geometry;
          if(a.labelBox)add('rect',{x:labelX-12,y:labelY-10,width:24,height:22,fill:'white',stroke:'#888','stroke-width':1});
          if(a.label){const text=add('text',{x:labelX,y:labelY+5,'text-anchor':'middle',fill:stroke,'font-size':14});text.textContent=a.label;}
        }
      }
    }
  };
  const schedule=()=>{if(disposed)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{for(const table of root.querySelectorAll('table'))observer.observe(table);draw();});};
  const observer=new ResizeObserver(schedule);observer.observe(root);
  const mutations=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('svg')&&(r.type!=='childList'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType!==1||n.tagName?.toLowerCase()!=='svg'))))schedule();});
  mutations.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['style','data-annotations']});
  document.fonts?.ready.then(schedule);schedule();
  return {update:schedule,destroy(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();}};
}
