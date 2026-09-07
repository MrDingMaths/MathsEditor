// A single measured tab layout for contentEditable, rendered HTML and print.
export function mountTabs(root) {
  let frame,disposed=false,writing=false;
  const put=(el,key,value)=>{if(el.style[key]!==value)el.style[key]=value;};
  const draw=()=>{
    writing=true;
    for(const p of root.querySelectorAll('p')) {
      const tabs=[...p.querySelectorAll('[data-tab]')];if(!tabs.length)continue;
      const box=p.getBoundingClientRect(),css=getComputedStyle(p),layoutWidth=parseFloat(css.width)+(css.boxSizing==='border-box'?0:(parseFloat(css.paddingLeft)||0)+(parseFloat(css.paddingRight)||0)+(parseFloat(css.borderLeftWidth)||0)+(parseFloat(css.borderRightWidth)||0)),scale=box.width/(layoutWidth||box.width||1),unit=96/25.4*scale;
      const left=box.left+(parseFloat(css.paddingLeft)||0)*scale,right=box.right-(parseFloat(css.paddingRight)||0)*scale;
      // Remove previous gaps before measuring: stale widths can wrap the next tab
      // onto another line and select the wrong stop after a container resize.
      for(const tab of tabs)put(tab,'width','0px');
      let stops=[];try{stops=JSON.parse(p.dataset.tabStops||'[]');}catch{}
      for(const tab of tabs) {
        const r=tab.getBoundingClientRect(),current=(r.left-left)/unit;
        const stop=stops.find(s=>s.position>current+.05)??{position:(Math.floor((current+.05)/10)+1)*10,align:'left',leader:'none'};
        const range=document.createRange();range.setStartAfter(tab);let end=tab.nextSibling;while(end&&!(end.nodeType===1&&(end.matches('[data-tab],br'))))end=end.nextSibling;
        end?range.setEndBefore(end):range.setEnd(p,p.childNodes.length);
        const run=range.getBoundingClientRect(),width=run.width/unit;
        let offset=stop.align==='right'?width:stop.align==='center'?width/2:0;
        if(stop.align==='decimal') {
          const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let text;let found=false;
          while((text=walker.nextNode())){if(!range.intersectsNode(text))continue;const index=text.textContent.indexOf('.');if(index<0)continue;const before=range.cloneRange();try{before.setEnd(text,index);offset=before.getBoundingClientRect().width/unit;found=true;break;}catch{}}
          if(!found)offset=width;
        }
        const gap=Math.max(0,Math.min(stop.position-current-offset,(right-r.left)/unit));
        put(tab,'width',(Math.floor(Math.max(0,gap)*100)/100).toFixed(2)+'mm');
        put(tab,'borderBottom',stop.leader==='dots'?'1px dotted currentcolor':stop.leader==='underline'?'1px solid currentcolor':'0px');
      }
    }
    observer.takeRecords();writing=false;
  };
  const schedule=()=>{if(disposed||writing)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);};
  const observer=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('svg')&&(r.type!=='childList'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType!==1||n.tagName?.toLowerCase()!=='svg'))))schedule();});observer.observe(root,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['style','data-tab-stops']});
  const resize=new ResizeObserver(schedule);resize.observe(root);
  root.addEventListener('load',schedule,true);document.fonts?.ready.then(schedule);document.fonts?.addEventListener('loadingdone',schedule);window.addEventListener('beforeprint',draw);schedule();
  return {update:schedule,destroy(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();root.removeEventListener('load',schedule,true);document.fonts?.removeEventListener('loadingdone',schedule);window.removeEventListener('beforeprint',draw);}};
}
