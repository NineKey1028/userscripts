// ==UserScript==
// @name         RootiCare 標註快捷鍵
// @namespace    https://editoreu.rooticare.com/
// @version      1.10.4
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
// 按住 Alt + 1 / 2 / 3 並移動滑鼠：僅修改碰到的既有標籤。
// 按住 4 並移動滑鼠：連續刪除碰到的標籤；滑鼠中鍵：刪除點擊的標籤。
// Ctrl + 1 / 2 / 3：記錄區間起點，在面板設定篩選條件，再於終點按快捷鍵套用 V / S / N。
// 區間可跨心電圖視窗；Esc：取消尚未完成的區間操作。
// W / S：模擬方向鍵 ↑ / ↓，調整心電圖縮放。
// Morphology 頁面停用標註操作；Alt 按鍵事件仍會被攔截。

(function() {
    'use strict';

    // 設定與操作狀態
    const USE_FIXED_POS = true; // V、S 輪轉會經過空白時， true：新標籤位置按原始位置生成； false：新標籤位置按滑鼠位置生成
    const sequence = ['', 'N', 'S', 'V']; // 點擊循環順序

    const TARGET_BLOCK_SELECTOR = '.ecg-individual-blk, .event-tag-blk.ng-scope'; // 追蹤的容器名稱
    // 依目前網址辨識 Morphology 路由；站內切頁不一定重新載入，因此操作前也要檢查。
    function isDisabledPage() {
        return /^\/rooti-care\/morphology(?:\/|$)/.test(window.location?.pathname || '');
    }
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let currentMousePos = { x: 0, y: 0 };

    const style = document.createElement('style');
    style.innerHTML = `
        ${TARGET_BLOCK_SELECTOR}:focus {
            outline: none !important;
            box-shadow: none !important;
        }
    `;
    document.head.appendChild(style);

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
    `;
    document.head.appendChild(rangeStyle);
    document.body.appendChild(rangeHint);
    let rangeMessage;
    let rangeControls;
    // 首次需要時才建立區間設定面板，保存節點供後續選取重用。
    // 上下限分別勾選才啟用；面板事件不向外傳遞，避免輸入數字時觸發網站分類快捷鍵。
    function ensureRangeControls() {
        if (rangeControls) return;
        rangeHint.innerHTML = `<div class="rh-head"><div data-role="message" role="status" aria-live="polite"></div>
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
        if (rangeHint.contains(e.target)) {
            if (e.key === 'Escape') { e.preventDefault(); cancelRange(); }
            return;
        }
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;

        const key = e.key.toLowerCase();
        const isAltPressed = e.altKey;
        if (key === 'escape' && rangeMode) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cancelRange();
            return;
        }
        if (e.ctrlKey && !e.altKey && !e.metaKey && ['1', '2', '3'].includes(key)) {
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

        if (key === 'w' || key === 's') {
            if (document.querySelector('.fixed-board') || activeBlock) {
                e.preventDefault();
                e.stopImmediatePropagation();
                key === 'w' ? triggerOriginalKey(38, 'ArrowUp') : triggerOriginalKey(40, 'ArrowDown');
            }
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
