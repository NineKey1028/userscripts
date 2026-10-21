// ==UserScript==
// @name         RootiCare 標註快捷鍵
// @namespace    https://editoreu.rooticare.com/
// @version      1.20.0
// @description  以數字鍵與滑鼠中鍵新增、修改或刪除 V / S / N 標籤；支援區間篩選修改與 W / S 心電圖縮放。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標註快捷鍵.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標註快捷鍵.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

/*
 * ── 使用教學 ────────────────────────────────────────────
 * 滑鼠移到心電圖上要處理的位置，再按快捷鍵。
 * 所有修改都只加入「未儲存修改」，不會自動儲存。
 *
 * 【標註】
 *   1 / 2 / 3            新增或改為 V / S / N
 *   4／滑鼠中鍵          刪除標籤
 *   按住 4 移動          連續刪除碰到的標籤
 *   按住 Alt+1/2/3 移動  只修改碰到的既有標籤
 *   Ctrl+左鍵拖曳        左右微調標籤位置（Esc 取消）；
 *                        按在標籤列空白處會吸過最近的標籤
 *
 * 【區間】Shift+1/2/3 按兩次（起點、終點），可跨視窗；Esc 取消
 *   篩選修改  依 BPM、變動率、原標籤篩選後改為 V / S / N
 *   填補整理  在頭尾兩顆標籤外側各按一次，依開頭 RR 平均補滿中間心搏
 *            （頭尾不改；多刪少補，保留的維持原類型）
 *   分頁選擇保留到重新整理頁面為止。
 *
 * 【檢視】
 *   W / S   縮放（↑ / ↓）
 *   Q / E   切換時間（← / →），縮放高度保持不變
 *   ch1～3 旁的眼睛  顯示／隱藏導程（重新載入恢復全開）
 *   滑過標籤列或波形時，顯示紅色垂直對齊線
 *
 * 【清單】
 *   HR Min／Max／Max sinus  「排除 ±1 分」移除後面相近時間的心電圖，標題列可還原
 *   事件清單頁碼拉條        選印位置下方的圓點可點擊跳頁，右側顯示選印張數
 *
 * Morphology 頁面不提供以上功能。
 */

(function() {
    'use strict';

    // 設定與操作狀態
    const ENABLE_ALIGNMENT_GUIDE = true; // BPM／心律標籤的紅色垂直對齊線；false 關閉
    const USE_FIXED_POS = true; // V、S 輪轉會經過空白時， true：新標籤位置按原始位置生成； false：新標籤位置按滑鼠位置生成
    const sequence = ['', 'N', 'S', 'V']; // 點擊循環順序

    const TARGET_BLOCK_SELECTOR = '.ecg-individual-blk, .event-tag-blk.ng-scope'; // 追蹤的容器名稱
    // 依目前網址辨識 Morphology 路由；站內切頁不一定重新載入，因此操作前也要檢查。
    function isDisabledPage() {
        return /^\/rooti-care\/morphology(?:\/|$)/.test(window.location?.pathname || '');
    }
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let currentMousePos = { x: 0, y: 0 };

    const zoomPreservingFunctions = new WeakSet();
    // 網站 selectedDataRange 的第 4 個參數控制是否重設高度；方向鍵原本即傳 false。
    // 在原控制器入口沿用此選項，不於非同步載入後覆寫使用者新調整的縮放。
    function installZoomPersistence() {
        const host = document.querySelector('[ng-controller="RootiCareDashboardAFCtrl"]');
        if (!host || !window.angular) return;
        let scope;
        try { scope = window.angular.element(host).scope?.(); } catch (_) { return; }
        while (scope && !Object.prototype.hasOwnProperty.call(scope, 'selectedDataRange')) scope = scope.$parent;
        const original = scope?.selectedDataRange;
        if (typeof original !== 'function' || zoomPreservingFunctions.has(original)) return;
        function preserveZoom(...args) {
            if (!isDisabledPage() && scope.af?.hrChart) args[3] = false;
            return original.apply(this, args);
        }
        zoomPreservingFunctions.add(preserveZoom);
        scope.selectedDataRange = preserveZoom;
    }
    document.addEventListener('mousedown', installZoomPersistence, true);
    document.addEventListener('wheel', installZoomPersistence, { capture: true, passive: true });

    const style = document.createElement('style');
    style.innerHTML = `
        ${TARGET_BLOCK_SELECTOR}:focus {
            outline: none !important;
            box-shadow: none !important;
        }
    `;
    document.head.appendChild(style);

    // 僅保存於本次頁面執行期；不寫入瀏覽器儲存或報告資料。
    const leadVisible = { ch1: true, ch2: true, ch3: true };
    const leadStyle = document.createElement('style');
    leadStyle.textContent = `
        .ecgWave path.ecg-path.rc-lead-hidden { visibility: hidden !important; }
        .rc-lead-eye { cursor: pointer; outline: none; }
        .rc-lead-eye:focus > rect { stroke: #779b3a; stroke-width: 2; }
    `;
    document.head.appendChild(leadStyle);
    const SVG_NS = 'http://www.w3.org/2000/svg';
    function svgElement(tag, attributes) {
        const element = document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
        return element;
    }
    function refreshLeadVisibility() {
        if (isDisabledPage()) return;
        for (const wave of document.querySelectorAll('div.ecgWave')) {
            const paths = [...wave.querySelectorAll('path.ecg-path')];
            if (paths.length !== 3) continue;
            const labels = [...wave.querySelectorAll('text')].filter(text => /^ch[123]$/.test(text.textContent.trim()));
            let switched = labels[0]?.textContent.trim() === 'ch2';
            if (!labels.length) {
                try { switched = Boolean(window.angular?.element(wave)?.isolateScope?.()?.channelSwitch); }
                catch (_) { continue; }
            }
            const order = switched ? ['ch2', 'ch1', 'ch3'] : ['ch1', 'ch2', 'ch3'];
            paths.forEach((path, index) => path.classList.toggle('rc-lead-hidden', !leadVisible[order[index]]));
            for (const label of labels) {
                const lead = label.textContent.trim();
                const group = label.parentElement;
                let button = group.querySelector(`[data-rc-lead="${lead}"]`);
                if (!button) {
                    button = svgElement('g', { class: 'rc-lead-eye', 'data-rc-lead': lead,
                        role: 'button', tabindex: '0' });
                    button.appendChild(svgElement('title', {}));
                    button.appendChild(svgElement('rect', { x: 0, y: 0, width: 24, height: 18,
                        rx: 3, fill: 'transparent' }));
                    button.appendChild(svgElement('path', { d: 'M3 9 Q12 -1 21 9 Q12 19 3 9 Z M12 6 A3 3 0 1 0 12 12 A3 3 0 1 0 12 6',
                        fill: 'none', stroke: '#526047', 'stroke-width': '1.5' }));
                    button.appendChild(svgElement('line', { class: 'rc-eye-slash', x1: 3, y1: 2,
                        x2: 21, y2: 16, stroke: '#a54141', 'stroke-width': 2 }));
                    const toggle = event => {
                        event.preventDefault(); event.stopPropagation();
                        leadVisible[lead] = !leadVisible[lead];
                        refreshLeadVisibility();
                    };
                    button.addEventListener('click', toggle);
                    for (const type of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick'])
                        button.addEventListener(type, event => event.stopPropagation());
                    button.addEventListener('keydown', event => {
                        event.stopPropagation();
                        if (event.key === 'Enter' || event.key === ' ') toggle(event);
                    });
                    group.appendChild(button);
                }
                const y = Number(label.getAttribute('y')) - 12;
                button.setAttribute('transform', `translate(44,${y})`);
                button.setAttribute('aria-pressed', String(leadVisible[lead]));
                const description = `${leadVisible[lead] ? '隱藏' : '顯示'} ${lead}`;
                button.setAttribute('aria-label', description);
                // 避免重寫文字引發 childList observer 的無限重畫。
                const title = button.querySelector('title');
                if (title.textContent !== description) title.textContent = description;
                button.querySelector('.rc-eye-slash').setAttribute('visibility', leadVisible[lead] ? 'hidden' : 'visible');
            }
        }
    }
    let leadRefreshPending = false;
    function scheduleLeadRefresh() {
        if (leadRefreshPending) return;
        leadRefreshPending = true;
        requestAnimationFrame(() => { leadRefreshPending = false; refreshLeadVisibility(); });
    }
    new MutationObserver(scheduleLeadRefresh).observe(document.body, { childList: true, subtree: true });
    scheduleLeadRefresh();

    // 使用螢幕座標對齊標籤列與主波形；獨立覆層不接收滑鼠事件，不改動網站 SVG。
    const alignmentGuide = document.createElement('div');
    alignmentGuide.setAttribute('aria-hidden', 'true');
    alignmentGuide.style.cssText = 'display:none;position:fixed;width:1px;background:#e02020;pointer-events:none;z-index:2147482000;';
    document.body.appendChild(alignmentGuide);
    let guideMarker = null;
    let guideMouseX = 0;
    let guideMouseY = 0;
    let guideFrame = null;
    function hideAlignmentGuide() {
        guideMarker = null;
        if (guideFrame !== null) cancelAnimationFrame(guideFrame);
        guideFrame = null;
        alignmentGuide.style.display = 'none';
    }
    function drawAlignmentGuide() {
        guideFrame = null;
        if (!ENABLE_ALIGNMENT_GUIDE || isDisabledPage() || !guideMarker?.isConnected) { hideAlignmentGuide(); return; }
        const overWave = guideMarker.matches('div.ecgWave');
        const wave = overWave ? guideMarker : guideMarker.nextElementSibling;
        if (!wave?.matches('div.ecgWave')) { hideAlignmentGuide(); return; }
        // 部分頁面在開啟 Measure 前沒有 centerRect，改用 centerGroup 或波形 SVG 的範圍。
        const plot = overWave ? (wave.querySelector('.centerGroup .centerRect')
            || wave.querySelector('.centerGroup') || wave.querySelector('svg')) : null;
        if (overWave && !plot) { hideAlignmentGuide(); return; }
        const markerBounds = (plot || guideMarker).getBoundingClientRect();
        const waveBounds = (plot || wave).getBoundingClientRect();
        if (waveBounds.height <= 0 || guideMouseX < markerBounds.left || guideMouseX > markerBounds.right
            || guideMouseX < waveBounds.left || guideMouseX > waveBounds.right
            || (overWave && (guideMouseY < waveBounds.top || guideMouseY > waveBounds.bottom))) {
            hideAlignmentGuide(); return;
        }
        // 對齊實體像素邊界，固定為一個實體像素，避免瀏覽器縮放／DPI 讓紅線跨兩欄像素。
        const ratio = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
            ? window.devicePixelRatio : 1;
        const snap = value => Math.round(value * ratio) / ratio;
        // 同一區塊可能有主波形及下方概覽；向前尋找共用的標籤列。
        let labelRow = overWave ? wave.previousElementSibling : guideMarker;
        while (labelRow?.matches('div.ecgWave')) labelRow = labelRow.previousElementSibling;
        const labelBounds = labelRow?.matches('svg.ecgRMarker') ? labelRow.getBoundingClientRect() : null;
        const top = snap(labelBounds && labelBounds.height > 0 ? Math.min(labelBounds.top, markerBounds.top) : markerBounds.top);
        alignmentGuide.style.width = `${1 / ratio}px`;
        alignmentGuide.style.left = `${snap(guideMouseX)}px`;
        alignmentGuide.style.top = `${top}px`;
        alignmentGuide.style.height = `${snap(waveBounds.bottom) - top}px`;
        alignmentGuide.style.background = overWave ? 'rgba(224, 32, 32, 0.3)' : '#e02020';
        alignmentGuide.style.display = 'block';
    }
    // 波形上方可能蓋著透明圖層（Measure 未開啟時尤其如此），事件目標不一定是波形本身；
    // 找不到時改查游標下方所有元素。
    const GUIDE_MARKER_SELECTOR = 'svg.ecgRMarker, div.ecgWave';
    function findGuideMarker(event) {
        const direct = event.target.closest?.(GUIDE_MARKER_SELECTOR);
        if (direct) return direct;
        for (const el of document.elementsFromPoint(event.clientX, event.clientY)) {
            if (el === alignmentGuide) continue;
            const marker = el.closest?.(GUIDE_MARKER_SELECTOR);
            if (marker) return marker;
        }
        return null;
    }
    document.addEventListener('mousemove', event => {
        if (labelDrag) return; // 拖曳期間由標籤的實際位置更新紅線，避免被游標位置覆蓋。
        if (!ENABLE_ALIGNMENT_GUIDE || isDisabledPage()) { hideAlignmentGuide(); return; }
        const marker = findGuideMarker(event);
        if (!marker) { hideAlignmentGuide(); return; }
        guideMarker = marker;
        guideMouseX = event.clientX;
        guideMouseY = event.clientY;
        if (guideFrame === null) guideFrame = requestAnimationFrame(drawAlignmentGuide);
    }, { passive: true });
    document.addEventListener('mouseleave', hideAlignmentGuide);
    document.addEventListener('scroll', hideAlignmentGuide, true);
    window.addEventListener('resize', hideAlignmentGuide);
    window.addEventListener('blur', hideAlignmentGuide);

    // 記錄滑鼠位置
    window.addEventListener('mousemove', (e) => {
        currentMousePos.x = e.clientX;
        currentMousePos.y = e.clientY;
    }, { passive: true });

    // 按住 4 或 Alt + 1 / 2 / 3 時直接跟隨滑鼠處理，不等鍵盤連發的延遲。
    // 每次移動沿上一點到目前位置取樣，快速甩過也不漏掉中間的標籤；只處理碰到的既有標籤。
    const SWEEP_STEP = 3; // 取樣間距（像素）
    const SWEEP_MAX_SAMPLES = 200;
    let heldSweep = null; // { key, tag, alt, last: { x, y } }
    function stopHeldSweep() { heldSweep = null; }
    function sweepTo(x, y) {
        const from = heldSweep.last;
        heldSweep.last = { x, y };
        const distance = Math.hypot(x - from.x, y - from.y);
        const samples = Math.min(SWEEP_MAX_SAMPLES, Math.max(1, Math.ceil(distance / SWEEP_STEP)));
        for (let i = 1; i <= samples; i++) {
            const point = { x: from.x + (x - from.x) * i / samples, y: from.y + (y - from.y) * i / samples };
            const el = getElementAtPoint(point.x, point.y);
            if (!el?.classList.contains('annoText') || el.textContent.trim() === heldSweep.tag) continue;
            const block = el.closest(TARGET_BLOCK_SELECTOR);
            if (block) processCommand(heldSweep.tag, point, block);
        }
    }
    window.addEventListener('mousemove', (e) => {
        if (!heldSweep) return;
        if (isDisabledPage() || rangeMode || rangeBusy || labelDrag || (heldSweep.alt && !e.altKey)) {
            stopHeldSweep(); return;
        }
        sweepTo(e.clientX, e.clientY);
    }, { passive: true });
    document.addEventListener('keyup', (e) => {
        if (heldSweep && (e.key === heldSweep.key || (e.key === 'Alt' && heldSweep.alt))) stopHeldSweep();
    }, true);
    window.addEventListener('blur', stopHeldSweep);

    // 檢查滑鼠位置下是否有 ECG 區塊
    function getActiveBlockUnderMouse() {
        if (isDisabledPage()) return null;
        const elements = document.elementsFromPoint(currentMousePos.x, currentMousePos.y);
        for (let el of elements) {
            const block = el.closest(TARGET_BLOCK_SELECTOR);
            if (block) return block;
        }
        return null;
    }

    // 取得當前位置的元素（優先抓取標籤文字，次之為背景矩形）
    function getElementAtPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        return elements.find(el => el.classList.contains('annoText')) ||
               elements.find(el => el.tagName.toLowerCase() === 'rect');
    }

    // 依原始 X 座標尋找目前 ECG 區塊內的標籤。
    function findLabelAtX(activeBlock, targetX) {
        if (!activeBlock) return null;
        // 找出該區塊內所有的標籤
        const annos = activeBlock.querySelectorAll('.annoText');
        for (let anno of annos) {
            const rect = anno.getBoundingClientRect();
            // 檢查原點擊的 X 座標是否落在這個標籤的左右範圍內
            if (targetX >= rect.left && targetX <= rect.right) {
                return anno;
            }
        }
        return null;
    }

    // 當滑鼠移入時自動聚焦，避免快捷鍵失效
    document.addEventListener('mouseover', (e) => {
        if (isDisabledPage()) return;
        const block = e.target.closest(TARGET_BLOCK_SELECTOR);
        if (block && document.activeElement !== block) {
            if (block.tabIndex < 0) block.tabIndex = 0;
            block.focus({ preventScroll: true });
        }
    }, { passive: true });

    // 區間修改更新顯示文字後，原生 D3 點擊狀態 typeIdx 可能仍保留舊值。
    // 原生循環為 N / A（顯示 S）/ V / X（刪除），點擊前以顯示標籤同步。
    function syncLabelClickState(el) {
        if (isDisabledPage()) return;
        if (!el?.classList?.contains('annoText') || !el.closest(TARGET_BLOCK_SELECTOR)) return;
        const indices = { N: 0, S: 1, A: 1, V: 2, X: 3, '': 3 };
        const text = el.textContent.trim();
        if (Object.prototype.hasOwnProperty.call(indices, text)) {
            el.setAttribute('typeIdx', String(indices[text]));
        }
    }

    // 也處理使用者直接左鍵點擊；capture 階段早於原生標籤 click handler。
    document.addEventListener('click', (e) => {
        syncLabelClickState(e.target.closest?.('.annoText'));
    }, true);

    // 依序發送左鍵按下、放開與點擊事件。
    function doLockedClick(el, x, y) {
        if (!el) return;
        syncLabelClickState(el);
        const opts = {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            clientX: x,
            clientY: y
        };
        el.dispatchEvent(new MouseEvent('mousedown', opts));
        el.dispatchEvent(new MouseEvent('mouseup', opts));
        el.dispatchEvent(new MouseEvent('click', opts));
    }

    // 發送原生方向鍵事件，沿用網站的縮放處理。
    function triggerOriginalKey(keyCode, keyName) {
        const eventProps = {
            bubbles: true, cancelable: true,
            keyCode: keyCode, which: keyCode,
            key: keyName, code: keyName, view: window
        };
        document.dispatchEvent(new KeyboardEvent('keydown', eventProps));
    }

    // 計算從當前狀態切換到目標狀態需要的點擊次數
    function getSteps(current, target) {
        let currIdx = sequence.indexOf(current);
        if (currIdx === -1) currIdx = 0;
        let targetIdx = sequence.indexOf(target);
        if (targetIdx === -1) targetIdx = 0;
        let steps = targetIdx - currIdx;
        return steps < 0 ? steps + sequence.length : steps;
    }

    // 以模擬點擊將指定位置的標籤切換至目標分類。
    async function processCommand(targetText, point = currentMousePos, rangeBlock = null) {
        if (isDisabledPage()) return;
        const lockedX = point.x;
        const lockedY = point.y;

        let currentEl = getElementAtPoint(lockedX, lockedY);
        const activeBlock = rangeBlock || getActiveBlockUnderMouse();

        if (!currentEl && activeBlock) {
            currentEl = activeBlock.querySelector('rect');
        }

        if (!currentEl) return;

        let currentText = currentEl.classList.contains('annoText') ? currentEl.textContent.trim() : '';
        if (currentText === targetText) return;

        let stepsNeeded = getSteps(currentText, targetText);

        let clickX = lockedX;
        let clickY = lockedY;

        if (USE_FIXED_POS && currentEl.classList.contains('annoText')) {
            const rect = currentEl.getBoundingClientRect();
            clickX = rect.left + rect.width / 2;
            clickY = rect.top + rect.height / 2;
        }

        for (let i = 0; i < stepsNeeded; i++) {
            let targetEl = getElementAtPoint(clickX, clickY) || currentEl;

            // 重新定位時只搜尋原始 X 座標涵蓋的標籤，
            // 避免畫面更新後誤點同區塊中的其他標籤。
            if (!targetEl || !targetEl.classList.contains('annoText')) {
                const localAnno = findLabelAtX(activeBlock, lockedX);
                if (localAnno) {
                    targetEl = localAnno;
                    // 將後續點擊座標移到找到的標籤中心。
                    const rect = targetEl.getBoundingClientRect();
                    clickX = rect.left + rect.width / 2;
                    clickY = rect.top + rect.height / 2;
                }
            }

            if (!targetEl) break;

            doLockedClick(targetEl, clickX, clickY);

            // 若網站重畫尚未完成，可啟用下一行等待後再點擊。
            // await sleep(30);
        }
    }

    let rangeMode = null;
    let rangeBusy = false;
    const rangeHint = document.createElement('div');
    rangeHint.id = 'rooticare-range-hotkeys';
    rangeHint.style.display = 'none';
    const rangeStyle = document.createElement('style');
    rangeStyle.textContent = `
        #rooticare-range-hotkeys { position:fixed;left:12px;bottom:12px;z-index:2147483000;
            width:370px;max-width:calc(100vw - 24px);padding:9px 11px;box-sizing:border-box;
            border:1px solid #dce3d6;border-radius:8px;background:#fff;color:#374333;
            box-shadow:0 3px 14px #24332118;font:12px/1.45 Arial,"Microsoft JhengHei",sans-serif; }
        #rooticare-range-hotkeys * { box-sizing:border-box; }
        #rooticare-range-hotkeys .rh-head { display:flex;align-items:center;gap:8px; }
        #rooticare-range-hotkeys [data-role=message] { flex:1;min-width:0;font-weight:600;overflow-wrap:anywhere; }
        #rooticare-range-hotkeys [data-role=filters] { margin-top:7px;display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
        #rooticare-range-hotkeys .rh-group { display:inline-flex;align-items:center;gap:4px;white-space:nowrap; }
        #rooticare-range-hotkeys .rh-source { width:100%;gap:6px; }
        #rooticare-range-hotkeys label { display:inline-flex;align-items:center;gap:3px;margin:0;padding:0;font:inherit;color:inherit;cursor:pointer; }
        #rooticare-range-hotkeys input[type=checkbox] { appearance:auto;position:static;float:none;width:12px;height:12px;min-height:0;margin:0;accent-color:#779b3a; }
        #rooticare-range-hotkeys select,#rooticare-range-hotkeys input[type=number] {
            appearance:auto;position:static;float:none;display:inline-block;width:39px;height:23px;min-height:0;
            margin:0;padding:1px 3px;border:1px solid #dce3d6;border-radius:4px;background:#fff;color:#374333;font:inherit; }
        #rooticare-range-hotkeys input[type=number] { width:51px; }
        #rooticare-range-hotkeys :disabled { opacity:.45;cursor:default; }
        #rooticare-range-hotkeys button { position:static;float:none;width:20px;height:20px;min-height:0;margin:0;padding:0;
            border:0;border-radius:4px;background:transparent;color:#889180;font:18px/20px Arial;cursor:pointer; }
        #rooticare-range-hotkeys button:hover { background:#f0f3ec;color:#374333; }
        #rooticare-range-hotkeys :is(button,input,select):focus-visible { outline:2px solid #91ad68;outline-offset:1px; }
        #rooticare-range-hotkeys [data-role=help] { margin-top:6px;color:#7b8574;font-size:11px; }
        #rooticare-range-hotkeys [data-role=tabs] { margin-top:7px;display:flex;gap:2px;border-bottom:1px solid #dce3d6; }
        #rooticare-range-hotkeys [data-role=tabs] button { width:auto;height:24px;padding:0 10px;border-radius:5px 5px 0 0;
            margin-bottom:-1px;border:1px solid transparent;font:600 12px/22px Arial,"Microsoft JhengHei",sans-serif;color:#889180; }
        #rooticare-range-hotkeys [data-role=tabs] button[aria-selected=true] { border-color:#dce3d6;border-bottom-color:#fff;
            background:#fff;color:#4f6b1a; }
        #rooticare-range-hotkeys [data-role=fill] { margin-top:7px;color:#526047; }
        #rooticare-range-hotkeys.rh-minimized { padding:5px 9px; }
        #rooticare-range-hotkeys.rh-minimized [data-role=filters],
        #rooticare-range-hotkeys.rh-minimized [data-role=tabs],
        #rooticare-range-hotkeys.rh-minimized [data-role=fill],
        #rooticare-range-hotkeys.rh-minimized [data-role=help] { display:none !important; }
        #rooticare-range-hotkeys.rh-minimized [data-role=message] {
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;
        }
    `;
    document.head.appendChild(rangeStyle);
    document.body.appendChild(rangeHint);
    let rangeMessage;
    let rangeControls;
    let rangeMinimized = false;
    // 區間分頁：filter 篩選修改、fill 填補整理。只存在本次頁面執行期，重新整理後回到篩選修改。
    let rangeTool = 'filter';
    const RANGE_HELP = {
        filter: '在另一端按 Shift + 1→V／2→S／3→N，即套用篩選修改',
        fill: '在結尾之後按 Shift + 1→V／2→S／3→N，補上的標籤使用該類型'
    };
    function updateRangeTool() {
        if (!rangeControls) return;
        for (const tab of rangeHint.querySelectorAll('[data-tool]')) {
            tab.setAttribute('aria-selected', String(tab.dataset.tool === rangeTool));
        }
        const open = rangeMode?.first && !rangeBusy;
        rangeControls.style.display = open && rangeTool === 'filter' ? 'flex' : 'none';
        rangeHint.querySelector('[data-role="fill"]').style.display = open && rangeTool === 'fill' ? 'block' : 'none';
        rangeHint.querySelector('[data-role="tabs"]').style.display = open ? 'flex' : 'none';
        const help = rangeHint.querySelector('[data-role="help"]');
        help.textContent = RANGE_HELP[rangeTool];
        help.style.display = open ? 'block' : 'none';
    }
    function updateRangeMinimized() {
        rangeHint.classList.toggle('rh-minimized', rangeMinimized);
        const button = rangeHint.querySelector('[data-role="minimize"]');
        if (!button) return;
        button.textContent = rangeMinimized ? '+' : '−';
        button.title = rangeMinimized ? '展開' : '最小化';
        button.setAttribute('aria-label', button.title);
        button.setAttribute('aria-expanded', String(!rangeMinimized));
    }
    // 首次需要時才建立區間設定面板，保存節點供後續選取重用。
    // 上下限分別勾選才啟用；面板事件不向外傳遞，避免輸入數字時觸發網站分類快捷鍵。
    function ensureRangeControls() {
        if (rangeControls) return;
        rangeHint.innerHTML = `<div class="rh-head"><div data-role="message" role="status" aria-live="polite"></div>
                <button type="button" data-role="minimize" aria-label="最小化" title="最小化" aria-expanded="true">−</button>
                <button type="button" data-role="cancel" aria-label="取消區間選取" title="取消 · Esc">×</button></div>
            <div data-role="tabs" role="tablist">
                <button type="button" role="tab" data-tool="filter">篩選修改</button>
                <button type="button" role="tab" data-tool="fill">填補整理</button></div>
            <div data-role="fill">以區間內第一顆與最後一顆標籤為錨點（兩顆不修改），依開頭那顆的 RR 平均補滿中間心搏；
                中間既有標籤靠近預期位置的保留原類型，多的刪除、缺的補上。</div>
            <div data-role="filters">
                <span class="rh-group" title="依此心搏與前一心搏的間隔計算 BPM，四捨五入後比較；勾選才啟用">
                <span>BPM</span>
                <label title="啟用下限"><input type="checkbox" data-role="bpm-min-enabled" aria-label="啟用 BPM 下限"> ≥</label>
                <input type="number" data-role="bpm-min" aria-label="BPM 下限" min="1" step="1" value="60">
                <label title="啟用上限"><input type="checkbox" data-role="bpm-max-enabled" aria-label="啟用 BPM 上限"> ≤</label>
                <input type="number" data-role="bpm-max" aria-label="BPM 上限" min="1" step="1" value="100"></span>
                <span class="rh-group" title="（前一 RR − 目前 RR）÷目前 RR；前兩個心搏不限標籤。所有啟用條件需同時符合。">
                <span>變動率</span>
                <label title="啟用下限"><input type="checkbox" data-role="variability-min-enabled" aria-label="啟用變動率下限"> ≥</label>
                <input type="number" data-role="variability-min" aria-label="變動率下限百分比" step="0.1" value="12"><span>%</span>
                <label title="啟用上限"><input type="checkbox" data-role="variability-max-enabled" aria-label="啟用變動率上限"> ≤</label>
                <input type="number" data-role="variability-max" aria-label="變動率上限百分比" step="0.1" value="12"><span>%</span></span>
                <span class="rh-group rh-source" title="只修改勾選的原標籤；所有啟用條件需同時符合"><span>原標籤</span>
                <label><input type="checkbox" data-source="N" checked> N</label>
                <label><input type="checkbox" data-source="S" checked> S</label>
                <label><input type="checkbox" data-source="V" checked> V</label></span>
            </div><div data-role="help"></div>`;
        rangeMessage = rangeHint.querySelector('[data-role="message"]');
        rangeControls = rangeHint.querySelector('[data-role="filters"]');
        for (const tab of rangeHint.querySelectorAll('[data-tool]')) {
            tab.addEventListener('click', () => { rangeTool = tab.dataset.tool; updateRangeTool(); });
        }
        rangeHint.querySelector('[data-role="minimize"]').addEventListener('click', () => {
            rangeMinimized = !rangeMinimized;
            updateRangeMinimized();
        });
        updateRangeMinimized();
        rangeHint.querySelector('[data-role="cancel"]').addEventListener('click', cancelRange);
        for (const kind of ['bpm', 'variability']) for (const bound of ['min', 'max']) {
            const toggle = rangeHint.querySelector(`[data-role="${kind}-${bound}-enabled"]`);
            const update = () => { rangeHint.querySelector(`[data-role="${kind}-${bound}"]`).disabled = !toggle.checked; };
            toggle.addEventListener('change', update);
            update();
        }
        for (const name of ['mousedown', 'mouseup', 'click', 'keydown', 'keyup']) {
            rangeHint.addEventListener(name, e => e.stopPropagation());
        }
    }
    // 將面板轉為 BPM、變動率與來源標籤條件；未勾選的上下限以 null 表示。
    // 變動率百分比除以 100 後參與計算；空白、無效數字、倒置上下限或未選來源皆拋出提示錯誤。
    function readRangeFilters() {
        const bounds = {};
        for (const bound of ['min', 'max']) {
            bounds[bound] = rangeHint.querySelector(`[data-role="bpm-${bound}-enabled"]`).checked
                ? Number(rangeHint.querySelector(`[data-role="bpm-${bound}"]`).value) : null;
            if (bounds[bound] !== null && (!Number.isFinite(bounds[bound]) || bounds[bound] <= 0))
                throw new Error(`請輸入大於 0 的 BPM ${bound === 'min' ? '下限' : '上限'}`);
        }
        if (bounds.min !== null && bounds.max !== null && bounds.min > bounds.max)
            throw new Error('BPM 下限不可大於上限');
        const variability = {};
        for (const bound of ['min', 'max']) {
            const input = rangeHint.querySelector(`[data-role="variability-${bound}"]`);
            variability[bound] = rangeHint.querySelector(`[data-role="variability-${bound}-enabled"]`).checked
                ? Number(input.value) / 100 : null;
            if (variability[bound] !== null && (!input.value.trim() || !Number.isFinite(variability[bound])))
                throw new Error('請輸入有效的變動率百分比');
        }
        if (variability.min !== null && variability.max !== null && variability.min > variability.max)
            throw new Error('變動率下限不可大於上限');
        variability.enabled = variability.min !== null || variability.max !== null;
        const sources = [...rangeHint.querySelectorAll('[data-source]:checked')].map(el => el.dataset.source);
        if (!sources.length) throw new Error('請至少勾選一種要修改的原標籤');
        return { enabled: bounds.min !== null || bounds.max !== null, ...bounds, variability, sources };
    }
    // 更新區間狀態文字；只有已選第一端點且未執行修改時，才顯示可操作的篩選欄位。
    function showRangeHint(text) {
        if (isDisabledPage()) { rangeHint.style.display = 'none'; return; }
        ensureRangeControls();
        rangeMessage.textContent = text;
        rangeMessage.title = text;
        updateRangeTool();
        rangeHint.style.display = 'block';
    }
    // 將滑鼠 X 座標換算成整份 ECG 的絕對取樣索引，包含目前時間窗、取樣率及通道位移。
    // 同時保存報告識別、Angular 控制器與未儲存陣列參照，用於第二端點及非同步完成後的一致性檢查。
    function getRangeContext(svg, clientX) {
        const angularAPI = window.angular;
        const scope = angularAPI?.element(svg).isolateScope();
        const info = scope?.posInfo;
        const rate = Number(info?.sampleRate || scope?.sampleRate);
        const seconds = Number(scope?.segSec);
        const start = Number(info?.idxRange?.[0]);
        const rect = svg.getBoundingClientRect();
        if (!scope || scope.eventDisabled || scope.invalidSwitch || !Number.isFinite(start) ||
            !(rate > 0) || !(seconds > 0) || !rect.width) throw new Error('無法讀取可編輯 ECG 的絕對索引');
        const shift = scope.threeChannel || scope.dialogSwitch ? Number(scope.shiftSec) : 0;
        if (!Number.isFinite(shift)) throw new Error('無法讀取 ECG 位移');
        const viewStart = start + shift * rate;
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        let parent = scope;
        while (parent && !parent.af) parent = parent.$parent;
        if (!parent?.af || !Array.isArray(scope.modifiedData)) throw new Error('無法讀取標籤修改資料');
        if (parent.af.loading?.modified || parent.af.labelEditing?.edit || parent.af.labelEditing?.pauseEdit)
            throw new Error('請先結束原生 R-type／Pause 模式或等待儲存完成');
        return { scope, parent, af: parent.af, index: Math.round(viewStart + fraction * rate * seconds),
            rate, viewStart, startTime: Number(scope.startTime) + shift,
            modifiedData: scope.modifiedData,
            record: [parent.af._vendorId, parent.af._idNumber, parent.af._measureId].join('|') };
    }
    // 以原始標籤加上未儲存修改後的有效分類，計算閉區間內需要變更的心搏。
    // A 正規化為 S 供篩選使用；BPM 與變動率由相鄰索引計算，缺前置心搏時不猜測。
    // 輸出沿用網站修改資料格式 [時間, 絕對索引, 目標分類, 原分類, 有效旗標]，保留最初分類供原生流程使用。
    function getRangeUpdates(effective, pending, data, first, start, end, tag, filters) {
        const normalize = type => type === 'A' ? 'S' : type;
        const beats = [...effective].filter(([index, type]) => Number.isFinite(index) && ['N', 'S', 'A', 'V'].includes(type))
            .sort((a, b) => a[0] - b[0]);
        const updates = [];
        for (let i = 0; i < beats.length; i++) {
            const [index, type] = beats[i];
            if (index < start || index > end || normalize(type) === tag || !filters.sources.includes(normalize(type))) continue;
            if (filters.enabled) {
                if (!i) continue; // 無前一心搏時，不猜測 BPM。
                const interval = index - beats[i - 1][0];
                const bpm = Math.round(60 * first.rate / interval);
                if (!(interval > 0) || (filters.min !== null && bpm < filters.min) ||
                    (filters.max !== null && bpm > filters.max)) continue;
            }
            if (filters.variability?.enabled) {
                // 前兩搏不限標籤；變動率保留正負號、不取絕對值。
                if (i < 2) continue;
                const previousInterval = beats[i - 1][0] - beats[i - 2][0];
                const currentInterval = index - beats[i - 1][0];
                if (!(previousInterval > 0) || !(currentInterval > 0)) continue;
                const rate = (previousInterval - currentInterval) / currentInterval;
                if ((filters.variability.min !== null && rate < filters.variability.min) ||
                    (filters.variability.max !== null && rate > filters.variability.max)) continue;
            }
            const existing = pending.find(item => item[4] && item[1] === index);
            const original = existing ? existing[3] : data.anno[index] || type;
            const time = first.startTime + Math.floor((index - first.viewStart) / first.rate);
            updates.push([time, index, tag, original, 1]);
        }
        return updates;
    }
    // 由 cursor 往前讀取相鄰心搏寫入 effective，直到取得 requiredBeats 個有效心搏（N/S/A/V）；未儲存修改優先。
    async function addPrecedingBeats(manager, af, effective, pending, cursor, requiredBeats) {
        let precedingBeats = 0;
        for (let attempts = 0; attempts < 64; attempts++) {
            const adjacentResponse = await manager.Af.getAdjacentFilteredECGLabel(
                af._vendorId, af._idNumber, af._measureId, cursor, 1);
            const adjacent = adjacentResponse?.plain ? adjacentResponse.plain() : adjacentResponse;
            if (!adjacent || typeof adjacent !== 'object') throw new Error('無法讀取前一心搏以計算 BPM');
            const entries = Object.entries(adjacent).map(([index, type]) => [Number(index), type])
                .filter(([index]) => Number.isFinite(index) && index < cursor).sort((a, b) => b[0] - a[0]);
            if (!entries.length) break;
            const [index, type] = entries[0];
            const edit = pending.find(item => item[4] && item[1] === index);
            effective.set(index, edit ? edit[2] : type);
            if (['N', 'S', 'A', 'V'].includes(edit ? edit[2] : type)) precedingBeats++;
            if (precedingBeats >= requiredBeats) break;
            cursor = index;
            if (attempts === 63) throw new Error('前一心搏連續刪除過多，無法確認 BPM');
        }
    }
    // 填補整理：以 previous→a 的 RR 為目標，在錨點 a、b 之間排出心搏。
    // inner 為兩錨點之間的既有心搏 [索引, 類型]；靠近預期位置（±25% RR）的保留，其餘刪除，缺的平均補在保留的心搏之間。
    const FILL_VARIABILITY = 0.12;
    function planFill(a, b, previous, inner) {
        const targetRR = a - previous;
        const gap = b - a;
        if (!(targetRR > 0) || !(gap > 0)) throw new Error('無法計算開頭心搏的 RR');
        const count = Math.max(1, Math.round(gap / targetRR));
        const spacing = gap / count;
        const slots = [{ k: 0, index: a }];
        const kept = new Set();
        for (let k = 1; k < count; k++) {
            const expected = a + k * spacing;
            let best = null;
            for (const [index] of inner) {
                if (kept.has(index) || Math.abs(index - expected) > spacing * 0.25) continue;
                if (best === null || Math.abs(index - expected) < Math.abs(best - expected)) best = index;
            }
            if (best !== null) { kept.add(best); slots.push({ k, index: best }); }
        }
        slots.push({ k: count, index: b });
        const variability = (prevRR, rr) => (prevRR - rr) / rr;
        const beats = [previous, a];
        const add = [];
        for (let s = 1; s < slots.length; s++) {
            const from = slots[s - 1];
            const to = slots[s];
            const step = (to.index - from.index) / (to.k - from.k);
            for (let j = 1; j < to.k - from.k; j++) {
                const index = Math.round(from.index + j * step);
                add.push(index);
                beats.push(index);
            }
            beats.push(to.index);
        }
        let maxVariability = 0;
        for (let i = 2; i < beats.length; i++) {
            const value = Math.abs(variability(beats[i - 1] - beats[i - 2], beats[i] - beats[i - 1]));
            if (Number.isFinite(value)) maxVariability = Math.max(maxVariability, value);
        }
        return { targetRR, count, keep: [...kept], remove: inner.map(([index]) => index).filter(index => !kept.has(index)),
            add, maxVariability };
    }
    // 填補整理：區間內第一顆、最後一顆有效標籤為錨點且不修改；依開頭那顆的 RR 補滿、整理兩者之間的心搏。
    // 補上的標籤使用 tag；結果寫入未儲存修改，不自動儲存報告。
    async function applyFillRange(first, last, tag) {
        if (first.af !== last.af || first.record !== last.record || first.modifiedData !== last.modifiedData)
            throw new Error('兩點必須屬於同一份報告');
        if (first.rate !== last.rate) throw new Error('兩個視窗取樣率不同，請重新選取');
        const start = Math.min(first.index, last.index);
        const end = Math.max(first.index, last.index);
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const af = first.af;
        const response = await manager.Af.getFilteredECGDataByIndexRange(
            af._vendorId, af._idNumber, af._measureId, start, end,
            first.startTime, af.record.ecgLeadMode, first.scope.channelSwitch || 1);
        const data = response?.plain ? response.plain() : response;
        if (!data?.anno || typeof data.anno !== 'object') throw new Error('區間標籤讀取失敗');
        if (data.sampleRate && Number(data.sampleRate) !== first.rate) throw new Error('區間取樣率不一致');
        const pending = first.modifiedData;
        const isBeat = type => ['N', 'S', 'A', 'V'].includes(type);
        const effective = new Map(Object.entries(data.anno).map(([index, type]) => [Number(index), type]));
        for (const item of pending) {
            if (item[4] && item[1] >= start && item[1] <= end) effective.set(item[1], item[2]);
        }
        const inRange = [...effective].filter(([index, type]) => Number.isFinite(index) && index >= start
            && index <= end && isBeat(type)).sort((x, y) => x[0] - y[0]);
        if (inRange.length < 2) throw new Error('區間內至少需要開頭與結尾兩顆標籤');
        const a = inRange[0][0];
        const b = inRange[inRange.length - 1][0];
        await addPrecedingBeats(manager, af, effective, pending, a, 1);
        if (isDisabledPage() || rangeMode?.cancelled || !first.parent || first.parent.$$destroyed ||
            first.parent.af !== af || first.modifiedData !== af.ecgAnno.modifiedData)
            throw new Error('報告已切換，取消區間修改');
        for (const item of pending) if (item[4] && item[1] < start) effective.set(item[1], item[2]);
        const previous = [...effective].reduce((max, [index, type]) =>
            Number.isFinite(index) && index < a && isBeat(type) ? Math.max(max, index) : max, -Infinity);
        if (!Number.isFinite(previous)) throw new Error('找不到開頭前一顆心搏，無法計算 RR');
        const plan = planFill(a, b, previous, inRange.slice(1, -1));
        const target = new Map(plan.remove.map(index => [index, 'X']));
        for (const index of plan.add) target.set(index, tag);
        const updates = [];
        const touched = new Set(target.keys());
        for (const [index, type] of target) {
            const existing = pending.find(item => item[4] && item[1] === index);
            const original = existing ? existing[3] : data.anno[index] || 'X';
            if (original === type) continue; // 與原始資料相同：只撤銷未儲存修改。
            updates.push([first.startTime + Math.floor((index - first.viewStart) / first.rate), index, type, original, 1]);
        }
        first.parent.$apply(() => {
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i][4] && touched.has(pending[i][1])) pending.splice(i, 1);
            }
            pending.push(...updates);
        });
        return { added: plan.add.length, removed: plan.remove.length, targetRR: plan.targetRR,
            maxVariability: plan.maxVariability };
    }
    // 核對兩端點屬於同一報告、同一修改陣列及相同取樣率，再讀取區間原始標籤。
    // 有間隔條件時額外取得前一至兩個有效心搏；套用前再次核對報告，最後於 Angular $apply 更新未儲存資料。
    async function applyIndexRange(first, last, tag, filters) {
        if (first.af !== last.af || first.record !== last.record || first.modifiedData !== last.modifiedData)
            throw new Error('兩點必須屬於同一份報告');
        if (first.rate !== last.rate) throw new Error('兩個視窗取樣率不同，請重新選取');
        const start = Math.min(first.index, last.index);
        const end = Math.max(first.index, last.index);
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const af = first.af;
        const response = await manager.Af.getFilteredECGDataByIndexRange(
            af._vendorId, af._idNumber, af._measureId, start, end,
            first.startTime, af.record.ecgLeadMode, first.scope.channelSwitch || 1);
        const data = response?.plain ? response.plain() : response;
        if (!data?.anno || typeof data.anno !== 'object') throw new Error('區間標籤讀取失敗');
        if (data.sampleRate && Number(data.sampleRate) !== first.rate) throw new Error('區間取樣率不一致');
        const pending = first.modifiedData;
        const effective = new Map(Object.entries(data.anno).map(([index, type]) => [Number(index), type]));
        const needsIntervals = filters.enabled || filters.variability?.enabled;
        if (needsIntervals) {
            // 使用網站原生的相鄰心搏 API；不擴張 ECG 波形讀取範圍或改變 src 對應。
            const firstIndex = [...effective.keys()].reduce((min, index) =>
                Number.isFinite(index) && index >= start ? Math.min(min, index) : min, Infinity);
            if (Number.isFinite(firstIndex)) {
                await addPrecedingBeats(manager, af, effective, pending, firstIndex, filters.variability?.enabled ? 2 : 1);
            }
        }
        // 所有非同步讀取完成後，再確認報告與未儲存資料仍一致。
        if (isDisabledPage() || rangeMode?.cancelled || !first.parent || first.parent.$$destroyed ||
            first.parent.af !== af || first.modifiedData !== af.ecgAnno.modifiedData)
            throw new Error('報告已切換，取消區間修改');
        for (const item of pending) {
            if (item[4] && item[1] <= end && (needsIntervals || item[1] >= start)) effective.set(item[1], item[2]);
        }
        const updates = getRangeUpdates(effective, pending, data, first, start, end, tag, filters);
        first.parent.$apply(() => {
            const indices = new Set(updates.map(item => item[1]));
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i][4] && indices.has(pending[i][1])) pending.splice(i, 1);
            }
            pending.push(...updates);
        });
        return updates.length;
    }
    // 標記目前選取已取消；若資料仍在讀取，保留取消旗標讓非同步流程在寫入前中止。
    function cancelRange() {
        if (rangeMode) rangeMode.cancelled = true;
        if (!rangeBusy) rangeMode = null;
        if (!rangeBusy) rangeHint.style.display = 'none';
    }
    // RootiCare 站內切頁不一定重載腳本；每次操作仍檢查目前路徑。
    // 路由畫面更新時也收起尚未完成的區間面板。
    let lastPagePath = window.location?.pathname;
    // 站內路由改變時更新可用狀態與焦點樣式；進入 Morphology 時收起未完成的區間操作。
    function updatePageAvailability() {
        installZoomPersistence();
        const path = window.location?.pathname;
        if (style.sheet) style.sheet.disabled = isDisabledPage();
        if (path === lastPagePath) return;
        lastPagePath = path;
        if (isDisabledPage()) { cancelRange(); rangeHint.style.display = 'none'; }
    }
    updatePageAvailability();
    window.addEventListener('popstate', updatePageAvailability);
    window.addEventListener('hashchange', updatePageAvailability);
    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(updatePageAvailability).observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener('blur', cancelRange);
    // 拖曳只預覽 DOM，放開後才以原生修改格式提交；不自動儲存報告。
    let labelDrag = null;
    let dragClickUntil = 0;
    const movedLabelSources = new WeakMap();
    // 原位仍有原始心搏資料；重新新增 N 時撤銷刪除，避免送出互相抵消的新增／刪除。
    function restoreMovedLabelSource(pending, index) {
        const position = pending.findIndex(item => item[4] && item[1] === index && item[2] === 'X');
        if (position < 0) return false;
        const original = pending[position][3];
        if (original === 'N') pending.splice(position, 1);
        else pending[position][2] = 'N';
        return true;
    }
    document.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || labelDrag || Date.now() < dragClickUntil || isDisabledPage()) return;
        const svg = event.target.closest?.('svg.ecgRMarker');
        if (!svg || event.target.closest?.('.annoText') || !svg.closest(TARGET_BLOCK_SELECTOR)) return;
        try {
            const context = getRangeContext(svg, event.clientX);
            const sources = movedLabelSources.get(context.modifiedData);
            const original = context.scope.annoData.find(beat => Math.abs(beat.index - context.index) <= 10);
            if (!original || !sources?.has(original.index)
                || !context.modifiedData.some(item => item[4] && item[1] === original.index && item[2] === 'X')) return;
            event.preventDefault(); event.stopImmediatePropagation();
            context.parent.$apply(() => restoreMovedLabelSource(context.modifiedData, original.index));
        } catch (_) { /* 不可編輯時沿用原生禁用狀態。 */ }
    }, true);
    function previewDragIntervals(drag) {
        const width = Number(drag.svg.getAttribute('width'));
        const pixelsPerSample = width / (drag.first.rate * Number(drag.first.scope.segSec));
        for (const item of drag.intervals) {
            const from = item.side === 'left' ? item.neighbor : drag.index;
            const to = item.side === 'left' ? drag.index : item.neighbor;
            const interval = to - from;
            if (!(interval > 0)) continue;
            item.text.nodeValue = String(Math.floor(interval / drag.first.rate * 1000));
            if (item.bpm) item.bpm.textContent = String(Math.round(60 * drag.first.rate / interval));
            // 父 text 的總長度包含下方 tspan；兩列須分別量寬，再共用同一中心。
            const rrWidth = item.node.getSubStringLength(0, item.text.nodeValue.length);
            const bpmWidth = item.bpm ? item.bpm.getComputedTextLength() : 0;
            const margin = Math.max(rrWidth, bpmWidth) / 2 + 1;
            const center = Math.max(margin, Math.min(width - margin,
                ((from + to) / 2 - drag.first.viewStart) * pixelsPerSample));
            item.node.setAttribute('px', center);
            item.node.setAttribute('x', center - rrWidth / 2);
            if (item.bpm) item.bpm.setAttribute('x', center - bpmWidth / 2);
        }
    }
    function finishLabelDrag(commit = false) {
        const drag = labelDrag;
        if (!drag) return;
        labelDrag = null;
        hideAlignmentGuide();
        dragClickUntil = Date.now() + 400;
        drag.label.setAttribute('x', drag.originalX);
        for (const item of drag.intervals) {
            item.text.nodeValue = item.originalText;
            item.node.setAttribute('x', item.x);
            item.node.setAttribute('px', item.px);
            if (item.bpm) {
                item.bpm.textContent = item.originalBpm;
                item.bpm.setAttribute('x', item.bpmX);
            }
        }
        if (!commit || drag.index === drag.first.index) return;
        try {
            const current = getRangeContext(drag.svg, drag.lastX);
            if (!drag.svg.isConnected || isDisabledPage() || current.scope !== drag.first.scope
                || current.record !== drag.first.record || current.viewStart !== drag.first.viewStart
                || current.rate !== drag.first.rate || current.modifiedData !== drag.first.modifiedData
                || JSON.stringify(current.modifiedData) !== drag.pendingSnapshot) return;
            const pending = current.modifiedData;
            const source = pending.find(item => item[4] && item[1] === drag.first.index);
            const original = source ? source[3] : drag.type;
            const destination = pending.find(item => item[4] && item[1] === drag.index);
            const destinationOriginal = destination ? destination[3]
                : current.scope.annoData.find(item => item.index === drag.index)?.type || 'X';
            const edit = (index, type, originalType) => [current.startTime
                + Math.floor((index - current.viewStart) / current.rate), index, type, originalType, 1];
            current.parent.$apply(() => {
                for (let i = pending.length - 1; i >= 0; i--) {
                    if (pending[i][4] && [drag.first.index, drag.index].includes(pending[i][1])) pending.splice(i, 1);
                }
                pending.push(edit(drag.first.index, 'X', original), edit(drag.index, drag.type, destinationOriginal));
                let sources = movedLabelSources.get(pending);
                if (!sources) { sources = new Set(); movedLabelSources.set(pending, sources); }
                sources.add(drag.first.index);
            });
        } catch (error) {
            console.warn('[RootiCare 標籤位置微調] 已取消', error);
        }
    }
    // 標籤列中水平距離游標最近、可拖曳（N / A / S / V）的標籤。
    function findNearestDraggableLabel(svg, clientX) {
        let nearest = null;
        let nearestDistance = Infinity;
        for (const label of svg.querySelectorAll('.annoText')) {
            const beat = label.__data__;
            if (!Number.isInteger(beat?.index) || !['N', 'A', 'S', 'V'].includes(beat.type)) continue;
            const bounds = label.getBoundingClientRect();
            if (!(bounds.width > 0)) continue;
            const distance = Math.abs(bounds.left + bounds.width / 2 - clientX);
            if (distance < nearestDistance) { nearest = label; nearestDistance = distance; }
        }
        return nearest;
    }
    document.addEventListener('pointerdown', event => {
        const marker = event.target.closest?.('svg.ecgRMarker');
        if (event.button === 0 && event.ctrlKey && marker?.closest(TARGET_BLOCK_SELECTOR) && !isDisabledPage()) {
            event.preventDefault(); event.stopImmediatePropagation();
            dragClickUntil = Date.now() + 400;
        }
        if (event.button !== 0 || !event.ctrlKey || event.shiftKey || event.altKey || event.metaKey
            || isDisabledPage() || rangeMode || rangeBusy || labelDrag) return;
        // 按在標籤上就拖曳該標籤；按在標籤列空白處則吸過最近的標籤，直接移到游標位置後可繼續拖曳。
        let label = event.target.closest?.('.annoText');
        if (!label && marker) label = findNearestDraggableLabel(marker, event.clientX);
        const svg = label?.closest('svg.ecgRMarker');
        if (!svg || !label.closest(TARGET_BLOCK_SELECTOR)) return;
        // Ctrl 點擊不送入原生循環分類，即使目前標籤不可編輯也不變更分類。
        event.preventDefault(); event.stopImmediatePropagation();
        dragClickUntil = Date.now() + 400;
        try {
            const first = getRangeContext(svg, event.clientX);
            const beat = label.__data__;
            if (!Number.isInteger(beat?.index) || !['N', 'A', 'S', 'V'].includes(beat.type)) return;
            first.index = beat.index;
            const effective = new Map(first.scope.annoData.map(item => [item.index, item.type]));
            for (const item of first.modifiedData) if (item[4]) effective.set(item[1], item[2]);
            const neighbors = [...effective].filter(([, type]) => ['N', 'A', 'S', 'V'].includes(type))
                .map(([index]) => index).sort((a, b) => a - b);
            const position = neighbors.indexOf(beat.index);
            if (position < 0) return;
            const labelMargin = (label.getComputedTextLength() / 2 + 1)
                / Number(svg.getAttribute('width')) * first.rate * Number(first.scope.segSec);
            const previous = neighbors[position - 1] ?? (Number(first.scope.idxAdjust?.[0]) > 0
                ? beat.index - Number(first.scope.idxAdjust[0]) : null);
            const next = neighbors[position + 1] ?? (Number(first.scope.idxAdjust?.[1]) > 0
                ? beat.index + Number(first.scope.idxAdjust[1]) : null);
            const durationNodes = [...svg.querySelectorAll('.annoDuration')]
                .filter(node => typeof node.__data__ === 'number').sort((a, b) => a.__data__ - b.__data__);
            const rightNode = durationNodes.find(node => node.__data__ > beat.index);
            const intervals = durationNodes.flatMap(node => {
                const side = node.__data__ === beat.index ? 'left' : node === rightNode ? 'right' : null;
                const neighbor = side === 'left' ? previous : next;
                const text = [...node.childNodes].find(child => child.nodeType === 3);
                if (!side || neighbor == null || !text || !text.nodeValue.trim()) return [];
                const bpm = node.querySelector('tspan');
                return [{ node, side, neighbor, text, bpm, originalText: text.nodeValue,
                    originalBpm: bpm?.textContent, x: node.getAttribute('x'), px: node.getAttribute('px'),
                    bpmX: bpm?.getAttribute('x') }];
            });
            labelDrag = { label, svg, first, type: beat.type, pointerId: event.pointerId,
                intervals,
                startX: event.clientX, lastX: event.clientX, originalX: label.getAttribute('x'), index: beat.index,
                pendingSnapshot: JSON.stringify(first.modifiedData),
                min: Math.max(Math.ceil(first.viewStart + labelMargin), (neighbors[position - 1] ?? -Infinity) + 1),
                max: Math.min(Math.floor(first.viewStart + first.rate * Number(first.scope.segSec) - labelMargin),
                    (neighbors[position + 1] ?? Infinity) - 1) };
            updateLabelDragPosition(event);
        } catch (_) { /* 原生禁用或資料尚未就緒時不開始拖曳。 */ }
    }, true);
    document.addEventListener('pointermove', event => {
        const drag = labelDrag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.ctrlKey || !(event.buttons & 1) || !drag.label.isConnected || isDisabledPage()) {
            finishLabelDrag(); return;
        }
        updateLabelDragPosition(event);
    }, true);
    function updateLabelDragPosition(event) {
        const drag = labelDrag;
        if (!drag) return;
        const bounds = drag.svg.getBoundingClientRect();
        if (!(bounds.width > 0) || drag.min > drag.max) { finishLabelDrag(); return; }
        const samplesPerPixel = drag.first.rate * Number(drag.first.scope.segSec) / bounds.width;
        drag.index = Math.max(drag.min, Math.min(drag.max,
            Math.round(drag.first.viewStart + (event.clientX - bounds.left) * samplesPerPixel)));
        drag.lastX = event.clientX;
        const scale = Number(drag.svg.getAttribute('width')) / bounds.width;
        const centerX = (drag.index - drag.first.viewStart) / samplesPerPixel * scale;
        drag.label.setAttribute('x', centerX - drag.label.getComputedTextLength() / 2);
        previewDragIntervals(drag);
        guideMarker = drag.svg;
        guideMouseX = bounds.left + (drag.index - drag.first.viewStart) / samplesPerPixel;
        guideMouseY = event.clientY;
        if (guideFrame !== null) cancelAnimationFrame(guideFrame);
        drawAlignmentGuide();
    }
    document.addEventListener('pointerup', event => {
        if (!labelDrag || event.pointerId !== labelDrag.pointerId) return;
        event.preventDefault(); event.stopImmediatePropagation();
        finishLabelDrag(event.ctrlKey && event.button === 0);
    }, true);
    for (const name of ['mousedown', 'mouseup', 'click', 'dblclick']) {
        document.addEventListener(name, event => {
            const ctrlOnMarker = event.ctrlKey && event.button === 0 && !isDisabledPage()
                && event.target.closest?.('svg.ecgRMarker')?.closest(TARGET_BLOCK_SELECTOR);
            if (ctrlOnMarker || labelDrag || (Date.now() < dragClickUntil && event.button === 0)) {
                event.preventDefault(); event.stopImmediatePropagation();
            }
        }, true);
    }
    document.addEventListener('keydown', event => {
        if (!labelDrag) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === 'Escape') finishLabelDrag();
    }, true);
    document.addEventListener('keyup', event => {
        if (event.key === 'Control' && labelDrag) finishLabelDrag();
    }, true);
    document.addEventListener('pointercancel', () => finishLabelDrag(), true);
    window.addEventListener('blur', () => finishLabelDrag());
    // 第一次快捷鍵記錄端點，第二次讀取篩選條件並套用區間；目標分類以第二次按鍵為準。
    // 執行中鎖住區間操作；完成或失敗後顯示結果，並延遲收起提示，不自動儲存報告。
    async function selectRangePoint(tag) {
        let failed = false;
        const block = getActiveBlockUnderMouse();
        const svg = block?.querySelector('.annoGroup')?.closest('svg');
        if (!svg) {
            showRangeHint('請在 ECG 上按 Shift + 1／2／3 選取端點');
            return;
        }
        try {
            const context = getRangeContext(svg, currentMousePos.x);
            if (!rangeMode?.first) {
                rangeMode = { tag, first: context };
                showRangeHint('區間修改 · 已選第一端點');
                return;
            }
            const mode = rangeMode;
            if (rangeTool === 'fill') {
                mode.tag = tag;
                rangeBusy = true;
                showRangeHint(`正在填補整理 → ${tag}…`);
                const result = await applyFillRange(mode.first, context, tag);
                rangeMode = null;
                const notes = [`RR ${Math.round(result.targetRR / mode.first.rate * 1000)} ms`];
                if (result.maxVariability > FILL_VARIABILITY) notes.push(`最大變動率 ${(result.maxVariability * 100).toFixed(1)}%，超過 12%`);
                showRangeHint(result.added || result.removed
                    ? `已補 ${result.added} 顆（${tag}）、刪除 ${result.removed} 顆 · ${notes.join(' · ')} · 尚未儲存`
                    : `兩錨點之間已符合，不需修改 · ${notes.join(' · ')}`);
                return;
            }
            let filters;
            try { filters = readRangeFilters(); }
            catch (error) { showRangeHint(error.message); return; }
            mode.tag = tag;
            rangeBusy = true;
            showRangeHint(`正在篩選區間標籤 → ${tag}…`);
            const count = await applyIndexRange(mode.first, context, tag, filters);
            rangeMode = null;
            showRangeHint(count ? `已修改 ${count} 個標籤 → ${tag} · 尚未儲存` : '沒有符合條件且需要變更的標籤');
        } catch (error) {
            failed = true;
            const detail = error?.message || (error?.status ? `資料讀取失敗（HTTP ${error.status}）` : '區間修改失敗，請重新選取');
            showRangeHint(detail);
            rangeMode = null;
        } finally {
            if (rangeBusy) {
                rangeBusy = false;
                setTimeout(() => { if (!rangeMode && !rangeBusy) rangeHint.style.display = 'none'; }, failed ? 15000 : 3500);
            }
        }
    }

    /**
     * 分派標註、區間選取與縮放快捷鍵。
     */
    // 所有匹配的 RootiCare 頁面皆攔截 Alt，包括輸入欄、面板與 Morphology。
    document.addEventListener('keyup', (e) => {
        if (e.key !== 'Alt') return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
    document.addEventListener('keydown', async function(e) {
        if (e.key === 'Alt') {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
        if (isDisabledPage()) { cancelRange(); rangeHint.style.display = 'none'; return; }
        // 提示可能沒有建立區間（例如無效端點）；Esc 也須能在輸入欄聚焦時收起。
        if (e.key === 'Escape' && (rangeMode || rangeHint.style.display !== 'none')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cancelRange();
            rangeHint.style.display = 'none';
            return;
        }
        if (rangeHint.contains(e.target)) {
            if (e.key === 'Escape') { e.preventDefault(); cancelRange(); }
            return;
        }
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;

        const key = e.key.toLowerCase();
        const isAltPressed = e.altKey;
        // W / S 縮放只處理無修飾鍵的按鍵，保留 Ctrl+S 等瀏覽器快捷鍵。
        if (['w', 's'].includes(key) && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) return;
        // Shift + 數字的 e.key 會變成 ! @ # 等符號，改以實體按鍵位置判斷（含數字鍵盤）。
        const rangeDigit = /^(?:Digit|Numpad)([123])$/.exec(e.code || '')?.[1];
        if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && rangeDigit) {
            // 區間端點與一般數字標註鍵使用相同的滑鼠容器限制。
            if (!getActiveBlockUnderMouse()) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!rangeBusy && !e.repeat) {
                await selectRangePoint({ '1': 'V', '2': 'S', '3': 'N' }[rangeDigit]);
            }
            return;
        }
        const movesECG = ['q', 'e', '<', '>', ',', '.', 'arrowleft', 'arrowright', 'w', 's', 'arrowup', 'arrowdown'].includes(key);
        if (rangeBusy && movesECG) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
        if ((key === 'q' || key === 'e') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
            && !e.isComposing && (rangeMode || document.querySelector('.fixed-board') || getActiveBlockUnderMouse())) {
            e.preventDefault();
            e.stopImmediatePropagation();
            installZoomPersistence();
            triggerOriginalKey(key === 'q' ? 37 : 39, key === 'q' ? 'ArrowLeft' : 'ArrowRight');
            return;
        }
        if (rangeMode && movesECG) {
            // 切換 ECG 視窗時保留區間端點的絕對取樣索引。
            // 保留原生導覽操作；W / S 仍轉換為腳本的縮放快捷鍵。
            if (key === 'w' || key === 's') {
                e.preventDefault();
                e.stopImmediatePropagation();
                triggerOriginalKey(key === 'w' ? 38 : 40, key === 'w' ? 'ArrowUp' : 'ArrowDown');
            }
            return;
        }
        if (rangeMode || rangeBusy) return;

        // 按住期間由滑鼠移動接手；鍵盤連發不再重複處理。
        if (!e.ctrlKey && !e.metaKey && (key === '4' || (isAltPressed && ['1', '2', '3'].includes(key)))) {
            if (e.repeat && heldSweep?.key === key) { e.preventDefault(); e.stopImmediatePropagation(); return; }
            heldSweep = { key, tag: { '1': 'V', '2': 'S', '3': 'N', '4': '' }[key], alt: key !== '4',
                last: { x: currentMousePos.x, y: currentMousePos.y } };
        }

        // 高度縮放不依賴滑鼠位置；數字標註鍵仍限制在下方的 ECG 容器內。
        if (key === 'w' || key === 's') {
            if (document.querySelector('.fixed-board') || document.querySelector(TARGET_BLOCK_SELECTOR)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                key === 'w' ? triggerOriginalKey(38, 'ArrowUp') : triggerOriginalKey(40, 'ArrowDown');
            }
            return;
        }

        const activeBlock = getActiveBlockUnderMouse();
        if (!activeBlock) return;

        // Ctrl / ⌘ + 數字保留給瀏覽器（如切換分頁），不視為標註鍵。
        if (['1', '2', '3', '4'].includes(key) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const targetUnderMouse = getElementAtPoint(currentMousePos.x, currentMousePos.y);
            const isOnLabel = targetUnderMouse && targetUnderMouse.classList.contains('annoText');

            const keyMap = { '1': 'V', '2': 'S', '3': 'N', '4': '' };
            const targetTag = keyMap[key];

            if (isAltPressed && key !== '4') {
                if (!isOnLabel) return;
                await processCommand(targetTag);
                return;
            }

            await processCommand(targetTag);
        }

    }, true);

    // HR Min／HR Max／HR Max sinus 清單：每張心電圖上方加入排除按鈕。
    // 點擊後移除排序在其後、起始時間相差 ±1 分鐘內的心電圖並重新分頁；只換掉清單的分頁資料，
    // 不修改網站原本的清單資料，重新開啟清單或按「還原」即恢復。以容器與 ng 屬性辨識，不依賴語系文字。
    const HR_LIST_TYPES = ['minHR', 'maxHR', 'maxSinus'];
    const HR_EXCLUDE_SECONDS = 60;
    const HR_CARD_SELECTOR = '[ng-repeat^="currentData in af.eventDialog.currentData"]';
    function getHRListContext(element) {
        const dialog = element?.closest?.('#af-hr-dialog');
        if (!dialog || !window.angular) return null;
        let scope;
        try { scope = window.angular.element(dialog).scope(); } catch (_) { return null; }
        const eventDialog = scope?.af?.eventDialog;
        const type = eventDialog?.dscp?.type;
        if (!HR_LIST_TYPES.includes(type) || !Array.isArray(eventDialog.pageData)) return null;
        let host = scope;
        while (host && !Object.prototype.hasOwnProperty.call(host, 'pageChanged')) host = host.$parent;
        if (typeof host?.pageChanged !== 'function') return null;
        return { dialog, eventDialog, type, host };
    }
    function applyHRPages(context, items) {
        const { eventDialog, type, host } = context;
        const pagination = eventDialog.pagination;
        const perPage = Number(pagination.itemsPerPage) || 6;
        const pages = [];
        for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
        host.$apply(() => {
            eventDialog.pageData = pages;
            pagination.totalItems = items.length;
            pagination.currentPage = Math.min(Math.max(1, pagination.currentPage), Math.max(1, pages.length));
            eventDialog.indexAdjust = (pagination.currentPage - 1) * perPage;
            host.pageChanged(type);
        });
    }
    // 已按過排除的心電圖起始時間；清單重新開啟或還原時清空。
    const hrExcludedAnchors = new Set();
    const hrStyle = document.createElement('style');
    hrStyle.textContent = `
        .rc-hr-exclude { display:inline-flex; align-items:center; gap:4px; margin-left:10px; padding:0 10px 0 8px;
            height:20px; border:1px solid #f0b4ae; border-radius:10px; background:#fff5f4; color:#c0392b;
            font-family:inherit; font-weight:600; font-size:11px; line-height:18px; letter-spacing:.3px; cursor:pointer; vertical-align:middle;
            box-shadow:0 1px 2px rgba(192,57,43,.12); transition:background .15s, color .15s, border-color .15s, box-shadow .15s; }
        .rc-hr-exclude .rc-hr-icon { font-size:12px; line-height:1; }
        .rc-hr-exclude:hover { background:#c0392b; border-color:#c0392b; color:#fff; box-shadow:0 2px 5px rgba(192,57,43,.3); }
        .rc-hr-exclude:active { transform:translateY(1px); }
        .rc-hr-exclude:focus-visible { outline:2px solid rgba(192,57,43,.45); outline-offset:1px; }
        .rc-hr-exclude.is-done, .rc-hr-exclude.is-done:hover { background:#eef1f3; border-color:#cfd6db; color:#6b7780;
            box-shadow:none; cursor:default; transform:none; }
        .rc-hr-exclude.is-done .rc-hr-icon { color:#3c9a5f; }
        .rc-hr-restore { display:none; align-items:center; gap:6px; height:22px; padding:0 10px 0 4px; border:0;
            border-radius:11px; background:rgba(255,255,255,.95); color:#4f6b1a; font-family:inherit; font-weight:600; font-size:12px; line-height:22px;
            cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.18); transition:background .15s, box-shadow .15s; }
        .rc-hr-restore.is-visible { display:inline-flex; }
        .rc-hr-restore:hover { background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.25); }
        .rc-hr-restore .rc-hr-count { min-width:18px; height:16px; padding:0 5px; border-radius:8px; background:#c0392b;
            color:#fff; font-size:11px; line-height:16px; text-align:center; }
    `;
    document.head.appendChild(hrStyle);
    function excludeNearbyHRItems(card) {
        const context = getHRListContext(card);
        if (!context) return;
        let item;
        try { item = window.angular.element(card).scope(); } catch (_) { return; }
        const time = Number(item?.currentData?.startTime);
        if (!Number.isFinite(time) || hrExcludedAnchors.has(time)) return;
        hrExcludedAnchors.add(time);
        const { eventDialog } = context;
        const position = (Number(eventDialog.indexAdjust) || 0) + item.$index;
        const items = eventDialog.pageData.flat();
        const kept = items.filter((value, index) => index <= position || Math.abs(Number(value) - time) > HR_EXCLUDE_SECONDS);
        if (kept.length !== items.length) applyHRPages(context, kept);
        else decorateHRList(); // 沒有可排除的項目時仍更新按鈕狀態。
    }
    function restoreHRItems(dialog) {
        const context = getHRListContext(dialog);
        const source = context?.eventDialog[context.type];
        if (!Array.isArray(source?.data)) return;
        hrExcludedAnchors.clear();
        applyHRPages(context, source.data.flat());
    }
    function setExcludeButtonState(button, done) {
        if (button.classList.contains('is-done') === done && button.childElementCount) return;
        button.classList.toggle('is-done', done);
        button.innerHTML = done
            ? '<span class="rc-hr-icon">✓</span>已排除 ±1 分'
            : '<span class="rc-hr-icon">⊘</span>排除 ±1 分';
        button.title = done ? '已移除排序在後、±1 分鐘內的心電圖；按標題列「還原」可恢復'
            : '移除排序在後、與此心電圖相差 ±1 分鐘內的心電圖';
        button.setAttribute('aria-pressed', String(done));
    }
    function decorateHRList() {
        if (isDisabledPage()) return;
        const dialog = document.querySelector('#af-hr-dialog');
        const context = getHRListContext(dialog);
        if (!context) return;
        const source = context.eventDialog[context.type];
        // 網站重新開啟清單時會把分頁資料換回原始清單，此時排除紀錄已失效。
        if (context.eventDialog.pageData === source?.data) hrExcludedAnchors.clear();
        for (const card of dialog.querySelectorAll(HR_CARD_SELECTOR)) {
            const header = card.querySelector('.event-blk-header');
            if (!header) continue;
            let button = header.querySelector('.rc-hr-exclude');
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'rc-hr-exclude';
                button.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    excludeNearbyHRItems(card);
                });
                header.appendChild(button);
            }
            // ng-repeat 以 $index 追蹤，換頁時卡片節點會沿用，因此每次依目前資料更新狀態。
            let time = NaN;
            try { time = Number(window.angular.element(card).scope()?.currentData?.startTime); } catch (_) { /* 略過 */ }
            setExcludeButtonState(button, hrExcludedAnchors.has(time));
        }
        // 標題列顯示已排除數量與還原按鈕。
        const originalCount = Array.isArray(source?.data) ? source.data.flat().length : 0;
        const excluded = context.eventDialog.pageData === source?.data ? 0
            : Math.max(0, originalCount - context.eventDialog.pageData.flat().length);
        const toolbar = dialog.querySelector('.data-tool-blk .float-left');
        let restore = dialog.querySelector('.rc-hr-restore');
        if (!restore && toolbar) {
            restore = document.createElement('button');
            restore.type = 'button';
            restore.className = 'rc-hr-restore';
            restore.title = '恢復完整清單';
            restore.innerHTML = '<span class="rc-hr-count"></span>還原';
            restore.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                restoreHRItems(dialog);
            });
            toolbar.appendChild(restore);
        }
        if (restore) {
            const count = restore.querySelector('.rc-hr-count');
            const label = `已排除 ${excluded}`;
            if (count.textContent !== label) count.textContent = label;
            restore.classList.toggle('is-visible', excluded > 0);
        }
    }
    let hrListPending = false;
    new MutationObserver(() => {
        if (hrListPending) return;
        hrListPending = true;
        requestAnimationFrame(() => { hrListPending = false; decorateHRList(); });
    }).observe(document.body, { childList: true, subtree: true });

    // 事件清單頁碼拉條：在選印的綠色垂直線下方加入頁碼按鈕，點擊即跳到該頁，右側顯示選印數量。
    // 直接讀取網站拉條（svg.paginationEventBar）綁定的分頁資料與選印清單，不依賴語系文字。
    const PRINT_LINK_SPACE = 4; // 拉條下緣到圓點列的連接線高度，需與 .rc-print-jumps 的 top 相同
    const printBarStyle = document.createElement('style');
    printBarStyle.textContent = `
        .rc-print-panel { position:relative; height:0; overflow:visible; }
        .rc-print-links { position:absolute; left:0; overflow:visible; pointer-events:none; }
        .rc-print-link { fill:none; stroke:#8fb43a; stroke-width:1; stroke-linecap:round; opacity:.75;
            transition:stroke .12s, stroke-width .12s, opacity .12s; }
        .rc-print-link.is-current, .rc-print-link.is-hot { stroke:#5b7d1a; stroke-width:1.6; opacity:1; }
        .rc-print-jumps { position:relative; top:4px; width:100%; height:14px; }
        .rc-print-jump { position:absolute; top:50%; box-sizing:border-box; width:11px; height:11px; margin:0; padding:0;
            transform:translate(-50%, -50%); border:2px solid #8fb43a; border-radius:50%; background:#fff; color:#fff;
            font-family:inherit; font-weight:700; font-size:8px; line-height:7px; text-align:center; cursor:pointer;
            transition:transform .12s, background .12s, border-color .12s; }
        .rc-print-jump.has-count { width:14px; height:14px; background:#8fb43a; line-height:10px; }
        .rc-print-jump:hover { z-index:1; transform:translate(-50%, -50%) scale(1.35); background:#5b7d1a; border-color:#5b7d1a; }
        .rc-print-jump.is-current { background:#5b7d1a; border-color:#5b7d1a; box-shadow:0 0 0 2px rgba(91,125,26,.28); }
        .rc-print-summary { position:absolute; left:calc(100% + 10px); top:calc(var(--rc-range-height, 20px) / -2);
            transform:translateY(-50%); height:18px; padding:0 8px; border-radius:9px; background:#5b7d1a; color:#fff;
            font-family:inherit; font-weight:600; font-size:11px; line-height:18px; white-space:nowrap; pointer-events:none; }
    `;
    document.head.appendChild(printBarStyle);
    // 分頁資料可能是時間、[時間, …] 或含 startTime 的物件。
    function toEventTime(value) {
        if (Array.isArray(value)) value = value[0];
        if (value && typeof value === 'object') value = value.startTime ?? value.tms ?? value.time;
        const time = Number(value);
        return Number.isFinite(time) ? time : null;
    }
    function getPrintPages(scope) {
        const pages = Array.isArray(scope?.pageData) ? scope.pageData : [];
        const events = Array.isArray(scope?.events) ? scope.events : [];
        if (!pages.length || !events.length) return { groups: [], total: events.length };
        const pageByTime = new Map();
        pages.forEach((page, index) => {
            for (const value of Array.isArray(page) ? page : [page]) {
                const time = toEventTime(value);
                if (time !== null && !pageByTime.has(time)) pageByTime.set(time, index + 1);
            }
        });
        const groups = new Map();
        for (const event of events) {
            const time = toEventTime(event);
            const page = pageByTime.get(time);
            if (!page) continue;
            if (!groups.has(page)) groups.set(page, []);
            groups.get(page).push(time);
        }
        return { groups: [...groups].sort((a, b) => a[0] - b[0]).map(([page, times]) => ({ page, times })),
            total: events.length, pageCount: pages.length };
    }
    // 只排一列：依綠線位置（已由左到右排序）回傳每個圓點的中心 x。
    // 會重疊的圓點合併成一組，以組內綠線的平均位置為中心左右攤開；每次合併都先限制在拉條寬度內，
    // 再與前一組比較，避免被邊界推回後又疊到相鄰的組。整列比拉條寬時置中。
    function layoutPrintDots(targets, barWidth) {
        const gap = Math.max(15, Math.min(18, barWidth / Math.max(1, targets.length)));
        const place = cluster => {
            const width = cluster.count * gap;
            const ideal = cluster.sum / cluster.count - width / 2;
            cluster.left = width > barWidth ? (barWidth - width) / 2 : Math.min(Math.max(ideal, 0), barWidth - width);
        };
        const clusters = [];
        targets.forEach((target, index) => {
            let cluster = { first: index, count: 1, sum: target };
            place(cluster);
            while (clusters.length) {
                const previous = clusters[clusters.length - 1];
                if (previous.left + previous.count * gap <= cluster.left + 0.01) break;
                clusters.pop();
                cluster = { first: previous.first, count: previous.count + cluster.count, sum: previous.sum + cluster.sum };
                place(cluster);
            }
            clusters.push(cluster);
        });
        const positions = [];
        for (const cluster of clusters) {
            for (let i = 0; i < cluster.count; i++) positions[cluster.first + i] = cluster.left + gap * (i + 0.5);
        }
        return positions;
    }
    function jumpToPage(range, page) {
        const input = range.querySelector('input[type="range"]');
        if (!input) return;
        input.value = String(page);
        // 交給網站的 ng-model 與 ng-change 處理換頁，與拖曳拉條相同。
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function decoratePrintBars() {
        if (isDisabledPage() || !window.angular) return;
        for (const bar of document.querySelectorAll('.pagination-range svg.paginationEventBar')) {
            const range = bar.closest('.pagination-range');
            let scope;
            try { scope = window.angular.element(bar).isolateScope(); } catch (_) { continue; }
            if (!scope) continue;
            const { groups, total, pageCount } = getPrintPages(scope);
            const current = Number(scope.pageIndex);
            const barWidth = bar.getBoundingClientRect().width;
            const signature = JSON.stringify([groups, total, current, Math.round(barWidth)]);
            const hasPanel = range.nextElementSibling?.classList.contains('rc-print-panel');
            if (range.dataset.rcPrintSignature === signature && hasPanel === total > 0) continue;
            range.dataset.rcPrintSignature = signature;

            // 拉條容器為 overflow:hidden，圓點與數量放在緊接其後、同寬置中的獨立列。
            let panel = range.nextElementSibling?.classList.contains('rc-print-panel') ? range.nextElementSibling : null;
            if (!total) { panel?.remove(); continue; }
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'rc-print-panel';
                panel.innerHTML = '<svg class="rc-print-links" aria-hidden="true"></svg>'
                    + '<span class="rc-print-summary"></span><div class="rc-print-jumps"></div>';
                range.after(panel);
            }
            const rangeStyle = getComputedStyle(range);
            panel.style.width = `${range.offsetWidth}px`;
            panel.style.marginLeft = rangeStyle.marginLeft;
            panel.style.marginRight = rangeStyle.marginRight;
            // 這一列高度為 0，畫在拉條下邊距的空白裡，不推動下方心電圖；負邊距貼齊拉條，再補回同樣的間距。
            const rangeGap = parseFloat(rangeStyle.marginBottom) || 0;
            panel.style.marginTop = `${-rangeGap}px`;
            panel.style.marginBottom = `${rangeGap}px`;
            panel.style.setProperty('--rc-range-height', `${range.offsetHeight}px`);
            panel.querySelector('.rc-print-summary').textContent = `選印 ${total} 張`;

            // 綠線位置：優先對齊網站畫出的 rect.mark-up，找不到相近的線時才用頁序換算。
            const scale = barWidth / (Number(bar.getAttribute('width')) || barWidth);
            const markXs = [...bar.querySelectorAll('rect.mark-up')]
                .map(rect => Number(rect.getAttribute('x')) * scale).filter(Number.isFinite);
            const items = groups.map(({ page, times }) => {
                const estimate = pageCount > 1 ? (page - 1) / pageCount * barWidth : barWidth / 2;
                const nearest = markXs.reduce((best, value) =>
                    Math.abs(value - estimate) < Math.abs(best - estimate) ? value : best, Infinity);
                return { page, times, target: Math.abs(nearest - estimate) <= 8 ? nearest + 0.5 : estimate };
            });
            layoutPrintDots(items.map(item => item.target), barWidth)
                .forEach((x, index) => { items[index].x = x; });

            // 細曲線從拉條上的綠線底部連到下方圓點。
            const barGap = Math.max(0, range.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom);
            const links = panel.querySelector('.rc-print-links');
            const linkHeight = barGap + PRINT_LINK_SPACE;
            links.setAttribute('width', String(barWidth));
            links.setAttribute('height', String(linkHeight));
            links.style.top = `${-barGap}px`;
            links.innerHTML = '';
            const strip = panel.querySelector('.rc-print-jumps');
            strip.textContent = '';
            for (const { page, times, target, x } of items) {
                const link = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                link.setAttribute('d', `M${target} 0 C${target} ${linkHeight * 0.55} ${x} ${linkHeight * 0.45} ${x} ${linkHeight}`);
                link.setAttribute('class', 'rc-print-link' + (page === current ? ' is-current' : ''));
                links.appendChild(link);

                const button = document.createElement('button');
                button.type = 'button';
                // 小圓點：同頁多張時顯示張數，頁碼放在滑鼠提示中。
                button.className = 'rc-print-jump' + (times.length > 1 ? ' has-count' : '')
                    + (page === current ? ' is-current' : '');
                button.textContent = times.length > 1 ? String(times.length) : '';
                button.title = `第 ${page} 頁・選印 ${times.length} 張`;
                button.setAttribute('aria-label', button.title);
                button.style.left = `${x}px`;
                button.addEventListener('mouseenter', () => link.classList.add('is-hot'));
                button.addEventListener('mouseleave', () => link.classList.remove('is-hot'));
                button.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    jumpToPage(range, page);
                });
                strip.appendChild(button);
            }
        }
    }
    let printBarPending = false;
    new MutationObserver(() => {
        if (printBarPending) return;
        printBarPending = true;
        requestAnimationFrame(() => { printBarPending = false; decoratePrintBars(); });
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => requestAnimationFrame(decoratePrintBars));

    // 滑鼠中鍵：刪除標籤
    window.addEventListener('mousedown', async function(e) {
        if (e.button === 1) {
            if (rangeMode || rangeBusy || rangeHint.contains(e.target)) return;
            const activeBlock = getActiveBlockUnderMouse();
            if (activeBlock) {
                e.preventDefault();
                await processCommand('');
            }
        }
    }, { passive: false });

})();
