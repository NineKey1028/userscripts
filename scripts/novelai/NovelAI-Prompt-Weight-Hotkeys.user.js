// ==UserScript==
// @name         NovelAI Prompt Weight Hotkeys
// @namespace    https://novelai.net/
// @version      2.2.1
// @description  Ctrl+Up/Down: weight; Ctrl+Alt+C: toggle the entire editor's weight format.
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/novelai
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/novelai/NovelAI-Prompt-Weight-Hotkeys.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/novelai/NovelAI-Prompt-Weight-Hotkeys.user.js
// @match        https://novelai.net/image*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(() => {
  'use strict';
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  const fmt = n => String(Number(n.toFixed(6))) + (Number.isInteger(Number(n.toFixed(6))) ? '.0' : '');
  const escaped = (s,i) => {let n=0; while(i>0 && s[--i]==='\\') n++; return n%2;};
  function groups(text,kind) {
    const out=[];
    if(kind==='nai') {
      const re=new RegExp('('+number+')::','g'); let m;
      while((m=re.exec(text))) {
        if(escaped(text,m.index) || (m.index && /[\w.:+-]/.test(text[m.index-1]))) continue;
        let end=text.indexOf('::',re.lastIndex);
        while(end>=0 && escaped(text,end)) end=text.indexOf('::',end+2);
        if(end<0) break;
        out.push({start:m.index,end:end+2,bodyStart:re.lastIndex,bodyEnd:end,weight:Number(m[1])});
        re.lastIndex=end+2;
      }
    } else {
      const stack=[];
      for(let i=0;i<text.length;i++) {
        if(escaped(text,i)) continue;
        if(text[i]==='(') stack.push(i);
        if(text[i]!==')' || !stack.length) continue;
        const start=stack.pop();
        const m=new RegExp('(:{1,2})('+number+')\\s*$').exec(text.slice(start+1,i));
        if(m) out.push({start,end:i+1,bodyStart:start+1,bodyEnd:start+1+m.index,weight:Number(m[2])});
      }
    }
    return out;
  }
  function plan(text,start,end,action) {
    if(action==='toggle') {
      // A mixed prompt is first normalized to NovelAI; the next press converts
      // all NovelAI groups to ComfyUI. Selection never limits conversion scope.
      action=groups(text,'comfy').length ? 'n' : 'c';
      start=0; end=text.length;
    }
    const source=groups(text,action==='n'?'comfy':'nai');
    const enclosing=source.filter(g=>g.start<=start && g.end>=end && (start!==end || start<g.end))
      .sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
    const chosen=enclosing?[enclosing]:source.filter(g=>g.start>=start && g.end<=end);
    if(chosen.some(a=>chosen.some(b=>a!==b && a.start<b.start && a.end>b.end))) return null;
    const edits=[];
    if(action==='up'||action==='down') {
      if(chosen.length>1) return null;
      const delta=action==='up'?0.1:-0.1;
      if(chosen.length) {
        const g=chosen[0]; let n=Math.round((g.weight+delta)*1e6)/1e6;
        if((g.weight<1 && n>1)||(g.weight>1 && n<1)) n=1;
        if(!Number.isFinite(n)) return null;
        edits.push({start:g.start,end:g.bodyStart,text:n===1?'':fmt(n)+'::'});
        if(n===1) edits.push({start:g.bodyEnd,end:g.end,text:''});
        start=g.start; end=g.end;
      } else {
        if(start===end) return null;
        while(start<end && /\s/.test(text[start])) start++;
        while(end>start && /[\s,]/.test(text[end-1])) end--;
        if(start===end || text.slice(start,end).includes('::')) return null;
        edits.push({start,end:start,text:fmt(1+delta)+'::'},{start:end,end,text:'::'});
      }
    } else {
      if(!chosen.length) return null;
      if(enclosing) {start=enclosing.start; end=enclosing.end;}
      for(const g of chosen) {
        if (action === 'c') {
          // Build the complete group using ComfyUI's single-colon form.
          const body = text.slice(g.bodyStart, g.bodyEnd);
          const replacement = g.weight === 1 ? body : `(${body.replace(/:+$/, '')}:${fmt(g.weight)})`;
          edits.push({start:g.start,end:g.end,text:replacement});
        } else {
          edits.push({start:g.start,end:g.bodyStart,text:g.weight===1?'':fmt(g.weight)+'::'});
          edits.push({start:g.bodyEnd,end:g.end,text:g.weight===1?'':'::'});
        }
      }
    }
    return {start,end,edits};
  }
  // Use the same representation for text, paragraph breaks and selection offsets.
  function snapshot(root) {
    let text=''; const points=[],offsets=new WeakMap();
    const mark=(node,offset)=>{points[text.length]=[node,offset];};
    function walk(node) {
      const at=[]; offsets.set(node,at);
      if(node.nodeType===3) {
        for(let i=0;i<=node.data.length;i++) {at[i]=text.length; mark(node,i); if(i<node.data.length) text+=node.data[i];}
        return;
      }
      const children=Array.from(node.childNodes);
      for(let i=0;i<children.length;i++) {
        const child=children[i]; at[i]=text.length; if(!points[text.length]) mark(node,i);
        if(child.nodeName==='BR') {
          if(!child.classList.contains('ProseMirror-trailingBreak') && children.length>1) text+='\n';
          offsets.set(child,[text.length]); mark(node,i+1);
        } else {
          if(i>0 && /^(P|DIV|LI|PRE|BLOCKQUOTE)$/.test(child.nodeName)) text+='\n';
          walk(child);
        }
      }
      at[children.length]=text.length;
      if(!points[text.length]) mark(node,children.length);
    }
    walk(root);
    const sel=window.getSelection(); if(!sel?.rangeCount) return null;
    const r=sel.getRangeAt(0);
    return {text,points,start:offsets.get(r.startContainer)?.[r.startOffset],end:offsets.get(r.endContainer)?.[r.endOffset]};
  }
  function select(root,start,end) {
    const s=snapshot(root);
    if(!s?.points[start]||!s.points[end]) throw new Error('Cannot map editor selection');
    const r=document.createRange(); r.setStart(...s.points[start]); r.setEnd(...s.points[end]);
    const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(r);
  }
  let revision=0;
  function handler(event) {
    if(!event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing) return;
    const action=!event.altKey?({ArrowUp:'up',ArrowDown:'down'})[event.key]:({c:'toggle'})[event.key.toLowerCase()];
    if(!action) return;
    const root=document.activeElement, plain=root instanceof HTMLTextAreaElement;
    if(!plain && (!root?.isContentEditable||!root.classList.contains('ProseMirror'))) return;
    if(plain && (root.disabled||root.readOnly)) return;
    const s=plain?{text:root.value,start:root.selectionStart,end:root.selectionEnd}:snapshot(root);
    if(!s||s.start===undefined||s.end===undefined) return;
    const p=plan(s.text,s.start,s.end,action); if(!p) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const id=++revision, edits=p.edits.sort((a,b)=>b.start-a.start);
    let expected=s.text;
    for(const e of edits) expected=expected.slice(0,e.start)+e.text+expected.slice(e.end);
    const finalEnd=p.end+edits.reduce((n,e)=>n+e.text.length-(e.end-e.start),0);
    if(plain) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(root,expected);
      root.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
      root.setSelectionRange(p.start,finalEnd);
    } else {
      // Native editing events update ProseMirror. Change syntax only, never its paragraph content.
      for(const e of edits) {
        select(root,e.start,e.end);
        if(!document.execCommand(e.text?'insertText':'delete',false,e.text)) {
          console.warn('NovelAI Weight: editor rejected edit'); return;
        }
      }
      const restore=()=>{
        if(revision!==id||document.activeElement!==root) return;
        if(snapshot(root)?.text===expected) select(root,p.start,finalEnd);
      };
      restore(); queueMicrotask(restore); requestAnimationFrame(restore);
    }
  }
  window.addEventListener('keydown',handler,true);
  window.addEventListener('pointerdown',()=>revision++,true);
  window.addEventListener('keydown',()=>revision++,true);
})();
