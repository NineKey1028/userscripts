// ==UserScript==
// @name         NovelAI Prompt Weight Hotkeys
// @namespace    https://novelai.net/
// @version      2.3.3
// @description  Weight hotkeys, whole-editor format conversion, and merged positive-prompt copy without style chunks.
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
      action=groups(text,'comfy').length || /\\[()]/.test(text) ? 'n' : 'c';
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
      if(!chosen.length && action !== 'c' && !/\\[()]/.test(text)) return null;
      if(enclosing) {start=enclosing.start; end=enclosing.end;}
      for(const g of chosen) {
        if (action === 'c') {
          // Build the complete group using ComfyUI's single-colon form.
          const body = text.slice(g.bodyStart, g.bodyEnd).replace(/[()]/g, '\\$&');
          const replacement = g.weight === 1 ? body : `(${body.replace(/:+$/, '')}:${fmt(g.weight)})`;
          edits.push({start:g.start,end:g.end,text:replacement});
        } else {
          // Rebuild the whole ComfyUI group so the NovelAI closing :: is
          // completed before any following comma: 1.2::tag::,.
          const body = text.slice(g.bodyStart, g.bodyEnd).replace(/\\([()])/g, '$1').replace(/:+\s*$/, '').trim();
          const replacement = g.weight === 1 ? body : `${fmt(g.weight)}::${body}::`;
          edits.push({start:g.start,end:g.end,text:replacement});
        }
      }
      // ComfyUI treats parentheses as syntax. Escape literal parentheses from
      // the source prompt; generated weighted-group wrappers remain structural.
      if (action === 'c') {
        for(let i=0;i<text.length;i++) {
          if((text[i]==='(' || text[i]===')') && !escaped(text,i) && !chosen.some(g=>i>=g.start && i<g.end)) edits.push({start:i,end:i,text:'\\'});
        }
      } else {
        for(let i=0;i<text.length-1;i++) {
          if(text[i]==='\\' && (text[i+1]==='(' || text[i+1]===')')) edits.push({start:i,end:i+1,text:''});
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
    const selectResult=action!=='toggle';
    if(plain) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(root,expected);
      root.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));
      root.setSelectionRange(p.start,selectResult?finalEnd:p.start);
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
        if(selectResult && snapshot(root)?.text===expected) select(root,p.start,finalEnd);
      };
      restore(); queueMicrotask(restore); requestAnimationFrame(restore);
    }
  }
  window.addEventListener('keydown',handler,true);
  window.addEventListener('pointerdown',()=>revision++,true);
  window.addEventListener('keydown',()=>revision++,true);

  // Copy reads only the named positive editors, never the hidden UC editors.
  let siteRequire;
  const copyChunks = new Map();
  function getChunkRecords() {
    // Read the same loaded Jotai atom used by the image page. No network,
    // account credentials, decryption, or Prompt Chunks panel is needed.
    if (!siteRequire) {
      const chunks = window.webpackChunk_N_E;
      if (!chunks?.push) throw new Error('NovelAI 的 Chunk 資料尚未就緒，請稍後再試。');
      const marker = `nai-prompt-copy-${Date.now()}-${Math.random()}`;
      chunks.push([[marker], {}, require => { siteRequire = require; }]);
      // Remove only our registration record; keep the site's chunk queue intact.
      const index = chunks.findIndex(entry => entry?.[0]?.[0] === marker);
      if (index >= 0) chunks.splice(index, 1);
    }
    if (!siteRequire) throw new Error('無法讀取 NovelAI 的 Chunk 資料。');
    // These module exports were checked against NovelAI's current image build.
    // Discover matching factories if a later build renumbers the modules.
    const factories = siteRequire.m || {};
    let stateId = '68898', storeId = '24554';
    if (!factories[stateId]?.toString().includes('lA:')) {
      stateId = Object.keys(factories).find(id => {
        const code = factories[id].toString();
        return code.includes('lA:') && code.includes('Nn:') && code.includes('.eU)');
      });
    }
    if (!factories[storeId]?.toString().includes('.y$)()')) {
      storeId = Object.keys(factories).find(id => {
        const code = factories[id].toString();
        return code.length < 300 && code.includes('A:') && code.includes('.y$)()');
      });
    }
    if (!stateId || !storeId) throw new Error('NovelAI 的 Chunk 資料介面已變更，請更新腳本。');
    const atom = siteRequire(stateId).lA;
    const store = siteRequire(storeId).A;
    const records = atom && store?.get?.(atom);
    if (!Array.isArray(records)) throw new Error('NovelAI 正在載入 Chunk 資料，請稍後再試。');
    if (!records.every(item => item && typeof item.id === 'string' && typeof item.label === 'string' && (item.isCategory === undefined || typeof item.isCategory === 'boolean'))) {
      throw new Error('NovelAI 的 Chunk 資料格式已變更，請更新腳本。');
    }
    return records;
  }
  function refreshChunkCategories() {
    const records = getChunkRecords();
    copyChunks.clear();
    for (const chunk of records.filter(item => !item.isCategory)) {
      const category = records.find(item => item.isCategory && item.id !== 'default' && item.childOrder?.includes(chunk.id));
      copyChunks.set(chunk.id, {chunk, category:category?.label || ''});
    }
  }
  function expandCopyChunk(id, active = new Set()) {
    const entry = copyChunks.get(id);
    if (!entry) throw new Error('有插入的 Chunk 不在目前資料清單中，請重新插入該 Chunk 後再試。');
    if (entry.category.trim().toLowerCase() === 'style') return ',';
    if (active.has(id)) throw new Error(`Chunk「${entry.chunk.label}」有循環引用，請先修正。`);
    const next = new Set(active); next.add(id);
    const expansion = entry.chunk.expansion;
    if (typeof expansion !== 'string') throw new Error('Chunk 的 prompt 內容格式無法辨識。');
    return `, ${expansion.replace(/⌜macro:([^⌟]+)⌟|!macro:([^!]+)!/g, (_, referenceId, label) => {
      const targetId = referenceId || Array.from(copyChunks.values()).find(item => item.chunk.label === label.trim())?.chunk.id;
      return expandCopyChunk(targetId, next);
    })}, `;
  }
  function readCopyEditor(editor) {
    function read(node) {
      if (node.nodeType === 3) return node.data;
      if (node.nodeType !== 1) return '';
      if (node.hasAttribute('data-macro-expansion')) {
        return expandCopyChunk(node.getAttribute('data-macro-id'));
      }
      if (node.tagName === 'BR') return '\n';
      const text = Array.from(node.childNodes, read).join('');
      return /^(P|DIV|LI)$/.test(node.tagName) ? text + '\n' : text;
    }
    return read(editor);
  }
  function mergeCopyPrompts(prompts) {
    const seen = new Set();
    function merge(text) {
      // Keep surviving tags inside their original weight group. First occurrence wins.
      const candidates = [...groups(text, 'comfy')];
      const weights = [];
      for (let i = 0; i < text.length; i++) {
        if (escaped(text, i)) continue;
        const opening = (!i || !/[\w.:+-]/.test(text[i-1])) && new RegExp('^' + number + '::').exec(text.slice(i));
        if (opening) {
          weights.push({start:i, bodyStart:i+opening[0].length});
          i += opening[0].length-1;
        } else if (text.slice(i,i+2) === '::') {
          const group = weights.pop();
          if (!group) throw new Error('提示詞有未配對的 ::，請先修正權重格式再複製。');
          candidates.push({...group, bodyEnd:i, end:i+2});
          i++;
        }
      }
      if (weights.length) throw new Error('提示詞有未結束的權重群組，請先補上 :: 再複製。');
      const stack = [];
      for (let i = 0; i < text.length; i++) {
        if (escaped(text, i)) continue;
        if (text[i] === '{' || text[i] === '[') stack.push(i);
        else if (stack.length && (text[i] === '}' || text[i] === ']')) {
          const start = stack[stack.length - 1];
          if ((text[start] === '{' ? '}' : ']') === text[i]) {
            stack.pop(); candidates.push({start, end:i+1, bodyStart:start+1, bodyEnd:i});
          }
        }
      }
      const outer = candidates.filter(g => !candidates.some(h => h !== g && h.start <= g.start && h.end >= g.end && (h.start < g.start || h.end > g.end)))
        .sort((a,b) => a.start-b.start);
      const output = [];
      function plain(value, offset) {
        // Commas inside literal parentheses are part of that tag.
        let depth = 0, start = 0;
        for (let i = 0; i <= value.length; i++) {
          if (!escaped(value, i)) {
            if (value[i] === '(') depth++;
            if (value[i] === ')') depth = Math.max(0, depth-1);
          }
          if (i !== value.length && ((![',', '\n'].includes(value[i])) || depth)) continue;
          const raw = value.slice(start, i);
          const tagStart = offset + start + (raw.match(/^\s*/)?.[0].length || 0);
          const tagEnd = offset + i - (raw.match(/\s*$/)?.[0].length || 0);
          const tag = raw.trim().replace(/[^\S\n]+/g, ' ');
          start = i+1;
          const key = tag.replace(/\\([()])/g, '$1').replace(/\s+/g, ' ').toLowerCase();
          if (!tag || /^(girl|boy)$/.test(key) || seen.has(key)) continue;
          seen.add(key); output.push({start:tagStart, end:tagEnd, text:tag});
        }
      }
      let cursor = 0;
      for (const g of outer) {
        if (g.start < cursor) continue;
        plain(text.slice(cursor, g.start), cursor);
        const body = merge(text.slice(g.bodyStart, g.bodyEnd));
        if (body) output.push({start:g.start, end:g.end, text:text.slice(g.start, g.bodyStart) + body + text.slice(g.bodyEnd, g.end)});
        cursor = g.end;
      }
      plain(text.slice(cursor), cursor);
      // Keep line boundaries (including blank lines) between surviving tags.
      return output.map((item, index) => {
        if (!index) return item.text;
        const breaks = text.slice(output[index-1].end, item.start).match(/\n/g)?.length || 0;
        return ',' + (breaks ? '\n'.repeat(breaks) : ' ') + item.text;
      }).join('');
    }
    return prompts.map(text => merge(text.replace(/\r\n?/g, '\n'))).filter(Boolean).join(',\n');
  }
  function positiveCopyEditors(base) {
    // Desktop/mobile mirrors share classes. Use the smallest common prompt area.
    let scope = base.parentElement;
    while (scope.parentElement && !scope.querySelector('[class*="prompt-input-box-character-prompts-"]')) scope = scope.parentElement;
    const characters = Array.from(scope.querySelectorAll('[data-prompt-input]')).map(box => {
      const match = Array.from(box.classList).map(c => /^prompt-input-box-character-prompts-(\d+)$/.exec(c)).find(Boolean);
      if (!match) return null;
      const card = box.closest('.character-prompt-input');
      // NovelAI sets this card's own opacity to 1 (enabled) or 0.5 (disabled).
      // Collapsing an enabled card hides its editor, so visibility is not a toggle.
      if (!card || !['1', '0.5'].includes(card.style.opacity)) {
        throw new Error(`無法確認 Character ${match[1]} 是否啟用，請重新整理頁面後再試。`);
      }
      return {index:Number(match[1]), editor:box.querySelector('.ProseMirror'), enabled:card.style.opacity === '1'};
    }).filter(item => item?.editor).sort((a,b) => a.index-b.index);
    const unique = new Map();
    for (const item of characters) if (!unique.has(item.index)) unique.set(item.index, item);
    return [base.querySelector('.ProseMirror'), ...Array.from(unique.values()).filter(item => item.enabled).map(item => item.editor)].filter(Boolean);
  }
  async function copyPositivePrompts(base, button) {
    try {
      const editors = positiveCopyEditors(base);
      if (editors.some(editor => editor.querySelector('[data-macro-id]'))) refreshChunkCategories();
      let text = mergeCopyPrompts(editors.map(readCopyEditor));
      if (!text) throw new Error('統整後沒有可複製的 tag。');
      if (!/[,.]$/.test(text)) text += ',';
      await navigator.clipboard.writeText(text);
      button.textContent = '已複製';
      button.title = text;
    } catch (error) {
      button.textContent = '複製未完成';
      button.title = error.message;
      window.alert(error.message);
    }
    setTimeout(() => { if (button.isConnected) button.textContent = '統整並複製'; }, 2200);
  }
  function mountCopyButtons() {
    for (const base of document.querySelectorAll('.prompt-input-box-base-prompt')) {
      if (base.querySelector('[data-nai-merge-copy]')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.naiMergeCopy = 'true';
      button.textContent = '統整並複製';
      button.title = '複製 Base Prompt 與 Character 1～N；去重、移除 girl/boy、略過 style 分類的 Chunk';
      button.style.cssText = 'align-self:flex-end;flex:none;margin:4px 0;padding:5px 10px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:12px;';
      button.addEventListener('click', () => copyPositivePrompts(base, button));
      base.appendChild(button);
    }
  }
  let copyRefreshQueued = false;
  function queueCopyRefresh() {
    if (copyRefreshQueued) return;
    copyRefreshQueued = true;
    requestAnimationFrame(() => { copyRefreshQueued = false; mountCopyButtons(); });
  }
  function initializeCopy() {
    mountCopyButtons();
    new MutationObserver(queueCopyRefresh).observe(document.body, {
      childList:true, subtree:true, characterData:true, attributes:true,
      attributeFilter:['data-macro-expansion', 'data-macro-label', 'title']
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeCopy, {once:true});
  else initializeCopy();
})();
