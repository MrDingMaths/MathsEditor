// Optional visual arrangements reference content; they never own copies of it.
export const ARRANGEMENT_VERSION = 1;
export const copy = value => JSON.parse(JSON.stringify(value));
export const group = (id, children = [], direction = 'stack') => ({id, type:'group', direction, gap:2, children});
export const item = (ref, title='') => ({id:'layout:'+ref, type:'item', ref, title});
export function findArrangement(root,id) {
  if(root?.id===id)return root;
  for(const child of root?.children??[]){const found=findArrangement(child,id);if(found)return found;}
  return null;
}
export function arrangementParent(root,id){return root?.children?.some(c=>c.id===id)?root:(root?.children??[]).map(c=>arrangementParent(c,id)).find(Boolean);}
export function arrangementItems(root){return root?.type==='item'?[root]:(root?.children??[]).flatMap(arrangementItems);}
export function normalizeArrangement(value){
  if(!value||value.version!==1||!value.root)return null;
  const ids=new Set(),refs=new Set();
  function visit(n,depth=0){
    if(!n||depth>30||typeof n.id!=='string'||ids.has(n.id))throw Error('Invalid or duplicate arrangement ID');ids.add(n.id);
    if(!['item','group'].includes(n.type))throw Error('Unknown arrangement type');
    const out={id:n.id,type:n.type};
    if(n.type==='item'){if(typeof n.ref!=='string'||refs.has(n.ref))throw Error('Duplicate content reference');refs.add(n.ref);out.ref=n.ref;}
    else {out.direction=n.direction==='row'?'row':'stack';out.children=(n.children??[]).map(c=>visit(c,depth+1));}
    if(n.title)out.title=String(n.title);
    for(const [key,max]of [['gap',30],['before',80],['after',80],['inset',60],['width',190],['weight',100],['height',180]])if(Number.isFinite(n[key]))out[key]=Math.max(key==='weight'?.1:0,Math.min(max,n[key]));
    if(['left','center','right','stretch'].includes(n.align))out.align=n.align;
    if(n.keepTogether!=null)out.keepTogether=!!n.keepTogether;if(n.keepInline!=null)out.keepInline=!!n.keepInline;
    return out;
  }
  return {version:1,root:visit(value.root)};
}
export function transformArrangement(value,command,id,options={}){
  const next=copy(value),root=next.root,node=findArrangement(root,id),parent=arrangementParent(root,id);
  if(!node)throw Error('Select an item first');
  const index=parent?.children.indexOf(node);
  if(command==='properties')Object.assign(node,options);
  else if(command==='group'){if(!parent)throw Error('The question is already a group');const selected=options.ids??[id];const children=parent.children.filter(c=>selected.includes(c.id));if(children.length!==selected.length)throw Error('Group items from the same parent');const at=parent.children.indexOf(children[0]);parent.children=parent.children.filter(c=>!selected.includes(c.id));parent.children.splice(at,0,group(options.id??'group:'+crypto.randomUUID(),children,options.direction));}
  else if(command==='ungroup'){if(!parent||node.type!=='group')throw Error('Select a nested group');parent.children.splice(index,1,...node.children);}
  else if(command==='before'||command==='after'){if(!parent)return next;const to=index+(command==='before'?-1:1);if(to>=0&&to<parent.children.length){parent.children.splice(index,1);parent.children.splice(to,0,node);}}
  else if(command==='move'){const target=findArrangement(root,options.targetId);if(!parent||!target||target.id===id||findArrangement(node,target.id))throw Error('Choose a destination outside the selection');const destination=options.position==='inside'?target:arrangementParent(root,target.id);if(destination?.type!=='group')throw Error('Choose a group or column');parent.children.splice(index,1);const at=options.position==='inside'?destination.children.length:destination.children.indexOf(target)+(options.position==='after'?1:0);destination.children.splice(at,0,node);}
  else if(command==='out'||command==='full-width'){
    let container=parent;
    if(command==='full-width'){while(container&&container.direction!=='row')container=arrangementParent(root,container.id);}
    const outer=container&&arrangementParent(root,container.id);
    if(!parent||!outer)throw Error('This item already spans its containing group');
    parent.children.splice(index,1);outer.children.splice(outer.children.indexOf(container)+1,0,node);delete node.width;
  } else if(command==='remove'){if(!parent)throw Error('Cannot remove the question');parent.children.splice(index,1);}
  return normalizeArrangement(next);
}
