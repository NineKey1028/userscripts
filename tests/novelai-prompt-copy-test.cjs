const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../scripts/novelai/NovelAI-Prompt-Weight-Hotkeys.user.js'), 'utf8');
const context = {
  window: {addEventListener() {}},
  document: {readyState:'loading', addEventListener() {}},
  navigator: {clipboard:{writeText:async text => { context.copied = text; }}},
  setTimeout() {},
};
vm.createContext(context);
vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'this.api = {mergeCopyPrompts, readCopyEditor, positiveCopyEditors, refreshChunkCategories, copyPositivePrompts, getChunkRecords, plan};})();'), context);
const {mergeCopyPrompts:merge, plan, readCopyEditor:read} = context.api;
const cases = [
  [['1girl, brown hair', 'girl, brown hair, blue eyes', 'boy, 1boy'], '1girl, brown hair,\nblue eyes,\n1boy'],
  [['Brown   hair, brown hair, BROWN HAIR'], 'Brown hair'],
  [['1.2::girl, brown hair, blue eyes::', 'brown hair, boy, 1boy'], '1.2::brown hair, blue eyes::,\n1boy'],
  [['brown hair', '1.3::brown hair, green eyes::'], 'brown hair,\n1.3::green eyes::'],
  [['(girl, brown hair:1.2)', '(brown hair:0.8), 1girl'], '(brown hair:1.2),\n1girl'],
  [['{girl, brown hair}, [boy, blue eyes], brown hair'], '{brown hair}, [blue eyes]'],
  [['girl, boy, 1.2::girl, boy::'], ''],
  [['2girls, 2boys, cowgirl, tomboy, girl focus'], '2girls, 2boys, cowgirl, tomboy, girl focus'],
  [['character (series, variant), brown hair', 'character (series, variant)'], 'character (series, variant), brown hair'],
  [['1.2::brown hair, 0.8::blue eyes::::', 'blue eyes'], '1.2::brown hair, 0.8::blue eyes::::'],
  [['1girl,\nbrown hair, blue eyes,\n\nsmile', 'girl, brown hair,\nred dress'], '1girl,\nbrown hair, blue eyes,\n\nsmile,\nred dress'],
  [['1.2::brown hair,\nblue eyes::,\nsmile'], '1.2::brown hair,\nblue eyes::,\nsmile'],
  [['brown hair,\nbrown hair,\nblue eyes'], 'brown hair,\n\nblue eyes'],
  [['1girl\r\nbrown hair\r\nblue eyes'], '1girl,\nbrown hair,\nblue eyes'],
];
for (const [input, expected] of cases) assert.equal(merge(input), expected, JSON.stringify(input));

// Minimal DOM fixtures follow the observed NovelAI macro attributes.
const text = data => ({nodeType:3, data});
const element = (tagName, childNodes=[], attrs={}) => ({
  nodeType:1, tagName, childNodes,
  textContent:attrs['data-macro-label'] || '',
  hasAttribute:name => Object.hasOwn(attrs, name),
  getAttribute:name => attrs[name] ?? null,
  querySelector:selector => childNodes.find(node => node.hasAttribute?.('data-macro-id')) || childNodes.map(node=>node.querySelector?.(selector)).find(Boolean) || null,
});
const macro = (label, expansion, id=label) => element('SPAN', [], {'data-macro-id':id, 'data-macro-label':label, 'data-macro-expansion':expansion});
const atom={};
let records=[
  {id:'style-category',label:'STYLE',isCategory:true,childOrder:['Not named style']},
  {id:'character-category',label:'角色',isCategory:true,childOrder:['style-like character name']},
  {id:'Not named style',label:'Not named style',isCategory:false,expansion:'artist, sketch'},
  {id:'style-like character name',label:'style-like character name',isCategory:false,expansion:'brown hair, blue eyes'},
  {id:'default',label:'Root Category',isCategory:true,childOrder:['uncategorized']},
  {id:'uncategorized',label:'uncategorized',expansion:'green eyes'},
];
const requireSite = id => id==='68898'?{lA:atom}:{A:{get:a=>{assert.equal(a,atom);return records;}}};
requireSite.m={68898:{toString:()=> 'lA:()=>a,Nn:()=>b,.eU)'},24554:{toString:()=> 'A:()=>a,.y$)()'}};
const queue=[];
queue.push=function(entry){Array.prototype.push.call(this,entry);entry[2](requireSite);};
context.window.webpackChunk_N_E=queue;
context.api.refreshChunkCategories();
assert.equal(queue.length,0);
const editor = element('DIV', [element('P', [text('1girl'), macro('Not named style', 'artist, sketch'), macro('style-like character name', 'brown hair, blue eyes'), text('brown hair')])]);
assert.equal(merge([read(editor)]), '1girl, brown hair, blue eyes');
records[3].expansion='brown hair,\n\nblue eyes';
context.api.refreshChunkCategories();
assert.equal(merge([read(editor)]),'1girl, brown hair,\n\nblue eyes');
records[3].expansion='brown hair, blue eyes';
context.api.refreshChunkCategories();
assert.throws(() => read(element('DIV', [macro('unknown', 'artist')])), /不在目前資料清單/);
assert.equal(merge([read(element('DIV',[macro('uncategorized','stale content')]))]),'green eyes');

// Category detection uses category membership, never a chunk's label or color.
// No panel is ever mounted; category moves/renames are read on the next copy.
context.document.getElementById = () => {throw new Error('Panel must not be consulted');};
records[0].childOrder.push('style-like character name');
records[1].childOrder=[];
context.api.refreshChunkCategories();
assert.equal(merge([read(editor)]),'1girl, brown hair');
records[0].childOrder=['Not named style'];
records[1].childOrder=['style-like character name'];
records.push({id:'nested',label:'nested',isCategory:false,expansion:'⌜macro:Not named style⌟, !macro:uncategorized!'});
context.api.refreshChunkCategories();
assert.equal(merge([read(element('DIV',[macro('nested','old')]))]),'green eyes');
records.push({id:'cycle',label:'cycle',isCategory:false,expansion:'!macro:cycle!'});
context.api.refreshChunkCategories();
assert.throws(()=>read(element('DIV',[macro('cycle','old')])),/循環引用/);
const loadedRecords=records;
records=undefined;
assert.throws(()=>context.api.refreshChunkCategories(),/正在載入/);
records=loadedRecords;
context.api.refreshChunkCategories();

// Positive-only exact class matching excludes UC and deduplicates mobile mirrors.
const box = (className, editor, opacity='1') => ({classList:[className], querySelector:()=>editor, closest:()=>({style:{opacity}})});
const e1=element('DIV',[text('girl, brown hair')]), e2=element('DIV',[text('1boy, blue eyes')]);
const scope = {parentElement:{}, querySelector:()=>true, querySelectorAll:()=>[
  box('prompt-input-box-character-prompts-2',e2),
  box('prompt-input-box-character-prompts-1-undesired-content',element('DIV',[text('bad quality')])),
  box('prompt-input-box-character-prompts-1',e1),
  box('prompt-input-box-character-prompts-3',element('DIV',[text('disabled character tag')]),'0.5'),
  box('prompt-input-box-character-prompts-1',element('DIV',[text('mirror')]))
]};
const base = {parentElement:scope, querySelector:()=>editor};
assert.deepEqual(Array.from(context.api.positiveCopyEditors(base)), [editor,e1,e2]);
let enabledOpacity='0.5';
const toggleBox=box('prompt-input-box-character-prompts-3',e1);
toggleBox.closest=()=>({style:{opacity:enabledOpacity}});
const toggleScope={parentElement:{},querySelector:()=>true,querySelectorAll:()=>[toggleBox]};
const toggleBase={parentElement:toggleScope,querySelector:()=>editor};
assert.deepEqual(Array.from(context.api.positiveCopyEditors(toggleBase)),[editor]);
enabledOpacity='1';
assert.deepEqual(Array.from(context.api.positiveCopyEditors(toggleBase)),[editor,e1]);
enabledOpacity='0.5';
assert.deepEqual(Array.from(context.api.positiveCopyEditors(toggleBase)),[editor]);
enabledOpacity='';
assert.throws(()=>context.api.positiveCopyEditors(toggleBase),/無法確認 Character 3/);

// Existing shortcuts retain their exact conversion syntax.
for (const [input, action, expected] of [['tag','up','1.1::tag::'],['1.1::tag::','down','tag'],['1.2::tag::,','toggle','(tag:1.2),'],['(tag:1.2),','toggle','1.2::tag::,']]) {
  const p=plan(input,0,input.length,action);
  let output=input;
  for (const edit of p.edits.sort((a,b)=>b.start-a.start)) output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);
  assert.equal(output,expected);
}
(async () => {
  const button={};
  await context.api.copyPositivePrompts(base,button);
  assert.equal(context.copied,'1girl, brown hair, blue eyes,\n1boy,');
  assert.equal(button.textContent,'已複製');
  for (const [input, expected] of [['brown hair','brown hair,'],['brown hair,','brown hair,'],['A smiling character.','A smiling character.'],['1.2::brown hair::','1.2::brown hair::,']]) {
    const lastEditor=element('DIV',[text(input)]);
    const lastScope={parentElement:{},querySelector:()=>true,querySelectorAll:()=>[]};
    await context.api.copyPositivePrompts({parentElement:lastScope,querySelector:()=>lastEditor},{});
    assert.equal(context.copied,expected);
  }
  console.log('PASS: merge cases, chunk classification/expansion, unknown-category guard, positive editor selection, clipboard and existing hotkeys');
})().catch(error => { console.error(error); process.exitCode=1; });
