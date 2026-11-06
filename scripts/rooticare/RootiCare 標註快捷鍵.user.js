// ==UserScript==
// @name         RootiCare 標註快捷鍵
// @namespace    https://editoreu.rooticare.com/
// @version      1.47.0
// @description  以數字鍵與滑鼠中鍵新增、修改或刪除 V / S / N 標籤；支援區間篩選修改、早搏判讀、W / S 心電圖縮放與 A / D 半步切換時間。
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
 *   Alt+左鍵拖曳         左右微調標籤位置（Esc 取消；Mac 為 Option）；
 *                        按在標籤列空白處或心電圖波形上會吸過最近的標籤；
 *                        開始後可放開 Alt，拖曳中按 1／2／3 改為 V／S／N，放開滑鼠一併送出
 *
 * 【區間】Shift+1/2/3/4 按兩次（起點、終點），可跨視窗；Esc 取消
 *   篩選修改  依 BPM、變動率、原標籤、前一個／後一個標籤、type（排除／限於 type 1,155）篩選後
 *            改為 V / S / N（結尾按 Shift+1/2/3）或刪除（結尾按 Shift+4）
 *   填補整理  在頭尾兩顆標籤外側各按一次，依開頭 RR 平均補滿中間心搏
 *            （頭尾不改；多刪少補，保留的維持原類型）
 *   早搏判讀  依 RR 變動率（預設超過 12%）判斷提早出現的心搏；只修改勾選的原標籤（預設 N、S）：
 *            結尾按 1／2 把判為早搏的改為 V／S，按 3 把未判為早搏的改為 N；
 *            以近期正常心律為基準，早搏後的代償間歇與恢復期不會讓後面的心搏被連帶判為早搏
 *            Isolated、Couplet／Triplet、Bigeminy／Trigeminy、SVE run 皆適用；區間前後整段都是早搏時改用 N→N 或週期平均推算基準
 *   面板開啟時按 1 / 2 / 3（不按 Shift）切換分頁：篩選修改／填補整理／早搏判讀。
 *   分頁選擇保留到重新整理頁面為止。
 *
 * 【檢視】
 *   W / S   縮放（↑ / ↓）
 *   Q / E   切換時間（← / →），縮放高度保持不變；滑鼠不必停在心電圖上
 *   A / D   以 Q / E 一半的距離切換時間（主畫面 30 秒、3 導程 10 秒、心電圖視窗 5 秒）；
 *           選印清單開啟時仍為切換上一張／下一張選印
 *   ch1～3 旁的眼睛  顯示／隱藏導程（重新載入恢復全開）
 *   滑過標籤列或波形時，顯示紅色垂直對齊線
 *
 * 【清單】
 *   HR Min／Max／Max sinus  「排除 ±1 分」移除後面相近時間的心電圖，再按一次取消；選印後保留，標題列可還原
 *   Max HR sinus            標題列「排除 AF 時段」（預設關）：開啟後移除與 AF 時段重疊的心電圖；
 *                          「排除高於 Max HR」（預設關）：開啟後移除平均 HR 高於 Max HR 方塊數值的心電圖；
 *                          「排除含 V／S」（預設關）：開啟後移除 10 秒內有 V 或 S 標籤的心電圖
 *   AF 清單 mid segment     下拉選單旁的 ◀ ▶ 切換上一個／下一個時段（編輯模式）
 *   Tachy／Brady 清單       網站 invert 按鈕旁的單頁「Invert」：本頁未修改的改為 artifact，
 *                          本頁已全部是 artifact 時改回未修改；psvt／vt 不變（編輯模式）
 *   Spéc. 清單              放大鏡前的「Invert」取消本頁所有星星、「Invert all」取消整個清單的星星，
 *                          備註與選印一併移除；再按一次可加回星星、備註與選印，按 Save 才儲存（編輯模式）
 *   時間輸入框              W／↑ 加 2 秒、S／↓ 減 2 秒，可按住連續調整；聚焦時顯示提示 3 秒
 *   HR 清單時間框           貼上或修改時間後，自動以該心電圖白色區段的平均 BPM 填入 HR 欄
 *   事件清單頁碼拉條       選印位置（綠色、橘色強制選印）下方的圓點可點擊跳頁，右側顯示選印張數
 *   V / S 事件清單          「⚡ 快速選印」依規則補足選印（時段分散、相隔 1 分鐘以上）；
 *                          按「選印 N 張」開啟選印清單：上方為心電圖視窗（可改標籤並 Save），
 *                          下方為縮圖列（A／D 切換），可「取消選印」「換一個」或「加選一個」；
 *                          心電圖視窗上也有「取消選印」「換一個」（作用於目前這張）；
 *                          「Group」先儲存標籤修改再執行 Group All，完成後重新開啟清單
 *                          選印清單開著時，點心電圖波形不會再出現量測虛線；只有開啟 Mesurer 等量測功能時才有
 *                          縮圖的標籤與上方心電圖視窗同步（未儲存的修改以淡黃底標示），Save 後自動重新讀取
 *                          在網站上點印表機圖示選印或取消時，開著的選印清單跟著更新；
 *                          強制選印同時也是藍色選印的，標示為「強制＋藍色」
 *                          「👁 列印範圍」：縮圖改顯示報告中波形下方的 30 秒縮圖範圍（綠色為印出的 8 秒），
 *                          所有清單的選印清單都有；預設關閉，開啟後保持到重新整理頁面
 *                          心電圖視窗「取消選印」旁也有「👁 列印範圍」：在上方心電圖標出實線（印出的 8 秒）
 *                          與虛線（下方 30 秒縮圖的範圍）；與縮圖的眼睛分開切換，同樣保持到重新整理頁面
 *                          已不在清單中的選印（例如改成 Couplet 等子分類後重新 Group）會自動取消並提示
 *                          快速選印與換一個會先依目前標籤（含未儲存修改）驗證是否仍符合清單類型
 *                          換掉或取消選印的心電圖（及其前後 30 秒內的）重新整理頁面前不再被選回，
 *                          包含在網站上直接點印表機取消的；Group 後被重新分類到其他清單的不算；
 *                          快速選印的候選不足時，才依序用回前後 30 秒內的、取消過的本身
 *                          Isolated S 需變動率超過 12%；前兩顆依序為 V、N 的排在最後，其他候選不足時才選
 *                          SVE run／SVT 超過 30 秒的心電圖改用藍色選印（區段選印），橘色強制選印也會一併檢查
 *   Pause／Event Tag 清單  按「選印 N 張」開啟選印清單，可逐張檢視（A／D 切換）、修改標籤、取消選印；
 *                          沒有快速選印、換一個、加選一個與 Group
 *   Event Tag 心電圖視窗    滑鼠移到心電圖（上方 20 秒或下方 60 秒長條）出現 10 秒虛線框，點一下即把選印時間移過去，
 *                          取代逐次點 ◀ ▶；以 ◀ ▶ 的 5 秒步距對齊，範圍與網站相同；實線框為目前的選印範圍；
 *                          框內最後 2 秒以灰色標示（與清單上的灰色區塊相同，報告只印出前 8 秒）；
 *                          選印在畫面外時（紀錄開頭附近的標籤可用 ◀ ▶ 移出），60 秒長條邊緣標示選印時間；
 *                          Mesurer、R-type／Pause 編輯時或按著修飾鍵時不作用；選印清單的縮圖顯示選印範圍
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
    // Alt（Mac 為 Option）+ 左鍵拖曳標籤。
    const isDragModifier = event => event.altKey;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let currentMousePos = { x: 0, y: 0 };

    const zoomPreservingFunctions = new WeakSet();
    // 網站 selectedDataRange 的第 4 個參數控制是否重設高度；方向鍵原本即傳 false。
    // 在原控制器入口沿用此選項，不於非同步載入後覆寫使用者新調整的縮放。
    // 取得網站 AF 控制器的 scope（擁有 selectedDataRange 與 adjustDisplayTime 的那一層）。
    function getDashboardScope() {
        const host = document.querySelector('[ng-controller="RootiCareDashboardAFCtrl"]');
        if (!host || !window.angular) return null;
        let scope;
        try { scope = window.angular.element(host).scope?.(); } catch (_) { return null; }
        while (scope && !Object.prototype.hasOwnProperty.call(scope, 'selectedDataRange')) scope = scope.$parent;
        return scope || null;
    }
    function installZoomPersistence() {
        const scope = getDashboardScope();
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
            if (!block) continue;
            processCommand(heldSweep.tag, point, block);
        }
    }
    window.addEventListener('mousemove', (e) => {
        if (!heldSweep) return;
        if (isDisabledPage() || rangeBusy || labelDrag || rangeMode || (heldSweep.alt && !e.altKey)) {
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

    // A / D：以 Q / E 一半的距離移動心電圖時間，判斷順序與網站原生方向鍵相同。
    // 主畫面原生一次 60 秒（3 導程模式 20 秒），心電圖視窗原生一次 10 秒；
    // 事件清單、分頁等原生為換頁的畫面不處理。成功移動時回傳 true。
    function halfStepECG(direction) {
        const scope = getDashboardScope();
        const af = scope?.af;
        if (!af || af.loading?.ecg || !af.tmsline?.timeRange) return false;
        const has = selector => !!document.querySelector(selector);
        if (has('#af-pr-dialog') || has('#af-add-tag-dialog')) return false;
        if (has('.event-tag-list') && !has('#af-ecg-dialog-v2')) return false;
        const apply = fn => (scope.$root?.$$phase ? fn() : scope.$apply(fn));
        if (has('#af-ecg-dialog-v2')) {
            const dialog = af.ECGTrendDialog;
            const chart = af.ecgChart;
            if (af.focusBlock || !dialog || !chart || !Array.isArray(dialog.timeRange)) return false;
            const step = 5 * direction;
            apply(() => {
                dialog.startTime += step;
                chart.shiftSec = Math.min(40, Math.max(0, chart.shiftSec + step));
                dialog.startTime = Math.min(dialog.timeRange[1] - 20, Math.max(dialog.timeRange[0], dialog.startTime));
            });
            return true;
        }
        if (has('.fixed-board') || !af.hrChart?.trendExtend) return false;
        const chartIdx = Array.isArray(af.hrChart.hr) ? af.hrChart.hr.findIndex(item => item?.ecgSwitch) : -1;
        const start = Number(af.ecgChart?.chartStartTms);
        if (chartIdx < 0 || !Number.isFinite(start) || typeof scope.selectedDataRange !== 'function') return false;
        const step = (af.record?.ecgLeadMode ? 10 : 30) * direction;
        const range = [start + step, start + 60 + step];
        installZoomPersistence();
        apply(() => {
            if (af.labelEditing) { af.labelEditing.selectedTime = [...range]; af.labelEditing.chartIdx = chartIdx; }
            if (af.ecgAnno) { af.ecgAnno.selectedTime = [...range]; af.ecgAnno.chartIdx = chartIdx; }
            scope.selectedDataRange(range[0], range[1], chartIdx, false);
        });
        return true;
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
    // 區間修改完成後顯示的結果提示（如「已修改 N 個標籤」）；此時 Esc 交還給網頁本身處理。
    let rangeResultShown = false;
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
        #rooticare-range-hotkeys .rh-type { width:100%; }
        #rooticare-range-hotkeys [data-role=type-mode] { width:54px; }
        #rooticare-range-hotkeys input[data-role=type-list] { appearance:auto;position:static;float:none;display:inline-block;
            flex:1;min-width:0;height:23px;min-height:0;margin:0;padding:1px 5px;border:1px solid #dce3d6;border-radius:4px;
            background:#fff;color:#374333;font:inherit; }
        #rooticare-range-hotkeys :disabled { opacity:.45;cursor:default; }
        #rooticare-range-hotkeys button { position:static;float:none;width:20px;height:20px;min-height:0;margin:0;padding:0;
            border:0;border-radius:4px;background:transparent;color:#889180;font:18px/20px Arial;cursor:pointer; }
        #rooticare-range-hotkeys button:hover { background:#f0f3ec;color:#374333; }
        #rooticare-range-hotkeys :is(button,input,select):focus-visible { outline:2px solid #91ad68;outline-offset:1px; }
        #rooticare-range-hotkeys [data-role=help] { margin-top:6px;color:#7b8574;font-size:11px; }
        #rooticare-range-hotkeys [data-role=tabs] { margin-top:7px;display:flex;gap:2px;border-bottom:1px solid #dce3d6; }
        #rooticare-range-hotkeys [data-role=tabs] button { width:auto;height:24px;padding:0 10px;border-radius:5px 5px 0 0;
            margin-bottom:-1px;border:1px solid transparent;font:600 12px/22px Arial,"PingFang TC","Microsoft JhengHei",sans-serif;color:#889180; }
        #rooticare-range-hotkeys [data-role=tabs] button[aria-selected=true] { border-color:#dce3d6;border-bottom-color:var(--rh-bg);
            background:var(--rh-bg);color:#4f6b1a; }
        /* 每個分頁各用一種淺色底：篩選修改淺綠、填補整理淺藍、早搏判讀淺杏 */
        #rooticare-range-hotkeys { --rh-bg:#fff; background:var(--rh-bg); transition:background-color .15s; }
        #rooticare-range-hotkeys[data-tool=filter] { --rh-bg:#f3f8ec; }
        #rooticare-range-hotkeys[data-tool=fill] { --rh-bg:#edf4fb; }
        #rooticare-range-hotkeys[data-tool=ectopic] { --rh-bg:#fcf3ea; }
        #rooticare-range-hotkeys [data-tool=filter]:not([aria-selected=true]) { background:#f3f8ec99; }
        #rooticare-range-hotkeys [data-tool=fill]:not([aria-selected=true]) { background:#edf4fb99; }
        #rooticare-range-hotkeys [data-tool=ectopic]:not([aria-selected=true]) { background:#fcf3ea99; }
        #rooticare-range-hotkeys [data-role=fill] { margin-top:7px;color:#526047; }
        #rooticare-range-hotkeys [data-role=ectopic] { margin-top:7px;color:#526047; }
        #rooticare-range-hotkeys .rh-ectopic-options { margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#374333; }
        #rooticare-range-hotkeys.rh-minimized { padding:5px 9px; }
        #rooticare-range-hotkeys.rh-minimized [data-role=filters],
        #rooticare-range-hotkeys.rh-minimized [data-role=tabs],
        #rooticare-range-hotkeys.rh-minimized [data-role=fill],
        #rooticare-range-hotkeys.rh-minimized [data-role=ectopic],
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
    // 區間分頁：filter 篩選修改、fill 填補整理、ectopic 早搏判讀。只存在本次頁面執行期，重新整理後回到篩選修改。
    let rangeTool = 'filter';
    const RANGE_HELP = {
        filter: '在另一端按 Shift + 1→V／2→S／3→N／4→刪除，即套用篩選修改',
        fill: '在結尾之後按 Shift + 1→V／2→S／3→N，補上的標籤使用該類型',
        ectopic: '在另一端按 Shift + 1→V／2→S：判為早搏的改為該類型；Shift + 3→N：未判為早搏的改為 N'
    };
    function updateRangeTool() {
        if (!rangeControls) return;
        for (const tab of rangeHint.querySelectorAll('[data-tool]')) {
            tab.setAttribute('aria-selected', String(tab.dataset.tool === rangeTool));
        }
        const open = rangeMode?.first && !rangeBusy;
        // 分頁開啟時才套用該分頁顏色；結果提示維持白底。
        if (open) rangeHint.dataset.tool = rangeTool;
        else delete rangeHint.dataset.tool;
        rangeControls.style.display = open && rangeTool === 'filter' ? 'flex' : 'none';
        rangeHint.querySelector('[data-role="fill"]').style.display = open && rangeTool === 'fill' ? 'block' : 'none';
        rangeHint.querySelector('[data-role="ectopic"]').style.display = open && rangeTool === 'ectopic' ? 'block' : 'none';
        rangeHint.querySelector('[data-role="tabs"]').style.display = open ? 'flex' : 'none';
        const help = rangeHint.querySelector('[data-role="help"]');
        help.textContent = RANGE_HELP[rangeTool] + '。按 1／2／3 切換分頁';
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
                <button type="button" role="tab" data-tool="filter" title="快捷鍵 1">篩選修改</button>
                <button type="button" role="tab" data-tool="fill" title="快捷鍵 2">填補整理</button>
                <button type="button" role="tab" data-tool="ectopic" title="快捷鍵 3">早搏判讀</button></div>
            <div data-role="ectopic">依 RR 判斷提早出現的心搏（變動率超過門檻）；早搏後的代償間歇與恢復期不當作參考，
                避免恢復正常的心搏被連帶判為早搏。
                <div class="rh-ectopic-options">
                <span class="rh-group" title="只修改勾選的原標籤"><span>原標籤</span>
                <label><input type="checkbox" data-ectopic-source="N" checked> N</label>
                <label><input type="checkbox" data-ectopic-source="S" checked> S</label>
                <label><input type="checkbox" data-ectopic-source="V"> V</label></span>
                <span class="rh-group" title="（參考 RR − 目前 RR）÷目前 RR 超過此值判為早搏"><span>變動率 &gt;</span>
                <input type="number" data-role="ectopic-threshold" aria-label="早搏變動率門檻百分比" min="0.1" step="0.1" value="12"><span>%</span></span>
                </div></div>
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
                <span class="rh-group" title="前一個心搏（A 視為 S）的標籤需為勾選的類型；都不勾選表示不限"><span>前一個標籤類型為：</span>
                <label><input type="checkbox" data-previous="V"> V</label>
                <label><input type="checkbox" data-previous="S"> S</label>
                <label><input type="checkbox" data-previous="N"> N</label></span>
                <span class="rh-group" title="後一個心搏（A 視為 S）的標籤需為勾選的類型；都不勾選表示不限"><span>後一個標籤為：</span>
                <label><input type="checkbox" data-next="V"> V</label>
                <label><input type="checkbox" data-next="S"> S</label>
                <label><input type="checkbox" data-next="N"> N</label></span>
                <span class="rh-group rh-type" title="依心搏的形態分類（Morphology type）篩選；多個 type 以逗號分隔，例如 1,155；勾選才啟用">
                <label title="啟用 type 條件"><input type="checkbox" data-role="type-enabled" aria-label="啟用 type 條件"></label>
                <select data-role="type-mode" aria-label="type 條件"><option value="exclude">排除</option><option value="only">限於</option></select>
                <span>type</span><input type="text" data-role="type-list" aria-label="type 清單" placeholder="輸入 type 數字，多個以小逗號分隔" autocomplete="off"></span>
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
        const typeToggle = rangeHint.querySelector('[data-role="type-enabled"]');
        const updateType = () => {
            for (const role of ['type-mode', 'type-list']) rangeHint.querySelector(`[data-role="${role}"]`).disabled = !typeToggle.checked;
        };
        typeToggle.addEventListener('change', updateType);
        updateType();
        for (const name of ['mousedown', 'mouseup', 'click', 'keydown', 'keyup']) {
            rangeHint.addEventListener(name, e => e.stopPropagation());
        }
    }
    // 將面板轉為 BPM、變動率、來源標籤與 type 條件；未勾選的上下限以 null 表示，未勾選 type 時 types 為 null。
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
        // 前一個標籤：都不勾選時為 null（不限）。
        const previous = [...rangeHint.querySelectorAll('[data-previous]:checked')].map(el => el.dataset.previous);
        const next = [...rangeHint.querySelectorAll('[data-next]:checked')].map(el => el.dataset.next);
        let types = null;
        if (rangeHint.querySelector('[data-role="type-enabled"]')?.checked) {
            types = { mode: rangeHint.querySelector('[data-role="type-mode"]').value === 'only' ? 'only' : 'exclude',
                values: parseTypeList(rangeHint.querySelector('[data-role="type-list"]').value) };
        }
        return { enabled: bounds.min !== null || bounds.max !== null, ...bounds, variability, sources, types,
            previous: previous.length ? previous : null, next: next.length ? next : null };
    }
    // type 清單：「1,155」「{1, 155}」皆可，全形逗號、空白也可分隔；只接受非負整數。
    function parseTypeList(text) {
        const parts = String(text || '').replace(/[{}｛｝]/g, ' ').split(/[,，、\s]+/).filter(Boolean);
        if (!parts.length) throw new Error('請在 type 欄位輸入至少一個 type，例如 1,155');
        const invalid = parts.find(part => !/^\d+$/.test(part));
        if (invalid !== undefined) throw new Error(`type「${invalid}」不是有效的數字`);
        return [...new Set(parts.map(part => String(Number(part))))];
    }
    // 更新區間狀態文字；只有已選第一端點且未執行修改時，才顯示可操作的篩選欄位。
    function showRangeHint(text) {
        if (isDisabledPage()) { rangeHint.style.display = 'none'; return; }
        ensureRangeControls();
        rangeResultShown = false;
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
            if (filters.types) {
                // 形態分類取自區間資料的 morphologyType；沒有分類的心搏（例如新增的標籤）不算在清單內。
                const morph = data.morphologyType?.[index];
                const listed = morph !== undefined && morph !== null && filters.types.values.includes(String(Number(morph)));
                if (filters.types.mode === 'only' ? !listed : listed) continue;
            }
            // 前一個標籤以修改前的標籤判斷；沒有前一心搏時不猜測。
            if (filters.previous && (!i || !filters.previous.includes(normalize(beats[i - 1][1])))) continue;
            // 後一個標籤同理；區間最後一顆之後沒有心搏時不修改。
            if (filters.next && (i === beats.length - 1 || !filters.next.includes(normalize(beats[i + 1][1])))) continue;
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
    // 由 cursor 往後讀取下一個有效心搏（N/S/A/V）寫入 effective，供「後一個標籤」條件使用；未儲存修改優先。
    // 網站的相鄰心搏 API：direction 1 為前一顆、0 為後一顆；只採用 cursor 之後的結果。回傳讀到的位置（沒有則為 null）。
    async function addFollowingBeat(manager, af, effective, pending, cursor) {
        for (let attempts = 0; attempts < 64; attempts++) {
            const response = await manager.Af.getAdjacentFilteredECGLabel(
                af._vendorId, af._idNumber, af._measureId, cursor, 0);
            const adjacent = response?.plain ? response.plain() : response;
            if (!adjacent || typeof adjacent !== 'object') throw new Error('無法讀取後一心搏');
            const entries = Object.entries(adjacent).map(([index, type]) => [Number(index), type])
                .filter(([index]) => Number.isFinite(index) && index > cursor).sort((a, b) => a[0] - b[0]);
            if (!entries.length) return null;
            const [index, type] = entries[0];
            const edit = pending.find(item => item[4] && item[1] === index);
            const label = edit ? edit[2] : type;
            effective.set(index, label);
            if (['N', 'S', 'A', 'V'].includes(label)) return index;
            cursor = index;
        }
        throw new Error('後一心搏連續刪除過多，無法確認後一個標籤');
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
    // ── 早搏判讀：依 RR 判斷區間內每顆心搏是否提早出現（早搏），再依結尾按鍵修改勾選的原標籤。
    // 變動率與 Isolated S 規則相同：（參考 RR − 目前 RR）/ 目前 RR，超過門檻（預設 12%）即為早搏。
    // 早搏後常有代償間歇（長 RR），之後可能再慢一拍才恢復；若拿這些長 RR 當參考，恢復正常的心搏
    // 也會被判為早搏並一路連鎖下去。因此參考 RR 另以「正常心律基準」限制：
    //   基準 = 最近 8 個乾淨 RR 的中位數；早搏本身、早搏後的間歇與再下一個 RR 都不算乾淨。
    //   前一個 RR 乾淨時，參考 = min(前一個 RR, 基準)：必須同時比前一拍與正常心律提早。
    //   前一顆是早搏（連發）或前一個 RR 落在早搏後的恢復期時，只與基準比較。
    const ECTOPIC_BASELINE_COUNT = 8;
    const ECTOPIC_BASELINE_LONG = 1.5; // 比基準長 1.5 倍以上的 RR（漏拍、雜訊）不納入基準
    const ectopicMedian = values => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = sorted.length >> 1;
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    // 備用基準：區間前後已是成串的 Bigeminy／Trigeminy 等（找不到乾淨 RR）時使用，依現有標籤推算正常 RR：
    //   1. 前後皆為 N 的 RR（Trigeminy 的 N→N）；
    //   2. 沒有時，用「N → 早搏… → N」整個週期平均到每一拍（Bigeminy：早搏 RR 加上代償間歇約為兩個正常 RR）。
    // 兩者都沒有（例如整段都是 SVT）時回傳 null，不判讀，避免把真正的早搏改掉。
    function ectopicFallbackBaseline(beats) {
        const isEctopic = type => type === 'V' || type === 'S';
        const nn = [];
        for (let i = 1; i < beats.length; i++) {
            if (!isEctopic(beats[i][1]) && !isEctopic(beats[i - 1][1])) nn.push(beats[i][0] - beats[i - 1][0]);
        }
        if (nn.length >= 2) return ectopicMedian(nn);
        const cycles = [];
        let lastNormal = -1;
        for (let i = 0; i < beats.length; i++) {
            if (isEctopic(beats[i][1])) continue;
            if (lastNormal >= 0 && i - lastNormal >= 2) cycles.push((beats[i][0] - beats[lastNormal][0]) / (i - lastNormal));
            lastNormal = i;
        }
        return cycles.length ? ectopicMedian(cycles) : null;
    }
    // trace（測試頁用）：傳入陣列時，逐顆記錄判讀時使用的基準、參考 RR 與變動率。
    function planEctopic(beats, start, end, sources, tag, threshold, trace = null) {
        const ectopic = [];
        const clean = []; // clean[i]：RR_i（第 i-1 顆到第 i 顆）可作為正常心律參考
        const baselineRR = [];
        const changes = new Map();
        let premature = 0, unknown = 0;
        const median = ectopicMedian;
        let fallback; // 需要時才計算
        for (let i = 0; i < beats.length; i++) {
            const [index, type] = beats[i];
            const rr = i > 0 ? index - beats[i - 1][0] : NaN;
            let baseline = baselineRR.length ? median(baselineRR.slice(-ECTOPIC_BASELINE_COUNT)) : null;
            if (baseline === null && index >= start) {
                if (fallback === undefined) fallback = ectopicFallbackBaseline(beats);
                baseline = fallback;
            }
            const judged = index >= start && index <= end && sources.includes(type);
            let isEctopic = type === 'V' || type === 'S';
            let reference = null, rate = null;
            if (judged) {
                if (rr > 0) {
                    const previousClean = i >= 2 && clean[i - 1] && !ectopic[i - 1];
                    const previousRR = i >= 2 ? beats[i - 1][0] - beats[i - 2][0] : NaN;
                    if (previousClean && previousRR > 0) reference = baseline === null ? previousRR : Math.min(previousRR, baseline);
                    else reference = baseline;
                }
                if (reference === null) {
                    unknown++; // 沒有可信的參考 RR：不修改，也不改變後續判斷用的類型
                } else {
                    rate = (reference - rr) / rr;
                    isEctopic = rate > threshold;
                    if (isEctopic) premature++;
                    const target = tag === 'N' ? (isEctopic ? null : 'N') : (isEctopic ? tag : null);
                    if (target && target !== type) changes.set(index, target);
                }
            }
            ectopic[i] = isEctopic;
            clean[i] = i > 0 && rr > 0 && !isEctopic && !ectopic[i - 1] && !(i >= 2 && ectopic[i - 2])
                && (baseline === null || rr < baseline * ECTOPIC_BASELINE_LONG);
            if (clean[i]) baselineRR.push(rr);
            trace?.push({ baseline, reference, rate, judged, ectopic: isEctopic, clean: clean[i] });
        }
        return { changes, premature, unknown };
    }
    function readEctopicOptions() {
        const sources = [...rangeHint.querySelectorAll('[data-ectopic-source]:checked')].map(el => el.dataset.ectopicSource);
        if (!sources.length) throw new Error('請至少勾選一種要修改的原標籤');
        const input = rangeHint.querySelector('[data-role="ectopic-threshold"]');
        const threshold = Number(input.value) / 100;
        if (!input.value.trim() || !Number.isFinite(threshold) || threshold <= 0) throw new Error('請輸入大於 0 的變動率門檻');
        return { sources, threshold };
    }
    async function applyEctopicRange(first, last, tag, options) {
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
        // 開頭前多讀幾顆心搏，建立正常心律基準。
        const firstIndex = [...effective.keys()].reduce((min, index) =>
            Number.isFinite(index) && index >= start ? Math.min(min, index) : min, Infinity);
        if (Number.isFinite(firstIndex)) await addPrecedingBeats(manager, af, effective, pending, firstIndex, ECTOPIC_BASELINE_COUNT + 2);
        if (isDisabledPage() || rangeMode?.cancelled || !first.parent || first.parent.$$destroyed ||
            first.parent.af !== af || first.modifiedData !== af.ecgAnno.modifiedData)
            throw new Error('報告已切換，取消區間修改');
        for (const item of pending) if (item[4] && item[1] <= end) effective.set(item[1], item[2]);
        const beats = [...effective].filter(([index, type]) => Number.isFinite(index) && index <= end && ['N', 'S', 'A', 'V'].includes(type))
            .map(([index, type]) => [index, type === 'A' ? 'S' : type]).sort((a, b) => a[0] - b[0]);
        const plan = planEctopic(beats, start, end, options.sources, tag, options.threshold);
        const updates = [...plan.changes].map(([index, type]) => {
            const existing = pending.find(item => item[4] && item[1] === index);
            const original = existing ? existing[3] : data.anno[index] || type;
            return [first.startTime + Math.floor((index - first.viewStart) / first.rate), index, type, original, 1];
        });
        first.parent.$apply(() => {
            const indices = new Set(updates.map(item => item[1]));
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i][4] && indices.has(pending[i][1])) pending.splice(i, 1);
            }
            pending.push(...updates);
        });
        return { changed: updates.length, premature: plan.premature, unknown: plan.unknown };
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
        const needsIntervals = filters.enabled || filters.variability?.enabled || !!filters.previous;
        if (needsIntervals) {
            // 使用網站原生的相鄰心搏 API；不擴張 ECG 波形讀取範圍或改變 src 對應。
            const firstIndex = [...effective.keys()].reduce((min, index) =>
                Number.isFinite(index) && index >= start ? Math.min(min, index) : min, Infinity);
            if (Number.isFinite(firstIndex)) {
                await addPrecedingBeats(manager, af, effective, pending, firstIndex, filters.variability?.enabled ? 2 : 1);
            }
        }
        // 後一個標籤：區間最後一顆之後的心搏不在讀取範圍內，另外讀取一顆。
        let followingEnd = end;
        if (filters.next) {
            const lastIndex = [...effective.keys()].reduce((max, index) =>
                Number.isFinite(index) && index >= start && index <= end ? Math.max(max, index) : max, -Infinity);
            if (Number.isFinite(lastIndex)) {
                followingEnd = (await addFollowingBeat(manager, af, effective, pending, lastIndex)) ?? Infinity;
            }
        }
        // 所有非同步讀取完成後，再確認報告與未儲存資料仍一致。
        if (isDisabledPage() || rangeMode?.cancelled || !first.parent || first.parent.$$destroyed ||
            first.parent.af !== af || first.modifiedData !== af.ecgAnno.modifiedData)
            throw new Error('報告已切換，取消區間修改');
        for (const item of pending) {
            // 結尾之後到後一顆心搏之間的未儲存修改（例如剛新增的標籤）也算在內。
            if (item[4] && item[1] <= followingEnd && (needsIntervals || item[1] >= start)) effective.set(item[1], item[2]);
        }
        const updates = getRangeUpdates(effective, pending, data, first, start, end, tag, filters);
        first.parent.$apply(() => {
            const indices = new Set(updates.map(item => item[1]));
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i][4] && indices.has(pending[i][1])) pending.splice(i, 1);
            }
            // 與原始資料相同（例如刪除尚未儲存的新增標籤）：只撤銷未儲存修改。
            pending.push(...updates.filter(item => item[2] !== item[3]));
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
    // Alt 拖曳的標籤列：按在標籤列上就是該列；按在心電圖波形上（包含事件清單卡片上覆蓋波形的 graphy-cover）
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
        // 在波形上按 Alt 也比照標籤列：拖曳最近的標籤，並攔下網站對波形的點擊（例如 Pause 清單切換排除類型）。
        const marker = isDragModifier(event) ? dragMarkerAt(event) : null;
        if (event.button === 0 && isDragModifier(event) && marker && !isDisabledPage()) {
            event.preventDefault(); event.stopImmediatePropagation();
            dragClickUntil = Date.now() + 400;
        }
        if (event.button !== 0 || !isDragModifier(event) || event.shiftKey || event.ctrlKey || event.metaKey
            || isDisabledPage() || rangeMode || rangeBusy || labelDrag) return;
        // 按在標籤上就拖曳該標籤；按在標籤列空白處則吸過最近的標籤，直接移到游標位置後可繼續拖曳。
        let label = event.target.closest?.('.annoText');
        if (!label && marker) label = findNearestDraggableLabel(marker, event.clientX);
        const svg = label?.closest('svg.ecgRMarker');
        if (!svg || !label.closest(TARGET_BLOCK_SELECTOR)) return;
        // Alt 點擊不送入原生循環分類，即使目前標籤不可編輯也不變更分類。
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
        // Alt 只需在開始時按住；之後放開 Alt 仍可繼續拖曳（方便拖曳中按數字鍵），放開滑鼠才結束。
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
            const altOnMarker = isDragModifier(event) && event.button === 0 && !isDisabledPage() && dragMarkerAt(event);
            // 拖曳放開後只吞掉滑鼠實際產生的那一次點擊；數字鍵模擬的點擊（isTrusted 為 false）不受影響，
            // 拖完可以立刻按 1／2／3 修改。
            const afterDrag = event.isTrusted && event.button === 0 && Date.now() < dragClickUntil;
            if (altOnMarker || labelDrag || afterDrag) {
                event.preventDefault(); event.stopImmediatePropagation();
                if (afterDrag && name === 'click') dragClickUntil = 0;
            }
        }, true);
    }
    // 拖曳中：1／2／3 把這顆標籤改為 V／S／N（以實體按鍵判斷，按住 Alt 也可），放開滑鼠時連同新位置一起送出；Esc 取消。
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
    // 拖曳中不開啟右鍵選單。
    document.addEventListener('contextmenu', event => {
        if (isDisabledPage()) return;
        if (labelDrag) {
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
            showRangeHint('請在 ECG 上按 Shift + 1／2／3／4 選取端點');
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
            // Shift+4（刪除）只用於篩選修改；其他分頁保留第一端點，改按 Shift+1／2／3。
            if (tag === 'X' && rangeTool !== 'filter') {
                showRangeHint('Shift + 4 刪除只能用於篩選修改，請改按 Shift + 1／2／3 或切換分頁');
                return;
            }
            if (rangeTool === 'ectopic') {
                let options;
                try { options = readEctopicOptions(); }
                catch (error) { showRangeHint(error.message); return; }
                mode.tag = tag;
                rangeBusy = true;
                showRangeHint(`正在判讀早搏 → ${tag}…`);
                const result = await applyEctopicRange(mode.first, context, tag, options);
                rangeMode = null;
                const notes = [`判為早搏 ${result.premature} 顆`];
                if (result.unknown) notes.push(`${result.unknown} 顆缺少參考 RR，未判讀`);
                showRangeHint((result.changed ? `已修改 ${result.changed} 個標籤 → ${tag}` : '沒有需要變更的標籤')
                    + ` · ${notes.join(' · ')}` + (result.changed ? ' · 尚未儲存' : ''));
                return;
            }
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
            const action = tag === 'X' ? '刪除' : `→ ${tag}`;
            showRangeHint(`正在篩選區間標籤 ${action}…`);
            const count = await applyIndexRange(mode.first, context, tag, filters);
            rangeMode = null;
            showRangeHint(!count ? '沒有符合條件且需要變更的標籤'
                : tag === 'X' ? `已刪除 ${count} 個標籤 · 尚未儲存` : `已修改 ${count} 個標籤 → ${tag} · 尚未儲存`);
        } catch (error) {
            failed = true;
            const detail = error?.message || (error?.status ? `資料讀取失敗（HTTP ${error.status}）` : '區間修改失敗，請重新選取');
            showRangeHint(detail);
            rangeMode = null;
        } finally {
            if (rangeBusy) {
                rangeBusy = false;
                if (!rangeMode) rangeResultShown = true;
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
        // 結果提示顯示中不攔截 Esc，讓網頁原本的 Esc 功能照常運作，提示則等計時自動收起。
        if (e.key === 'Escape' && !rangeMode && rangeResultShown && !rangeHint.contains(e.target)) return;
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

        // 區間面板開啟（已選第一端點）時，1／2／3 不標註，改為切換分頁；Shift+1/2/3 仍用來選第二端點。
        const tabDigit = /^(?:Digit|Numpad)([123])$/.exec(e.code || '')?.[1];
        if (tabDigit && rangeMode?.first && !rangeBusy && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!e.repeat) {
                rangeTool = ['filter', 'fill', 'ectopic'][tabDigit - 1];
                updateRangeTool();
            }
            return;
        }

        const key = e.key.toLowerCase();
        const isAltPressed = e.altKey;
        // Mac 的 Option+數字會輸出 ¡ ™ £ 等符號，改以實體按鍵位置判斷數字鍵。
        const labelKey = /^Digit([1-4])$/.exec(e.code || '')?.[1] || key;
        // W / S 縮放只處理無修飾鍵的按鍵，保留 Ctrl+S 等瀏覽器快捷鍵。
        if (['w', 's'].includes(key) && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) return;
        // Shift + 數字的 e.key 會變成 ! @ # 等符號，改以實體按鍵位置判斷（含數字鍵盤）。
        const rangeDigit = /^(?:Digit|Numpad)([1-4])$/.exec(e.code || '')?.[1];
        if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && rangeDigit) {
            // 區間端點與一般數字標註鍵使用相同的滑鼠容器限制。
            if (!getActiveBlockUnderMouse()) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!rangeBusy && !e.repeat) {
                await selectRangePoint({ '1': 'V', '2': 'S', '3': 'N', '4': 'X' }[rangeDigit]);
            }
            return;
        }
        // A / D 以實體按鍵位置判斷（大小寫、輸入法不影響）；選印清單開啟時交給選印清單切換上一張／下一張。
        const halfStep = !review && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !e.isComposing
            ? { KeyA: -1, KeyD: 1 }[e.code] : undefined;
        const movesECG = !!halfStep || ['q', 'e', '<', '>', ',', '.', 'arrowleft', 'arrowright', 'w', 's', 'arrowup', 'arrowdown'].includes(key);
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
        if (halfStep && halfStepECG(halfStep)) {
            e.preventDefault();
            e.stopImmediatePropagation();
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
    // Max HR sinus 的「排除高於 Max HR」開關：預設關閉，開啟後保留到重新整理頁面。
    // 上限讀取 Max HR 方塊目前的數值（含手動修改）；每張心電圖的平均 HR 取自網站 Max HR 清單的 [時間, HR]。
    let hrAboveMaxExcludeOn = false;
    function getMaxHRLimit(af) {
        const value = Number(af?.record?.maxHR?.record);
        return Number.isFinite(value) && value > 0 ? value : null;
    }
    // 網站各 HR 清單的 [時間, 平均 HR]；同一時間以第一筆為準（與未排除時卡片顯示的相同）。
    const HR_VALUE_LISTS = { minHR: ['slowAvgHR'], maxHR: ['fastAvgHR'], maxSinus: ['maxSinusHR', 'fastAvgHR'] };
    function getHRValueMap(af, type = 'maxSinus') {
        const map = new Map();
        for (const key of HR_VALUE_LISTS[type] || []) {
            const list = af?.maxMinAvgHR?.[key];
            if (!Array.isArray(list)) continue;
            for (const entry of list) {
                const time = Number(Array.isArray(entry) ? entry[0] : NaN);
                const hr = Number(Array.isArray(entry) ? entry[1] : NaN);
                if (Number.isFinite(time) && Number.isFinite(hr) && !map.has(time)) map.set(time, hr);
            }
        }
        return map;
    }
    // 平均 HR 高於上限的心電圖排除（等於上限保留）；讀不到 HR 的保留。
    function excludeAboveHR(items, limit, hrByTime) {
        if (limit === null) return items;
        return items.filter(value => {
            const hr = hrByTime.get(toEventTime(value));
            return hr === undefined || hr <= limit;
        });
    }
    function getHRAboveLimit(context) {
        return context.type === 'maxSinus' && hrAboveMaxExcludeOn ? getMaxHRLimit(context.af) : null;
    }
    // Max HR sinus 的「排除含 V／S」開關：預設關閉，開啟後保留到重新整理頁面。
    // 網站時間軸的 V／S 時間（tmsPVC、VEBAPos 等）要 Group 後才更新，會留著已改為 N 的舊標籤，
    // 因此開啟時逐張向伺服器讀取 10 秒心電圖的標籤（最多同時 QUICK_FETCH_CONCURRENCY 張，結果快取），
    // 並套用未儲存的標籤修改。起點起 10 秒內含任一 V 或 S（A 視為 S）即排除；讀取失敗的保留。
    let hrEctopicExcludeOn = false;
    const ectopicStripCache = new Map(); // `${measureId}|${時間}` → 心電圖資料（失敗為 null）
    const ectopicCheck = { running: false, done: 0, total: 0 };
    function ectopicStripKey(af, time) {
        return `${af?._measureId}|${time}`;
    }
    function stripHasEctopic(data, modifiedData, start) {
        return effectiveEventBeats(data, modifiedData, start)
            .some(beat => beat.type !== 'N' && beat.offset >= 0 && beat.offset < HR_STRIP_SECONDS);
    }
    // 已確認含 V／S 的心電圖時間；尚未讀取的不列入（保留），並在背景開始讀取。
    function getHREctopicSet(context) {
        if (context.type !== 'maxSinus' || !hrEctopicExcludeOn) return null;
        const all = getHRSourceItems(context) || [];
        const found = new Set();
        const missing = [];
        for (const value of all) {
            const time = toEventTime(value);
            if (time === null) continue;
            const key = ectopicStripKey(context.af, time);
            if (!ectopicStripCache.has(key)) { missing.push(time); continue; }
            const data = ectopicStripCache.get(key);
            if (data && stripHasEctopic(data, context.af.ecgAnno?.modifiedData, time)) found.add(time);
        }
        if (missing.length) checkEctopicStrips(context.af, missing);
        return found;
    }
    async function checkEctopicStrips(af, times) {
        if (ectopicCheck.running) return;
        const pending = [...new Set(times)];
        ectopicCheck.running = true;
        ectopicCheck.done = 0;
        ectopicCheck.total = pending.length;
        scheduleHRList();
        try {
            await runLimited(pending, QUICK_FETCH_CONCURRENCY, async time => {
                let data = null;
                try { data = await fetchEventECG(af, time, 0, HR_STRIP_SECONDS); } catch (_) { /* 讀取失敗的保留 */ }
                ectopicStripCache.set(ectopicStripKey(af, time), data);
            }, done => { ectopicCheck.done = done; scheduleHRList(); });
        } finally {
            ectopicCheck.running = false;
        }
        // 讀完後依目前清單重新套用排除。
        const dialog = document.querySelector('#af-hr-dialog');
        const context = dialog && isHRDialogShown(dialog) ? getHRListContext(dialog) : null;
        if (context && hrEctopicExcludeOn) reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        scheduleHRList();
    }
    function excludeEctopicItems(items, ectopicSet) {
        if (!ectopicSet?.size) return items;
        return items.filter(value => !ectopicSet.has(toEventTime(value)));
    }
    function isHRFilterActive(context) {
        return hrExclusion.anchors.length > 0 || getHRAFRanges(context).length > 0 || getHRAboveLimit(context) !== null
            || (getHREctopicSet(context)?.size || 0) > 0;
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
    // 依序排除 AF 時段、高於 Max HR、含 V／S，最後套用 ±1 分錨點；保留各階段結果供標題列計數。
    function getHRFilteredItems(context, all) {
        const afKept = excludeAFItems(all, getHRAFRanges(context));
        const belowMax = excludeAboveHR(afKept, getHRAboveLimit(context), getHRValueMap(context.af));
        const sinus = excludeEctopicItems(belowMax, getHREctopicSet(context));
        return { afKept, belowMax, sinus, kept: hrExclusion.anchors.length ? filterHRItems(sinus, hrExclusion.anchors) : sinus };
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
    function toggleHRAboveMaxExclusion(dialog) {
        const context = getHRListContext(dialog);
        if (!context) return;
        hrExclusion.type = context.type;
        hrAboveMaxExcludeOn = !hrAboveMaxExcludeOn;
        reapplyHRExclusion(context, currentHRFocusTime(context.eventDialog));
        decorateHRList();
    }
    function toggleHREctopicExclusion(dialog) {
        const context = getHRListContext(dialog);
        if (!context) return;
        hrExclusion.type = context.type;
        hrEctopicExcludeOn = !hrEctopicExcludeOn;
        // 每次開啟都重新讀取，反映上次之後已儲存的標籤修改。
        if (hrEctopicExcludeOn && !ectopicCheck.running) ectopicStripCache.clear();
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
                if (hrReapplyTimes.length >= 8) {
                    resetHRExclusion();
                    hrAFExcludeOn = false;
                    hrAboveMaxExcludeOn = false;
                    hrEctopicExcludeOn = false;
                    return;
                }
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
        // 網站卡片的「HR:」依清單位置讀取（maxMinAvgHR.*[indexAdjust + $index]），排除後位置對不上；
        // 清單由腳本重新分頁時，改依心電圖時間顯示正確的 HR，並隱藏網站的數值。
        const filteredPages = !!hrExclusion.pages && eventDialog.pageData === hrExclusion.pages;
        const cardHR = filteredPages ? getHRValueMap(context.af, context.type) : null;
        for (const card of dialog.querySelectorAll(HR_CARD_SELECTOR)) {
            const header = card.querySelector('.event-blk-header');
            if (!header) continue;
            const siteHR = header.querySelector('.event-infor-blk .stat-result b');
            let fixedHR = header.querySelector('.rc-hr-true');
            const hr = cardHR?.get(getHRCardTime(card));
            if (siteHR && hr !== undefined) {
                if (!fixedHR || fixedHR.previousElementSibling !== siteHR) {
                    fixedHR?.remove();
                    fixedHR = document.createElement('b');
                    fixedHR.className = 'rc-hr-true';
                    siteHR.after(fixedHR);
                }
                const text = `${hr}bpm`;
                if (fixedHR.textContent !== text) fixedHR.textContent = text;
                siteHR.style.display = 'none';
            } else {
                fixedHR?.remove();
                if (siteHR?.style.display) siteHR.style.display = '';
            }
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
        const { afKept, belowMax, sinus, kept } = getHRFilteredItems(context, all);
        const excluded = hrExclusion.anchors.length ? Math.max(0, sinus.length - kept.length) : 0;
        const toolbar = dialog.querySelector('.data-tool-blk .float-left');
        let afToggle = dialog.querySelector('.rc-hr-af:not(.rc-hr-above-max):not(.rc-hr-ectopic)');
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
                ? `<span class="rc-hr-icon">⊘</span>已排除 AF 時段<span class="rc-hr-count">${all.length - afKept.length}</span>`
                : '<span class="rc-hr-icon">○</span>排除 AF 時段';
            if (afToggle.innerHTML !== html) afToggle.innerHTML = html;
            afToggle.title = on ? '已排除與 AF 時段重疊的心電圖；按下關閉' : '按下排除與 AF 時段重疊的心電圖';
            afToggle.setAttribute('aria-pressed', String(on));
            afToggle.classList.toggle('is-on', on);
            afToggle.classList.toggle('is-visible', hasAF);
        }
        // 排除高於 Max HR：與 AF 開關同樣式，只在 Max HR sinus 清單且讀得到 Max HR 時顯示。
        let maxToggle = dialog.querySelector('.rc-hr-above-max');
        if (!maxToggle && toolbar) {
            maxToggle = document.createElement('button');
            maxToggle.type = 'button';
            maxToggle.className = 'rc-hr-af rc-hr-above-max';
            maxToggle.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                toggleHRAboveMaxExclusion(dialog);
            });
            (afToggle?.nextSibling ? toolbar.insertBefore(maxToggle, afToggle.nextSibling) : toolbar.appendChild(maxToggle));
        }
        if (maxToggle) {
            const limit = context.type === 'maxSinus' ? getMaxHRLimit(context.af) : null;
            const on = limit !== null && hrAboveMaxExcludeOn;
            const html = on
                ? `<span class="rc-hr-icon">⊘</span>已排除高於 Max HR ${limit}<span class="rc-hr-count">${afKept.length - belowMax.length}</span>`
                : `<span class="rc-hr-icon">○</span>排除高於 Max HR${limit !== null ? ` ${limit}` : ''}`;
            if (maxToggle.innerHTML !== html) maxToggle.innerHTML = html;
            maxToggle.title = on ? `已排除平均 HR 高於 Max HR（${limit} bpm）的心電圖；按下關閉`
                : '按下排除平均 HR 高於 Max HR 的心電圖';
            maxToggle.setAttribute('aria-pressed', String(on));
            maxToggle.classList.toggle('is-on', on);
            maxToggle.classList.toggle('is-visible', limit !== null);
        }
        // 排除含 V／S：與其他開關同樣式，只在 Max HR sinus 清單且有 V／S 資料時顯示。
        let ectopicToggle = dialog.querySelector('.rc-hr-ectopic');
        if (!ectopicToggle && toolbar) {
            ectopicToggle = document.createElement('button');
            ectopicToggle.type = 'button';
            ectopicToggle.className = 'rc-hr-af rc-hr-ectopic';
            ectopicToggle.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation();
                toggleHREctopicExclusion(dialog);
            });
            const after = maxToggle || afToggle;
            (after?.nextSibling ? toolbar.insertBefore(ectopicToggle, after.nextSibling) : toolbar.appendChild(ectopicToggle));
        }
        if (ectopicToggle) {
            const visible = context.type === 'maxSinus';
            const on = visible && hrEctopicExcludeOn;
            const checking = on && ectopicCheck.running;
            const html = checking
                ? `<span class="rc-hr-icon">⋯</span>檢查 V／S 中 ${ectopicCheck.done}/${ectopicCheck.total}`
                : on ? `<span class="rc-hr-icon">⊘</span>已排除含 V／S<span class="rc-hr-count">${belowMax.length - sinus.length}</span>`
                    : '<span class="rc-hr-icon">○</span>排除含 V／S';
            if (ectopicToggle.innerHTML !== html) ectopicToggle.innerHTML = html;
            ectopicToggle.title = on ? '已排除 10 秒內有 V 或 S 標籤的心電圖（含未儲存的標籤修改）；按下關閉'
                : '按下排除 10 秒內有 V 或 S 標籤的心電圖（逐張讀取標籤，含未儲存的修改）';
            ectopicToggle.setAttribute('aria-pressed', String(on));
            ectopicToggle.classList.toggle('is-on', on);
            ectopicToggle.classList.toggle('is-visible', visible);
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

    // Tachy／Brady 事件清單：在網站的 invert（全部）按鈕前加入單頁 Invert，樣式沿用 Pause 清單的單頁 Invert。
    // 網站點一張心電圖會依序切換狀態（Tachy：none → artifact → psvt → vt；Brady：none ↔ artifact），
    // 這裡只在 none 與 artifact 之間切換：本頁有未修改的就全改為 artifact，全部已是 artifact 時改回 none；
    // 手動設為 psvt／vt 的不變。每張的處理與網站點擊相同（取消該張選印、寫入未儲存修改）。
    const PAGE_INVERT_TYPES = ['tachy', 'brady'];
    function getPageInvertScope(dialog) {
        let scope;
        try { scope = window.angular?.element(dialog).scope?.(); } catch (_) { return null; }
        const af = scope?.af;
        if (!af || !PAGE_INVERT_TYPES.includes(af.eventDialog?.dscp?.type)) return null;
        if (typeof scope.setEventOperationSelected !== 'function' || typeof scope.selectPrintedEvent !== 'function') return null;
        return scope;
    }
    function invertEventPage(dialog) {
        const scope = getPageInvertScope(dialog);
        const items = scope?.af.eventDialog.currentData;
        if (!scope || !scope.af.editingSwitch || scope.af.loading?.ecg || !Array.isArray(items) || !items.length) return;
        const stateOf = item => item.selectedType || 'none';
        const toArtifact = items.some(item => stateOf(item) === 'none');
        const [from, to] = toArtifact ? ['none', 'artifact'] : ['artifact', 'none'];
        scope.$apply(() => {
            scope.af.ecgEnlargedChart.psSwitch = false;
            for (const item of items) {
                if (stateOf(item) !== from) continue;
                item.selectedEvent = false;
                scope.selectPrintedEvent(item);
                item.selectedType = to;
                item.chkDisabled = to !== 'none';
                scope.setEventOperationSelected(item);
            }
        });
    }
    function decorateEventPageInvert() {
        for (const button of document.querySelectorAll('.rc-page-invert')) {
            const dialog = button.closest('#af-event-dialog');
            if (isDisabledPage() || !dialog || !getPageInvertScope(dialog)
                || !button.nextElementSibling?.matches('[ng-click="pausesubOperation()"]')) button.remove();
        }
        if (isDisabledPage()) return;
        for (const all of document.querySelectorAll('#af-event-dialog .tool-btns > [ng-click="pausesubOperation()"]')) {
            const dialog = all.closest('#af-event-dialog');
            if (!getPageInvertScope(dialog)) continue;
            let button = all.previousElementSibling;
            if (!button?.classList.contains('rc-page-invert')) {
                button = document.createElement('div');
                button.className = 'tool-btn invertselect-btn rc-page-invert';
                button.title = '單頁 Invert：本頁未修改的改為 artifact；本頁已全部是 artifact 時改回未修改（psvt／vt 不變）';
                button.innerHTML = '<div class="invertselect-page-icon"></div><span class="smaller-font-size-11">Invert</span>';
                button.addEventListener('click', event => {
                    event.preventDefault(); event.stopPropagation();
                    invertEventPage(button.closest('#af-event-dialog'));
                });
                all.before(button);
            }
            // 與網站的 invert 按鈕同時顯示（編輯模式、非 iPad 列印）。
            const hidden = all.classList.contains('ng-hide');
            if (button.classList.contains('ng-hide') !== hidden) button.classList.toggle('ng-hide', hidden);
        }
    }
    let pageInvertPending = false;
    function schedulePageInvert() {
        if (pageInvertPending) return;
        pageInvertPending = true;
        requestAnimationFrame(() => { pageInvertPending = false; decorateEventPageInvert(); });
    }
    new MutationObserver(schedulePageInvert).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // Spéc.（specifics）清單：網站沒有 invert 按鈕，這裡在放大鏡前加入「Invert」（本頁）與「Invert all」（整個清單），
    // 功能是取消星星（Ajouter aux spécificités）。每張都走網站點星星的 selectSpecificEvent：
    // 同時移除備註文字與選印，寫入未儲存修改，按 Save 才會儲存（編輯模式）。
    // 取消後若星星與選印都沒有再變動，再按一次同一個按鈕會把剛剛取消的星星、備註與選印加回來。
    function getSpecificListScope(dialog) {
        let scope;
        try { scope = window.angular?.element(dialog).scope?.(); } catch (_) { return null; }
        if (scope?.af?.eventDialog?.dscp?.type !== 'specifics' || typeof scope.selectSpecificEvent !== 'function') return null;
        return scope;
    }
    // 網站備註存放的位置不明，因此取消前把星星、選印與清單相關資料做快照，
    // 還原時只把「取消星星」與「重新加星星」改動到的欄位改回快照的值（陣列、物件就地更新，保留網站的參照）。
    const SNAPSHOT_SKIP = Symbol('skip');
    const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value)
        && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
    function snapshotValue(value, depth = 0, seen = new WeakSet()) {
        if (value === null || typeof value !== 'object') return typeof value === 'function' ? SNAPSHOT_SKIP : value;
        if (depth > 8 || seen.has(value)) return SNAPSHOT_SKIP;
        if (Array.isArray(value)) {
            // 心電圖波形等大型數值陣列與星星、備註、選印無關，不做快照。
            if (value.length > 5000) return SNAPSHOT_SKIP;
            seen.add(value);
            const copy = value.map(item => snapshotValue(item, depth + 1, seen));
            seen.delete(value);
            return copy;
        }
        if (!isPlainObject(value)) return SNAPSHOT_SKIP;
        seen.add(value);
        const copy = {};
        for (const key of Object.keys(value)) {
            if (key.startsWith('$$')) continue;
            copy[key] = snapshotValue(value[key], depth + 1, seen);
        }
        seen.delete(value);
        return copy;
    }
    const isLeafArray = value => value.every(item => item === null || typeof item !== 'object');
    // 找出 a、b 兩份快照中不同的路徑；只含數值的陣列整個當成一個值比較。
    function diffSnapshots(a, b, path = [], out = []) {
        if (a === SNAPSHOT_SKIP || b === SNAPSHOT_SKIP) return out;
        if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && !(isLeafArray(a) && isLeafArray(b))) {
            a.forEach((item, index) => diffSnapshots(item, b[index], [...path, index], out));
        } else if (isPlainObject(a) && isPlainObject(b)) {
            for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diffSnapshots(a[key], b[key], [...path, key], out);
        } else if (JSON.stringify(a) !== JSON.stringify(b)) {
            out.push(path);
        }
        return out;
    }
    const readPath = (root, path) => path.reduce((value, key) => value?.[key], root);
    function cloneSnapshot(value) {
        if (Array.isArray(value)) return value.map(cloneSnapshot);
        if (!isPlainObject(value)) return value === SNAPSHOT_SKIP ? undefined : value;
        const copy = {};
        for (const [key, item] of Object.entries(value)) if (item !== SNAPSHOT_SKIP) copy[key] = cloneSnapshot(item);
        return copy;
    }
    function restoreSnapshotValue(target, snapshot) {
        // 就地更新：陣列與物件保留原本的參照，網站其他地方綁定的資料才會一起更新。
        if (Array.isArray(target) && Array.isArray(snapshot)) {
            const items = snapshot.map((item, index) => item === SNAPSHOT_SKIP ? target[index] : cloneSnapshot(item));
            target.splice(0, target.length, ...items);
            return target;
        }
        if (isPlainObject(target) && isPlainObject(snapshot)) {
            for (const key of Object.keys(target)) if (!key.startsWith('$$') && !(key in snapshot)) delete target[key];
            for (const [key, value] of Object.entries(snapshot)) {
                if (value !== SNAPSHOT_SKIP) target[key] = restoreSnapshotValue(target[key], value);
            }
            return target;
        }
        return cloneSnapshot(snapshot);
    }
    function restorePaths(root, before, paths) {
        // 先處理較短的路徑；已被上層一併還原的子路徑跳過。
        const done = [];
        for (const path of [...paths].sort((a, b) => a.length - b.length)) {
            if (!path.length || done.some(prefix => prefix.every((key, index) => path[index] === key))) continue;
            const parent = readPath(root, path.slice(0, -1));
            const key = path[path.length - 1];
            if (!parent || typeof parent !== 'object') continue;
            let value = before;
            for (const step of path) value = value === undefined || value === SNAPSHOT_SKIP ? undefined : value?.[step];
            if (value === SNAPSHOT_SKIP) continue;
            if (value === undefined) delete parent[key];
            else parent[key] = restoreSnapshotValue(parent[key], value);
            done.push(path);
        }
    }
    function specificSnapshotRoot(af) {
        return {
            specificEvents: af.specificEvents,
            selectedEvents: af.printDialog?.selectedEvents,
            specifics: af.eventDialog?.specifics,
            currentData: af.eventDialog?.currentData,
        };
    }
    // 判斷取消後是否有其他變動：比對星星與選印。
    function specificSignature(af) {
        const tms = [...(af.specificEvents?.modifiedData?.tms || [])].map(Number).sort((a, b) => a - b);
        return JSON.stringify([tms, snapshotValue(af.printDialog?.selectedEvents)]);
    }
    const specificPageTimes = af => (af.eventDialog.currentData || []).map(toEventTime).join(',');
    // 已取消、可還原的紀錄（後進先出）：先按本頁再按全部時，可依序還原。
    const specificUndoStack = [];
    function unstarSpecificList(dialog, all, anchor) {
        const scope = getSpecificListScope(dialog);
        const af = scope?.af;
        const tms = af?.specificEvents?.modifiedData?.tms;
        if (!scope || !af.editingSwitch || af.loading?.ecg || !Array.isArray(tms)) return;
        const top = specificUndoStack[specificUndoStack.length - 1];
        if (top && (top.af !== af || top.signature !== specificSignature(af))) specificUndoStack.length = 0;
        const last = specificUndoStack[specificUndoStack.length - 1];
        if (last && last.all === all && (all || last.pageTimes === specificPageTimes(af))) {
            specificUndoStack.pop();
            restoreSpecificList(scope, last, anchor);
            return;
        }
        const starred = time => af.specificEvents.modifiedData.tms.includes(time);
        const pageItems = (af.eventDialog.currentData || []).filter(item => {
            const time = toEventTime(item);
            return time !== null && starred(time);
        });
        const otherTimes = all ? [...new Set((af.eventDialog.specifics?.data || []).flat().map(toEventTime))]
            .filter(time => time !== null && starred(time) && !pageItems.some(item => toEventTime(item) === time)) : [];
        if (!pageItems.length && !otherTimes.length) return;
        const before = snapshotValue(specificSnapshotRoot(af));
        const pageTimes = specificPageTimes(af);
        scope.$apply(() => {
            // 本頁：傳入心電圖物件，網站會一併更新選印勾選狀態；星星圖示由 isSpecific 決定。
            for (const item of pageItems) {
                scope.selectSpecificEvent(item);
                item.isSpecific = false;
            }
            // 其他頁：只取消這個清單裡的時間，傳入時間數值（網站同樣支援）。
            for (const time of otherTimes) scope.selectSpecificEvent(time);
        });
        const after = snapshotValue(specificSnapshotRoot(af));
        specificUndoStack.push({
            af, all, pageTimes, before, after,
            pageTimesRemoved: pageItems.map(toEventTime), otherTimes,
            signature: specificSignature(af),
        });
        quickToast(anchor, `已取消 ${pageItems.length + otherTimes.length} 個星星，再按一次可加回星星、備註與選印`);
    }
    function restoreSpecificList(scope, record, anchor) {
        const af = scope.af;
        const times = [...record.pageTimesRemoved, ...record.otherTimes];
        scope.$apply(() => {
            // 先以網站點星星的方式加回（寫入未儲存修改），再把備註、選印等改回取消前的值。
            for (const time of times) {
                if (af.specificEvents.modifiedData.tms.includes(time)) continue;
                const item = (af.eventDialog.currentData || []).find(entry => toEventTime(entry) === time);
                scope.selectSpecificEvent(item || time);
            }
            const restarred = snapshotValue(specificSnapshotRoot(af));
            const paths = [...diffSnapshots(record.before, record.after), ...diffSnapshots(record.after, restarred)];
            restorePaths(specificSnapshotRoot(af), record.before, paths);
            for (const item of af.eventDialog.currentData || []) {
                if (times.includes(toEventTime(item))) item.isSpecific = true;
            }
        });
        quickToast(anchor, `已加回 ${times.length} 個星星（含備註與選印）`);
    }
    const SPECIFIC_BUTTONS = [
        { all: false, icon: 'invertselect-page-icon', text: 'Invert', title: '單頁 Invert：取消本頁所有星星（連同備註與選印），再按一次加回' },
        { all: true, icon: 'invertselect-icon', text: 'Invert all', title: 'Invert all：取消整個 Spéc. 清單的所有星星（連同備註與選印），再按一次加回' },
    ];
    function decorateSpecificInvert() {
        for (const button of document.querySelectorAll('.rc-specific-invert')) {
            const dialog = button.closest('#af-event-dialog');
            if (isDisabledPage() || !dialog || !getSpecificListScope(dialog)) button.remove();
        }
        if (isDisabledPage()) return;
        for (const zoom of document.querySelectorAll('#af-event-dialog .tool-btns > .zoom-btn')) {
            const dialog = zoom.closest('#af-event-dialog');
            const scope = getSpecificListScope(dialog);
            if (!scope) continue;
            // 與網站其他清單的 invert 按鈕相同：編輯模式、非 iPad 列印才顯示。
            let hidden = !scope.af.editingSwitch;
            try { hidden ||= !!scope.isiPad_inPrint?.(); } catch (_) { /* 沿用編輯模式判斷 */ }
            for (const spec of SPECIFIC_BUTTONS) {
                let button = dialog.querySelector(`.rc-specific-invert[data-all="${spec.all}"]`);
                if (!button) {
                    button = document.createElement('div');
                    button.className = 'tool-btn invertselect-btn rc-specific-invert';
                    button.dataset.all = String(spec.all);
                    button.title = spec.title;
                    button.innerHTML = `<div class="${spec.icon}"></div><span class="smaller-font-size-11">${spec.text}</span>`;
                    button.addEventListener('click', event => {
                        event.preventDefault(); event.stopPropagation();
                        unstarSpecificList(button.closest('#af-event-dialog'), spec.all, button);
                    });
                    zoom.before(button);
                }
                if (button.classList.contains('ng-hide') !== hidden) button.classList.toggle('ng-hide', hidden);
            }
        }
    }
    let specificInvertPending = false;
    function scheduleSpecificInvert() {
        if (specificInvertPending) return;
        specificInvertPending = true;
        requestAnimationFrame(() => { specificInvertPending = false; decorateSpecificInvert(); });
    }
    new MutationObserver(scheduleSpecificInvert).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

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
    // 分頁資料可能是時間、[時間, …] 或含 startTime 的物件；Event Tag 清單為 { tagTime, dataTime }，
    // 網站選印記錄的是 dataTime（沒有時用 tagTime）。
    function toEventTime(value) {
        if (Array.isArray(value)) value = value[0];
        if (value && typeof value === 'object') value = value.startTime ?? value.dataTime ?? value.tagTime ?? value.tms ?? value.time;
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
        if (!pages.length || !events.length) return { groups: [], total: events.length, forced: forced.size, missing: [] };
        const pageByTime = new Map();
        pages.forEach((page, index) => {
            for (const value of Array.isArray(page) ? page : [page]) {
                const time = toEventTime(value);
                if (time !== null && !pageByTime.has(time)) pageByTime.set(time, index + 1);
            }
        });
        const groups = new Map();
        // missing：有選印紀錄但已不在這個清單的心電圖（例如改成 Couplet 後重新 Group，從 Isolated 清單移走）。
        const missing = [];
        for (const time of events) {
            const page = pageByTime.get(time);
            if (!page) { missing.push(time); continue; }
            if (!groups.has(page)) groups.set(page, { page, times: [], forced: 0 });
            const group = groups.get(page);
            group.times.push(time);
            if (forced.has(time)) group.forced++;
        }
        return { groups: [...groups.values()].sort((a, b) => a.page - b.page),
            total: events.length - missing.length, forced: [...forced].filter(time => pageByTime.has(time)).length,
            pageCount: pages.length, missing };
    }
    // 已不在清單中的綠色選印：網站的 Group 不會移除原清單的選印紀錄，
    // 這些心電圖仍會計入報告，但清單上看不到也無法取消。只回傳可用網站取消選印處理的部分。
    // 只在拉條的頁面資料就是目前清單的完整資料時判斷，避免切換清單或載入中把別的清單當成「不在清單」。
    // Manual／Unclassified 清單（openUnclassifiedList，例如 modifiedS）與 Isolated 共用同一組選印紀錄，
    // 但只列出部分心電圖，不能把不在其中的選印當成「已不在清單」。
    // Event Tag 清單（tags）也不自動取消：標籤可能被篩選或另外管理，不依清單內容判斷。
    const ORPHAN_SKIP_TYPE = /^(modified|unclassified|tags$)/i;
    function getOrphanPrints(bar, af, missing, pages) {
        if (!missing?.length || !af?.printDialog?.selectedEvents || !window.angular) return null;
        const key = af.eventDialog?.dscp?.printedEventType;
        const type = af.eventDialog?.dscp?.type;
        if (typeof type !== 'string' || ORPHAN_SKIP_TYPE.test(type)) return null;
        const selected = af.printDialog.selectedEvents[key];
        const source = af.eventDialog?.[type];
        if (!Array.isArray(selected) || !Array.isArray(source?.data) || !Array.isArray(pages)) return null;
        const listTimes = source.data.flat().map(toEventTime).filter(time => time !== null);
        const pageTimes = pages.flatMap(page => Array.isArray(page) ? page : [page]).map(toEventTime).filter(time => time !== null);
        if (!listTimes.length || listTimes.length !== Number(source.itemsLength) || pageTimes.length !== listTimes.length) return null;
        const inList = new Set(listTimes);
        if (pageTimes.some(time => !inList.has(time))) return null;
        let host;
        try { host = window.angular.element(bar).scope(); } catch (_) { return null; }
        while (host && typeof host.selectPrintedEvent !== 'function') host = host.$parent;
        if (!host) return null;
        // 改過標籤、尚未重新 Group 的心搏只在 Manual 清單（af.unclassifiedGroup）裡，
        // 不在 Isolated 等清單中；這些選印（例如 MP 按 5 選印）仍有效，不能取消。
        const manual = af.unclassifiedGroup || {};
        for (const value of [manual.veb, manual.sveb].flatMap(list => Array.isArray(list) ? list : [])) {
            const time = toEventTime(value);
            if (time !== null) inList.add(time);
        }
        // 共用同一組選印紀錄的其他清單（例如 Pause 2-3／3-4／4-5／≥5 秒與 Pause、Isolated 與 4／5 顆 S）
        // 中的心電圖也算在清單中，避免開啟子清單時取消其他清單的選印。
        for (const [name, other] of Object.entries(af.eventDialog || {})) {
            if (name === type || other?.printedEventType !== key || !Array.isArray(other.data)) continue;
            for (const value of other.data.flat()) {
                const time = toEventTime(value);
                if (time !== null) inList.add(time);
            }
        }
        const lost = new Set(missing.filter(time => !inList.has(time)));
        const times = [...new Set(selected.map(toEventTime).filter(time => time !== null && lost.has(time)))].sort((a, b) => a - b);
        return times.length ? { times, host, af, key, type, signature: `${af._measureId}|${key}|${times.join(',')}` } : null;
    }
    // 自動取消不在清單中的選印：同一批連續 1.5 秒都偵測到才處理，處理後以提示訊息告知，不跳確認視窗。
    const ORPHAN_STABLE_MS = 1500;
    const orphanState = { signature: null, since: 0, busy: false };
    function autoClearOrphanPrints(orphans, anchor) {
        if (!orphans || orphanState.busy || review?.grouping) {
            if (!orphans) orphanState.signature = null;
            return;
        }
        if (orphanState.signature !== orphans.signature) {
            orphanState.signature = orphans.signature;
            orphanState.since = Date.now();
            setTimeout(schedulePrintBars, ORPHAN_STABLE_MS + 100);
            return;
        }
        if (Date.now() - orphanState.since < ORPHAN_STABLE_MS) return;
        orphanState.busy = true;
        orphanState.signature = null;
        clearOrphanPrints(orphans, anchor).finally(() => { orphanState.busy = false; schedulePrintBars(); });
    }
    async function clearOrphanPrints(orphans, anchor) {
        const { times, host, af, key, type } = orphans;
        try {
            // 與網站點擊取消選印相同；取消前確認仍是同一個清單。
            if (af.eventDialog?.dscp?.printedEventType !== key || af.eventDialog?.dscp?.type !== type) return;
            host.$apply(() => { for (const time of times) host.selectPrintedEvent({ startTime: time, selectedEvent: false }); });
            await uploadPrintSelections(af);
            const list = times.slice(0, 3).map(time => formatQuickTime({ host }, time)).join('、') + (times.length > 3 ? ' 等' : '');
            quickToast(anchor?.isConnected ? anchor : null, `已自動取消 ${times.length} 張已不在清單中的選印（${list}）`);
        } catch (error) {
            quickToast(anchor?.isConnected ? anchor : null, `取消不在清單中的選印失敗：${error?.message || error}`, true);
        }
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
        if (review && !review.anchor.isConnected && !review.grouping) closePrintReview();
        syncReviewPrints();
        recheckReviewCards();
        decorateReviewDialog();
        drawTagPrintWindows(); // 網站重畫心電圖後補回選印範圍框
        for (const bar of document.querySelectorAll('.pagination-range svg.paginationEventBar')) {
            const range = bar.closest('.pagination-range');
            let scope;
            try { scope = window.angular.element(bar).isolateScope(); } catch (_) { continue; }
            if (!scope) continue;
            watchPrintRange(range);
            let liveForced = null;
            let printAF = null;
            try {
                let parent = window.angular.element(bar).scope();
                while (parent && !parent.af) parent = parent.$parent;
                printAF = parent?.af || null;
                liveForced = getLiveForcedEvents(printAF);
            } catch (_) {}
            const { groups, total, forced, pageCount, missing } = liveForced ? getPrintPages(scope, liveForced) : getPrintPages(scope);
            autoClearOrphanPrints(getOrphanPrints(bar, printAF, missing, scope.pageData), range);
            const current = Number(scope.pageIndex);
            const barWidth = bar.getBoundingClientRect().width;
            // 拉條暫時隱藏或尚未排版時不計算，避免圓點列以錯誤的位置畫出；顯示後由 ResizeObserver 觸發重畫。
            if (!range.offsetWidth || !barWidth) continue;
            // V / S 事件清單另外顯示「快速選印」，沒有選印時也保留按鈕列；Pause、Event Tag 只有選印清單。
            const quick = getQuickContext(bar, true);
            trackCancelledPrints(quick); // 記下使用者取消的選印，快速選印時略過
            const keepPanel = total > 0 || (!!quick && !quick.config.reviewOnly);
            const signature = JSON.stringify([groups, total, current, Math.round(barWidth), quick?.type || '']);
            const existing = range.nextElementSibling?.classList.contains('rc-print-panel') ? range.nextElementSibling : null;
            // 換頁或選印時版面可能短暫變動，圓點列沒對齊拉條就整列重畫。
            const aligned = !existing || Math.abs(existing.getBoundingClientRect().left - range.getBoundingClientRect().left) < 1;
            if (range.dataset.rcPrintSignature === signature && !!existing === keepPanel && aligned) {
                updatePrintActions(existing, quick, total, forced);
                continue;
            }
            range.dataset.rcPrintSignature = signature;

            // 拉條容器為 overflow:hidden，圓點與數量放在緊接其後、同寬置中的獨立列。
            let panel = range.nextElementSibling?.classList.contains('rc-print-panel') ? range.nextElementSibling : null;
            if (!keepPanel) { panel?.remove(); continue; }
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
    // 只提供選印清單（檢視、取消選印），沒有快速選印、換一個、加選與 Group 的清單。
    // tag：Event Tag 清單的項目為 { tagTime, dataTime }，以網站的 openEventTagDialog 開啟心電圖。
    const REVIEW_ONLY_TYPES = {
        pause: { reviewOnly: true, name: 'Pause' },
        pause23: { reviewOnly: true, name: 'Pause 2-3 sec' },
        pause34: { reviewOnly: true, name: 'Pause 3-4 sec' },
        pause45: { reviewOnly: true, name: 'Pause 4-5 sec' },
        pause5: { reviewOnly: true, name: 'Pause ≥5 sec' },
        tags: { reviewOnly: true, tag: true, name: 'Event Tag' },
    };
    const QUICK_MIN_GAP = 60; // 選印心電圖之間至少相隔（秒）
    const QUICK_REJECT_NEAR = 30; // 淘汰過的心電圖前後這麼多秒內不再選（秒）
    const QUICK_S_VARIABILITY = 0.12; // Isolated S 的變動率需超過此值
    const QUICK_SECTION_TYPES = ['sve', 'psvt']; // 這些清單的長事件改用藍色選印
    const QUICK_SECTION_SECONDS = 30; // 事件超過此秒數時改用藍色選印
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

    // 目前清單的網站資料；不是支援的清單時回傳 null。review 為 true 時也接受只有選印清單的清單（REVIEW_ONLY_TYPES）。
    function getQuickContext(element, review = false) {
        if (!window.angular || !element) return null;
        let scope;
        try { scope = window.angular.element(element).scope(); } catch (_) { return null; }
        let host = scope;
        while (host && typeof host.selectPrintedEvent !== 'function') host = host.$parent;
        let sectionHost = scope;
        while (sectionHost && typeof sectionHost.selectSectionEvent !== 'function') sectionHost = sectionHost.$parent;
        let owner = scope;
        while (owner && !owner.af) owner = owner.$parent;
        const af = owner?.af;
        const dialog = af?.eventDialog;
        const type = dialog?.dscp?.type;
        const config = QUICK_PRINT_TYPES[type] || (review ? REVIEW_ONLY_TYPES[type] : null);
        const key = dialog?.dscp?.printedEventType;
        if (!config || !host || !key || !af.printDialog?.selectedEvents) return null;
        return { af, host, sectionHost, dialog, type, config, key };
    }
    function getQuickTimes(ctx) {
        const source = ctx.dialog[ctx.type];
        const values = Array.isArray(source?.data) ? source.data.flat() : [];
        return [...new Set(values.map(toEventTime).filter(time => time !== null))];
    }
    // 清單中已選印（使用者綠色、藍色區段選印）與強制選印（橘色）的時間。
    function getQuickPrinted(ctx, times = getQuickTimes(ctx)) {
        const inList = new Set(times);
        const pick = values => new Set((Array.isArray(values) ? values : []).map(toEventTime)
            .filter(time => time !== null && inList.has(time)));
        const forced = pick(getLiveForcedEvents(ctx.af));
        const selected = pick(ctx.af.printDialog.selectedEvents[ctx.key]);
        const section = pick(getSectionTimes(ctx));
        return { selected, section, forced, all: [...new Set([...selected, ...section, ...forced])].sort((a, b) => a - b) };
    }
    // 藍色選印（區段選印）的事件時間：清單上的勾選（eventDialog.section）與網站保存的區段範圍（eventRecordRange）。
    function getSectionTimes(ctx) {
        const list = Array.isArray(ctx.dialog.section) ? ctx.dialog.section : [];
        const ranges = ctx.af.eventRecordRange?.[ctx.type];
        return [...list, ...(ranges && typeof ranges === 'object' ? Object.keys(ranges) : [])];
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
        let variabilityReason = null;
        for (const anchor of anchors) {
            let first = anchor, last = anchor;
            while (first > 0 && isEctopic(first - 1)) first--;
            while (last < beats.length - 1 && isEctopic(last + 1)) last++;
            const length = last - first + 1;
            found = Math.max(found, length);
            // Isolated S：變動率需超過 12%，與「ECG 變動率自動標註器」相同算法：
            // （前一個間隔 − 進入這顆 S 的間隔）/ 進入這顆 S 的間隔，保留正負號。
            if (config.kind === 'isolated' && length === 1 && ectopic === 'S') {
                const before = beats[anchor - 1], earlier = beats[anchor - 2];
                const previousRR = before && earlier ? before.offset - earlier.offset : NaN;
                const rr = before ? beats[anchor].offset - before.offset : NaN;
                const rate = (previousRR - rr) / rr;
                if (!(previousRR > 0) || !(rr > 0)) { variabilityReason = 'S 前心搏不足，無法計算變動率'; continue; }
                if (!(rate > QUICK_S_VARIABILITY)) {
                    variabilityReason = `變動率 ${(rate * 100).toFixed(1)}%，未超過 ${QUICK_S_VARIABILITY * 100}%`;
                    continue;
                }
            }
            // Isolated S：前兩顆依序是 V、N（V → N → S）時仍符合，但標為次要，候選不足時才選。
            if (config.kind === 'isolated' && length === 1) {
                return { ok: true, lowPriority: ectopic === 'S' && beats[anchor - 1]?.type === 'N' && beats[anchor - 2]?.type === 'V' };
            }
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
        if (variabilityReason) return { ok: false, reason: `標籤已不符合 ${config.name}（${variabilityReason}）` };
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
    // 驗證標為次要的（Isolated S 的 V → N → S）先保留，其他候選都用完仍不足時，才依原本選出的順序補上。
    async function pickValidated(ctx, candidates, existing, need, pick, onProgress) {
        let pool = [...candidates];
        const valid = [];
        const skipped = [];
        const lowPriority = [];
        while (valid.length < need) {
            const picks = pick(pool, [...existing, ...valid], need - valid.length);
            if (!picks.length) break;
            onProgress?.(valid.length + skipped.length + lowPriority.length, picks.length);
            const results = await runLimited(picks, 4, time => validateQuickTime(ctx, time));
            picks.forEach((time, i) => (!results[i].ok ? skipped : results[i].lowPriority ? lowPriority : valid).push(time));
            const used = new Set([...valid, ...skipped, ...lowPriority]);
            pool = pool.filter(candidate => !used.has(candidate.time));
        }
        let usedLow = 0;
        for (const time of lowPriority) {
            if (valid.length >= need) break;
            if ([...existing, ...valid].every(other => Math.abs(other - time) >= QUICK_MIN_GAP)) { valid.push(time); usedLow++; }
        }
        return { valid, skipped, lowPriority: usedLow };
    }

    // 網站的事件統計（eventTypeStat）：[秒數, 最快 HR, 平均 HR, 最慢 HR, 心搏數]；事件清單卡片顯示的 beats 即第 5 項。
    function getEventStat(af, type, time) {
        const row = af.eventTypeStat?.[type]?.[time];
        if (!Array.isArray(row) || row.length < 5) return null;
        const beats = Number(row[4]);
        const avgHR = Number(row[2]);
        const seconds = Number(row[0]);
        return { beats: beats > 0 ? beats : null, avgHR: avgHR > 0 ? avgHR : null, seconds: seconds > 0 ? seconds : null };
    }
    // SVE run／SVT 事件超過 30 秒時，改用藍色選印（區段選印）。
    function needsSectionPrint(af, type, time) {
        if (!QUICK_SECTION_TYPES.includes(type)) return false;
        return (getEventStat(af, type, time)?.seconds ?? 0) > QUICK_SECTION_SECONDS;
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
    // 透過網站的選印函式加入／移除（與點擊印表機圖示相同），並同步目前頁面的勾選狀態。
    // 網站只改記憶體中的選印，關閉事件清單時才上傳（postPDFSelectedEvents）；Group 前需先上傳。
    // SVE run／SVT 超過 30 秒的改用藍色選印（與勾選藍色印表機相同，網站會一併取消綠色選印）；
    // 取消時依目前是哪一種選印移除。回傳是否為藍色選印。
    function setQuickPrint(ctx, time, on) {
        // 以 toEventTime 比對，Event Tag 的項目（dataTime／tagTime）也能同步勾選狀態。
        const items = (Array.isArray(ctx.dialog.currentData) ? ctx.dialog.currentData : [])
            .filter(item => item && toEventTime(item) === time);
        const inSection = getSectionTimes(ctx).some(value => toEventTime(value) === time);
        const section = !!ctx.sectionHost && (on ? needsSectionPrint(ctx.af, ctx.type, time) : inSection);
        ctx.host.$apply(() => {
            if (section) {
                const target = items[0] || { startTime: time };
                target.isPrintSection = on;
                ctx.sectionHost.selectSectionEvent(target);
                if (!on && ctx.af.eventRecordRange?.[ctx.type]) delete ctx.af.eventRecordRange[ctx.type][time];
                for (const item of items) { item.isPrintSection = on; item.selectedEvent = false; }
                return;
            }
            ctx.host.selectPrintedEvent({ startTime: time, selectedEvent: on });
            for (const item of items) item.selectedEvent = on;
        });
        return section;
    }
    // 換掉的心電圖在本次頁面執行期不再被選回。
    const quickRejected = new Map();
    function getQuickRejected(ctx) {
        const key = `${ctx.af._measureId}|${ctx.type}`;
        if (!quickRejected.has(key)) quickRejected.set(key, new Set());
        return quickRejected.get(key);
    }
    // 使用者取消的選印：清單開著時比對前後的選印（綠色與藍色），消失但心電圖仍在同一清單中的，
    // 不論是在網站上點印表機圖示、選印清單的「取消選印」或其他方式取消，都記為淘汰。
    // 心電圖已不在清單中的（Group 後重新分類到其他子項目、S↔V 改標後重新分類、不在清單中的選印被自動取消）不算。
    // 使用者之後又自己選印回來的，從淘汰中移除。只保留到重新整理頁面。
    const quickPrintSnapshots = new Map();
    function trackCancelledPrints(ctx) {
        if (!ctx || ctx.config.reviewOnly) return;
        const key = `${ctx.af._measureId}|${ctx.type}`;
        const times = getQuickTimes(ctx);
        const inList = new Set(times);
        const { selected, section } = getQuickPrinted(ctx, times);
        const current = new Set([...selected, ...section]);
        const previous = quickPrintSnapshots.get(key);
        quickPrintSnapshots.set(key, current);
        if (!previous) return;
        const rejected = getQuickRejected(ctx);
        for (const time of previous) if (!current.has(time) && inList.has(time)) rejected.add(time);
        for (const time of current) if (!previous.has(time)) rejected.delete(time);
    }
    // candidates：一般候選；fallback：候選不足時才用，依序為與淘汰過的相隔 30 秒內的、淘汰過的本身。
    async function getQuickCandidates(ctx, onProgress) {
        const times = getQuickTimes(ctx);
        const printed = new Set(getQuickPrinted(ctx, times).all);
        const excluded = getQuickExcluded(ctx);
        // 淘汰過的（換掉或取消選印的）不再選回，與它相隔 30 秒內的也不選（同一段心律，畫面幾乎相同）。
        const rejectedSet = getQuickRejected(ctx);
        const rejected = [...rejectedSet];
        const nearRejected = time => rejected.some(other => Math.abs(other - time) <= QUICK_REJECT_NEAR);
        const open = times.filter(time => !printed.has(time) && !excluded.has(time));
        const pool = open.filter(time => !nearRejected(time));
        const fallback = [open.filter(time => nearRejected(time) && !rejectedSet.has(time)), open.filter(time => rejectedSet.has(time))];
        return { times, candidates: await computeQuickScores(ctx, pool, onProgress), fallback };
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
            const printed = getQuickPrinted(ctx, times);
            const existing = printed.all;
            const target = ctx.config.target(times.length);
            // 橘色強制選印同樣檢查：SVE run／SVT 超過 30 秒、還不是藍色選印的，改為藍色選印（強制選印紀錄保留）。
            const forcedLong = ctx.sectionHost ? [...printed.forced]
                .filter(time => !printed.section.has(time) && needsSectionPrint(ctx.af, ctx.type, time)) : [];
            const forcedSectioned = forcedLong.filter(time => setQuickPrint(ctx, time, true)).length;
            const forcedText = forcedSectioned
                ? `強制選印 ${forcedSectioned} 張超過 ${QUICK_SECTION_SECONDS} 秒，已改為藍色選印；` : '';
            if (existing.length >= target) {
                quickToast(button, forcedText + `${ctx.config.name} 已選印 ${existing.length} 張，已達 ${target} 張`);
                if (forcedSectioned) refreshPrintReview();
                return;
            }
            const { candidates, fallback } = await getQuickCandidates(ctx, (done, total) => {
                quickState.progress = `${done}/${total}`;
                schedulePrintBars();
            });
            // 計算期間清單被關閉或切換時放棄。
            if (getQuickContext(button)?.type !== ctx.type) {
                if (forcedSectioned) quickToast(null, forcedText.replace(/；$/, ''));
                return;
            }
            const now = getQuickPrinted(ctx, times).all;
            const range = getQuickRange(ctx, times);
            // 選出後逐張讀取心電圖、套用未儲存的標籤修改，驗證仍符合此清單類型；不符合的換下一張。
            const pickRound = (pool, already) => pickValidated(ctx, pool, [...now, ...already], target - now.length - already.length,
                (list, existing, need) => pickQuickPrints({ candidates: list, existing, target, ...range, need,
                    spread: ctx.config.spread !== false }),
                done => { quickState.progress = `驗證 ${done}`; schedulePrintBars(); });
            const { valid: chosen, skipped, lowPriority } = await pickRound(candidates, []);
            // 一般候選不足時，才依序使用與取消過的相隔 30 秒內的、取消過的本身。
            let reused = 0;
            for (const tier of fallback) {
                if (now.length + chosen.length >= target || !tier.length) continue;
                if (getQuickContext(button)?.type !== ctx.type) return;
                const scored = await computeQuickScores(ctx, tier);
                const extra = await pickRound(scored, chosen);
                chosen.push(...extra.valid);
                skipped.push(...extra.skipped);
                reused += extra.valid.length;
            }
            if (getQuickContext(button)?.type !== ctx.type) return;
            const sectioned = chosen.filter(time => setQuickPrint(ctx, time, true)).length;
            const total = now.length + chosen.length;
            const skippedText = (skipped.length ? `（略過 ${skipped.length} 張標籤已不符合的）` : '')
                + (lowPriority ? `（候選不足，其中 ${lowPriority} 張前兩顆為 V、N）` : '')
                + (reused ? `（候選不足，其中 ${reused} 張為之前取消過的或其前後 30 秒內的）` : '');
            const sectionText = sectioned ? `（其中 ${sectioned} 張超過 ${QUICK_SECTION_SECONDS} 秒，使用藍色選印）` : '';
            quickToast(button, forcedText + (chosen.length
                ? `已快速選印 ${chosen.length} 張，${ctx.config.name} 共 ${total}／${target} 張` + (total < target ? '（符合條件的心電圖不足）' : '') + sectionText + skippedText
                : `沒有符合條件的心電圖可選印（需相隔 1 分鐘以上）` + skippedText), !chosen.length && !forcedSectioned);
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
                if (getQuickContext(summary, true)) openPrintReview(summary);
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
        summary.title = !quick ? '' : quick.config.reviewOnly ? '開啟選印清單：逐張檢視心電圖，可修改標籤或取消選印'
            : '開啟選印清單：逐張檢視心電圖，可修改標籤、取消選印或換一張';
        const showQuick = !!quick && !quick.config.reviewOnly;
        button.hidden = !showQuick;
        if (showQuick) {
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
        .rc-review-tag.is-section { background:#2c6aa0; }
        .rc-review-tag.is-both { background:linear-gradient(90deg, #d88f3f 0 50%, #2c6aa0 50% 100%); }
        .rc-review-card.is-both { border-color:#c9b9d9; }
        .rc-review-card.is-section { border-color:#bcd6ee; }
        .rc-review-card.is-section.is-active { border-color:#2c6aa0; background:#f2f7fc; box-shadow:0 0 0 2px rgba(44,106,160,.25); }
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
        /* 眼睛：縮圖改顯示報告中波形下方 30 秒縮圖的範圍 */
        .rc-review-eye { height:22px; padding:0 8px; border:1px solid #fff; border-radius:11px; background:transparent; color:#fff;
            font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; opacity:.75; }
        .rc-review-eye:hover { opacity:1; }
        .rc-review-eye[aria-pressed="true"] { background:#fff; color:#5b7d1a; opacity:1; }
        .rc-review-bar.is-context .rc-review-card { width:380px; }
        .rc-review-bar.is-review-only :is(.rc-review-add, .rc-review-group, .rc-review-btn.is-swap) { display:none; }
    `;
    document.head.appendChild(reviewStyle);

    function closePrintReview() {
        if (!review) return;
        if (review.onResize) window.removeEventListener('resize', review.onResize);
        clearTimeout(review.staleTimer);
        review.bar.remove();
        review = null;
        decorateReviewDialog();
    }
    // focusTime：開啟後顯示這張選印（仍在清單中時），否則顯示第一張。
    function openPrintReview(anchor, focusTime = null) {
        const ctx = getQuickContext(anchor, true);
        if (!ctx) return;
        closePrintReview();
        const bar = document.createElement('div');
        // Pause、Event Tag 只能檢視與取消選印：隱藏加選、Group、換一個。
        bar.className = 'rc-review-bar' + (ctx.config.reviewOnly ? ' is-review-only' : '');
        bar.tabIndex = -1;
        bar.innerHTML = '<div class="rc-review-head"><span class="rc-review-title"></span><span class="rc-review-count"></span>'
            + '<span class="rc-review-hint"></span>'
            + '<button type="button" class="rc-review-eye" aria-pressed="false" title="縮圖顯示報告中波形下方的 30 秒縮圖範圍（綠色為印出的 8 秒）">👁 列印範圍</button>'
            + '<button type="button" class="rc-review-add" title="依快速選印的規則再多選一張（時段分散、相隔 1 分鐘以上）">＋ 加選一個</button>'
            + '<button type="button" class="rc-review-group" title="儲存標籤修改後執行 Group All，重新分類事件並重整清單">Group</button>'
            + '<button type="button" class="rc-review-close" title="關閉選印清單" aria-label="關閉">×</button></div>'
            + '<div class="rc-review-strip"><button type="button" class="rc-review-scroll is-prev" title="往前捲動" aria-label="往前捲動">◀</button>'
            + '<div class="rc-review-list"></div>'
            + '<button type="button" class="rc-review-scroll is-next" title="往後捲動" aria-label="往後捲動">▶</button></div>';
        review = { bar, ctx, anchor, cards: new Map(), items: [], active: null, switching: false, busy: false,
            staleCards: new Set(), staleTimer: null, labelIndices: null };
        bar.querySelector('.rc-review-close').addEventListener('click', closePrintReview);
        bar.querySelector('.rc-review-add').addEventListener('click', addReviewPrint);
        bar.querySelector('.rc-review-eye').addEventListener('click', () => setReviewContext(!reviewContextOn));
        bar.classList.toggle('is-context', reviewContextOn);
        bar.querySelector('.rc-review-eye').setAttribute('aria-pressed', String(reviewContextOn));
        bar.querySelector('.rc-review-group').addEventListener('click', groupReview);
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
        if (review.items.length) showReviewTime(review.items.includes(focusTime) ? focusTime : review.items[0]);
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
    function reviewPrintSignature(forced, section, all) {
        return JSON.stringify([all, [...forced].sort((a, b) => a - b), [...section].sort((a, b) => a - b)]);
    }
    // 選印清單開著時，在網站上點印表機圖示選印或取消（或其他方式改變選印），清單跟著更新。
    // 由頁面變動觸發，只在選印（綠色、橘色、藍色）有變化時才重整；腳本自己操作中（busy、Group）時不處理。
    function syncReviewPrints() {
        if (!review || review.busy || review.grouping) return;
        const ctx = review.ctx;
        if (!ctx.dialog || ctx.dialog.dscp?.type !== ctx.type) return;
        const { forced, section, all } = getQuickPrinted(ctx);
        if (reviewPrintSignature(forced, section, all) !== review.printSignature) refreshPrintReview();
    }
    function refreshPrintReview() {
        if (!review) return;
        const { ctx, bar, cards } = review;
        if (!ctx.dialog || ctx.dialog.dscp?.type !== ctx.type || !review.anchor.isConnected) { closePrintReview(); return; }
        const times = getQuickTimes(ctx);
        const { forced, section, all } = getQuickPrinted(ctx, times);
        review.items = all;
        review.section = section;
        review.printSignature = reviewPrintSignature(forced, section, all);
        const title = `選印清單・${ctx.config.name}`;
        const titleNode = bar.querySelector('.rc-review-title');
        if (titleNode.textContent !== title) titleNode.textContent = title;
        const hint = 'A／D 切換上一張／下一張選印；Q/E、←/→ 移動時間。'
            + (section.size ? '藍色選印開啟區段選印視窗（Start／Mid／End 三段）。' : '')
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
            // 強制選印同時也是藍色選印（例如超過 30 秒的最長 SVT）時，另外標示「強制＋藍色」。
            const isBoth = isForced && section.has(time);
            card.classList.toggle('is-forced', isForced);
            card.classList.toggle('is-both', isBoth);
            card.classList.toggle('is-active', time === review.active);
            card.querySelector('.rc-review-tag.is-forced-tag').hidden = !isForced || isBoth;
            card.querySelector('.rc-review-tag.is-both').hidden = !isBoth;
            const isSection = !isForced && section.has(time);
            card.classList.toggle('is-section', isSection);
            card.querySelector('.rc-review-tag.is-section').hidden = !isSection;
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
        const group = bar.querySelector('.rc-review-group');
        if (!review.grouping) group.disabled = review.busy;
        updateReviewCount();
        decorateReviewDialog();
        requestAnimationFrame(updateReviewScroll);
    }
    function createReviewCard(time) {
        const card = document.createElement('div');
        card.className = 'rc-review-card';
        card.dataset.time = String(time);
        card.innerHTML = '<div class="rc-review-card-head"><span class="rc-review-time"></span>'
            + '<span class="rc-review-tag is-forced-tag" hidden>強制選印</span>'
            + '<span class="rc-review-tag is-both" hidden title="網站的強制選印，同時也是藍色區段選印（報告印出 Start／Mid／End 三段）">強制＋藍色</span>'
            + '<span class="rc-review-tag is-section" hidden title="區段選印：報告印出 Start／Mid／End 三段，點選卡片開啟區段選印視窗">藍色選印</span></div>'
            + '<div class="rc-review-info"></div><div class="rc-review-warn" hidden></div><div class="rc-review-thumb">載入中…</div>'
            + '<div class="rc-review-actions"><button type="button" class="rc-review-btn is-cancel">取消選印</button>'
            + '<button type="button" class="rc-review-btn is-swap">換一個</button></div>';
        card.querySelector('.rc-review-time').textContent = formatQuickTime(review.ctx, time);
        card.addEventListener('click', event => {
            if (event.target.closest('button')) return;
            showReviewTime(time);
        });
        card.querySelector('.is-cancel').addEventListener('click', event => cancelReviewPrint(time, event.currentTarget));
        card.querySelector('.is-swap').addEventListener('click', event => swapReviewPrint(time, event.currentTarget));
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
        if (!ctx || ctx.config.reviewOnly) return;
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
        decorateReviewDialog();
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
    // 藍色選印改開網站的區段選印視窗（Start／Mid／End 三段，與點擊清單上的時間相同）；plain 為 true 時一律開一般心電圖視窗。
    const REVIEW_POPUP_SELECTOR = '.ngdialog.ecg-dialog, .ngdialog.section-dialog';
    async function showReviewTime(time, plain = false) {
        if (!review || review.switching) return;
        const { ctx } = review;
        const section = !plain && !!review.section?.has(time);
        const popupOpen = () => !!document.querySelector(REVIEW_POPUP_SELECTOR);
        const expectedOpen = () => !!document.querySelector(section ? '.ngdialog.section-dialog' : '.ngdialog.ecg-dialog');
        if (expectedOpen() && review.active === time) return;
        review.switching = true;
        setReviewActive(time);
        try {
            if (popupOpen()) {
                ctx.host.$apply(() => ctx.host.closeDialog());
                await waitFor(() => !popupOpen(), 1500);
            }
            if (!review || review.ctx !== ctx) return;
            if (section && ctx.sectionHost?.openSectionPrintDialog) {
                const items = Array.isArray(ctx.dialog.currentData) ? ctx.dialog.currentData : [];
                const item = items.find(entry => toEventTime(entry?.startTime) === time);
                const target = item?.isPrintSection ? item : { ...(item || {}), startTime: time, isPrintSection: true };
                ctx.sectionHost.$apply(() => ctx.sectionHost.openSectionPrintDialog(target, ctx.type));
            } else if (ctx.config.tag && typeof ctx.host.openEventTagDialog === 'function') {
                // Event Tag：與點擊清單上的心電圖相同。不在目前頁面的項目沒有 timeRange，依網站格式補上（起點後 10 秒）。
                const loaded = (Array.isArray(ctx.dialog.currentData) ? ctx.dialog.currentData : []).find(entry => toEventTime(entry) === time);
                const raw = loaded || (ctx.dialog[ctx.type]?.data || []).flat().find(entry => toEventTime(entry) === time)
                    || { tagTime: time, dataTime: time };
                const start = toEventTime(raw);
                const item = Array.isArray(raw.timeRange) && raw.timeRange.length ? raw : { ...raw, timeRange: [start, start + 10] };
                ctx.host.$apply(() => ctx.host.openEventTagDialog(item, ctx.af.dataDuration || 60));
            } else {
                ctx.host.$apply(() => ctx.host.openDialog(time, ctx.af.dataDuration || 60));
            }
            await waitFor(expectedOpen, 3000);
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
    // 眼睛（列印範圍）開啟時改顯示報告中波形下方的 30 秒縮圖範圍，綠色為印出的 8 秒；只保留到重新整理頁面。
    const PRINT_CONTEXT_BEFORE = 11; // 網站列印：下方縮圖從印出的 8 秒前 11 秒開始，共 30 秒
    const PRINT_CONTEXT_SECONDS = 30;
    const PRINT_SHOWN_SECONDS = 8;
    let reviewContextOn = false;
    // 報告中印出的 8 秒的起點：一般清單為事件前 3 秒（事件心電圖前 4 秒起，印出第 1～9 秒），
    // Pause 為事件前 4 秒（印出第 0～8 秒），Event Tag 為選印範圍的起點；藍色區段選印的版面不同，回傳 null。
    function reviewPrintStart(ctx, time) {
        if (review?.section?.has(time)) return null;
        if (ctx.config.tag) return getTagPrintWindow(ctx.af, time).start;
        if (/^pause/.test(ctx.type)) return time - 4;
        return time - 3;
    }
    function cardUsesContext(time) {
        return reviewContextOn && !!review && reviewPrintStart(review.ctx, time) !== null;
    }
    // 依目前模式畫出已讀到的資料；沒有資料時回傳 false。
    function showReviewThumb(card, time, modifiedData) {
        const thumb = card.querySelector('.rc-review-thumb');
        if (cardUsesContext(time)) {
            if (!card.rcContext) return false;
            renderReviewThumb(thumb, card.rcContext, time, modifiedData,
                { labels: false, highlight: [PRINT_CONTEXT_BEFORE, PRINT_CONTEXT_BEFORE + PRINT_SHOWN_SECONDS] });
        } else {
            if (!card.rcData) return false;
            renderReviewThumb(thumb, card.rcData, time, modifiedData);
        }
        return true;
    }
    const thumbQueue = [];
    let thumbLoading = 0;
    function loadReviewThumb(card, time) {
        thumbQueue.push({ card, time });
        pumpThumbQueue();
    }
    // 資料已過期（Save 後、Event Tag 選印時間改變）時清掉兩種縮圖資料再重新讀取。
    function reloadReviewThumb(card, time) {
        card.rcData = null;
        card.rcContext = null;
        loadReviewThumb(card, time);
    }
    function pumpThumbQueue() {
        while (thumbLoading < 3 && thumbQueue.length) {
            const { card, time } = thumbQueue.shift();
            if (review?.cards.get(time) !== card) continue;
            const context = cardUsesContext(time);
            if (showReviewThumb(card, time)) { checkReviewCard(card, time); continue; }
            thumbLoading++;
            let before = THUMB_BEFORE, after = THUMB_AFTER;
            if (context) {
                const start = reviewPrintStart(review.ctx, time) - PRINT_CONTEXT_BEFORE;
                before = time - start;
                after = start + PRINT_CONTEXT_SECONDS - time;
            } else if (review.ctx.config.tag) {
                // Event Tag 的縮圖顯示目前的 10 秒選印範圍；其他清單顯示事件前 4 秒至後 6 秒。
                const start = getTagPrintWindow(review.ctx.af, time).start;
                before = time - start;
                after = start + TAG_PRINT_SECONDS - time;
            }
            fetchReviewECG(time, before, after).then(data => {
                if (review?.cards.get(time) !== card) return;
                if (context) card.rcContext = data; else card.rcData = data;
                showReviewThumb(card, time);
                checkReviewCard(card, time);
            }).catch(error => {
                const thumb = card.querySelector('.rc-review-thumb');
                if (thumb) thumb.textContent = `載入失敗：${error?.message || error?.status || error}`;
            }).finally(() => { thumbLoading--; pumpThumbQueue(); });
        }
    }
    function setReviewContext(on) {
        reviewContextOn = on;
        if (!review) return;
        review.bar.classList.toggle('is-context', on);
        review.bar.querySelector('.rc-review-eye').setAttribute('aria-pressed', String(on));
        // 卡片變寬後才重畫，縮圖寬度才量得到；沒有資料的排隊讀取。
        for (const [time, card] of review.cards) {
            if (!showReviewThumb(card, time)) {
                const thumb = card.querySelector('.rc-review-thumb');
                if (thumb) thumb.textContent = '載入中…';
                loadReviewThumb(card, time);
            }
        }
        requestAnimationFrame(updateReviewScroll);
        if (review.active !== null) setReviewActive(review.active);
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
    // 縮圖的心搏標籤：伺服器資料加上未儲存的標籤修改（[時間, 索引, 新標籤, 原標籤, 1]），與上方心電圖視窗一致。
    // 回傳 { labels: Map(索引 → 標籤), edited: Set(改過的索引) }；新標籤空白或 X（刪除）不顯示。
    function thumbLabels(data, modifiedData) {
        const fromIndex = Number(data.fromIndex) || 0;
        const endIndex = fromIndex + (Array.isArray(data.ecg) ? data.ecg.length : 0);
        const labels = new Map(Object.entries(data.anno || {}).map(([index, type]) => [Number(index), type]));
        const edited = new Set();
        for (const item of Array.isArray(modifiedData) ? modifiedData : []) {
            const index = Number(item?.[1]);
            if (!item?.[4] || !(index >= fromIndex && index <= endIndex)) continue;
            labels.set(index, item[2]);
            edited.add(index);
        }
        return { labels, edited };
    }
    let thumbGradientSeq = 0; // 每張縮圖的漸層 id 不重複
    // options.highlight：[開始秒, 結束秒]（自資料起點），以列印縮圖相同的淡綠色標示；options.labels 為 false 時不畫標籤。
    function renderReviewThumb(container, data, eventTime, modifiedData = review?.ctx.af.ecgAnno?.modifiedData, options = {}) {
        if (!container) return;
        if (modifiedData === undefined) modifiedData = review?.ctx.af.ecgAnno?.modifiedData;
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
        if (options.highlight) {
            const [from, to] = options.highlight;
            add('rect', { x: from * pxPerSec, y: labelHeight, width: Math.max(0, (to - from) * pxPerSec), height: waveHeight,
                fill: 'rgba(173,209,73,.41)' });
        }
        let d = '';
        values.forEach((value, i) => {
            if (!Number.isFinite(value)) return;
            const x = i / sampleRate * pxPerSec;
            const y = Math.min(height, Math.max(labelHeight, labelHeight + waveHeight / 2 - (value - baseline) * pxPerMV));
            d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        const { labels, edited } = thumbLabels(data, modifiedData);
        // 與網站心電圖相同：每顆心搏在其位置放一個漸層色標（V 紅、S／A 藍、其他深灰），相鄰心搏之間漸變。
        const waveColor = type => type === 'V' ? 'red' : type === 'S' || type === 'A' ? '#0568F7' : '#262626';
        const gradientId = `rc-thumb-grad-${++thumbGradientSeq}`;
        const defs = add('defs', {});
        const gradient = document.createElementNS(ns, 'linearGradient');
        for (const [key, value] of Object.entries({ id: gradientId, gradientUnits: 'userSpaceOnUse', x1: 0, x2: width, y1: 0, y2: 0 })) {
            gradient.setAttribute(key, String(value));
        }
        const stops = [...labels].filter(([index, type]) => Number.isFinite(index) && type && type !== 'X')
            .map(([index, type]) => [(index - fromIndex) / sampleRate * pxPerSec / width, type])
            .filter(([offset]) => offset >= 0 && offset <= 1).sort((a, b) => a[0] - b[0]);
        for (const [offset, type] of stops.length ? stops : [[1, 'N']]) {
            const stop = document.createElementNS(ns, 'stop');
            stop.setAttribute('offset', String(offset));
            stop.setAttribute('stop-color', waveColor(type));
            gradient.appendChild(stop);
        }
        defs.appendChild(gradient);
        add('path', { d, stroke: `url(#${gradientId})`, 'stroke-width': 0.9, fill: 'none', 'stroke-linejoin': 'round' });
        const color = type => type === 'V' ? '#d0021b' : type === 'S' || type === 'A' ? '#2a6fdb' : '#888';
        // 30 秒的列印範圍與報告的縮圖相同，不畫標籤（太密），心搏類型由波形顏色表示。
        for (const [index, type] of options.labels === false ? [] : labels) {
            if (!['N', 'S', 'A', 'V'].includes(type) || !Number.isFinite(index)) continue;
            const x = (index - fromIndex) / sampleRate * pxPerSec;
            if (x < 0 || x > width) continue;
            // 尚未儲存的修改：標籤底下加淡黃底，與已儲存的區分。
            if (edited.has(index)) add('rect', { x: x - 5, y: 1, width: 10, height: 11, rx: 2, fill: '#fff1c9' });
            // 與網站標籤列相同，A 顯示為 S。
            add('text', { x, y: 10, 'font-size': 9, 'text-anchor': 'middle', fill: color(type), 'font-weight': type === 'N' ? 400 : 700 },
                type === 'A' ? 'S' : type);
        }
        container.textContent = '';
        container.appendChild(svg);
    }
    // 選印清單的卡片：依縮圖的心電圖與目前未儲存的標籤修改，標示已不符合清單類型的選印。
    function checkReviewCard(card, time) {
        // 一般縮圖或 30 秒列印範圍的資料都涵蓋事件前後，哪一份有就用哪一份。
        const data = card.rcData || card.rcContext;
        if (!review || !data || review.ctx.config.reviewOnly) return; // Pause、Event Tag 沒有心搏型態規則
        const result = checkEventPattern(effectiveEventBeats(data, review.ctx.af.ecgAnno?.modifiedData, time), review.ctx.config);
        card.classList.toggle('is-invalid', !result.ok);
        const warn = card.querySelector('.rc-review-warn');
        const text = result.ok ? '' : `⚠ ${result.reason}`;
        if (warn.textContent !== text) warn.textContent = text;
        warn.hidden = result.ok;
        card.title = result.ok ? '' : result.reason;
    }
    // 標籤修改後重新檢查並重畫縮圖的標籤（由頁面變動觸發，只在修改內容改變時才重算）。
    // 修改從未儲存清單中消失（按了 Save 或放棄修改）時，縮圖裡的伺服器資料已過期，儲存完成後重新讀取。
    function recheckReviewCards() {
        if (!review) return;
        const pending = review.ctx.af.ecgAnno?.modifiedData || [];
        const signature = JSON.stringify(pending);
        if (signature === review.labelSignature) return;
        review.labelSignature = signature;
        const current = new Set(pending.filter(item => item?.[4]).map(item => Number(item[1])));
        const removed = [...(review.labelIndices || [])].filter(index => !current.has(index));
        review.labelIndices = current;
        const covers = data => {
            const fromIndex = Number(data.fromIndex) || 0;
            const endIndex = fromIndex + (Array.isArray(data.ecg) ? data.ecg.length : 0);
            return removed.some(index => index >= fromIndex && index <= endIndex);
        };
        for (const [time, card] of review.cards) {
            const datasets = [card.rcData, card.rcContext].filter(Boolean);
            if (!datasets.length) continue;
            if (removed.length && datasets.some(covers)) { review.staleCards.add(card); continue; }
            if (review.staleCards.has(card)) continue; // 等重新讀取，避免先閃回舊標籤
            showReviewThumb(card, time, pending);
            checkReviewCard(card, time);
        }
        if (review.staleCards.size) scheduleStaleThumbs();
    }
    // 等網站儲存完成（af.loading.modified 結束）再重新讀取過期的縮圖。
    function scheduleStaleThumbs() {
        if (!review || review.staleTimer) return;
        const ctx = review.ctx;
        review.staleTimer = setTimeout(function retry() {
            if (!review || review.ctx !== ctx) return;
            if (ctx.af.loading?.modified) { review.staleTimer = setTimeout(retry, 300); return; }
            review.staleTimer = null;
            for (const card of review.staleCards) {
                const time = Number(card.dataset.time);
                if (review.cards.get(time) === card) reloadReviewThumb(card, time);
            }
            review.staleCards.clear();
        }, 800);
    }
    function setReviewBusy(busy) {
        if (!review) return;
        review.busy = busy;
        refreshPrintReview();
    }
    // 取消選印：目前顯示的是這張時，改顯示相鄰的下一張（沒有則上一張）。
    // button 為按下的按鈕（縮圖卡片或心電圖視窗上的），用來顯示提示。
    function cancelReviewPrint(time, button) {
        if (!review || review.busy) return;
        const items = review.items;
        const index = items.indexOf(time);
        const neighbor = review.active === time ? (items[index + 1] ?? items[index - 1] ?? null) : null;
        const anchor = review.cards.get(neighbor ?? time) || review.bar;
        try {
            setQuickPrint(review.ctx, time, false);
            getQuickRejected(review.ctx).add(time); // 取消的也算淘汰，之後快速選印、換一個、加選不再選回
            quickToast(button?.isConnected ? button : anchor, `已取消選印 ${formatQuickTime(review.ctx, time)}`);
        } catch (error) {
            quickToast(button?.isConnected ? button : anchor, `取消選印失敗：${error?.message || error}`, true);
            return;
        }
        refreshPrintReview();
        if (neighbor !== null) showReviewTime(neighbor);
    }
    async function swapReviewPrint(time, button) {
        if (!review || review.busy) return;
        const ctx = review.ctx;
        setReviewBusy(true);
        button.textContent = '尋找中…';
        try {
            getQuickRejected(ctx).add(time);
            const { times, candidates } = await getQuickCandidates(ctx, (done, total) => { button.textContent = `${done}/${total}`; });
            if (!review || review.ctx !== ctx) return;
            const existing = getQuickPrinted(ctx, times).all.filter(other => other !== time);
            const range = getQuickRange(ctx, times);
            button.textContent = '驗證中…';
            const { valid: [replacement = null], skipped, lowPriority } = await pickValidated(ctx, candidates, existing, 1,
                (pool, others) => [pickQuickReplacement({ candidates: pool, existing: others, removed: time,
                    target: ctx.config.target(times.length), ...range, spread: ctx.config.spread !== false })].filter(value => value !== null));
            if (!review || review.ctx !== ctx) return;
            if (replacement === null) {
                getQuickRejected(ctx).delete(time);
                quickToast(button, '沒有其他符合條件的心電圖（需與其他選印相隔 1 分鐘以上，且不選淘汰過的及其前後 30 秒）'
                    + (skipped.length ? `；${skipped.length} 張標籤已不符合` : ''), true);
                return;
            }
            setQuickPrint(ctx, time, false);
            const replacedSection = setQuickPrint(ctx, replacement, true);
            review.busy = false;
            refreshPrintReview();
            const added = review?.cards.get(replacement);
            added?.classList.add('is-new');
            quickToast(added?.querySelector('.is-swap') || review?.bar, `已換成 ${formatQuickTime(ctx, replacement)}` + (replacedSection ? '（超過 30 秒，藍色選印）' : '')
                + (lowPriority ? '（沒有其他候選，使用前兩顆為 V、N 的 S）' : ''));
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
            const addedSection = setQuickPrint(ctx, added, true);
            review.busy = false;
            refreshPrintReview();
            const card = review?.cards.get(added);
            card?.classList.add('is-new');
            quickToast(card || button, `已加選 ${formatQuickTime(ctx, added)}` + (addedSection ? '（超過 30 秒，藍色選印）' : ''));
            showReviewTime(added);
        } catch (error) {
            quickToast(button, `加選失敗：${error?.message || error}`, true);
        } finally {
            if (button.isConnected) { button.textContent = '＋ 加選一個'; button.disabled = false; }
            setReviewBusy(false);
        }
    }

    // 選印清單開啟時，在網站心電圖視窗的「Mesurer／Imprimer」旁加入「取消選印」「換一個」，作用於目前顯示的選印。
    const reviewDialogStyle = document.createElement('style');
    reviewDialogStyle.textContent = `
        .rc-review-dialog-actions { display:inline-flex; align-items:center; gap:6px; margin-right:10px; vertical-align:top; height:44px; }
        .rc-review-dialog-actions .rc-review-btn { flex:0 0 auto; height:26px; padding:0 12px; border-radius:13px; font-size:12px; }
        .rc-review-group { height:22px; padding:0 10px; border:1px solid #fff; border-radius:11px; background:transparent; color:#fff;
            font-family:inherit; font-size:12px; font-weight:600; cursor:pointer; }
        .rc-review-group:hover:not(:disabled) { background:#fff; color:#5b7d1a; }
        .rc-review-group:disabled { cursor:progress; opacity:.7; }
        .rc-review-btn.is-eye { border-color:#cfe0a8; background:#f6faee; color:#5b7d1a; }
        .rc-review-btn.is-eye[aria-pressed="true"] { border-color:#5b7d1a; background:#5b7d1a; color:#fff; }
        /* 心電圖視窗上的列印範圍：虛線為報告下方 30 秒縮圖的範圍，實線為印出的 8 秒 */
        .rc-printrange { pointer-events:none; }
        .rc-printrange.is-context { fill:none; stroke:#5b7d1a; stroke-width:1.5; stroke-dasharray:6 4; }
        .rc-printrange.is-main { fill:rgba(173,209,73,.08); stroke:#5b7d1a; stroke-width:1.5; }
    `;
    document.head.appendChild(reviewDialogStyle);
    // 心電圖視窗的「👁 列印範圍」：與縮圖的眼睛分開，預設關閉，開啟後保持到重新整理頁面。
    let reviewDialogRangeOn = false;
    function drawReviewPrintRange() {
        const dialog = getReviewECGDialog();
        const existing = document.querySelectorAll('.rc-printrange');
        let scope = null;
        try { scope = dialog && window.angular?.element(dialog).scope(); } catch (_) {}
        while (scope && !scope.af) scope = scope.$parent;
        const af = scope?.af;
        const time = Number(af?.eventDialog?.printInfo?.dataTms);
        const trend = af?.ECGTrendDialog;
        const range = Array.isArray(trend?.timeRange) ? trend.timeRange.map(Number) : [];
        const printStart = review && reviewDialogRangeOn && review.items.includes(time) && range.length === 2
            && Number.isFinite(Number(trend.startTime)) ? reviewPrintStart(review.ctx, time) : null;
        if (printStart === null) { existing.forEach(node => node.remove()); return; }
        const boxes = [['context', printStart - PRINT_CONTEXT_BEFORE, PRINT_CONTEXT_SECONDS]];
        // Event Tag 的印出範圍已有橘色選印框，只加 30 秒的範圍。
        if (!review.ctx.config.tag) boxes.push(['main', printStart, PRINT_SHOWN_SECONDS]);
        const strips = getTagPrintStrips({ dialog, range, viewStart: Number(trend.startTime) });
        for (const node of existing) if (!strips.some(strip => strip.svg.contains(node))) node.remove();
        for (const strip of strips) {
            const width = Number(strip.svg.getAttribute('width')) || strip.svg.getBoundingClientRect().width;
            const height = Number(strip.svg.getAttribute('height')) || strip.svg.getBoundingClientRect().height;
            const scale = width / strip.seconds;
            for (const [kind, start, seconds] of boxes) {
                let rect = strip.svg.querySelector(`:scope > rect.rc-printrange.is-${kind}`);
                if (!rect) {
                    rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('class', `rc-printrange is-${kind}`);
                    strip.svg.appendChild(rect);
                }
                // 範圍的邊剛好落在波形邊緣時往內縮 1px，虛線才看得到，不會被誤認為範圍還延伸到畫面外；
                // 真的超出畫面時維持原樣（該側沒有邊線）。
                let x0 = (start - strip.from) * scale;
                let x1 = x0 + seconds * scale;
                if (Math.abs(x0) <= 1.5) x0 = 1;
                if (Math.abs(x1 - width) <= 1.5) x1 = width - 1;
                rect.setAttribute('x', String(x0));
                rect.setAttribute('y', '1');
                rect.setAttribute('width', String(Math.max(0, x1 - x0)));
                rect.setAttribute('height', String(Math.max(0, height - 2)));
            }
        }
    }
    function getReviewECGDialog() {
        return document.querySelector('.ngdialog.ecg-dialog #af-ecg-dialog-v2');
    }
    function decorateReviewDialog() {
        drawReviewPrintRange();
        let actions = document.querySelector('.rc-review-dialog-actions');
        const time = review?.active ?? null;
        const tools = (getReviewECGDialog() || document.querySelector('.ngdialog.section-dialog #af-section-dialog'))
            ?.querySelector('.dialog-content .tool-btns');
        if (!review || time === null || !review.items.includes(time) || !tools) { actions?.remove(); return; }
        if (!actions || actions.parentElement !== tools) {
            actions?.remove();
            actions = document.createElement('div');
            actions.className = 'rc-review-dialog-actions';
            actions.innerHTML = '<button type="button" class="rc-review-btn is-eye" aria-pressed="false"'
                + ' title="在心電圖上標出報告的列印範圍：實線為印出的 8 秒，虛線為下方 30 秒縮圖的範圍">👁 列印範圍</button>'
                + '<button type="button" class="rc-review-btn is-cancel">取消選印</button>'
                + '<button type="button" class="rc-review-btn is-swap">換一個</button>';
            actions.querySelector('.is-eye').addEventListener('click', () => {
                reviewDialogRangeOn = !reviewDialogRangeOn;
                decorateReviewDialog();
            });
            // 按下時才讀取目前顯示的選印，切換到其他張後也作用在正確的心電圖上。
            actions.querySelector('.is-cancel').addEventListener('click', event => {
                if (review?.active != null) cancelReviewPrint(review.active, event.currentTarget);
            });
            actions.querySelector('.is-swap').addEventListener('click', event => {
                if (review?.active != null) swapReviewPrint(review.active, event.currentTarget);
            });
            tools.prepend(actions);
        }
        actions.querySelector('.is-swap').hidden = !!review.ctx.config.reviewOnly;
        // 列印範圍只用在一般心電圖視窗；藍色區段選印的報告版面不同，不顯示。
        const eye = actions.querySelector('.is-eye');
        eye.hidden = !getReviewECGDialog() || reviewPrintStart(review.ctx, time) === null;
        eye.setAttribute('aria-pressed', String(reviewDialogRangeOn));
        const forced = !!review.cards.get(time)?.classList.contains('is-forced');
        for (const button of actions.querySelectorAll('button:not(.is-eye)')) {
            button.disabled = forced || review.busy || review.grouping;
            button.title = forced ? '橘色強制選印由網站決定，無法在此取消或替換' : '';
        }
    }

    // ── Event Tag 選印時間：從 Event Tag 清單開啟的心電圖視窗中，滑鼠移到心電圖（上方 20 秒或下方 60 秒長條）
    // 時以虛線框顯示 10 秒的選印範圍，點一下即把選印時間移到該處，取代逐次點 ◀ ▶。
    // 與網站 adjustTagEventRange 相同：選印起點只能在標籤前 50 秒至標籤時間之間（紀錄開頭附近改為開頭起 60 秒內），
    // 並以 ◀ ▶ 的步距（5 秒）對齊；寫入 af.eventRecordRange.tag，關閉清單時由網站上傳。
    // Mesurer（放大量測）、R-type／Pause 編輯、PR 量測、按著修飾鍵或拖曳時都不處理，交給網站。
    const TAG_PRINT_SECONDS = 10;
    // 網站 ecgMask：Event Tag 的 10 秒中只印出前 8 秒，後 2 秒在清單上以灰色標示、報告中看不到。
    const TAG_PRINT_SHOWN = 8;
    const TAG_PRINT_STEP = 5;
    const TAG_PRINT_BEFORE = 50;
    function getTagPrintWindow(af, tagTime) {
        const recordStart = Number(af?.record?.startTimeInt);
        let bounds = [tagTime - TAG_PRINT_BEFORE, tagTime];
        if (bounds[0] < recordStart) bounds = [recordStart, recordStart + 60];
        // ◀ ▶ 由「已存的起點，沒有時為範圍終點」每次加減 5 秒，可到達的起點都與範圍終點相差 5 秒的倍數。
        let anchor = bounds[1];
        if (anchor < recordStart) anchor = recordStart;
        // 還沒調整過時，清單上顯示（也就是選印）的是標籤時間起 10 秒（base）。
        const base = Math.max(tagTime, recordStart);
        const saved = Number(af?.eventRecordRange?.tag?.[tagTime]);
        let start = saved || base;
        if (start < recordStart) start = recordStart;
        const steps = Math.floor((anchor - bounds[0]) / TAG_PRINT_STEP);
        return { start, base, anchor, min: anchor - steps * TAG_PRINT_STEP, max: anchor };
    }
    // 依游標時間（印出的 8 秒的中心）換算成可到達的起點；viewEnd 為心電圖視窗的結束時間，選印範圍不超出視窗。
    function snapTagPrintStart(limits, centerTime, viewEnd = Infinity) {
        const step = TAG_PRINT_STEP;
        const grid = value => limits.anchor + Math.floor((value - limits.anchor) / step) * step;
        const max = Math.max(limits.min, Math.min(limits.max, grid(viewEnd - TAG_PRINT_SECONDS)));
        const raw = centerTime - TAG_PRINT_SHOWN / 2;
        const snapped = Math.min(max, Math.max(limits.min, limits.anchor + Math.round((raw - limits.anchor) / step) * step));
        // 紀錄開頭附近的標籤：預設起點（標籤時間）不在 ◀ ▶ 的 5 秒格點上，游標較靠近它時也可選回預設起點，
        // 否則虛線框永遠無法與目前的選印重疊。
        const base = limits.base;
        if (Number.isFinite(base) && base >= limits.min && base <= max && Math.abs(raw - base) < Math.abs(raw - snapped)) return base;
        return snapped;
    }
    // Mesurer（放大量測）、R-type／Pause 編輯、PR 量測等需要點擊波形的網站功能是否開啟。
    function isECGMeasuring(af) {
        return !!(af?.ecgEnlargedChart?.chartSwitch || af?.ruler?.rulerMode || af?.labelEditing?.edit
            || af?.labelEditing?.pauseEdit || document.querySelector('#af-pr-dialog'));
    }
    // 目前心電圖視窗屬於哪個 Event Tag；不是從 Event Tag 清單開啟的或正在量測時回傳 null。
    function getTagPrintContext() {
        if (!window.angular) return null;
        const dialog = document.querySelector('.ngdialog.ecg-dialog #af-ecg-dialog-v2');
        if (!dialog) return null;
        let scope;
        try { scope = window.angular.element(dialog).scope(); } catch (_) { return null; }
        let host = scope;
        while (host && typeof host.adjustTagEventRange !== 'function') host = host.$parent;
        const af = host?.af;
        const info = af?.eventDialog?.printInfo;
        const tagTime = Number(info?.dataTms);
        if (!af || info?.dialogType !== 'tags' || af.eventDialog?.dscp?.type !== 'tags' || !Number.isFinite(tagTime)) return null;
        if (isECGMeasuring(af) || af.loading?.ecg) return null;
        const trend = af.ECGTrendDialog;
        const range = Array.isArray(trend?.timeRange) ? trend.timeRange.map(Number) : [];
        if (range.length < 2 || !Number.isFinite(Number(trend.startTime))) return null;
        return { dialog, host, af, tagTime, viewStart: Number(trend.startTime), range };
    }
    // 心電圖視窗中可點選的波形：下方含綠色顯示範圍的是 60 秒長條，其餘為上方 20 秒心電圖（3 導程時有多條）。
    function getTagPrintStrips(ctx) {
        return [...ctx.dialog.querySelectorAll('.ecg-wave .ecgWave svg')].map(svg => {
            const overview = !!svg.querySelector('rect.pdfHighlightRect');
            return { svg, overview, from: overview ? ctx.range[0] : ctx.viewStart,
                seconds: overview ? ctx.range[1] - ctx.range[0] : 20 };
        }).filter(strip => strip.seconds > 0 && strip.svg.getBoundingClientRect().width > 0);
    }
    function tagStripTime(strip, clientX) {
        const rect = strip.svg.getBoundingClientRect();
        return strip.from + Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * strip.seconds;
    }
    // 波形實際看得到的時間範圍：視窗比心電圖窄時，網站的心電圖會被外層裁掉（或需左右捲動），只算看得到的部分。
    function tagStripVisible(strip) {
        const rect = strip.svg.getBoundingClientRect();
        let left = rect.left, right = rect.right;
        for (let el = strip.svg.parentElement; el && el !== document.body; el = el.parentElement) {
            if (getComputedStyle(el).overflowX === 'visible') continue;
            const box = el.getBoundingClientRect();
            left = Math.max(left, box.left);
            right = Math.min(right, box.right);
        }
        left = Math.max(left, 0);
        right = Math.min(right, window.innerWidth);
        const toTime = x => strip.from + Math.max(0, Math.min(1, (x - rect.left) / rect.width)) * strip.seconds;
        return right > left ? { from: toTime(left), to: toTime(right) } : { from: strip.from, to: strip.from + strip.seconds };
    }
    // 點選的範圍不超出 60 秒長條看得到的部分。
    function tagViewEnd(ctx) {
        const overview = getTagPrintStrips(ctx).find(strip => strip.overview);
        return Math.min(ctx.range[1], overview ? tagStripVisible(overview).to : Infinity);
    }
    const tagPrintStyle = document.createElement('style');
    tagPrintStyle.textContent = `
        .rc-tagwin { pointer-events:none; }
        .rc-tagwin.is-current { fill:none; stroke:#d88f3f; stroke-width:1.5; }
        .rc-tagwin.is-hover { fill:none; stroke:#2c6aa0; stroke-width:1.5; stroke-dasharray:6 4; }
        .rc-tagwin-text { pointer-events:none; fill:#2c6aa0; font:600 11px Arial,"Microsoft JhengHei",sans-serif; }
        .rc-tagwin-cut { pointer-events:none; fill:rgba(0,0,0,.08); }
        .rc-tagwin-edge { pointer-events:none; fill:#d88f3f; font:600 11px Arial,"Microsoft JhengHei",sans-serif; }
    `;
    document.head.appendChild(tagPrintStyle);
    let tagHover = null; // { start } 滑鼠所在位置對應的起點
    // 在每條波形上畫出目前的選印範圍（實線）與滑鼠位置的範圍（虛線）。
    function drawTagPrintWindows() {
        const ctx = getTagPrintContext();
        for (const node of document.querySelectorAll('.rc-tagwin, .rc-tagwin-text, .rc-tagwin-cut, .rc-tagwin-edge')) {
            if (!ctx || !ctx.dialog.contains(node)) node.remove();
        }
        if (!ctx) { tagHover = null; return; }
        const current = getTagPrintWindow(ctx.af, ctx.tagTime).start;
        for (const strip of getTagPrintStrips(ctx)) {
            const width = Number(strip.svg.getAttribute('width')) || strip.svg.getBoundingClientRect().width;
            const height = Number(strip.svg.getAttribute('height')) || strip.svg.getBoundingClientRect().height;
            const scale = width / strip.seconds;
            // 框內最後 2 秒（不會印出）另以灰色標示，與清單上網站的灰色區塊相同。
            const place = (kind, start) => {
                let rect = strip.svg.querySelector(`:scope > rect.rc-tagwin.is-${kind}`);
                let cut = strip.svg.querySelector(`:scope > rect.rc-tagwin-cut.is-${kind}`);
                if (start === null) { rect?.remove(); cut?.remove(); return; }
                if (!cut) {
                    cut = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    cut.setAttribute('class', `rc-tagwin-cut is-${kind}`);
                    strip.svg.appendChild(cut);
                }
                if (!rect) {
                    rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('class', `rc-tagwin is-${kind}`);
                    strip.svg.appendChild(rect);
                }
                const y = 1, h = Math.max(0, height - 2);
                rect.setAttribute('x', String((start - strip.from) * scale));
                rect.setAttribute('y', String(y));
                rect.setAttribute('width', String(TAG_PRINT_SECONDS * scale));
                rect.setAttribute('height', String(h));
                cut.setAttribute('x', String((start + TAG_PRINT_SHOWN - strip.from) * scale));
                cut.setAttribute('y', String(y));
                cut.setAttribute('width', String((TAG_PRINT_SECONDS - TAG_PRINT_SHOWN) * scale));
                cut.setAttribute('height', String(h));
            };
            place('current', current);
            // 60 秒長條：目前的選印（印出的 8 秒）有部分在畫面外時，在該側邊緣標示選印時間。
            // 紀錄開頭附近的標籤，網站的 ◀ ▶ 可以把選印移到畫面之外。
            let edge = strip.svg.querySelector(':scope > text.rc-tagwin-edge');
            const visible = strip.overview ? tagStripVisible(strip) : null;
            const before = !!visible && current < visible.from;
            const after = !!visible && current + TAG_PRINT_SHOWN > visible.to;
            if (strip.overview && (before || after)) {
                if (!edge) {
                    edge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    edge.setAttribute('class', 'rc-tagwin-edge');
                    strip.svg.appendChild(edge);
                }
                edge.setAttribute('x', String(before ? (visible.from - strip.from) * scale + 4 : (visible.to - strip.from) * scale - 4));
                edge.setAttribute('y', String(height - 6));
                edge.setAttribute('text-anchor', before ? 'start' : 'end');
                const label = `選印 ${formatTagClock(ctx, current)}–${formatTagClock(ctx, current + TAG_PRINT_SHOWN)}`;
                setSvgText(edge, before ? `← ${label}` : `${label} →`);
            } else edge?.remove();
            const hover = tagHover && tagHover.start !== current ? tagHover.start : null;
            place('hover', hover);
            let text = strip.svg.querySelector(':scope > text.rc-tagwin-text');
            if (hover === null) { text?.remove(); continue; }
            if (!text) {
                text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('class', 'rc-tagwin-text');
                strip.svg.appendChild(text);
            }
            text.setAttribute('x', String((hover - strip.from) * scale + 4));
            text.setAttribute('y', '13');
            setSvgText(text, `點一下：選印 ${formatTagClock(ctx, hover)}–${formatTagClock(ctx, hover + TAG_PRINT_SHOWN)}`);
        }
    }
    // 內容相同時不重設：改文字會觸發頁面變動，而頁面變動又會重畫，避免不斷重畫。
    function setSvgText(node, text) {
        if (node.textContent !== text) node.textContent = text;
    }
    function formatTagClock(ctx, time) {
        try {
            const text = ctx.host.tmsFormat?.(time, 'HH:mm:ss');
            if (text) return text;
        } catch (_) {}
        return new Date(time * 1000).toLocaleTimeString();
    }
    function findTagStrip(ctx, target) {
        return getTagPrintStrips(ctx).find(strip => strip.svg.contains(target)) || null;
    }
    // 與網站 ◀ ▶ 相同的方式寫入：清單上有這張時借用 adjustTagEventRange，順便更新清單上的心電圖。
    function setTagPrintStart(ctx, start) {
        const af = ctx.af;
        if (!af.eventRecordRange) af.eventRecordRange = {};
        if (!af.eventRecordRange.tag) af.eventRecordRange.tag = {};
        const ranges = af.eventRecordRange.tag;
        const item = (Array.isArray(af.eventDialog.currentData) ? af.eventDialog.currentData : [])
            .find(entry => entry && toEventTime(entry) === ctx.tagTime);
        ctx.host.$apply(() => {
            if (item) {
                // 先放在前一步，網站再往後移 5 秒正好落在 start；紀錄開頭（前一步早於開頭）改從後一步往前移。
                const fromAfter = start - TAG_PRINT_STEP < Number(af.record?.startTimeInt);
                ranges[ctx.tagTime] = fromAfter ? start + TAG_PRINT_STEP : start - TAG_PRINT_STEP;
                ctx.host.adjustTagEventRange(fromAfter ? 'prev' : 'next', item, 'tag');
            }
            if (Number(ranges[ctx.tagTime]) !== start) {
                ranges[ctx.tagTime] = start;
                if (item) item.timeRange = [start, start + TAG_PRINT_SECONDS];
            }
        });
    }
    // 心電圖視窗左右捲動時，畫面外的標示跟著看得到的邊緣移動。
    let tagScrollPending = false;
    document.addEventListener('scroll', () => {
        if (tagScrollPending || !document.querySelector('.rc-tagwin')) return;
        tagScrollPending = true;
        requestAnimationFrame(() => { tagScrollPending = false; drawTagPrintWindows(); });
    }, { capture: true, passive: true });
    let tagPointerDown = null;
    document.addEventListener('mousemove', event => {
        const inside = event.target.closest?.('.ngdialog.ecg-dialog .ecg-wave .ecgWave svg')
            && !event.target.closest('.rc-lead-eye');
        if (!inside && !tagHover) return;
        const ctx = inside && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !labelDrag
            ? getTagPrintContext() : null;
        const strip = ctx && findTagStrip(ctx, event.target);
        const next = strip ? { start: snapTagPrintStart(getTagPrintWindow(ctx.af, ctx.tagTime),
            tagStripTime(strip, event.clientX), tagViewEnd(ctx)) } : null;
        // Mesurer 等開啟時收起選印範圍框，不擋住量測。
        if (inside && !ctx && document.querySelector('.rc-tagwin')) { tagHover = null; drawTagPrintWindows(); return; }
        if (next?.start === tagHover?.start) return;
        tagHover = next;
        drawTagPrintWindows();
    }, { capture: true, passive: true });
    document.addEventListener('mousedown', event => {
        tagPointerDown = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
    }, true);
    document.addEventListener('click', event => {
        if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || labelDrag) return;
        if (!event.target.closest?.('.ngdialog.ecg-dialog .ecg-wave .ecgWave svg')) return;
        if (event.target.closest('.rc-lead-eye')) return; // 導程眼睛按鈕自己處理點擊
        // 拖曳（例如選取或捲動）放開時不算點一下。
        if (tagPointerDown && Math.hypot(event.clientX - tagPointerDown.x, event.clientY - tagPointerDown.y) > 4) return;
        const ctx = getTagPrintContext();
        const strip = ctx && findTagStrip(ctx, event.target);
        if (!strip) return;
        // 這次點擊用來移動選印範圍：不交給網站波形的點擊（未開 Mesurer 也會畫出量測虛線）。
        event.preventDefault();
        event.stopImmediatePropagation();
        clearECGMeasureLine(strip.svg);
        const start = snapTagPrintStart(getTagPrintWindow(ctx.af, ctx.tagTime), tagStripTime(strip, event.clientX), tagViewEnd(ctx));
        if (start !== getTagPrintWindow(ctx.af, ctx.tagTime).start) setTagPrintStart(ctx, start);
        tagHover = null;
        drawTagPrintWindows();
        quickToast(strip.svg, `選印時間：${formatTagClock(ctx, start)}–${formatTagClock(ctx, start + TAG_PRINT_SHOWN)}`);
        // 選印清單中這張的縮圖改顯示新的選印範圍。
        const card = review?.ctx.config.tag ? review.cards.get(ctx.tagTime) : null;
        if (card) reloadReviewThumb(card, ctx.tagTime);
    }, true);
    // 選印清單開著時：網站點擊心電圖波形會切換並畫出 Mesurer 的量測虛線（未開 Mesurer 也會），
    // 只有 Mesurer 等量測功能開啟時才交給網站，否則擋下這次點擊。上方的標籤列不在波形內，改標籤不受影響。
    document.addEventListener('click', event => {
        if (!review || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || labelDrag) return;
        const svg = event.target.closest?.('.ngdialog.ecg-dialog .ecg-wave .ecgWave svg');
        if (!svg || !window.angular || event.target.closest('.rc-lead-eye')) return; // 導程眼睛按鈕不擋
        let scope;
        try { scope = window.angular.element(svg).scope(); } catch (_) { return; }
        while (scope && !scope.af) scope = scope.$parent;
        if (!scope?.af || isECGMeasuring(scope.af)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        clearECGMeasureLine(svg);
    }, true);
    // 先前點擊留下的量測虛線（網站的 eventSwitch 仍開著）一併關閉，滑鼠移動時網站就會收起。
    function clearECGMeasureLine(svg) {
        let wave;
        try { wave = window.angular.element(svg.closest('.ecgWave')).isolateScope(); } catch (_) { return; }
        if (wave?.eventSwitch) wave.$apply(() => { wave.eventSwitch = false; });
    }

    // Group：先儲存未儲存的標籤修改（與心電圖視窗的 Save 相同），等上傳完成後執行網站的 Group All
    // （伺服器重新分類事件並重新載入資料），載入完成後重新開啟同類型的事件清單與選印清單。
    const GROUP_SAVE_TIMEOUT_MS = 30000;
    const GROUP_RELOAD_TIMEOUT_MS = 90000;
    function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    // 每 100 毫秒檢查一次；check 連續成立 stableMs 才算完成。
    async function waitStable(check, stableMs, timeout) {
        const started = Date.now();
        let since = null;
        while (Date.now() - started < timeout) {
            let ok = false;
            try { ok = !!check(); } catch (_) {}
            if (!ok) since = null;
            else if (since === null) since = Date.now();
            else if (Date.now() - since >= stableMs) return true;
            await waitMs(100);
        }
        return false;
    }
    function getAFHost() {
        const element = document.querySelector('[ng-controller="RootiCareDashboardAFCtrl"]');
        if (!element || !window.angular) return null;
        let scope;
        try { scope = window.angular.element(element).scope(); } catch (_) { return null; }
        while (scope && typeof scope.classifyType !== 'function') scope = scope.$parent;
        return scope || null;
    }
    function isSiteLoading(host) {
        try {
            return !!host.rooticare?.loading || (typeof host.checkIsLoading === 'function' && host.checkIsLoading(host.af));
        } catch (_) { return true; }
    }
    // 上傳尚未儲存的選印：與網站關閉事件清單時的 postPDFSelectedEvents 相同，內容沒變就不上傳。
    // Group All 會從伺服器重新載入選印，清單開著時選的（含快速選印）若沒先上傳就會被覆蓋。
    async function uploadPrintSelections(af) {
        const printDialog = af?.printDialog;
        if (!printDialog?.selectedEvents) return;
        if (JSON.stringify(printDialog.tmpSelectedEvents) === JSON.stringify(printDialog.selectedEvents)) return;
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const snapshot = window.angular.copy(printDialog.selectedEvents);
        await manager.Af.postPDFSelectedEvents(af._vendorId, af._idNumber, af._measureId, printDialog.selectedEvents);
        printDialog.tmpSelectedEvents = snapshot;
    }
    // 上傳藍色選印（區段選印）：網站把區段範圍存在 eventRecordRange，關閉事件清單時以 postEventRangeAdjust 上傳
    // （連同 AF 心率資料 af_stat），與 ogEventRecordRange 相同就不上傳。
    async function uploadSectionSelections(af) {
        if (!af?.eventRecordRange) return;
        if (JSON.stringify(af.eventRecordRange) === JSON.stringify(af.ogEventRecordRange)) return;
        const manager = window.angular.element(document.body).injector().get('WppManager');
        const payload = window.angular.copy(af.eventRecordRange);
        payload.af_stat = af.afHRData;
        await manager.Af.postEventRangeAdjust(af._vendorId, af._idNumber, af._measureId, payload);
        af.ogEventRecordRange = window.angular.copy(af.eventRecordRange);
    }
    function findPrintReviewAnchor(type) {
        for (const summary of document.querySelectorAll('.rc-print-summary.is-link')) {
            const ctx = getQuickContext(summary);
            if (ctx?.type === type) return summary;
        }
        return null;
    }
    async function groupReview() {
        if (!review || review.busy || review.grouping) return;
        const { ctx } = review;
        const type = ctx.type;
        const button = review.bar.querySelector('.rc-review-group');
        const host = getAFHost();
        if (!host) { quickToast(button, '找不到網站的 Group All 功能', true); return; }
        if (!ctx.af.editingSwitch) { quickToast(button, '請先進入編輯模式（點計時器）再 Group', true); return; }
        review.grouping = true;
        setReviewBusy(true);
        const setText = text => { if (button.isConnected) button.textContent = text; };
        try {
            // 1. 儲存：網站的 Save 會上傳修改並關閉心電圖視窗；沒有開著心電圖視窗時先開一張，避免關到事件清單。
            if (ctx.af.ecgAnno?.modifiedData?.length) {
                setText('儲存中…');
                if (!getReviewECGDialog() && review.items.length) await showReviewTime(review.active ?? review.items[0], true);
                if (!getReviewECGDialog()) throw new Error('無法開啟心電圖視窗以儲存修改');
                ctx.host.$apply(() => ctx.host.saveCurrentModifiedData());
                const saved = await waitStable(() => !ctx.af.loading?.modified, 300, GROUP_SAVE_TIMEOUT_MS);
                if (!saved) throw new Error('儲存逾時');
                // 網站在上傳後 2.5 秒會重新整理清單的心電圖，等它跑完再 Group。
                await waitMs(2700);
            }
            // 2. 先上傳選印（含快速選印），否則 Group All 重新載入時會被伺服器上的舊選印覆蓋。
            setText('儲存選印…');
            await uploadPrintSelections(host.af);
            await uploadSectionSelections(host.af);
            // 記下目前畫面：清單頁碼與正在看的選印，重新載入後回到同一處。
            const restorePage = Number(ctx.dialog.pagination?.currentPage) || 1;
            const restoreTime = review.active;
            // 3. Group All：伺服器重新分類後網站會重新載入整份資料（AF 區塊可能重建，開著的清單會被關掉）。
            //    每次都重新取得目前的 AF scope，等它不再載入、這個類型的清單資料就緒且穩定 1.5 秒。
            setText('Group 中…');
            host.$apply(() => host.classifyType('all'));
            await waitStable(() => { const h = getAFHost(); return !h || h !== host || isSiteLoading(h); }, 0, 5000);
            const loaded = await waitStable(() => {
                const h = getAFHost();
                return h && !isSiteLoading(h) && Array.isArray(h.af?.eventDialog?.[type]?.data);
            }, 1500, GROUP_RELOAD_TIMEOUT_MS);
            if (!loaded) throw new Error('重新載入逾時');
            // 4. 回到原本的畫面：同類型清單、同一頁、選印清單並開啟原本那張心電圖。
            setText('重整中…');
            closePrintReview();
            const ngDialog = window.angular.element(document.body).injector().get('ngDialog');
            for (const dialog of document.querySelectorAll('.ngdialog.ecg-dialog, .ngdialog.section-dialog, .ngdialog.event-dialog')) {
                if (dialog.id) ngDialog.close(dialog.id);
            }
            await waitFor(() => !document.querySelector('.ngdialog.ecg-dialog, .ngdialog.section-dialog, .ngdialog.event-dialog'), 3000);
            const freshHost = getAFHost();
            if (!freshHost?.af?.eventDialog?.[type]?.itemsLength) {
                quickToast(null, 'Group 完成；這個類型目前沒有事件，未重新開啟清單');
                return;
            }
            freshHost.$apply(() => freshHost.openEventBasicList(type));
            await waitFor(() => !!findPrintReviewAnchor(type), 15000);
            const anchor = findPrintReviewAnchor(type);
            if (!anchor) { quickToast(null, 'Group 完成，但無法重新開啟選印清單'); return; }
            const range = anchor.closest('.ngdialog')?.querySelector('.pagination-range');
            const pageCount = Number(freshHost.af.eventDialog.pagination?.pageCount)
                || Math.ceil(freshHost.af.eventDialog[type].itemsLength / (Number(freshHost.af.eventDialog.pagination?.itemsPerPage) || 1));
            if (restorePage > 1 && range) jumpToPage(range, Math.min(restorePage, pageCount || restorePage));
            openPrintReview(anchor, restoreTime);
            quickToast(review?.bar.querySelector('.rc-review-group') || null, 'Group 完成，已重新整理清單');
        } catch (error) {
            quickToast(button, `Group 失敗：${error?.message || error}`, true);
        } finally {
            if (review?.grouping) {
                review.grouping = false;
                setText('Group');
                setReviewBusy(false);
            }
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
