// ==UserScript==
// @name         RootiCare 標註快捷鍵
// @namespace    https://editoreu.rooticare.com/
// @version      1.14.4
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

// 使用教學：在 ECG 或事件心電圖中，將滑鼠移到要處理的位置再按快捷鍵。
// 1 / 2 / 3：新增或切換為 V / S / N；4：刪除該位置的標籤。
// Shift + 左鍵拖曳既有標籤：左右微調位置，放開後加入未儲存修改；Esc 取消。
// 按住 Alt + 1 / 2 / 3 並移動滑鼠：僅修改碰到的既有標籤。
// 按住 4 並移動滑鼠：連續刪除碰到的標籤；滑鼠中鍵：刪除點擊的標籤。
// Ctrl + 1 / 2 / 3：記錄區間起點，在面板設定篩選條件，再於終點按快捷鍵套用 V / S / N。
// 區間可跨心電圖視窗；Esc：取消尚未完成的區間操作。
// W / S：模擬方向鍵 ↑ / ↓，調整心電圖縮放。
// Q / E：模擬方向鍵 ← / → 切換時間；滑鼠點選與滾輪切換時間也保留高度縮放。
// ch1／ch2／ch3 旁的眼睛可切換導程曲線；本次頁面內保留狀態，重新載入恢復全開。
// 滑鼠移過 BPM／心律標籤列時，以細紅色垂直線對齊下方心電圖。
// 滑鼠移過心電圖波形（含 Measure／Ruler 視窗）時，顯示較淡的紅色垂直對照線。
// Morphology 頁面停用標註操作；Alt 按鍵事件仍會被攔截。

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
        const plot = overWave ? wave.querySelector('.centerGroup .centerRect') : null;
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
    document.addEventListener('mousemove', event => {
        if (labelDrag) return; // 拖曳期間由標籤的實際位置更新紅線，避免被游標位置覆蓋。
        const marker = event.target.closest?.('svg.ecgRMarker, div.ecgWave');
        if (!ENABLE_ALIGNMENT_GUIDE || !marker || isDisabledPage()) { hideAlignmentGuide(); return; }
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
        #rooticare-range-hotkeys.rh-minimized { padding:5px 9px; }
        #rooticare-range-hotkeys.rh-minimized [data-role=filters],
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
            </div><div data-role="help">在另一端按 Ctrl + 1→V／2→S／3→N，即套用篩選修改</div>`;
        rangeMessage = rangeHint.querySelector('[data-role="message"]');
        rangeControls = rangeHint.querySelector('[data-role="filters"]');
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
        rangeControls.style.display = rangeMode?.first && !rangeBusy ? 'flex' : 'none';
        rangeHint.querySelector('[data-role="help"]').style.display = rangeMode?.first && !rangeBusy ? 'block' : 'none';
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
                let cursor = firstIndex;
                let precedingBeats = 0;
                const requiredBeats = filters.variability?.enabled ? 2 : 1;
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
        if (event.button !== 0 || event.shiftKey || labelDrag || Date.now() < dragClickUntil || isDisabledPage()) return;
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
    document.addEventListener('pointerdown', event => {
        const marker = event.target.closest?.('svg.ecgRMarker');
        if (event.button === 0 && event.shiftKey && marker?.closest(TARGET_BLOCK_SELECTOR) && !isDisabledPage()) {
            event.preventDefault(); event.stopImmediatePropagation();
            dragClickUntil = Date.now() + 400;
        }
        if (event.button !== 0 || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey
            || isDisabledPage() || rangeMode || rangeBusy || labelDrag) return;
        const label = event.target.closest?.('.annoText');
        const svg = label?.closest('svg.ecgRMarker');
        if (!svg || !label.closest(TARGET_BLOCK_SELECTOR)) return;
        // Shift 點擊不送入原生循環分類，即使目前標籤不可編輯也不變更分類。
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
        if (!event.shiftKey || !(event.buttons & 1) || !drag.label.isConnected || isDisabledPage()) {
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
        finishLabelDrag(event.shiftKey && event.button === 0);
    }, true);
    for (const name of ['mousedown', 'mouseup', 'click', 'dblclick']) {
        document.addEventListener(name, event => {
            const shiftOnMarker = event.shiftKey && event.button === 0 && !isDisabledPage()
                && event.target.closest?.('svg.ecgRMarker')?.closest(TARGET_BLOCK_SELECTOR);
            if (shiftOnMarker || labelDrag || (Date.now() < dragClickUntil && event.button === 0)) {
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
        if (event.key === 'Shift' && labelDrag) finishLabelDrag();
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
            showRangeHint('請在 ECG 上按 Ctrl + 1／2／3 選取端點');
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
        if (e.ctrlKey && !e.altKey && !e.metaKey && ['1', '2', '3'].includes(key)) {
            // 區間端點與一般數字標註鍵使用相同的滑鼠容器限制。
            if (!getActiveBlockUnderMouse()) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!rangeBusy && !e.repeat) {
                await selectRangePoint({ '1': 'V', '2': 'S', '3': 'N' }[key]);
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

        if (['1', '2', '3', '4'].includes(key)) {
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
