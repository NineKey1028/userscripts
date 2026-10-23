// ==UserScript==
// @name         RootiCare 標註快捷鍵
// @namespace    https://editoreu.rooticare.com/
// @version      1.30.1
// @description  以數字鍵與滑鼠中鍵新增、修改或刪除 V / S / N 標籤；支援區間篩選修改與 W / S 心電圖縮放。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標註快捷鍵.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標註快捷鍵.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// @inject-into  page
// ==/UserScript==

/*
 * ── 使用教學 ────────────────────────────────────────────
 * 滑鼠移到心電圖上要處理的位置，再按快捷鍵。
 * 所有修改都只加入「未儲存修改」，不會自動儲存。
 *
 * 【標註】
 *   1 / 2 / 3            新增或改為 V / S / N
 *   4／滑鼠中鍵          刪除標籤（Mac 觸控板無中鍵，用 4）
 *   滑鼠在心電圖波形上    以上按鍵與按住滑動同樣作用在該時間點的標籤（等同滑鼠在標籤列同一位置）
 *   按住 4 移動          連續刪除碰到的標籤
 *   按住 Alt+1/2/3 移動  只修改碰到的既有標籤（Mac 為 Option）
 *   Ctrl+左鍵拖曳        左右微調標籤位置（Esc 取消；Mac 建議用 ⌘）；
 *                        按在標籤列空白處或心電圖波形上會吸過最近的標籤；
 *                        開始後可放開 Ctrl，拖曳中按 1／2／3 改為 V／S／N，放開滑鼠一併送出
 *
 * 【區間】Shift+1/2/3 按兩次（起點、終點），可跨視窗；Esc 取消
 *   篩選修改  依 BPM、變動率、原標籤篩選後改為 V / S / N
 *   填補整理  在頭尾兩顆標籤外側各按一次，依開頭 RR 平均補滿中間心搏
 *            （頭尾不改；多刪少補，保留的維持原類型）
 *   分頁選擇保留到重新整理頁面為止。
 *
 * 【檢視】
 *   W / S   縮放（↑ / ↓）
 *   Q / E   切換時間（← / →），縮放高度保持不變；滑鼠不必停在心電圖上
 *   ch1～3 旁的眼睛  顯示／隱藏導程（重新載入恢復全開）
 *   滑過標籤列或波形時，顯示紅色垂直對齊線
 *
 * 【清單】
 *   HR Min／Max／Max sinus  「排除 ±1 分」移除後面相近時間的心電圖，再按一次取消；選印後保留，標題列可還原
 *   Max HR sinus            標題列「排除 AF 時段」（預設關）：開啟後移除與 AF 時段重疊的心電圖
 *   AF 清單 mid segment     下拉選單旁的 ◀ ▶ 切換上一個／下一個時段（編輯模式）
 *   時間輸入框              W／↑ 加 2 秒、S／↓ 減 2 秒，可按住連續調整；聚焦時顯示提示 3 秒
 *   HR 清單時間框           貼上或修改時間後，自動以該心電圖白色區段的平均 BPM 填入 HR 欄
 *   事件清單頁碼拉條       選印位置（綠色、橘色強制選印）下方的圓點可點擊跳頁，右側顯示選印張數
 *   V / S 事件清單          「⚡ 快速選印」依規則補足選印（時段分散、相隔 1 分鐘以上）；
 *                          按「選印 N 張」開啟選印清單：上方為心電圖視窗（可改標籤並 Save），
 *                          下方為縮圖列（A／D 切換），可「取消選印」「換一個」或「加選一個」
 *                          快速選印與換一個會先依目前標籤（含未儲存修改）驗證是否仍符合清單類型
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
    // Mac：⌘ 可代替 Ctrl 拖曳標籤（Mac 的 Ctrl+點擊等同右鍵）。
    const IS_MAC = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '');
    const isDragModifier = event => event.ctrlKey || (IS_MAC && event.metaKey);
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
    let heldSweep = null; // { key, code, tag, alt, last: { x, y } }
    function stopHeldSweep() { heldSweep = null; }
    function sweepTo(x, y) {
        const from = heldSweep.last;
        heldSweep.last = { x, y };
        const distance = Math.hypot(x - from.x, y - from.y);
        const samples = Math.min(SWEEP_MAX_SAMPLES, Math.max(1, Math.ceil(distance / SWEEP_STEP)));
        for (let i = 1; i <= samples; i++) {
            // 在波形上滑動時同樣投影到標籤列，碰到該 x 的既有標籤就處理。
            const point = toLabelRowPoint({ x: from.x + (x - from.x) * i / samples, y: from.y + (y - from.y) * i / samples });
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
        if (heldSweep && (e.code === heldSweep.code || (e.key === 'Alt' && heldSweep.alt))) stopHeldSweep();
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

    // 畫面上是否有可見的 ECG 區塊（不論滑鼠位置）。
    function hasVisibleECGBlock() {
        if (isDisabledPage()) return false;
        return [...document.querySelectorAll(TARGET_BLOCK_SELECTOR)].some(block => block.getClientRects().length > 0);
    }

    // 取得當前位置的元素（優先抓取標籤文字，次之為標籤列的背景矩形）。
    // 只接受標籤列（svg.ecgRMarker）內的矩形：心電圖外框（centerRect）的線寬會延伸到標籤列底部，點到會觸發量測。
    function getElementAtPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        return elements.find(el => el.classList.contains('annoText')) ||
               elements.find(el => el.tagName.toLowerCase() === 'rect' && el.closest('svg.ecgRMarker'));
    }

    // 滑鼠在心電圖波形上時，把位置垂直投影到同一區塊的標籤列（x 不變），
    // 讓數字鍵、Alt、按住滑動與中鍵在波形上也能新增或修改該時間點的標籤，效果與滑鼠在標籤列上相同。
    // 該 x 已有標籤時落在標籤中心，沒有時落在標籤列中線；已在標籤列上或不在 ECG 區塊內則不變。
    function toLabelRowPoint(point, block = null) {
        if (!block) {
            for (const element of document.elementsFromPoint(point.x, point.y)) {
                block = element.closest?.(TARGET_BLOCK_SELECTOR);
                if (block) break;
            }
        }
        const marker = block?.querySelector('svg.ecgRMarker');
        if (!marker) return point;
        const row = marker.getBoundingClientRect();
        if (!row.height || (point.y >= row.top && point.y <= row.bottom) || point.x < row.left || point.x > row.right) return point;
        const label = findLabelAtX(block, point.x);
        if (label) {
            const rect = label.getBoundingClientRect();
            return { x: point.x, y: rect.top + rect.height / 2 };
        }
        return { x: point.x, y: row.top + row.height / 2 };
    }

    // 標籤列與心電圖的交界：畫面縮放時兩者之間可能出現縫隙，加上心電圖外框的線寬，
    // 點到交界下方這一條會變成點擊心電圖（等同開啟 Measure 後點心電圖）。交界下方 3px 內的滑鼠點擊直接忽略。
    const LABEL_SEAM_PX = 3;
    function isLabelSeamClick(event) {
        const wave = event.target?.closest?.('.ecgWave');
        const marker = wave?.closest('.ecg-individual-blk')?.querySelector('svg.ecgRMarker');
        if (!marker) return false;
        const edge = Math.max(wave.getBoundingClientRect().top, marker.getBoundingClientRect().bottom);
        return event.clientY < edge + LABEL_SEAM_PX;
    }
    for (const type of ['mousedown', 'mouseup', 'click', 'dblclick']) {
        window.addEventListener(type, event => {
            // 只處理實際的滑鼠操作；腳本模擬的標籤點擊目標在標籤列上，不受影響。
            if (!event.isTrusted || event.button !== 0 || isDisabledPage() || !isLabelSeamClick(event)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
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
        // 滑鼠在波形上時改以標籤列上同一 x 的位置處理。
        point = toLabelRowPoint(point, rangeBlock);
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
            box-shadow:0 3px 14px #24332118;font:12px/1.45 Arial,"PingFang TC","Microsoft JhengHei",sans-serif; }
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
            margin-bottom:-1px;border:1px solid transparent;font:600 12px/22px Arial,"PingFang TC","Microsoft JhengHei",sans-serif;color:#889180; }
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
        if (event.button !== 0 || isDragModifier(event) || labelDrag || (event.isTrusted && Date.now() < dragClickUntil)
            || isDisabledPage()) return;
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
        drag.label.textContent = drag.originalText;
        drag.label.style.fill = drag.originalFill;
        for (const item of drag.intervals) {
            item.text.nodeValue = item.originalText;
            item.node.setAttribute('x', item.x);
            item.node.setAttribute('px', item.px);
            if (item.bpm) {
                item.bpm.textContent = item.originalBpm;
                item.bpm.setAttribute('x', item.bpmX);
            }
        }
        // 位置沒變且類型也沒變（或取消）時不送出修改。
        if (!commit || (drag.index === drag.first.index && drag.type === drag.originalType)) return;
        try {
            const current = getRangeContext(drag.svg, drag.lastX);
            if (!drag.svg.isConnected || isDisabledPage() || current.scope !== drag.first.scope
                || current.record !== drag.first.record || current.viewStart !== drag.first.viewStart
                || current.rate !== drag.first.rate || current.modifiedData !== drag.first.modifiedData
                || JSON.stringify(current.modifiedData) !== drag.pendingSnapshot) return;
            const pending = current.modifiedData;
            const source = pending.find(item => item[4] && item[1] === drag.first.index);
            const original = source ? source[3] : drag.originalType;
            const destination = pending.find(item => item[4] && item[1] === drag.index);
            const destinationOriginal = destination ? destination[3]
                : current.scope.annoData.find(item => item.index === drag.index)?.type || 'X';
            const edit = (index, type, originalType) => [current.startTime
                + Math.floor((index - current.viewStart) / current.rate), index, type, originalType, 1];
            // 拖曳中只按了數字鍵、位置沒變：只改類型（改回原始類型時移除這筆修改）。
            if (drag.index === drag.first.index) {
                current.parent.$apply(() => {
                    for (let i = pending.length - 1; i >= 0; i--) {
                        if (pending[i][4] && pending[i][1] === drag.index) pending.splice(i, 1);
                    }
                    if (drag.type !== original) pending.push(edit(drag.index, drag.type, original));
                });
                return;
            }
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
    // Ctrl 拖曳的標籤列：按在標籤列上就是該列；按在心電圖波形上（包含事件清單卡片上覆蓋波形的 graphy-cover）
    // 則依位置找到同一區塊的標籤列，x 需落在標籤列範圍內。不在 ECG 區塊上回傳 null。
    function dragMarkerAt(event) {
        const direct = event.target?.closest?.('svg.ecgRMarker');
        if (direct) return direct.closest(TARGET_BLOCK_SELECTOR) ? direct : null;
        for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
            if (element.closest?.('.rc-review-bar, .rc-quick-toast')) return null;
            const block = element.closest?.(TARGET_BLOCK_SELECTOR);
            if (!block) continue;
            const marker = block.querySelector('svg.ecgRMarker');
            const row = marker?.getBoundingClientRect();
            return row && row.width > 0 && event.clientX >= row.left && event.clientX <= row.right ? marker : null;
        }
        return null;
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
        // 在波形上按 Ctrl 也比照標籤列：拖曳最近的標籤，並攔下網站對波形的點擊（例如 Pause 清單切換排除類型）。
        const marker = isDragModifier(event) ? dragMarkerAt(event) : null;
        if (event.button === 0 && isDragModifier(event) && marker && !isDisabledPage()) {
            event.preventDefault(); event.stopImmediatePropagation();
            dragClickUntil = Date.now() + 400;
        }
        if (event.button !== 0 || !isDragModifier(event) || event.shiftKey || event.altKey || (event.metaKey && !IS_MAC)
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
            labelDrag = { label, svg, first, type: beat.type, originalType: beat.type, pointerId: event.pointerId,
                originalText: label.textContent, originalFill: label.style.fill,
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
        // Ctrl 只需在開始時按住；之後放開 Ctrl 仍可繼續拖曳（方便拖曳中按數字鍵），放開滑鼠才結束。
        if (!(event.buttons & 1) || !drag.label.isConnected || isDisabledPage()) {
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
        finishLabelDrag(event.button === 0);
    }, true);
    for (const name of ['mousedown', 'mouseup', 'click', 'dblclick']) {
        document.addEventListener(name, event => {
            const ctrlOnMarker = isDragModifier(event) && event.button === 0 && !isDisabledPage() && dragMarkerAt(event);
            // 拖曳放開後只吞掉滑鼠實際產生的那一次點擊；數字鍵模擬的點擊（isTrusted 為 false）不受影響，
            // 拖完可以立刻按 1／2／3 修改。
            const afterDrag = event.isTrusted && event.button === 0 && Date.now() < dragClickUntil;
            if (ctrlOnMarker || labelDrag || afterDrag) {
                event.preventDefault(); event.stopImmediatePropagation();
                if (afterDrag && name === 'click') dragClickUntil = 0;
            }
        }, true);
    }
    // 拖曳中：1／2／3 把這顆標籤改為 V／S／N（以實體按鍵判斷，按住 Ctrl 也可），放開滑鼠時連同新位置一起送出；Esc 取消。
    const DRAG_TYPE_COLORS = { V: '#e2231a', S: '#1f6fd1', N: '#555' };
    function setLabelDragType(drag, type) {
        drag.type = type;
        drag.label.textContent = type;
        // 顏色沿用同一列中相同類型的標籤，沒有時用預設色；放開後網站會依實際修改重畫。
        const sample = [...drag.svg.querySelectorAll('.annoText')]
            .find(node => node !== drag.label && node.__data__?.type === type);
        drag.label.style.fill = sample ? getComputedStyle(sample).fill : DRAG_TYPE_COLORS[type];
    }
    document.addEventListener('keydown', event => {
        if (!labelDrag) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === 'Escape') { finishLabelDrag(); return; }
        const digit = /^(?:Digit|Numpad)([123])$/.exec(event.code || '')?.[1];
        if (digit && !event.repeat) setLabelDragType(labelDrag, { '1': 'V', '2': 'S', '3': 'N' }[digit]);
    }, true);
    document.addEventListener('pointercancel', () => finishLabelDrag(), true);
    // Mac 的 Ctrl+點擊會開啟右鍵選單並中斷拖曳；在標籤列上攔截。
    document.addEventListener('contextmenu', event => {
        if (isDisabledPage()) return;
        if (labelDrag || (event.ctrlKey && dragMarkerAt(event))) {
            event.preventDefault();
        }
    }, true);
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
        // Mac 的 Option+數字會輸出 ¡ ™ £ 等符號，改以實體按鍵位置判斷數字鍵。
        const labelKey = /^Digit([1-4])$/.exec(e.code || '')?.[1] || key;
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
        // Q / E 與 W / S 一樣不依賴滑鼠位置：畫面上有 ECG 區塊（例如總覽心電圖）即可切換時間。
        if ((key === 'q' || key === 'e') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
            && !e.isComposing && (rangeMode || document.querySelector('.fixed-board') || hasVisibleECGBlock())) {
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
        if (!e.ctrlKey && !e.metaKey && (labelKey === '4' || (isAltPressed && ['1', '2', '3'].includes(labelKey)))) {
            if (e.repeat && heldSweep?.key === labelKey) { e.preventDefault(); e.stopImmediatePropagation(); return; }
            heldSweep = { key: labelKey, code: e.code, tag: { '1': 'V', '2': 'S', '3': 'N', '4': '' }[labelKey], alt: labelKey !== '4',
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
        if (['1', '2', '3', '4'].includes(labelKey) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopImmediatePropagation();

            const labelPoint = toLabelRowPoint(currentMousePos, activeBlock);
            const targetUnderMouse = getElementAtPoint(labelPoint.x, labelPoint.y);
            const isOnLabel = targetUnderMouse && targetUnderMouse.classList.contains('annoText');

            const keyMap = { '1': 'V', '2': 'S', '3': 'N', '4': '' };
            const targetTag = keyMap[labelKey];

            if (isAltPressed && labelKey !== '4') {
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
        return { dialog, eventDialog, type, host, af: scope.af };
    }
    // focusTime：重新分頁後停在包含這張心電圖（或排在它前面最近一張）的頁面。
    function applyHRPages(context, items, focusTime = null) {
        const { eventDialog, type, host } = context;
        const pagination = eventDialog.pagination;
        const perPage = Number(pagination.itemsPerPage) || 6;
        const pages = [];
        for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
        let focusPage = null;
        if (focusTime !== null) {
            const index = items.findIndex(value => toEventTime(value) === focusTime);
            if (index >= 0) focusPage = Math.floor(index / perPage) + 1;
        }
        host.$apply(() => {
            eventDialog.pageData = pages;
            pagination.totalItems = items.length;
            pagination.currentPage = Math.min(Math.max(1, focusPage ?? pagination.currentPage), Math.max(1, pages.length));
            eventDialog.indexAdjust = (pagination.currentPage - 1) * perPage;
            host.pageChanged(type);
        });
        hrExclusion.pages = eventDialog.pageData;
    }
    // 排除紀錄：依按下順序保存錨點心電圖的起始時間。網站把清單換回完整資料時（例如選印後）自動重新套用；
    // 只有關閉清單、切換清單類型或按「還原」才清空。
    const hrExclusion = { type: null, anchors: [], pages: null, focusTime: null };
    function resetHRExclusion() {
        hrExclusion.type = null;
        hrExclusion.anchors = [];
        hrExclusion.pages = null;
        hrExclusion.focusTime = null;
    }
    // Max HR sinus 的 AF 時段排除開關：預設關閉，開啟後保留到重新整理頁面。
    let hrAFExcludeOn = false;
    // 網站的 Max HR sinus 清單直接複製 Max HR 清單，會包含 AF 期間的心電圖。
    // AF 時段取自時間軸的 tmsAFs（已含 AF 修改，每筆代表該秒起 60 秒），
    // 再加上 AF 編輯中尚未儲存的區段，合併成不重疊的區段。10 秒心電圖與任一區段重疊即排除。
    const HR_STRIP_SECONDS = 10;
    const AF_BLOCK_SECONDS = 60;
    function mergeRanges(ranges) {
        const sorted = ranges.filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
            .sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const [start, end] of sorted) {
            const last = merged[merged.length - 1];
            if (last && start <= last[1]) last[1] = Math.max(last[1], end);
            else merged.push([start, end]);
        }
        return merged;
    }
    function getAFRanges(af) {
        const ranges = [];
        const blocks = af?.tmsline?.tagsRecord?.tmsAFs;
        if (Array.isArray(blocks)) {
            for (const value of blocks) {
                const start = Number(value);
                ranges.push([start, start + AF_BLOCK_SECONDS]);
            }
        }
        const edited = af?.afEditing?.data;
        if (Array.isArray(edited)) {
            for (const range of edited) ranges.push([Number(range?.start), Number(range?.end)]);
        }
        return mergeRanges(ranges);
    }
    function excludeAFItems(items, afRanges) {
        if (!afRanges.length) return items;
        return items.filter(value => {
            const start = toEventTime(value);
            if (start === null) return true;
            // 找第一個結束時間晚於心電圖起點的區段，再看它是否早於心電圖終點開始。
            let low = 0, high = afRanges.length;
            while (low < high) {
                const mid = (low + high) >> 1;
                if (afRanges[mid][1] <= start) low = mid + 1; else high = mid;
            }
            return !(low < afRanges.length && afRanges[low][0] < start + HR_STRIP_SECONDS);
        });
    }
    function getHRAFRanges(context) {
        return context.type === 'maxSinus' && hrAFExcludeOn ? getAFRanges(context.af) : [];
    }
    function isHRFilterActive(context) {
        return hrExclusion.anchors.length > 0 || getHRAFRanges(context).length > 0;
    }
    // 依序套用每個錨點：移除排序在錨點之後、起始時間相差 ±1 分鐘內的心電圖。
    function filterHRItems(items, anchors) {
        let kept = items;
        for (const anchor of anchors) {
            const position = kept.findIndex(value => toEventTime(value) === anchor);
            if (position < 0) continue;
            kept = kept.filter((value, index) => index <= position || Math.abs(toEventTime(value) - anchor) > HR_EXCLUDE_SECONDS);
        }
        return kept;
    }
    function getHRSourceItems(context) {
        const source = context.eventDialog[context.type];
        return Array.isArray(source?.data) ? source.data.flat() : null;
    }
    function currentHRFocusTime(eventDialog) {
        const page = eventDialog.pageData[(Number(eventDialog.pagination?.currentPage) || 1) - 1];
        return toEventTime(Array.isArray(page) ? page[0] : page);
    }
    // 先排除 AF 時段，再依序套用 ±1 分錨點。
    function getHRFilteredItems(context, all) {
        const sinus = excludeAFItems(all, getHRAFRanges(context));
        return { sinus, kept: hrExclusion.anchors.length ? filterHRItems(sinus, hrExclusion.anchors) : sinus };
    }
    function reapplyHRExclusion(context, focusTime) {
        const all = getHRSourceItems(context);
        if (!all) return;
        applyHRPages(context, getHRFilteredItems(context, all).kept, focusTime);
    }
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
        .rc-hr-exclude.is-done { background:#eef1f3; border-color:#cfd6db; color:#6b7780; box-shadow:none; }
        .rc-hr-exclude.is-done .rc-hr-icon { color:#3c9a5f; }
        .rc-hr-exclude.is-done:hover { background:#fff; border-color:#9aa5ad; color:#4a555d; box-shadow:0 1px 3px rgba(0,0,0,.15); }
        .rc-hr-exclude.is-done:hover .rc-hr-icon { color:#c0392b; }
        .rc-hr-restore { display:none; align-items:center; gap:6px; height:22px; padding:0 10px 0 4px; border:0;
            border-radius:11px; background:rgba(255,255,255,.95); color:#4f6b1a; font-family:inherit; font-weight:600; font-size:12px; line-height:22px;
            cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.18); transition:background .15s, box-shadow .15s; }
        .rc-hr-restore.is-visible { display:inline-flex; }
        .rc-hr-restore:hover { background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.25); }
        .rc-hr-af { display:none; align-items:center; gap:5px; height:22px; margin-right:6px; padding:0 4px 0 9px; border:1px solid #cfd6db;
            border-radius:11px; background:rgba(255,255,255,.95); color:#6b7780; font-family:inherit; font-weight:600; font-size:12px;
            line-height:20px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,.18); transition:background .15s, box-shadow .15s; }
        .rc-hr-af:not(.is-on) { padding-right:10px; }
        .rc-hr-af.is-visible { display:inline-flex; }
        .rc-hr-af.is-on { border-color:#f0b4ae; color:#c0392b; }
        .rc-hr-af:hover { background:#fff; box-shadow:0 2px 6px rgba(0,0,0,.25); }
        .rc-hr-af .rc-hr-count, .rc-hr-restore .rc-hr-count { min-width:18px; height:16px; padding:0 5px; border-radius:8px; background:#c0392b;
            color:#fff; font-size:11px; line-height:16px; text-align:center; }
    `;
    document.head.appendChild(hrStyle);
    function getHRCardTime(card) {
        try { return toEventTime(window.angular.element(card).scope()?.currentData?.startTime); } catch (_) { return null; }
    }
    // 未排除時套用排除；已排除（反灰）時再按一次取消這張的排除，其他排除保持不變。
    function toggleHRExclusion(card) {
        const context = getHRListContext(card);
        const time = getHRCardTime(card);
        if (!context || time === null) return;
        if (hrExclusion.type !== context.type) resetHRExclusion();
        hrExclusion.type = context.type;
        const index = hrExclusion.anchors.indexOf(time);
        if (index >= 0) hrExclusion.anchors.splice(index, 1);
        else hrExclusion.anchors.push(time);
        reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        decorateHRList();
    }
    function restoreHRItems(dialog) {
        const context = getHRListContext(dialog);
        if (!context) return;
        const focusTime = currentHRFocusTime(context.eventDialog);
        hrExclusion.anchors = [];
        reapplyHRExclusion(context, focusTime);
        decorateHRList();
    }
    function toggleHRAFExclusion(dialog) {
        const context = getHRListContext(dialog);
        if (!context) return;
        hrExclusion.type = context.type;
        hrAFExcludeOn = !hrAFExcludeOn;
        reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        decorateHRList();
    }
    function setExcludeButtonState(button, done) {
        if (button.classList.contains('is-done') === done && button.childElementCount) return;
        button.classList.toggle('is-done', done);
        button.innerHTML = done
            ? '<span class="rc-hr-icon">✓</span>已排除 ±1 分'
            : '<span class="rc-hr-icon">⊘</span>排除 ±1 分';
        button.title = done ? '已移除排序在後、±1 分鐘內的心電圖；再按一次取消這張的排除'
            : '移除排序在後、與此心電圖相差 ±1 分鐘內的心電圖';
        button.setAttribute('aria-pressed', String(done));
    }
    function isHRDialogShown(dialog) {
        return !!dialog?.isConnected && dialog.getClientRects().length > 0;
    }
    // 清單關閉通常只改 class / style，沒有節點增減；監看清單與其祖先的屬性，關閉時清空排除紀錄。
    let watchedHRDialog = null;
    const hrDialogObserver = new MutationObserver(scheduleHRList);
    function watchHRDialog(dialog) {
        if (watchedHRDialog === dialog) return;
        hrDialogObserver.disconnect();
        watchedHRDialog = dialog;
        for (let node = dialog; node && node !== document.body; node = node.parentElement) {
            hrDialogObserver.observe(node, { attributes: true, attributeFilter: ['class', 'style'] });
        }
    }
    // 網站若持續把清單換回去，短時間內重套太多次就放棄，避免無限循環。
    const hrReapplyTimes = [];
    function decorateHRList() {
        if (isDisabledPage()) return;
        const dialog = document.querySelector('#af-hr-dialog');
        if (dialog) watchHRDialog(dialog);
        if (!isHRDialogShown(dialog)) { resetHRExclusion(); return; }
        const context = getHRListContext(dialog);
        if (!context) return;
        const { eventDialog } = context;
        if (hrExclusion.type !== context.type) resetHRExclusion();
        hrExclusion.type = context.type;
        const filtering = isHRFilterActive(context);
        if (filtering || hrExclusion.pages) {
            if (eventDialog.pageData !== hrExclusion.pages) {
                const now = Date.now();
                while (hrReapplyTimes.length && now - hrReapplyTimes[0] > 2000) hrReapplyTimes.shift();
                if (hrReapplyTimes.length >= 8) { resetHRExclusion(); hrAFExcludeOn = false; return; }
                hrReapplyTimes.push(now);
                // 網站換回完整清單（例如選印後）：重新套用排除，並停在原本看的心電圖所在頁。
                // 沒有任何排除時不再接手，交還網站自己的分頁。
                if (filtering) {
                    reapplyHRExclusion(context, hrExclusion.focusTime ?? currentHRFocusTime(eventDialog));
                    return; // 重新分頁會觸發下一次更新。
                }
                hrExclusion.pages = null;
            }
            hrExclusion.focusTime = currentHRFocusTime(eventDialog);
        }
        const anchors = new Set(hrExclusion.anchors);
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
                    toggleHRExclusion(card);
                });
                header.appendChild(button);
            }
            // ng-repeat 以 $index 追蹤，換頁時卡片節點會沿用，因此每次依目前資料更新狀態。
            setExcludeButtonState(button, anchors.has(getHRCardTime(card)));
        }
        // 標題列：AF 時段排除開關（僅 Max HR sinus）、±1 分排除數量與還原按鈕。
        const all = getHRSourceItems(context) || [];
        const { sinus, kept } = getHRFilteredItems(context, all);
        const excluded = hrExclusion.anchors.length ? Math.max(0, sinus.length - kept.length) : 0;
        const toolbar = dialog.querySelector('.data-tool-blk .float-left');
        let afToggle = dialog.querySelector('.rc-hr-af');
        if (!afToggle && toolbar) {
            afToggle = document.createElement('button');
            afToggle.type = 'button';
            afToggle.className = 'rc-hr-af';
            afToggle.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                toggleHRAFExclusion(dialog);
            });
            toolbar.appendChild(afToggle);
        }
        if (afToggle) {
            const hasAF = context.type === 'maxSinus' && getAFRanges(context.af).length > 0;
            const on = hasAF && hrAFExcludeOn;
            const html = on
                ? `<span class="rc-hr-icon">⊘</span>已排除 AF 時段<span class="rc-hr-count">${all.length - sinus.length}</span>`
                : '<span class="rc-hr-icon">○</span>排除 AF 時段';
            if (afToggle.innerHTML !== html) afToggle.innerHTML = html;
            afToggle.title = on ? '已排除與 AF 時段重疊的心電圖；按下關閉' : '按下排除與 AF 時段重疊的心電圖';
            afToggle.setAttribute('aria-pressed', String(on));
            afToggle.classList.toggle('is-on', on);
            afToggle.classList.toggle('is-visible', hasAF);
        }
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
    function scheduleHRList() {
        if (hrListPending) return;
        hrListPending = true;
        requestAnimationFrame(() => { hrListPending = false; decorateHRList(); });
    }
    new MutationObserver(scheduleHRList).observe(document.body, { childList: true, subtree: true });

    // AF 事件清單編輯模式：mid segment 下拉選單旁加入 ◀ ▶，依選單順序切換上一個／下一個時段。
    // 透過 change 事件交給網站原本的 adjustAFTime 處理（網站會延遲 500 毫秒再載入心電圖）。
    const AF_SEGMENT_SELECT = 'select[ng-model="af.adjustAF[$index]"]';
    const afStepStyle = document.createElement('style');
    afStepStyle.textContent = `
        .rc-af-step { display:inline-flex; align-items:center; gap:2px; margin:0 0 5px -6px; vertical-align:middle; white-space:nowrap; }
        .rc-af-step button { width:22px; height:25px; padding:0; border:1px solid #767676; border-radius:3px; background:#fff;
            color:#5b7d1a; font-family:inherit; font-size:10px; line-height:23px; cursor:pointer; }
        .rc-af-step button:hover:not(:disabled) { background:#8fb43a; border-color:#8fb43a; color:#fff; }
        .rc-af-step button:disabled { color:#c4c4c4; border-color:#d6d6d6; cursor:default; }
        .rc-af-step .rc-af-pos { color:#848484; font-size:11px; text-align:center; }
    `;
    document.head.appendChild(afStepStyle);
    function stepAFSegment(select, delta) {
        const index = select.selectedIndex + delta;
        if (!select.isConnected || index < 0 || index >= select.options.length) return;
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function createAFStep() {
        const nav = document.createElement('span');
        nav.className = 'rc-af-step';
        nav.innerHTML = '<button type="button" data-step="-1" title="上一個時段">◀</button>'
            + '<span class="rc-af-pos"></span><button type="button" data-step="1" title="下一個時段">▶</button>';
        nav.addEventListener('click', event => {
            const button = event.target.closest('button[data-step]');
            if (!button) return;
            event.preventDefault(); event.stopPropagation();
            // ng-if 重建選單時按鈕列會留在原位，因此每次點擊都找緊鄰在前的選單。
            const select = nav.previousElementSibling;
            if (select?.matches(AF_SEGMENT_SELECT)) stepAFSegment(select, Number(button.dataset.step));
        });
        return nav;
    }
    function decorateAFSegmentSelects() {
        // 選單被移除後留下的按鈕列一併清除。
        for (const nav of document.querySelectorAll('.rc-af-step')) {
            if (!nav.previousElementSibling?.matches(AF_SEGMENT_SELECT)) nav.remove();
        }
        if (isDisabledPage()) return;
        for (const select of document.querySelectorAll(AF_SEGMENT_SELECT)) {
            let nav = select.nextElementSibling;
            if (!nav?.classList.contains('rc-af-step')) {
                nav = createAFStep();
                select.after(nav);
            }
            const index = select.selectedIndex;
            const total = select.options.length;
            const [prev, next] = nav.querySelectorAll('button');
            prev.disabled = index <= 0;
            next.disabled = index < 0 || index >= total - 1;
            const label = total ? `${index + 1}/${total}` : '';
            const pos = nav.querySelector('.rc-af-pos');
            if (pos.textContent !== label) pos.textContent = label;
        }
    }
    let afStepPending = false;
    function scheduleAFStep() {
        if (afStepPending) return;
        afStepPending = true;
        requestAnimationFrame(() => { afStepPending = false; decorateAFSegmentSelects(); });
    }
    new MutationObserver(scheduleAFStep).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('change', event => {
        if (event.target?.matches?.(AF_SEGMENT_SELECT)) scheduleAFStep();
    }, true);

    // 時間輸入框：聚焦且內容是完整時間時，W／↑ 加 2 秒、S／↓ 減 2 秒（可按住連續調整）。
    // 依網站的日期格式解析（另接受輸入框提示的「日期, 時間」寫法），以原本的寫法寫回，
    // 再送出 input 事件交給網站原本的 ng-change 處理。
    const TIME_STEP_SECONDS = 2;
    const DEFAULT_TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
    function getTimeFormats(input) {
        let site = DEFAULT_TIME_FORMAT;
        try {
            const format = window.angular?.element(input).scope()?.getAdjustFormat?.(DEFAULT_TIME_FORMAT);
            if (typeof format === 'string' && format) site = format;
        } catch (_) { /* 沒有網站格式時改用預設 */ }
        const formats = [site, site.replace(' ', ', ')];
        // 提示文字本身是時間格式（例如 DD/MM/YYYY, HH:mm:ss）時一併接受。
        if (/^[DMY/.\-, ]+HH:mm:ss$/.test(input.placeholder || '')) formats.push(input.placeholder);
        return [...new Set(formats)];
    }
    function stepTimeText(value, formats, seconds) {
        const moment = window.moment;
        if (typeof moment?.utc !== 'function') return null;
        for (const format of formats) {
            const time = moment.utc(String(value).trim(), format, true);
            if (time.isValid()) return time.add(seconds, 'seconds').format(format);
        }
        return null;
    }
    window.addEventListener('keydown', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'text' || !input.hasAttribute('ng-model')) return;
        if (isDisabledPage() || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
        const key = event.key;
        const direction = key === 'ArrowUp' || key === 'w' || key === 'W' ? 1
            : key === 'ArrowDown' || key === 's' || key === 'S' ? -1 : 0;
        if (!direction) return;
        const next = stepTimeText(input.value, getTimeFormats(input), direction * TIME_STEP_SECONDS);
        if (next === null) return; // 不是完整時間（例如正在輸入）時保留原本按鍵行為。
        event.preventDefault();
        event.stopImmediatePropagation();
        const { selectionStart, selectionEnd } = input;
        input.value = next;
        if (selectionStart !== null) input.setSelectionRange(selectionStart, selectionEnd);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, true);

    // 聚焦時間輸入框時，在框下方顯示快捷鍵提示 3 秒；失焦或捲動時收起。
    // 時間輸入框：內容是完整時間，或提示文字是時間格式（例如空白的 HR 清單時間框）。
    const TIME_HINT_MS = 3000;
    const TIME_FORMAT_PLACEHOLDER = /^[DMY/.\-, ]+HH:mm:ss$/;
    const timeHintStyle = document.createElement('style');
    timeHintStyle.textContent = `
        .rc-time-hint { position:fixed; z-index:100000; padding:3px 8px; border:1px solid #dcdcdc; border-radius:4px; background:#fff;
            color:#888; font-size:11px; line-height:16px; white-space:nowrap; pointer-events:none; box-shadow:0 1px 3px rgba(0,0,0,.08);
            opacity:0; transition:opacity .15s; }
        .rc-time-hint.is-visible { opacity:1; }
        .rc-time-hint kbd { display:inline-block; min-width:12px; margin:0 1px; padding:0 3px; border:1px solid #d6d6d6; border-radius:3px;
            background:#f6f6f6; color:#666; font-family:inherit; font-size:10px; line-height:13px; text-align:center; }
    `;
    document.head.appendChild(timeHintStyle);
    const timeHint = document.createElement('div');
    timeHint.className = 'rc-time-hint';
    timeHint.innerHTML = `<kbd>W</kbd><kbd>↑</kbd> 加 ${TIME_STEP_SECONDS} 秒　<kbd>S</kbd><kbd>↓</kbd> 減 ${TIME_STEP_SECONDS} 秒`;
    let timeHintTimer = null;
    function isTimeInput(input) {
        if (!(input instanceof HTMLInputElement) || input.type !== 'text' || !input.hasAttribute('ng-model')) return false;
        return TIME_FORMAT_PLACEHOLDER.test(input.placeholder || '')
            || stepTimeText(input.value, getTimeFormats(input), 0) !== null;
    }
    function hideTimeHint() {
        clearTimeout(timeHintTimer);
        timeHintTimer = null;
        timeHint.classList.remove('is-visible');
    }
    function showTimeHint(input) {
        if (!timeHint.isConnected) document.body.appendChild(timeHint);
        const rect = input.getBoundingClientRect();
        const height = timeHint.offsetHeight || 24;
        // 預設在框下方，下方空間不足時改到上方。
        const top = rect.bottom + 6 + height > window.innerHeight ? rect.top - 6 - height : rect.bottom + 6;
        const left = Math.min(Math.max(4, rect.left), window.innerWidth - timeHint.offsetWidth - 4);
        timeHint.style.top = `${Math.round(top)}px`;
        timeHint.style.left = `${Math.round(left)}px`;
        timeHint.classList.add('is-visible');
        clearTimeout(timeHintTimer);
        timeHintTimer = setTimeout(hideTimeHint, TIME_HINT_MS);
    }
    document.addEventListener('focusin', event => {
        if (!isDisabledPage() && isTimeInput(event.target)) showTimeHint(event.target);
    }, true);
    document.addEventListener('focusout', event => {
        if (event.target instanceof HTMLInputElement) hideTimeHint();
    }, true);
    window.addEventListener('scroll', () => { if (timeHintTimer) hideTimeHint(); }, { capture: true, passive: true });

    // HR 清單時間框：貼上或修改時間後，網站會把清單第一筆換成該時間；
    // 等這張心電圖與標籤載入完成，再以「ECG 變動率自動標註器」相同算法
    // （心搏 BPM 平均，排除灰色背景區段）四捨五入填入旁邊的 HR 欄。
    const HR_TIME_INPUT = 'input[ng-model="af.hrUpdate.tms"]';
    const HR_VALUE_INPUT = 'input[ng-model="af.hrUpdate.hr"]';
    const HR_TMS_KEYS = { minHR: 'minTms', maxHR: 'maxTms', maxSinus: 'maxSinusTms' };
    const HR_FILL_TIMEOUT_MS = 8000;
    const HR_FILL_POLL_MS = 200;
    let hrFillJob = 0;
    function getHRListTarget(input) {
        try {
            const scope = window.angular.element(input).scope();
            const key = HR_TMS_KEYS[scope?.af?.eventDialog?.dscp?.type];
            const value = Number(scope?.af?.tmsline?.ogTagsRecord?.[key]?.[0]);
            return Number.isFinite(value) ? value : null;
        } catch (_) { return null; }
    }
    // 卡片內可讀的心搏 BPM（排除間隔過長的文字），以及灰色背景的水平範圍。
    function readCardBeats(card) {
        const block = card.querySelector('svg.ecgRMarker')?.parentElement;
        if (!block) return null;
        const gray = [...block.querySelectorAll('.ecgMask rect.mask')]
            .filter(mask => Number(mask.getAttribute('opacity') ?? getComputedStyle(mask).opacity) > 0)
            .map(mask => mask.getBoundingClientRect())
            .filter(rect => rect.width > 0)
            .map(rect => [rect.left, rect.right]);
        const beats = [];
        for (const text of card.querySelectorAll('.annoGroup text.annoDuration')) {
            const interval = Number((text.childNodes[0]?.textContent || '').match(/\d+/)?.[0]);
            const hr = Number(text.querySelector('tspan')?.textContent.match(/\d+/)?.[0]);
            if (!Number.isFinite(interval) || interval >= 10000 || !Number.isFinite(hr)) continue;
            const rect = text.getBoundingClientRect();
            beats.push({ hr, center: rect.left + rect.width / 2 });
        }
        return { gray, beats };
    }
    function averageWhiteBPM({ gray, beats }) {
        const rates = beats.filter(({ center }) => !gray.some(([left, right]) => center >= left && center < right))
            .map(({ hr }) => hr);
        return rates.length ? rates.reduce((sum, hr) => sum + hr, 0) / rates.length : null;
    }
    function findHRCard(dialog, time) {
        return [...dialog.querySelectorAll(HR_CARD_SELECTOR)].find(card => getHRCardTime(card) === time) || null;
    }
    // 標籤內容連續兩次相同才計算，避免讀到換頁前沿用節點的舊標籤。
    function fillHRFromCard(input, target) {
        const job = ++hrFillJob;
        const started = Date.now();
        let lastSignature = null;
        const poll = () => {
            if (job !== hrFillJob || !input.isConnected) return;
            if (Date.now() - started > HR_FILL_TIMEOUT_MS) return;
            const dialog = input.closest('#af-hr-dialog');
            const card = dialog && findHRCard(dialog, target);
            const data = card && readCardBeats(card);
            const loaded = data?.beats.length
                && window.angular.element(card).scope()?.currentData?.ecgData?.length;
            const signature = loaded ? data.beats.map(beat => `${beat.hr}@${Math.round(beat.center)}`).join(',') : null;
            if (!signature || signature !== lastSignature) {
                lastSignature = signature;
                setTimeout(poll, HR_FILL_POLL_MS);
                return;
            }
            const average = averageWhiteBPM(data);
            const hrInput = dialog.querySelector(HR_VALUE_INPUT);
            if (average === null || !hrInput) return;
            hrInput.value = String(Math.round(average));
            hrInput.dispatchEvent(new Event('input', { bubbles: true }));
        };
        setTimeout(poll, HR_FILL_POLL_MS);
    }
    // 捕獲階段先記下修改前的時間，網站處理完後清單第一筆有變才計算（時間無效或超出範圍時網站不會更新）。
    document.addEventListener('input', event => {
        const input = event.target;
        if (isDisabledPage() || !input?.matches?.(HR_TIME_INPUT)) return;
        const before = getHRListTarget(input);
        setTimeout(() => {
            const target = getHRListTarget(input);
            if (target !== null && target !== before) fillHRFromCard(input, target);
        }, 0);
    }, true);

    // 事件清單頁碼拉條：在選印的綠色／橘色（強制選印）垂直線下方加入頁碼按鈕，點擊即跳到該頁，右側顯示選印數量。
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
        .rc-print-link.is-forced { stroke:#d88f3f; }
        .rc-print-link.is-forced.is-current, .rc-print-link.is-forced.is-hot { stroke:#b5701f; }
        .rc-print-jump.is-forced, .rc-print-jump.has-forced { border-color:#d88f3f; }
        .rc-print-jump.is-forced.has-count { background:#d88f3f; }
        .rc-print-jump.is-forced:hover, .rc-print-jump.is-forced.is-current { background:#b5701f; border-color:#b5701f; }
        .rc-print-jump.is-forced.is-current { box-shadow:0 0 0 2px rgba(216,143,63,.35); }
        .rc-print-summary { border:0; background:#5b7d1a; color:#fff; cursor:default; }
    `;
    document.head.appendChild(printBarStyle);
    // 分頁資料可能是時間、[時間, …] 或含 startTime 的物件。
    function toEventTime(value) {
        if (Array.isArray(value)) value = value[0];
        if (value && typeof value === 'object') value = value.startTime ?? value.tms ?? value.time;
        const time = Number(value);
        return Number.isFinite(time) ? time : null;
    }
    // 橘色強制選印：網站的拉條只在開啟清單時把 preselectedEvents 算一次，之後排除或取消排除不會更新；
    // 心電圖上的橘色選印圖示（checkPrintEvent）則即時讀取 printDialog.selectedEvents 的這些欄位。
    const FORCED_PRINT_KEYS = {
        vtTmsArr: ['longestVTTms', 'fastestAvgVTTms'],
        svtTmsArr: ['longestSVTTms', 'fastestAvgSVTTms'],
        pauseTmsArr: ['longestAsleepPause', 'longestAwakePause'],
        afTmsArr: ['longestAfTms', 'avgFastestAfTms', 'af10SecFastestTms'],
        // Isolated 清單：網站把 Couplet 等子分類的選印也畫成橘色，但那不是強制選印，不計入。
        pvcTmsArr: [],
        svebTmsArr: [],
    };
    // 依目前清單類型即時取得強制選印；不支援的清單回傳 null，改用拉條的 preselectedEvents。
    function getLiveForcedEvents(af) {
        const keys = FORCED_PRINT_KEYS[af?.eventDialog?.dscp?.printedEventType];
        const selected = af?.printDialog?.selectedEvents;
        if (!keys || !selected) return null;
        return keys.flatMap(key => Array.isArray(selected[key]) ? selected[key] : []);
    }
    // 選印分兩種：綠色（events 與 section）與橘色強制選印（forcedEvents，預設為拉條的 preselectedEvents）。
    // 同一張兩邊都有時算一張，以橘色為準。
    function getPrintPages(scope, forcedEvents = scope?.preselectedEvents) {
        const pages = Array.isArray(scope?.pageData) ? scope.pageData : [];
        const list = value => Array.isArray(value) ? value : [];
        const forced = new Set(list(forcedEvents).map(toEventTime).filter(time => time !== null));
        const selected = new Set([...list(scope?.events), ...list(scope?.section)]
            .map(toEventTime).filter(time => time !== null));
        const events = [...new Set([...selected, ...forced])];
        if (!pages.length || !events.length) return { groups: [], total: events.length, forced: forced.size };
        const pageByTime = new Map();
        pages.forEach((page, index) => {
            for (const value of Array.isArray(page) ? page : [page]) {
                const time = toEventTime(value);
                if (time !== null && !pageByTime.has(time)) pageByTime.set(time, index + 1);
            }
        });
        const groups = new Map();
        for (const time of events) {
            const page = pageByTime.get(time);
            if (!page) continue;
            if (!groups.has(page)) groups.set(page, { page, times: [], forced: 0 });
            const group = groups.get(page);
            group.times.push(time);
            if (forced.has(time)) group.forced++;
        }
        return { groups: [...groups.values()].sort((a, b) => a.page - b.page),
            total: events.length, forced: forced.size, pageCount: pages.length };
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
    // 與網站拉條（paginationEventBar）相同的頁面標記中心：超過 3 頁時兩端各留 10px（trackWidth 20 的一半），
    // 標記寬度取頁距與可用寬度 1/10 的較小者；只有 1 頁時標記從左端開始。
    function estimatePrintMark(page, pageCount, barWidth) {
        const track = pageCount <= 3 ? 0 : 20;
        const usable = barWidth - track;
        if (pageCount <= 1) return usable / 20;
        const step = usable / (pageCount - 1);
        return track / 2 + (page - 1) * step;
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
        if (review && !review.anchor.isConnected) closePrintReview();
        recheckReviewCards();
        for (const bar of document.querySelectorAll('.pagination-range svg.paginationEventBar')) {
            const range = bar.closest('.pagination-range');
            let scope;
            try { scope = window.angular.element(bar).isolateScope(); } catch (_) { continue; }
            if (!scope) continue;
            watchPrintRange(range);
            let liveForced = null;
            try {
                let parent = window.angular.element(bar).scope();
                while (parent && !parent.af) parent = parent.$parent;
                liveForced = getLiveForcedEvents(parent?.af);
            } catch (_) {}
            const { groups, total, forced, pageCount } = liveForced ? getPrintPages(scope, liveForced) : getPrintPages(scope);
            const current = Number(scope.pageIndex);
            const barWidth = bar.getBoundingClientRect().width;
            // 拉條暫時隱藏或尚未排版時不計算，避免圓點列以錯誤的位置畫出；顯示後由 ResizeObserver 觸發重畫。
            if (!range.offsetWidth || !barWidth) continue;
            // V / S 事件清單另外顯示「快速選印」，沒有選印時也保留按鈕列。
            const quick = getQuickContext(bar);
            const signature = JSON.stringify([groups, total, current, Math.round(barWidth), quick?.type || '']);
            const existing = range.nextElementSibling?.classList.contains('rc-print-panel') ? range.nextElementSibling : null;
            // 換頁或選印時版面可能短暫變動，圓點列沒對齊拉條就整列重畫。
            const aligned = !existing || Math.abs(existing.getBoundingClientRect().left - range.getBoundingClientRect().left) < 1;
            if (range.dataset.rcPrintSignature === signature && !!existing === (total > 0 || !!quick) && aligned) {
                updatePrintActions(existing, quick, total, forced);
                continue;
            }
            range.dataset.rcPrintSignature = signature;

            // 拉條容器為 overflow:hidden，圓點與數量放在緊接其後、同寬置中的獨立列。
            let panel = range.nextElementSibling?.classList.contains('rc-print-panel') ? range.nextElementSibling : null;
            if (!total && !quick) { panel?.remove(); continue; }
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'rc-print-panel';
                panel.innerHTML = '<svg class="rc-print-links" aria-hidden="true"></svg>'
                    + '<div class="rc-print-actions"><button type="button" class="rc-print-summary"></button>'
                    + '<button type="button" class="rc-quick-print"></button></div><div class="rc-print-jumps"></div>';
                range.after(panel);
            }
            const rangeStyle = getComputedStyle(range);
            panel.style.width = `${range.offsetWidth}px`;
            panel.style.marginLeft = rangeStyle.marginLeft;
            panel.style.marginRight = rangeStyle.marginRight;
            // 依實際位置校正，拉條以 auto 邊距或父層置中時也能對齊。
            const offset = range.getBoundingClientRect().left - panel.getBoundingClientRect().left;
            if (Math.abs(offset) >= 0.5) panel.style.marginLeft = `${(parseFloat(panel.style.marginLeft) || 0) + offset}px`;
            // 這一列高度為 0，畫在拉條下邊距的空白裡，不推動下方心電圖；負邊距貼齊拉條，再補回同樣的間距。
            const rangeGap = parseFloat(rangeStyle.marginBottom) || 0;
            panel.style.marginTop = `${-rangeGap}px`;
            panel.style.marginBottom = `${rangeGap}px`;
            panel.style.setProperty('--rc-range-height', `${range.offsetHeight}px`);
            updatePrintActions(panel, quick, total, forced);

            // 標記位置：優先對齊網站畫出的標記中心，找不到相近的標記時依拉條的頁序公式換算。
            // 即時讀取強制選印時，網站的橘色標記可能已過期，只對齊綠色標記。
            const scale = barWidth / (Number(bar.getAttribute('width')) || barWidth);
            const markXs = [...bar.querySelectorAll(liveForced ? 'rect.mark-up' : 'rect.mark-up, rect.pre-mark-up')]
                .map(rect => (Number(rect.getAttribute('x')) + (Number(rect.getAttribute('width')) || 0) / 2) * scale)
                .filter(Number.isFinite);
            const items = groups.map(({ page, times, forced }) => {
                const estimate = estimatePrintMark(page, pageCount, barWidth);
                const nearest = markXs.reduce((best, value) =>
                    Math.abs(value - estimate) < Math.abs(best - estimate) ? value : best, Infinity);
                return { page, times, forced, target: Math.abs(nearest - estimate) <= 8 ? nearest : estimate };
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
            for (const { page, times, forced, target, x } of items) {
                // 全部強制選印為橘色；同頁混有綠色時為綠底橘框。
                const tone = !forced ? '' : forced === times.length ? ' is-forced' : ' has-forced';
                const link = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                link.setAttribute('d', `M${target} 0 C${target} ${linkHeight * 0.55} ${x} ${linkHeight * 0.45} ${x} ${linkHeight}`);
                link.setAttribute('class', 'rc-print-link' + (forced ? ' is-forced' : '') + (page === current ? ' is-current' : ''));
                links.appendChild(link);

                const button = document.createElement('button');
                button.type = 'button';
                // 小圓點：同頁多張時顯示張數，頁碼放在滑鼠提示中。
                button.className = 'rc-print-jump' + (times.length > 1 ? ' has-count' : '') + tone
                    + (page === current ? ' is-current' : '');
                button.textContent = times.length > 1 ? String(times.length) : '';
                button.title = `第 ${page} 頁・選印 ${times.length} 張` + (forced ? `（強制 ${forced}）` : '');
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
    function schedulePrintBars() {
        if (printBarPending) return;
        printBarPending = true;
        requestAnimationFrame(() => { printBarPending = false; decoratePrintBars(); });
    }
    // 拉條或其父層尺寸改變（例如由隱藏變為顯示）時不一定有節點增減，另以 ResizeObserver 觸發重畫。
    const printRangeResize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedulePrintBars) : null;
    const watchedPrintRanges = new WeakSet();
    function watchPrintRange(range) {
        if (!printRangeResize || watchedPrintRanges.has(range)) return;
        watchedPrintRanges.add(range);
        printRangeResize.observe(range);
        if (range.parentElement) printRangeResize.observe(range.parentElement);
    }
    new MutationObserver(schedulePrintBars).observe(document.body, { childList: true, subtree: true });
    // 排除或取消排除只改心電圖選印圖示的 class，沒有節點增減；圖示變色時也重畫圓點。
    new MutationObserver(records => {
        if (records.some(record => record.target.classList?.contains('tag-label'))) schedulePrintBars();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    window.addEventListener('resize', schedulePrintBars);

    // ── 快速選印 ──────────────────────────────────────────
    // V / S 事件清單：「快速選印」依規則補足選印張數（使用者選印與橘色強制選印都計入）；
    // 「選印 N 張」開啟選印清單，逐張檢視前後 30 秒心電圖，可取消選印或換一張。
    // 規則：把紀錄時間均分成目標張數的時段，每段選排序最前的一張；各張相隔至少 1 分鐘。
    const QUICK_FEW = count => count > 300 ? 4 : 3;
    const QUICK_PRINT_TYPES = {
        V_isolated: { kind: 'isolated', beat: 'V', name: 'VEB Isolated', target: () => 8 },
        couplets: { kind: 'average', beat: 'V', beats: 2, name: 'VEB Couplet', target: QUICK_FEW },
        triplets: { kind: 'average', beat: 'V', beats: 3, name: 'VEB Triplet', target: QUICK_FEW },
        bigemini: { kind: 'pattern', beat: 'V', name: 'VEB Bigeminy', every: 2, target: QUICK_FEW, spread: false },
        trigemini: { kind: 'pattern', beat: 'V', name: 'VEB Trigeminy', every: 3, target: QUICK_FEW, spread: false },
        vt: { kind: 'run', beat: 'V', name: 'VT', target: () => 6 },
        S_isolated: { kind: 'isolated', beat: 'S', name: 'SVEB Isolated', target: () => 8 },
        sveb2s: { kind: 'average', beat: 'S', beats: 2, name: 'SVEB Couplet', target: QUICK_FEW },
        sveb3s: { kind: 'average', beat: 'S', beats: 3, name: 'SVEB Triplet', target: QUICK_FEW },
        S_bigemini: { kind: 'pattern', beat: 'S', name: 'SVEB Bigeminy', every: 2, target: QUICK_FEW, spread: false },
        S_trigemini: { kind: 'pattern', beat: 'S', name: 'SVEB Trigeminy', every: 3, target: QUICK_FEW, spread: false },
        sve: { kind: 'run', beat: 'S', name: 'SVE run', target: QUICK_FEW },
        psvt: { kind: 'run', beat: 'S', name: 'SVT', target: () => 6 },
    };
    const QUICK_MIN_GAP = 60; // 選印心電圖之間至少相隔（秒）
    const QUICK_RUN_GAP = 1.2; // 連發相鄰早搏的最大間隔（秒）
    const QUICK_EVENT_AFTER = 6; // 事件心電圖涵蓋事件時間後 6 秒（顯示起點前 4 秒）
    const QUICK_FETCH_CONCURRENCY = 6;

    function lowerBound(values, value) {
        let low = 0, high = values.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (values[middle] < value) low = middle + 1; else high = middle;
        }
        return low;
    }
    // 每分鐘平均心率：points 為 [{ time, data }]（網站心率趨勢圖的 avgHR），回傳以時間查詢的函式。
    function makeMinuteHR(points) {
        const sorted = points.map(point => ({ time: Number(point?.time), hr: Number(point?.data) }))
            .filter(point => Number.isFinite(point.time) && point.hr > 0).sort((a, b) => a.time - b.time);
        const times = sorted.map(point => point.time);
        return time => {
            const index = lowerBound(times, time + 1) - 1;
            return index >= 0 && time - times[index] < 60 ? sorted[index].hr : 0;
        };
    }
    // 事件的第一顆早搏：事件時間（到秒）起、事件心電圖範圍內的第一顆；找不到回傳 -1。
    function findEventBeat(list, time) {
        const index = lowerBound(list.times, time);
        return index < list.times.length && list.times[index] - time <= QUICK_EVENT_AFTER ? index : -1;
    }
    // 連發：自錨點起相鄰間隔不超過 QUICK_RUN_GAP 的早搏位置；maxBeats 限制 Couplet／Triplet 的心搏數。
    function runFrom(list, anchor, sampleRate, maxBeats = Infinity) {
        const gap = QUICK_RUN_GAP * sampleRate;
        let last = anchor;
        while (last + 1 < list.positions.length && last - anchor + 1 < maxBeats
            && list.positions[last + 1] - list.positions[last] <= gap) last++;
        return list.positions.slice(anchor, last + 1);
    }
    // 二聯律／三聯律：早搏間隔與第一個間隔相差 30% 內（且不超過 4 秒）視為同一段，回傳早搏數。
    function patternFrom(list, anchor, sampleRate) {
        const positions = list.positions;
        if (anchor + 1 >= positions.length) return 1;
        const first = positions[anchor + 1] - positions[anchor];
        if (!(first > 0) || first > 4 * sampleRate) return 1;
        let count = 1;
        for (let i = anchor; i + 1 < positions.length; i++) {
            const gap = positions[i + 1] - positions[i];
            if (gap < first * 0.7 || gap > first * 1.3) break;
            count++;
        }
        return count;
    }
    function averageBPM(intervals, sampleRate) {
        const rates = intervals.filter(rr => rr > 0).map(rr => 60 * sampleRate / rr);
        return rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
    }
    // 排序：score 逐項由大到小，相同時較早的在前。
    function compareQuickScore(a, b) {
        for (let i = 0; i < Math.max(a.score.length, b.score.length); i++) {
            const diff = (b.score[i] || 0) - (a.score[i] || 0);
            if (diff) return diff;
        }
        return a.time - b.time;
    }
    // 分段的位置：place 為清單事件依時間排序的名次比例（0～1），各段事件數相同，與頁碼拉條的位置一致；
    // 沒有 place 時依紀錄時間 [start, end] 換算。
    function makeRankPlace(times) {
        const sorted = [...new Set(times)].sort((a, b) => a - b);
        return { count: sorted.length, position: time => sorted.length ? lowerBound(sorted, time) / sorted.length : 0 };
    }
    // 均分選印：依位置切成 target 段，已選印的佔掉所在段，依排序在空的段各選一張；
    // 且與其他選印至少相隔半段，避免兩張落在相鄰兩段的交界而擠在一起。
    // 張數不足時段數再對半細分（2 倍、4 倍…）重複同樣的選法，細分到每段不到一個事件（或比 minGap 短）仍不足時，
    // 才從全部依排序補足。所有選印相隔至少 minGap 秒。
    // 分數全為 0（找不到早搏或沒有心率資料）的只在最後補足時使用。
    // spread 為 false（Bigeminy／Trigeminy）時不分段，直接依排序選（仍相隔 minGap 秒）。
    function pickQuickPrints({ candidates, existing, target, start, end, place = null, minGap = QUICK_MIN_GAP,
        need = target - existing.length, spread = true }) {
        if (need <= 0 || target <= 0) return [];
        const span = Math.max(1, end - start);
        const position = place ? place.position : time => (time - start) / span;
        const taken = [...existing];
        const ok = time => taken.every(other => Math.abs(other - time) >= minGap);
        const ranked = [...candidates].sort(compareQuickScore);
        const chosen = [];
        for (let bins = target; spread && chosen.length < need; bins *= 2) {
            const bin = time => Math.min(bins - 1, Math.max(0, Math.floor(position(time) * bins)));
            const apart = time => taken.every(other => Math.abs(position(other) - position(time)) >= 0.5 / bins);
            const occupied = new Set(taken.map(bin));
            for (const { time, score } of ranked) {
                if (chosen.length >= need) break;
                if (!score.some(value => value > 0)) continue;
                if (chosen.includes(time) || occupied.has(bin(time)) || !ok(time) || !apart(time)) continue;
                chosen.push(time); taken.push(time); occupied.add(bin(time));
            }
            if (place ? bins >= place.count : span / bins <= minGap) break;
        }
        for (const { time } of ranked) {
            if (chosen.length >= need) break;
            if (!chosen.includes(time) && ok(time)) { chosen.push(time); taken.push(time); }
        }
        return chosen;
    }
    // 換一張：優先在被換掉那張的時段內選排序最前的，沒有時依均分規則選一張；不分時段時直接依排序選。
    function pickQuickReplacement({ candidates, existing, removed, target, start, end, place = null, minGap = QUICK_MIN_GAP, spread = true }) {
        const span = Math.max(1, end - start);
        const position = place ? place.position : time => (time - start) / span;
        const bin = time => Math.min(target - 1, Math.max(0, Math.floor(position(time) * target)));
        const ok = time => existing.every(other => Math.abs(other - time) >= minGap);
        const pool = candidates.filter(({ time }) => time !== removed);
        if (!spread) return pickQuickPrints({ candidates: pool, existing, target, start, end, place, minGap, need: 1, spread })[0] ?? null;
        const same = [...pool].sort(compareQuickScore)
            .find(({ time, score }) => score.some(value => value > 0) && bin(time) === bin(removed) && ok(time));
        if (same) return same.time;
        return pickQuickPrints({ candidates: pool, existing, target, start, end, place, minGap, need: 1 })[0] ?? null;
    }

    // 目前清單的網站資料；不是支援的清單時回傳 null。
    function getQuickContext(element) {
        if (!window.angular || !element) return null;
        let scope;
        try { scope = window.angular.element(element).scope(); } catch (_) { return null; }
        let host = scope;
        while (host && typeof host.selectPrintedEvent !== 'function') host = host.$parent;
        let owner = scope;
        while (owner && !owner.af) owner = owner.$parent;
        const af = owner?.af;
        const dialog = af?.eventDialog;
        const type = dialog?.dscp?.type;
        const config = QUICK_PRINT_TYPES[type];
        const key = dialog?.dscp?.printedEventType;
        if (!config || !host || !key || !af.printDialog?.selectedEvents) return null;
        return { af, host, dialog, type, config, key };
    }
    function getQuickTimes(ctx) {
        const source = ctx.dialog[ctx.type];
        const values = Array.isArray(source?.data) ? source.data.flat() : [];
        return [...new Set(values.map(toEventTime).filter(time => time !== null))];
    }
    // 清單中已選印（使用者）與強制選印（橘色）的時間。
    function getQuickPrinted(ctx, times = getQuickTimes(ctx)) {
        const inList = new Set(times);
        const pick = values => new Set((Array.isArray(values) ? values : []).map(toEventTime)
            .filter(time => time !== null && inList.has(time)));
        const forced = pick(getLiveForcedEvents(ctx.af));
        const selected = pick(ctx.af.printDialog.selectedEvents[ctx.key]);
        return { selected, forced, all: [...new Set([...selected, ...forced])].sort((a, b) => a - b) };
    }
    // 目前頁面上被標為 Artifact 等排除的心電圖（未儲存前仍在清單中），不納入快速選印。
    function getQuickExcluded(ctx) {
        const items = Array.isArray(ctx.dialog.currentData) ? ctx.dialog.currentData : [];
        return new Set(items.filter(item => item?.selectedType && item.selectedType !== 'none')
            .map(item => toEventTime(item.startTime)).filter(time => time !== null));
    }
    // 分段依據：清單事件依時間排序的名次（place）；start／end 只在沒有事件時作為後備。
    function getQuickRange(ctx, times) {
        const start = Number(ctx.af.record?.startTimeInt);
        const end = Number(ctx.af.record?.endTimeInt);
        const place = makeRankPlace(times);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) return { start, end, place };
        return { start: Math.min(...times), end: Math.max(...times) + 1, place };
    }
    function getQuickSampleRate(af) {
        return Number(af.ecgChart?.sampleRate) || 250;
    }
    // 早搏時間與位置：tagsRecord 的時間清單會被網站依檢視條件刪減，與位置清單不再一一對應；
    // 優先使用原始紀錄（ogTagsRecord），兩份清單長度一致才採用。
    function getBeatList(af, beat) {
        for (const record of [af.tmsline?.ogTagsRecord, af.tmsline?.tagsRecord]) {
            const times = (beat === 'V' ? record?.tmsPVC : record?.tmsSVEB) || [];
            const positions = (beat === 'V' ? record?.posPVC : record?.posSVEB) || [];
            if (times.length && times.length === positions.length) {
                const pairs = times.map((time, i) => [Number(time), Number(positions[i])]).sort((a, b) => a[1] - b[1]);
                return { times: pairs.map(pair => pair[0]), positions: pairs.map(pair => pair[1]) };
            }
        }
        return { times: [], positions: [] };
    }
    function getMinuteHRPoints(af) {
        const charts = Array.isArray(af.hrChart?.hr) ? af.hrChart.hr : [];
        return charts.flatMap(chart => Array.isArray(chart?.data?.avgHR) ? chart.data.avgHR : []);
    }
    // 早搏前一顆心搏的位置（Couplet／Triplet 第一顆的 RR）；同一份紀錄沿用結果。
    const quickPreviousBeat = new Map();
    async function fetchPreviousBeat(af, position) {
        const key = `${af._measureId}|${position}`;
        if (quickPreviousBeat.has(key)) return quickPreviousBeat.get(key);
        const manager = window.angular.element(document.body).injector().get('WppManager');
        let cursor = position, found = null;
        for (let attempt = 0; attempt < 4 && found === null; attempt++) {
            const response = await manager.Af.getAdjacentFilteredECGLabel(af._vendorId, af._idNumber, af._measureId, cursor, 1);
            const data = response?.plain ? response.plain() : response;
            const entries = Object.entries(data && typeof data === 'object' ? data : {})
                .map(([index, type]) => [Number(index), type])
                .filter(([index]) => Number.isFinite(index) && index < cursor).sort((a, b) => b[0] - a[0]);
            if (!entries.length) break;
            const [index, type] = entries[0];
            if (['N', 'S', 'A', 'V'].includes(type)) found = index; else cursor = index;
        }
        quickPreviousBeat.set(key, found);
        return found;
    }
    async function runLimited(items, limit, worker, onProgress) {
        const results = new Array(items.length);
        let next = 0, done = 0;
        const run = async () => {
            while (next < items.length) {
                const index = next++;
                results[index] = await worker(items[index]);
                done++;
                onProgress?.(done, items.length);
            }
        };
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
        return results;
    }
    // ── 標籤驗證：使用者可能改過標籤，清單資料要儲存並重新分類後才會更新 ──
    const QUICK_RUN_MIN = 4; // VT／SVE run／SVT：至少 4 顆連續早搏（3 顆為 Triplet）
    // 套用未儲存的標籤修改（af.ecgAnno.modifiedData：[時間, 索引, 新標籤, 原標籤, 1]，新標籤空白或 X 為刪除），
    // 回傳 [{ offset, type }]：offset 為相對事件時間的秒數，A 視為 S，只保留 N／S／V 心搏。
    function effectiveEventBeats(data, modifiedData, eventTime) {
        const sampleRate = Number(data.sampleRate) || 250;
        const fromIndex = Number(data.fromIndex) || 0;
        const endIndex = fromIndex + (Array.isArray(data.ecg) ? data.ecg.length : 0);
        const fromTime = Number(data.fromTimestamp);
        const labels = new Map(Object.entries(data.anno || {}).map(([index, type]) => [Number(index), type]));
        for (const item of Array.isArray(modifiedData) ? modifiedData : []) {
            const index = Number(item?.[1]);
            if (item?.[4] && index >= fromIndex && index <= endIndex) labels.set(index, item[2]);
        }
        return [...labels].filter(([index, type]) => Number.isFinite(index) && ['N', 'S', 'A', 'V'].includes(type))
            .sort((a, b) => a[0] - b[0])
            .map(([index, type]) => ({ offset: fromTime + (index - fromIndex) / sampleRate - eventTime, type: type === 'A' ? 'S' : type }));
    }
    // 依清單類型檢查事件時間附近（-1～+2 秒）的早搏是否仍符合：
    // Isolated 單顆；Couplet／Triplet 剛好 2／3 顆連續；VT／SVE run／SVT 至少 4 顆連續；
    // Bigeminy／Trigeminy 為單顆早搏，與前或後一顆早搏之間剛好隔 1／2 顆正常心搏。
    function checkEventPattern(beats, config) {
        const ectopic = config.beat;
        const isEctopic = index => beats[index]?.type === ectopic;
        const anchors = beats.map((_, i) => i).filter(i => isEctopic(i) && beats[i].offset >= -1 && beats[i].offset <= 2);
        if (!anchors.length) return { ok: false, reason: `事件時間附近沒有 ${ectopic} 標籤` };
        let found = 0;
        for (const anchor of anchors) {
            let first = anchor, last = anchor;
            while (first > 0 && isEctopic(first - 1)) first--;
            while (last < beats.length - 1 && isEctopic(last + 1)) last++;
            const length = last - first + 1;
            found = Math.max(found, length);
            if (config.kind === 'isolated' && length === 1) return { ok: true };
            if (config.kind === 'average' && length === config.beats) return { ok: true };
            if (config.kind === 'run' && length >= QUICK_RUN_MIN) return { ok: true };
            if (config.kind === 'pattern' && length === 1) {
                const gap = config.every - 1;
                let next = last + 1;
                while (next < beats.length && !isEctopic(next)) next++;
                let previous = first - 1;
                while (previous >= 0 && !isEctopic(previous)) previous--;
                const afterOk = next < beats.length && next - last - 1 === gap && !isEctopic(next + 1);
                const beforeOk = previous >= 0 && first - previous - 1 === gap && !isEctopic(previous - 1);
                if (afterOk || beforeOk) return { ok: true };
            }
        }
        const expected = { isolated: `單顆 ${ectopic}`, average: `${config.beats} 顆連續 ${ectopic}`,
            run: `${QUICK_RUN_MIN} 顆以上連續 ${ectopic}`, pattern: `${ectopic} 之間隔 ${(config.every || 2) - 1} 顆正常心搏` }[config.kind];
        return { ok: false, reason: `標籤已不符合 ${config.name}（需${expected}，目前 ${found} 顆連續 ${ectopic}）` };
    }
    // 讀取事件心電圖（事件時間前 4 秒至後 6 秒）並驗證；讀取失敗時視為不符合，不選這張。
    async function validateQuickTime(ctx, time) {
        try {
            const data = await fetchEventECG(ctx.af, time, THUMB_BEFORE, THUMB_AFTER);
            return checkEventPattern(effectiveEventBeats(data, ctx.af.ecgAnno?.modifiedData, time), ctx.config);
        } catch (error) {
            return { ok: false, reason: `心電圖讀取失敗：${error?.message || error?.status || error}` };
        }
    }
    // 依 pick(pool, existing, need) 選出後逐張驗證，不符合的剔除再選，直到選滿或沒有候選。
    async function pickValidated(ctx, candidates, existing, need, pick, onProgress) {
        let pool = [...candidates];
        const valid = [];
        const skipped = [];
        while (valid.length < need) {
            const picks = pick(pool, [...existing, ...valid], need - valid.length);
            if (!picks.length) break;
            onProgress?.(valid.length + skipped.length, picks.length);
            const results = await runLimited(picks, 4, time => validateQuickTime(ctx, time));
            picks.forEach((time, i) => (results[i].ok ? valid.push(time) : skipped.push(time)));
            const used = new Set([...valid, ...skipped]);
            pool = pool.filter(candidate => !used.has(candidate.time));
        }
        return { valid, skipped };
    }

    // 網站的事件統計（eventTypeStat）：[秒數, 最快 HR, 平均 HR, 最慢 HR, 心搏數]；事件清單卡片顯示的 beats 即第 5 項。
    function getEventStat(af, type, time) {
        const row = af.eventTypeStat?.[type]?.[time];
        if (!Array.isArray(row) || row.length < 5) return null;
        const beats = Number(row[4]);
        const avgHR = Number(row[2]);
        return { beats: beats > 0 ? beats : null, avgHR: avgHR > 0 ? avgHR : null };
    }
    // 每張心電圖的排序依據與說明：
    // Isolated：該分鐘平均心率；Couplet／Triplet：各心搏 BPM 平均；
    // VT／SVT／SVE run：心搏數多者優先，其次平均 BPM；Bigeminy／Trigeminy：早搏數多者優先，其次該分鐘平均心率。
    async function computeQuickScores(ctx, times, onProgress) {
        const { af, config } = ctx;
        const sampleRate = getQuickSampleRate(af);
        const minuteHR = makeMinuteHR(getMinuteHRPoints(af));
        if (config.kind === 'isolated') {
            return times.map(time => {
                const hr = minuteHR(time);
                return { time, score: [hr], info: hr ? `該分鐘平均 ${hr} bpm` : '無心率資料' };
            });
        }
        const list = getBeatList(af, config.beat);
        if (config.kind !== 'average') {
            return times.map(time => {
                const anchor = findEventBeat(list, time);
                const stat = getEventStat(af, ctx.type, time);
                if (anchor < 0 && !stat?.beats) return { time, score: [0, 0], info: '找不到早搏' };
                if (config.kind === 'pattern') {
                    const count = stat?.beats ?? patternFrom(list, anchor, sampleRate);
                    const hr = minuteHR(time);
                    return { time, score: [count, hr], info: `${count} beats` + (hr ? `・該分鐘平均 ${hr} bpm` : '') };
                }
                const beats = anchor >= 0 ? runFrom(list, anchor, sampleRate) : [];
                const count = stat?.beats ?? beats.length;
                const bpm = stat?.avgHR ?? averageBPM(beats.slice(1).map((pos, i) => pos - beats[i]), sampleRate);
                return { time, score: [count, bpm], info: `${count} beats` + (bpm ? `・平均 ${Math.round(bpm)} bpm` : '') };
            });
        }
        return runLimited(times, QUICK_FETCH_CONCURRENCY, async time => {
            const anchor = findEventBeat(list, time);
            if (anchor < 0) return { time, score: [0], info: '找不到早搏' };
            const beats = runFrom(list, anchor, sampleRate, config.beats);
            const intervals = beats.slice(1).map((pos, i) => pos - beats[i]);
            let previous = null;
            try { previous = await fetchPreviousBeat(af, beats[0]); } catch (_) {}
            if (previous !== null) intervals.unshift(beats[0] - previous);
            const bpm = averageBPM(intervals, sampleRate);
            return { time, score: [bpm], info: bpm ? `平均 ${Math.round(bpm)} bpm` : '無法計算 BPM' };
        }, onProgress);
    }
    // 透過網站的選印函式加入／移除（與點擊印表機圖示相同，會立即儲存），並同步目前頁面的勾選狀態。
    function setQuickPrint(ctx, time, on) {
        ctx.host.$apply(() => {
            ctx.host.selectPrintedEvent({ startTime: time, selectedEvent: on });
            for (const item of Array.isArray(ctx.dialog.currentData) ? ctx.dialog.currentData : []) {
                if (toEventTime(item?.startTime) === time) item.selectedEvent = on;
            }
        });
    }
    // 換掉的心電圖在本次頁面執行期不再被選回。
    const quickRejected = new Map();
    function getQuickRejected(ctx) {
        const key = `${ctx.af._measureId}|${ctx.type}`;
        if (!quickRejected.has(key)) quickRejected.set(key, new Set());
        return quickRejected.get(key);
    }
    async function getQuickCandidates(ctx, onProgress) {
        const times = getQuickTimes(ctx);
        const printed = new Set(getQuickPrinted(ctx, times).all);
        const excluded = getQuickExcluded(ctx);
        const rejected = getQuickRejected(ctx);
        const pool = times.filter(time => !printed.has(time) && !excluded.has(time) && !rejected.has(time));
        return { times, candidates: await computeQuickScores(ctx, pool, onProgress) };
    }

    const quickState = { busy: false, progress: '' };
    const quickStyle = document.createElement('style');
    quickStyle.textContent = `
        .rc-print-actions { position:absolute; left:calc(100% + 10px); top:calc(var(--rc-range-height, 20px) / -2);
            transform:translateY(-50%); display:flex; align-items:center; gap:6px; white-space:nowrap; z-index:1; }
        .rc-print-actions button { height:20px; padding:0 9px; border-radius:10px; font-family:inherit; font-weight:600;
            font-size:11px; line-height:18px; white-space:nowrap; }
        .rc-print-actions button[hidden] { display:none; }
        .rc-print-summary.is-link { cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,.18); }
        .rc-print-summary.is-link:hover { background:#46620f; box-shadow:0 2px 5px rgba(0,0,0,.25); }
        .rc-quick-print { border:1px solid #8fb43a; background:#fff; color:#5b7d1a; cursor:pointer;
            box-shadow:0 1px 2px rgba(0,0,0,.12); transition:background .15s, color .15s; }
        .rc-quick-print:hover:not(:disabled) { background:#5b7d1a; border-color:#5b7d1a; color:#fff; }
        .rc-quick-print:disabled { cursor:progress; opacity:.75; }
        .rc-quick-toast { position:fixed; z-index:100001; max-width:420px; padding:6px 12px; border-radius:6px;
            background:rgba(40,52,20,.94); color:#fff; font-size:12px; line-height:1.5; pointer-events:none;
            box-shadow:0 3px 10px rgba(0,0,0,.25); transition:opacity .25s; }
        .rc-quick-toast.is-error { background:rgba(150,40,30,.95); }
    `;
    document.head.appendChild(quickStyle);

    let quickToastElement = null;
    function quickToast(anchor, message, isError = false) {
        if (!quickToastElement) {
            quickToastElement = document.createElement('div');
            quickToastElement.className = 'rc-quick-toast';
            document.body.appendChild(quickToastElement);
        }
        const toast = quickToastElement;
        toast.textContent = message;
        toast.classList.toggle('is-error', isError);
        // 預設顯示在按鈕下方；下方空間不夠（例如畫面底部的選印清單）時改在上方，並限制在畫面內。
        const rect = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
        const width = toast.offsetWidth;
        const height = toast.offsetHeight;
        toast.style.left = `${Math.max(8, Math.min((rect?.left ?? 16), window.innerWidth - width - 8))}px`;
        let top = rect ? rect.bottom + 8 : 16;
        if (rect && top + height > window.innerHeight - 8) top = rect.top - height - 8;
        toast.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
        toast.style.opacity = '1';
        clearTimeout(toast.rcTimer);
        toast.rcTimer = setTimeout(() => { toast.style.opacity = '0'; }, isError ? 5000 : 3500);
    }

    async function runQuickPrint(button) {
        const ctx = getQuickContext(button);
        if (!ctx || quickState.busy) return;
        quickState.busy = true;
        quickState.progress = '';
        schedulePrintBars();
        try {
            const times = getQuickTimes(ctx);
            const existing = getQuickPrinted(ctx, times).all;
            const target = ctx.config.target(times.length);
            if (existing.length >= target) {
                quickToast(button, `${ctx.config.name} 已選印 ${existing.length} 張，已達 ${target} 張`);
                return;
            }
            const { candidates } = await getQuickCandidates(ctx, (done, total) => {
                quickState.progress = `${done}/${total}`;
                schedulePrintBars();
            });
            // 計算期間清單被關閉或切換時放棄。
            if (getQuickContext(button)?.type !== ctx.type) return;
            const now = getQuickPrinted(ctx, times).all;
            const range = getQuickRange(ctx, times);
            // 選出後逐張讀取心電圖、套用未儲存的標籤修改，驗證仍符合此清單類型；不符合的換下一張。
            const { valid: chosen, skipped } = await pickValidated(ctx, candidates, now, target - now.length,
                (pool, existing, need) => pickQuickPrints({ candidates: pool, existing, target, ...range, need,
                    spread: ctx.config.spread !== false }),
                done => { quickState.progress = `驗證 ${done}`; schedulePrintBars(); });
            if (getQuickContext(button)?.type !== ctx.type) return;
            for (const time of chosen) setQuickPrint(ctx, time, true);
            const total = now.length + chosen.length;
            const skippedText = skipped.length ? `（略過 ${skipped.length} 張標籤已不符合的）` : '';
            quickToast(button, chosen.length
                ? `已快速選印 ${chosen.length} 張，${ctx.config.name} 共 ${total}／${target} 張` + (total < target ? '（符合條件的心電圖不足）' : '') + skippedText
                : `沒有符合條件的心電圖可選印（需相隔 1 分鐘以上）` + skippedText, !chosen.length);
            refreshPrintReview();
        } catch (error) {
            quickToast(button, `快速選印失敗：${error?.message || error}`, true);
        } finally {
            quickState.busy = false;
            quickState.progress = '';
            schedulePrintBars();
        }
    }

    // 「選印 N 張」與「快速選印」按鈕；只在支援的清單顯示快速選印，選印清單也只在支援的清單可開啟。
    function updatePrintActions(panel, quick, total, forced) {
        const actions = panel?.querySelector('.rc-print-actions');
        if (!actions) return;
        const summary = actions.querySelector('.rc-print-summary');
        const button = actions.querySelector('.rc-quick-print');
        if (!actions.dataset.rcBound) {
            actions.dataset.rcBound = '1';
            summary.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                if (getQuickContext(summary)) openPrintReview(summary);
            });
            button.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                runQuickPrint(button);
            });
        }
        const summaryText = forced ? `選印 ${total} 張（強制 ${forced}）` : `選印 ${total} 張`;
        if (summary.textContent !== summaryText) summary.textContent = summaryText;
        summary.hidden = !total;
        summary.classList.toggle('is-link', !!quick);
        summary.title = quick ? '開啟選印清單：逐張檢視心電圖，可修改標籤、取消選印或換一張' : '';
        button.hidden = !quick;
        if (quick) {
            const text = quickState.busy ? (quickState.progress ? `計算中 ${quickState.progress}` : '選印中…') : '⚡ 快速選印';
            if (button.textContent !== text) button.textContent = text;
            button.disabled = quickState.busy;
            const target = quick.config.target(getQuickTimes(quick).length);
            button.title = `依規則補足 ${quick.config.name} 選印到 ${target} 張（已選印與橘色強制選印都計入）`;
        }
    }

    // ── 選印清單：上方為網站的心電圖視窗（與點擊心電圖時間相同，可改標籤並 Save），下方為選印縮圖列 ──
    // A／D 切換上一張／下一張選印；Q/E、←/→ 維持原本的移動時間。
    const THUMB_BEFORE = 4; // 縮圖顯示事件心電圖範圍：事件時間前 4 秒
    const THUMB_AFTER = 6; // 至後 6 秒
    let review = null;
    const reviewStyle = document.createElement('style');
    reviewStyle.textContent = `
        .rc-review-bar { position:fixed; left:0; right:0; bottom:0; z-index:100000; display:flex; flex-direction:column;
            overflow:hidden; border-radius:15px 15px 0 0; background:#fff; box-shadow:0 -4px 16px rgba(0,0,0,.28); outline:none; }
        .rc-review-head { display:flex; align-items:center; gap:12px; height:30px; padding:0 10px 0 16px; background:#add149;
            color:#fff; font-weight:600; font-size:13px; white-space:nowrap; }
        .rc-review-title { flex:0 0 auto; }
        .rc-review-hint { flex:1; overflow:hidden; text-overflow:ellipsis; font-weight:400; font-size:11px; opacity:.95; }
        .rc-review-close { width:24px; height:24px; border:0; border-radius:50%; background:transparent; color:#fff;
            font-size:20px; line-height:22px; cursor:pointer; }
        .rc-review-close:hover { background:rgba(255,255,255,.25); }
        .rc-review-add { height:22px; padding:0 10px; border:1px solid #fff; border-radius:11px; background:#fff; color:#5b7d1a;
            font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; }
        .rc-review-add:hover:not(:disabled) { background:#5b7d1a; border-color:#5b7d1a; color:#fff; }
        .rc-review-add:disabled { cursor:progress; opacity:.7; }
        .rc-review-strip { position:relative; }
        .rc-review-list { position:relative; display:flex; gap:10px; overflow-x:auto; padding:8px 12px 4px; scroll-behavior:smooth;
            scrollbar-width:auto; scrollbar-color:#8fb43a #eef3e2; }
        .rc-review-list::-webkit-scrollbar { height:12px; }
        .rc-review-list::-webkit-scrollbar-track { background:#eef3e2; border-radius:6px; }
        .rc-review-list::-webkit-scrollbar-thumb { background:#8fb43a; border:2px solid #eef3e2; border-radius:6px; }
        .rc-review-list::-webkit-scrollbar-thumb:hover { background:#5b7d1a; }
        .rc-review-scroll { position:absolute; top:50%; z-index:1; display:none; width:30px; height:56px; margin-top:-34px;
            border:0; background:rgba(91,125,26,.85); color:#fff; font-size:16px; cursor:pointer;
            box-shadow:0 2px 6px rgba(0,0,0,.25); }
        .rc-review-scroll.is-visible { display:block; }
        .rc-review-scroll:hover { background:#46620f; }
        .rc-review-scroll.is-prev { left:0; border-radius:0 8px 8px 0; }
        .rc-review-scroll.is-next { right:0; border-radius:8px 0 0 8px; }
        .rc-review-count { flex:0 0 auto; padding:0 8px; border-radius:9px; background:rgba(255,255,255,.25);
            font-size:12px; line-height:18px; }
        .rc-review-empty { padding:18px; color:#777; }
        .rc-review-card { flex:0 0 auto; width:250px; box-sizing:border-box; padding:4px 6px 6px; border:2px solid #dcdcdc;
            border-radius:6px; background:#fff; cursor:pointer; transition:border-color .12s, box-shadow .12s; }
        .rc-review-card:hover { border-color:#a9c56a; }
        .rc-review-card.is-active { border-color:#5b7d1a; background:#f6faee; box-shadow:0 0 0 2px rgba(91,125,26,.25); }
        .rc-review-card.is-new { animation:rc-review-flash 1.6s ease-out; }
        @keyframes rc-review-flash { from { background:#fff1c9; } }
        .rc-review-card-head { display:flex; align-items:center; gap:6px; font-size:12px; }
        .rc-review-time { color:#1a3fb8; font-weight:600; }
        .rc-review-tag { padding:0 6px; border-radius:8px; background:#d88f3f; color:#fff; font-size:10px; line-height:16px; }
        .rc-review-card.is-invalid { border-color:#e3a39b; background:#fff7f6; }
        .rc-review-card.is-invalid.is-active { border-color:#c0392b; box-shadow:0 0 0 2px rgba(192,57,43,.25); }
        .rc-review-warn { overflow:hidden; color:#c0392b; font-size:11px; font-weight:600; white-space:nowrap; text-overflow:ellipsis; }
        .rc-review-info { height:15px; overflow:hidden; color:#666; font-size:11px; white-space:nowrap; text-overflow:ellipsis; }
        .rc-review-thumb { height:64px; color:#999; font-size:11px; line-height:64px; text-align:center; }
        .rc-review-thumb svg { display:block; }
        .rc-review-actions { display:flex; gap:6px; margin-top:4px; }
        .rc-review-btn { flex:1; height:22px; padding:0 8px; border:1px solid #c9c9c9; border-radius:11px; background:#fff;
            color:#444; font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; }
        .rc-review-btn:hover:not(:disabled) { border-color:#5b7d1a; background:#5b7d1a; color:#fff; }
        .rc-review-btn.is-cancel:hover:not(:disabled) { border-color:#c0392b; background:#c0392b; }
        .rc-review-btn.is-cancel { border-color:#f1c4bf; background:#fdf1ef; color:#b03a2e; }
        .rc-review-btn.is-swap { border-color:#bcd6ee; background:#eef5fc; color:#2c6aa0; }
        .rc-review-btn.is-swap:hover:not(:disabled) { border-color:#2c6aa0; background:#2c6aa0; color:#fff; }
        .rc-review-btn:disabled { cursor:not-allowed; opacity:.45; }
    `;
    document.head.appendChild(reviewStyle);

    function closePrintReview() {
        if (!review) return;
        if (review.onResize) window.removeEventListener('resize', review.onResize);
        review.bar.remove();
        review = null;
    }
    function openPrintReview(anchor) {
        const ctx = getQuickContext(anchor);
        if (!ctx) return;
        closePrintReview();
        const bar = document.createElement('div');
        bar.className = 'rc-review-bar';
        bar.tabIndex = -1;
        bar.innerHTML = '<div class="rc-review-head"><span class="rc-review-title"></span><span class="rc-review-count"></span>'
            + '<span class="rc-review-hint"></span>'
            + '<button type="button" class="rc-review-add" title="依快速選印的規則再多選一張（時段分散、相隔 1 分鐘以上）">＋ 加選一個</button>'
            + '<button type="button" class="rc-review-close" title="關閉選印清單" aria-label="關閉">×</button></div>'
            + '<div class="rc-review-strip"><button type="button" class="rc-review-scroll is-prev" title="往前捲動" aria-label="往前捲動">◀</button>'
            + '<div class="rc-review-list"></div>'
            + '<button type="button" class="rc-review-scroll is-next" title="往後捲動" aria-label="往後捲動">▶</button></div>';
        review = { bar, ctx, anchor, cards: new Map(), items: [], active: null, switching: false, busy: false };
        bar.querySelector('.rc-review-close').addEventListener('click', closePrintReview);
        bar.querySelector('.rc-review-add').addEventListener('click', addReviewPrint);
        // 縮圖超出畫面時：下方捲軸、滑鼠滾輪左右捲動、兩側 ◀ ▶ 一次捲動約一個畫面寬。
        const list = bar.querySelector('.rc-review-list');
        list.addEventListener('wheel', event => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || list.scrollWidth <= list.clientWidth) return;
            event.preventDefault();
            list.scrollLeft += event.deltaY;
        }, { passive: false });
        list.addEventListener('scroll', updateReviewScroll, { passive: true });
        for (const button of bar.querySelectorAll('.rc-review-scroll')) {
            button.addEventListener('click', () => {
                const direction = button.classList.contains('is-prev') ? -1 : 1;
                list.scrollBy({ left: direction * Math.max(200, list.clientWidth * 0.8), behavior: 'smooth' });
            });
        }
        review.onResize = updateReviewScroll;
        window.addEventListener('resize', review.onResize);
        document.body.appendChild(bar);
        refreshPrintReview();
        if (review.items.length) showReviewTime(review.items[0]);
    }
    // ◀ ▶ 只在該方向還有縮圖時顯示。
    function updateReviewScroll() {
        if (!review) return;
        const list = review.bar.querySelector('.rc-review-list');
        const max = list.scrollWidth - list.clientWidth;
        review.bar.querySelector('.rc-review-scroll.is-prev').classList.toggle('is-visible', list.scrollLeft > 4);
        review.bar.querySelector('.rc-review-scroll.is-next').classList.toggle('is-visible', list.scrollLeft < max - 4);
    }
    function updateReviewCount() {
        if (!review) return;
        const index = review.items.indexOf(review.active);
        const text = review.items.length ? `第 ${index >= 0 ? index + 1 : '–'}／${review.items.length} 張` : '';
        const node = review.bar.querySelector('.rc-review-count');
        if (node.textContent !== text) node.textContent = text;
        node.hidden = !text;
    }
    function refreshPrintReview() {
        if (!review) return;
        const { ctx, bar, cards } = review;
        if (!ctx.dialog || ctx.dialog.dscp?.type !== ctx.type || !review.anchor.isConnected) { closePrintReview(); return; }
        const times = getQuickTimes(ctx);
        const { forced, all } = getQuickPrinted(ctx, times);
        review.items = all;
        const title = `選印清單・${ctx.config.name}`;
        const titleNode = bar.querySelector('.rc-review-title');
        if (titleNode.textContent !== title) titleNode.textContent = title;
        const hint = 'A／D 切換上一張／下一張選印；Q/E、←/→ 移動時間。'
            + (ctx.af.editingSwitch ? '' : '目前不是編輯模式，無法修改標籤。');
        const hintNode = bar.querySelector('.rc-review-hint');
        if (hintNode.textContent !== hint) hintNode.textContent = hint;
        const list = bar.querySelector('.rc-review-list');
        for (const [time, card] of cards) if (!all.includes(time)) { card.remove(); cards.delete(time); }
        if (!all.includes(review.active)) review.active = null;
        let previous = null;
        for (const time of all) {
            let card = cards.get(time);
            if (!card) { card = createReviewCard(time); cards.set(time, card); }
            const isForced = forced.has(time);
            card.classList.toggle('is-forced', isForced);
            card.classList.toggle('is-active', time === review.active);
            card.querySelector('.rc-review-tag').hidden = !isForced;
            for (const button of card.querySelectorAll('.rc-review-btn')) {
                button.disabled = isForced || review.busy;
                button.title = isForced ? '橘色強制選印由網站決定，無法在此取消或替換' : '';
            }
            const expected = previous ? previous.nextElementSibling : list.firstElementChild;
            if (expected !== card) list.insertBefore(card, expected);
            previous = card;
            // 加入清單後才載入，縮圖寬度才量得到。
            if (!card.dataset.rcLoaded) {
                card.dataset.rcLoaded = '1';
                loadReviewThumb(card, time);
                loadReviewInfo(card, time);
            }
        }
        let empty = list.querySelector('.rc-review-empty');
        if (!all.length && !empty) {
            empty = document.createElement('div');
            empty.className = 'rc-review-empty';
            empty.textContent = '目前沒有選印的心電圖';
            list.appendChild(empty);
        } else if (all.length && empty) empty.remove();
        updateReviewCount();
        requestAnimationFrame(updateReviewScroll);
    }
    function createReviewCard(time) {
        const card = document.createElement('div');
        card.className = 'rc-review-card';
        card.dataset.time = String(time);
        card.innerHTML = '<div class="rc-review-card-head"><span class="rc-review-time"></span>'
            + '<span class="rc-review-tag" hidden>強制選印</span></div>'
            + '<div class="rc-review-info"></div><div class="rc-review-warn" hidden></div><div class="rc-review-thumb">載入中…</div>'
            + '<div class="rc-review-actions"><button type="button" class="rc-review-btn is-cancel">取消選印</button>'
            + '<button type="button" class="rc-review-btn is-swap">換一個</button></div>';
        card.querySelector('.rc-review-time').textContent = formatQuickTime(review.ctx, time);
        card.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            showReviewTime(time);
        });
        card.querySelector('.is-cancel').addEventListener('click', () => cancelReviewPrint(time, card));
        card.querySelector('.is-swap').addEventListener('click', () => swapReviewPrint(time, card));
        return card;
    }
    function formatQuickTime(ctx, time) {
        try {
            const text = ctx.host.tmsFormat?.(time, 'DD/MM/YYYY, HH:mm:ss');
            if (text) return text;
        } catch (_) {}
        return new Date(time * 1000).toLocaleString();
    }
    async function loadReviewInfo(card, time) {
        const ctx = review?.ctx;
        if (!ctx) return;
        try {
            const [score] = await computeQuickScores(ctx, [time]);
            if (card.isConnected && score?.info) card.querySelector('.rc-review-info').textContent = score.info;
        } catch (_) {}
    }
    function setReviewActive(time) {
        if (!review) return;
        review.active = time;
        for (const [other, card] of review.cards) card.classList.toggle('is-active', other === time);
        // 只捲動縮圖列本身，讓目前這張完整顯示。
        const card = review.cards.get(time);
        const list = review.bar.querySelector('.rc-review-list');
        if (card) {
            const left = card.offsetLeft; // 縮圖列為 position:relative，offsetLeft 即在列中的位置
            if (left < list.scrollLeft + 8) list.scrollTo({ left: left - 40, behavior: 'smooth' });
            else if (left + card.offsetWidth > list.scrollLeft + list.clientWidth - 8) {
                list.scrollTo({ left: left + card.offsetWidth - list.clientWidth + 40, behavior: 'smooth' });
            }
        }
        updateReviewCount();
    }
    function waitFor(check, timeout) {
        return new Promise(resolve => {
            const started = Date.now();
            const tick = () => {
                if (check() || Date.now() - started > timeout) resolve(check());
                else requestAnimationFrame(tick);
            };
            tick();
        });
    }
    // 在上方開啟網站的心電圖視窗（與點擊心電圖時間相同）。切換時只關閉視窗、不放棄修改（同網站關閉時選 No），
    // 未儲存的標籤修改會保留，可多張改完後一併按 Save。
    async function showReviewTime(time) {
        if (!review || review.switching) return;
        const { ctx } = review;
        const popupOpen = () => !!document.querySelector('.ngdialog.ecg-dialog');
        if (popupOpen() && review.active === time) return;
        review.switching = true;
        setReviewActive(time);
        try {
            if (popupOpen()) {
                ctx.host.$apply(() => ctx.host.closeDialog());
                await waitFor(() => !popupOpen(), 1500);
            }
            if (!review || review.ctx !== ctx) return;
            ctx.host.$apply(() => ctx.host.openDialog(time, ctx.af.dataDuration || 60));
            await waitFor(popupOpen, 3000);
        } catch (error) {
            quickToast(review?.bar, `無法開啟心電圖：${error?.message || error}`, true);
        } finally {
            if (review) review.switching = false;
        }
    }
    function moveReview(delta) {
        if (!review || !review.items.length) return;
        const index = review.items.indexOf(review.active);
        const next = index < 0 ? (delta > 0 ? 0 : review.items.length - 1)
            : Math.min(review.items.length - 1, Math.max(0, index + delta));
        if (index >= 0 && next === index) return;
        showReviewTime(review.items[next]);
    }
    // A／D：選印清單開啟時切換上一張／下一張選印，不論滑鼠位置；Q/E、←/→ 維持原本的移動時間。
    // 以實體按鍵位置判斷（輸入法或大小寫不影響），輸入欄聚焦時不處理。
    window.addEventListener('keydown', event => {
        if (!review || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
        if (event.code !== 'KeyA' && event.code !== 'KeyD') return;
        const active = document.activeElement;
        if (active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat || !review.switching) moveReview(event.code === 'KeyA' ? -1 : 1);
    }, true);

    // 縮圖：事件心電圖範圍（前 4 秒至後 6 秒）一列，上方標出心搏類型；依序載入，最多同時 3 張。
    const thumbQueue = [];
    let thumbLoading = 0;
    function loadReviewThumb(card, time) {
        thumbQueue.push({ card, time });
        pumpThumbQueue();
    }
    function pumpThumbQueue() {
        while (thumbLoading < 3 && thumbQueue.length) {
            const { card, time } = thumbQueue.shift();
            if (review?.cards.get(time) !== card) continue;
            thumbLoading++;
            fetchReviewECG(time, THUMB_BEFORE, THUMB_AFTER).then(data => {
                if (review?.cards.get(time) !== card) return;
                card.rcData = data;
                renderReviewThumb(card.querySelector('.rc-review-thumb'), data, time);
                checkReviewCard(card, time);
            }).catch(error => {
                const thumb = card.querySelector('.rc-review-thumb');
                if (thumb) thumb.textContent = `載入失敗：${error?.message || error?.status || error}`;
            }).finally(() => { thumbLoading--; pumpThumbQueue(); });
        }
    }
    // 網站讀取事件心電圖時使用的固定取樣率（125／250／500／1000 中最接近者）。
    function requestSampleRate(sampleRate) {
        return [125, 250, 500, 1000].reduce((best, value) =>
            Math.abs(value - sampleRate) < Math.abs(best - sampleRate) ? value : best, 250);
    }
    async function fetchReviewECG(time, before, after) {
        return fetchEventECG(review.ctx.af, time, before, after);
    }
    async function fetchEventECG(af, time, before, after) {
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const response = await manager.Af.getFilteredECGDataByTms(af._vendorId, af._idNumber, af._measureId,
            time - before, time + after, requestSampleRate(getQuickSampleRate(af)), time, false, false);
        const data = response?.plain ? response.plain() : response;
        if (!Array.isArray(data?.ecg) || !data.ecg.length) throw new Error('沒有心電圖資料');
        return data;
    }
    function median(values) {
        const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
        return sorted.length ? sorted[sorted.length >> 1] : 0;
    }
    function renderReviewThumb(container, data, eventTime) {
        if (!container) return;
        const width = Math.max(120, container.clientWidth || 234);
        const height = 64;
        const labelHeight = 13;
        const sampleRate = Number(data.sampleRate) || 250;
        const fromIndex = Number(data.fromIndex) || 0;
        const ecg = data.ecg;
        const seconds = ecg.length / sampleRate;
        const pxPerSec = width / Math.max(1, seconds);
        const waveHeight = height - labelHeight;
        const values = ecg.map(Number);
        const baseline = median(values);
        // 振幅依這張的範圍縮放（至少 1.2 mV 高），讓縮圖都看得清楚。
        const span = Math.max(1.2, 2 * Math.max(...values.map(value => Math.abs(value - baseline)).filter(Number.isFinite), 0));
        const pxPerMV = waveHeight / span;
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        const add = (tag, attrs, text) => {
            const node = document.createElementNS(ns, tag);
            for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
            if (text !== undefined) node.textContent = text;
            svg.appendChild(node);
            return node;
        };
        add('rect', { x: 0, y: labelHeight, width, height: waveHeight, fill: '#fff', stroke: '#ccc' });
        let grid = '';
        for (let s = 0.2; s < seconds; s += 0.2) grid += `M${(s * pxPerSec).toFixed(1)} ${labelHeight}V${height}`;
        add('path', { d: grid, stroke: '#eee', 'stroke-width': 0.6, fill: 'none' });
        let d = '';
        values.forEach((value, i) => {
            if (!Number.isFinite(value)) return;
            const x = i / sampleRate * pxPerSec;
            const y = Math.min(height, Math.max(labelHeight, labelHeight + waveHeight / 2 - (value - baseline) * pxPerMV));
            d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        add('path', { d, stroke: '#262626', 'stroke-width': 0.9, fill: 'none', 'stroke-linejoin': 'round' });
        const color = type => type === 'V' ? '#d0021b' : type === 'S' || type === 'A' ? '#2a6fdb' : '#888';
        for (const [index, type] of Object.entries(data.anno || {}).map(([index, type]) => [Number(index), type])) {
            if (!['N', 'S', 'A', 'V'].includes(type) || !Number.isFinite(index)) continue;
            const x = (index - fromIndex) / sampleRate * pxPerSec;
            if (x < 0 || x > width) continue;
            // 與網站標籤列相同，A 顯示為 S。
            add('text', { x, y: 10, 'font-size': 9, 'text-anchor': 'middle', fill: color(type), 'font-weight': type === 'N' ? 400 : 700 },
                type === 'A' ? 'S' : type);
        }
        container.textContent = '';
        container.appendChild(svg);
    }
    // 選印清單的卡片：依縮圖的心電圖與目前未儲存的標籤修改，標示已不符合清單類型的選印。
    function checkReviewCard(card, time) {
        if (!review || !card.rcData) return;
        const result = checkEventPattern(effectiveEventBeats(card.rcData, review.ctx.af.ecgAnno?.modifiedData, time), review.ctx.config);
        card.classList.toggle('is-invalid', !result.ok);
        const warn = card.querySelector('.rc-review-warn');
        const text = result.ok ? '' : `⚠ ${result.reason}`;
        if (warn.textContent !== text) warn.textContent = text;
        warn.hidden = result.ok;
        card.title = result.ok ? '' : result.reason;
    }
    // 標籤修改後重新檢查（由頁面變動觸發，只在修改內容改變時才重算）。
    function recheckReviewCards() {
        if (!review) return;
        const signature = JSON.stringify(review.ctx.af.ecgAnno?.modifiedData || []);
        if (signature === review.labelSignature) return;
        review.labelSignature = signature;
        for (const [time, card] of review.cards) checkReviewCard(card, time);
    }
    function setReviewBusy(busy) {
        if (!review) return;
        review.busy = busy;
        refreshPrintReview();
    }
    // 取消選印：目前顯示的是這張時，改顯示相鄰的下一張（沒有則上一張）。
    function cancelReviewPrint(time, card) {
        if (!review || review.busy) return;
        const items = review.items;
        const index = items.indexOf(time);
        const neighbor = review.active === time ? (items[index + 1] ?? items[index - 1] ?? null) : null;
        try {
            setQuickPrint(review.ctx, time, false);
            quickToast(card.querySelector('.is-cancel'), `已取消選印 ${formatQuickTime(review.ctx, time)}`);
        } catch (error) {
            quickToast(card.querySelector('.is-cancel'), `取消選印失敗：${error?.message || error}`, true);
            return;
        }
        refreshPrintReview();
        if (neighbor !== null) showReviewTime(neighbor);
    }
    async function swapReviewPrint(time, card) {
        if (!review || review.busy) return;
        const ctx = review.ctx;
        const button = card.querySelector('.is-swap');
        setReviewBusy(true);
        button.textContent = '尋找中…';
        try {
            getQuickRejected(ctx).add(time);
            const { times, candidates } = await getQuickCandidates(ctx, (done, total) => { button.textContent = `${done}/${total}`; });
            if (!review || review.ctx !== ctx) return;
            const existing = getQuickPrinted(ctx, times).all.filter(other => other !== time);
            const range = getQuickRange(ctx, times);
            button.textContent = '驗證中…';
            const { valid: [replacement = null], skipped } = await pickValidated(ctx, candidates, existing, 1,
                (pool, others) => [pickQuickReplacement({ candidates: pool, existing: others, removed: time,
                    target: ctx.config.target(times.length), ...range, spread: ctx.config.spread !== false })].filter(value => value !== null));
            if (!review || review.ctx !== ctx) return;
            if (replacement === null) {
                getQuickRejected(ctx).delete(time);
                quickToast(button, '沒有其他符合條件的心電圖（需與其他選印相隔 1 分鐘以上）'
                    + (skipped.length ? `；${skipped.length} 張標籤已不符合` : ''), true);
                return;
            }
            setQuickPrint(ctx, time, false);
            setQuickPrint(ctx, replacement, true);
            review.busy = false;
            refreshPrintReview();
            const added = review?.cards.get(replacement);
            added?.classList.add('is-new');
            quickToast(added?.querySelector('.is-swap') || review?.bar, `已換成 ${formatQuickTime(ctx, replacement)}`);
            showReviewTime(replacement);
        } catch (error) {
            quickToast(button, `換一個失敗：${error?.message || error}`, true);
        } finally {
            if (button.isConnected) button.textContent = '換一個';
            setReviewBusy(false);
        }
    }

    // 加選一個：不受目標張數限制，依同樣的規則再選一張；時段數取目前張數 + 1，選在空出的時段中排序最前的。
    async function addReviewPrint() {
        if (!review || review.busy) return;
        const ctx = review.ctx;
        const button = review.bar.querySelector('.rc-review-add');
        setReviewBusy(true);
        button.disabled = true;
        button.textContent = '尋找中…';
        try {
            const { times, candidates } = await getQuickCandidates(ctx, (done, total) => { button.textContent = `尋找中 ${done}/${total}`; });
            if (!review || review.ctx !== ctx) return;
            const existing = getQuickPrinted(ctx, times).all;
            const range = getQuickRange(ctx, times);
            const target = Math.max(ctx.config.target(times.length), existing.length + 1);
            button.textContent = '驗證中…';
            const { valid: [added], skipped } = await pickValidated(ctx, candidates, existing, 1,
                (pool, others) => pickQuickPrints({ candidates: pool, existing: others, need: 1, target, ...range,
                    spread: ctx.config.spread !== false }));
            if (!review || review.ctx !== ctx) return;
            if (added === undefined) {
                quickToast(button, '沒有其他符合條件的心電圖（需與其他選印相隔 1 分鐘以上）'
                    + (skipped.length ? `；${skipped.length} 張標籤已不符合` : ''), true);
                return;
            }
            setQuickPrint(ctx, added, true);
            review.busy = false;
            refreshPrintReview();
            const card = review?.cards.get(added);
            card?.classList.add('is-new');
            quickToast(card || button, `已加選 ${formatQuickTime(ctx, added)}`);
            showReviewTime(added);
        } catch (error) {
            quickToast(button, `加選失敗：${error?.message || error}`, true);
        } finally {
            if (button.isConnected) { button.textContent = '＋ 加選一個'; button.disabled = false; }
            setReviewBusy(false);
        }
    }

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
