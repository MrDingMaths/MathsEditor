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
