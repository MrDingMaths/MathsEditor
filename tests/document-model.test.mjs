import test from 'node:test';
import assert from 'node:assert/strict';
import {fromSource,normalizeDocument,renderDocument,toSource,template} from '../document-model.mjs';
test('source preserves display maths, literal dollars, marks, cloze and tables',()=>{
 const d=fromSource('A \\$5 price and **bold** $x^2$\n\n$$y=x+1$$\n\n[[answer|24]]\n\n| A | B |\n|---|---|\n| $x$ | 3 |');
 assert.equal(d.blocks.at(-1).type,'table');assert.ok(toSource(d).includes('$$y=x+1$$'));assert.ok(toSource(d).includes('\\$5'));assert.deepEqual(normalizeDocument(JSON.parse(JSON.stringify(d))),d);
});
test('structured layout and image crop survive round trip; unsafe image rejected',()=>{
 const d=normalizeDocument({blocks:[template('parallel'),{id:'image',type:'image',src:'javascript:alert(1)',crop:[10,5,2,0],width:90}]});
 assert.equal(d.blocks[1].src,'');assert.deepEqual(d.blocks[1].crop,[10,5,2,0]);assert.deepEqual(normalizeDocument(JSON.parse(JSON.stringify(d))),d);assert.ok(!renderDocument(d).includes('javascript:'));
});
test('unknown formats and nodes cannot silently lose content',()=>{
 assert.throws(()=>normalizeDocument({version:99}),/version/);assert.throws(()=>normalizeDocument({blocks:[{type:'unknown'}]}),/Unsupported/);
});
import {tableGrid,mergeCells,splitCell,editTrack,trackWidths,setColumnWidth,moveBoundary,unresolvedAnnotations} from '../table-model.mjs';
import {exportSource,freshDocument,paragraph} from '../document-model.mjs';
const fixture=()=>normalizeDocument({blocks:[{id:'t',type:'table',widthMm:90,widths:[1,1,1],annotations:[{id:'arrow',type:'arrow',cellId:'b',toCellId:'f'}],rows:[['a','b','c'],['d','e','f'],['g','h','i']].map(row=>row.map(id=>({id,type:'cell',background:id==='b'?'#ff0000':'#ffffff',rotation:id==='b'?90:0,blocks:[{id:'p'+id,type:'paragraph',inlines:[{type:'text',text:id}]}]})))}]}).blocks[0];
test('inline asset survives model/render/export and clipboard identity remapping',()=>{const doc=normalizeDocument({blocks:[paragraph([{type:'text',text:'before'},{id:'asset',type:'inline-image',src:'/test.png',alt:'Plot',width:13,aspectRatio:2},{type:'math',latex:'x'},{type:'text',text:'after'}])]});assert.deepEqual(normalizeDocument(JSON.parse(JSON.stringify(doc))),doc);assert.match(renderDocument(doc),/data-type="inline-image"/);assert.match(toSource(doc),/before\[Image "Plot" source="\/test.png"\]\$x\$after/);assert.equal(exportSource(doc).losses.length,1);assert.notEqual(freshDocument(doc).blocks[0].inlines[1].id,'asset');});
test('mixed-span merges remap anchors, split restores styles without old content',()=>{const t=fixture();mergeCells(t,'a','right');mergeCells(t,'a','down');assert.equal(tableGrid(t).byId.get('a').rows,2);assert.equal(t.annotations[0].cellId,'a');assert.equal(t.rows[0][0].blocks.map(p=>p.inlines[0].text).join(''),'abde');t.rows[0][0].blocks=[paragraph([{type:'text',text:'edited'}])];splitCell(t,'a');assert.equal(tableGrid(t).entries.length,9);assert.equal(t.rows[0][1].rotation,90);assert.equal(t.rows[0][1].background,'#ff0000');assert.equal(t.rows[0][1].blocks[0].inlines.length,0);assert.equal(t.rows[0][0].blocks[0].inlines[0].text,'edited');assert.deepEqual(unresolvedAnnotations(t),[]);});
test('row and column edits crossing spans retain a rectangular grid and stable survivor',()=>{const t=fixture();mergeCells(t,'a','right');mergeCells(t,'a','down');editTrack(t,'row',1);assert.equal(tableGrid(t).byId.get('a').rows,3);editTrack(t,'column',1);assert.equal(tableGrid(t).byId.get('a').cols,3);editTrack(t,'row',0,true);editTrack(t,'column',0,true);assert.equal(tableGrid(t).byId.get('a').rows,2);assert.equal(tableGrid(t).byId.get('a').cols,2);splitCell(t,'a');assert.equal(tableGrid(t).entries.length,9);});
test('column numbers preserve peer widths; boundary moves preserve total',()=>{const t=fixture();setColumnWidth(t,1,45);assert.equal(t.widthMm,105);assert.deepEqual(trackWidths(t),[30,45,30]);moveBoundary(t,0,200);assert.equal(t.widthMm,105);assert.deepEqual(trackWidths(t),[70,5,30]);assert.throws(()=>setColumnWidth(t,0,190),/page width/);});
test('removed anchors remain explicitly unresolved; copied table anchors follow new IDs',()=>{const t=fixture();editTrack(t,'column',2,true);assert.equal(unresolvedAnnotations(t).length,1);const copied=freshDocument({blocks:[fixture()]}).blocks[0];assert.deepEqual(unresolvedAnnotations(copied),[]);assert.notEqual(copied.annotations[0].cellId,'b');});

test('column insertion and removal preserve existing absolute widths',()=>{const t=fixture();editTrack(t,'column',1);assert.deepEqual(trackWidths(t),[30,30,30,30]);assert.equal(t.widthMm,120);editTrack(t,'column',1,true);assert.equal(t.widthMm,90);assert.deepEqual(trackWidths(t),[30,30,30]);});
test('normalization rejects invalid spanning geometry without discarding it',()=>{const t=fixture();t.rows[2][0].rowspan=2;assert.throws(()=>normalizeDocument({blocks:[t]}),/beyond/);});

test('tabs preserve positions, leaders, clipboard identity and plain text diagnostics',()=>{
 const d=normalizeDocument({blocks:[{id:'tabs',type:'paragraph',tabStops:[{position:50,align:'decimal',leader:'dots'},{position:20,align:'right',leader:'underline'}],inlines:[{type:'math',latex:'(-1,3)'},{type:'tab'},{type:'text',text:'12.5'}]}]});
 assert.deepEqual(d.blocks[0].tabStops.map(s=>s.position),[20,50]);assert.equal(toSource(d),'$(-1,3)$\t12.5');assert.equal(exportSource(d).losses[0].type,'tabs');assert.match(renderDocument(d),/data-tab-stops=/);assert.deepEqual(normalizeDocument(JSON.parse(JSON.stringify(d))),d);assert.deepEqual(freshDocument(d).blocks[0].tabStops,d.blocks[0].tabStops);
});
test('extended arrow style survives normalization and fresh copies without changing legacy defaults',()=>{
 const t=fixture();Object.assign(t.annotations[0],{thicknessMm:.7,curveMm:8,distanceMm:3,heads:'both'});const d=normalizeDocument({blocks:[t]});assert.equal(d.blocks[0].annotations[0].curveMm,8);assert.equal(freshDocument(d).blocks[0].annotations[0].heads,'both');assert.equal(fixture().annotations[0].curveMm,undefined);
});
test('shared layout tracks are additive and render unequal columns',()=>{const l=template('parallel');l.tracks=[1,3];const d=normalizeDocument({blocks:[l]});assert.deepEqual(d.blocks[0].tracks,[1,3]);assert.match(renderDocument(d),/minmax\(0,1fr\) minmax\(0,3fr\)/);});

test('plain tabs become structured tabs without changing literal dollar handling',()=>{const d=fromSource('a\tb');assert.deepEqual(d.blocks[0].inlines.map(n=>n.type),['text','tab','text']);assert.equal(toSource(d),'a\tb');});

test('table arrows have separated endpoints and diagonal tangent-aligned heads', async () => {
  const {tableArrowGeometry}=await import('../table-annotations.mjs');
  const cell=left=>({left,top:0,bottom:40,width:40,height:40});
  for(const side of ['top','bottom']) {
    const a=tableArrowGeometry(cell(0),cell(40),{cellId:'a',toCellId:'b',side});
    const b=tableArrowGeometry(cell(40),cell(80),{cellId:'b',toCellId:'c',side});
    assert.ok(a.end[0]<b.start[0], 'neighbouring arrows leave a gap at the shared cell');
    assert.notEqual(a.controls[0][0],a.start[0]);assert.notEqual(a.controls[1][0],a.end[0]);
    assert.ok(a.path.includes(' C '));assert.ok(a.endHead.endsWith(' Z'));
    const reversed=tableArrowGeometry(cell(40),cell(0),{cellId:'b',toCellId:'a',side});
    assert.ok(reversed.controls[0][0]<reversed.start[0]);
  }
});
