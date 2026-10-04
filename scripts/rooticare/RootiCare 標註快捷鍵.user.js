// ==UserScript==
// @name         RootiCare 標註快捷鍵
// @namespace    https://editoreu.rooticare.com/
// @version      1.6
// @description  針對 V, S, N 元件，點擊中鍵直接模擬多次左鍵點擊以達到刪除效果
// @author       Alex
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標註快捷鍵.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標註快捷鍵.user.js
// 
// 
// @grant        none
// ==/UserScript==

// 將鼠標移至需修改或需標註的位置使用數字鍵 1 ~ 4 快速補上對應的標籤或刪除
// 1：V、2：S、3：N、4以及滑鼠中鍵：刪除
// 按住 Alt + 1 ~ 3 滑動鼠標：僅對現有標籤進行快速修改
// 按住 4 滑動鼠標：快速刪除碰到的所有標籤
// 滑鼠中鍵：將點擊的標籤快速刪除
// Ctrl + 1 / 2 / 3：在滑鼠位置直接記錄端點，第二次按鍵套用 V / S / N；以第二次數字為準，支援跨視窗；Esc 取消
// W / S 對應方向鍵 ↑ / ↓ 拉縮心電圖

(function() {
    'use strict';

    // ================= 配置與變數 =================
    const USE_FIXED_POS = true; // V、S 輪轉會經過空白時， true：新標籤位置按原始位置生成； false：新標籤位置按鼠標位置生成
    const sequence = ['', 'N', 'S', 'V']; // 點擊循環順序

    const TARGET_BLOCK_SELECTOR = '.ecg-individual-blk, .event-tag-blk.ng-scope'; // 追蹤的容器名稱
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

    // 紀錄滑鼠位置
    window.addEventListener('mousemove', (e) => {
        currentMousePos.x = e.clientX;
        currentMousePos.y = e.clientY;
    }, { passive: true });

    // 檢查滑鼠位置下是否有 ECG 區塊
    function getActiveBlockUnderMouse() {
        const elements = document.elementsFromPoint(currentMousePos.x, currentMousePos.y);
        for (let el of elements) {
            const block = el.closest(TARGET_BLOCK_SELECTOR);
            if (block) return block;
        }
        return null;
    }

    // 取得當前位置的元素（優先抓取標籤文本，次之為背景矩形）
    function getElementAtPoint(x, y) {
        const elements = document.elementsFromPoint(x, y);
        return elements.find(el => el.classList.contains('annoText')) ||
               elements.find(el => el.tagName.toLowerCase() === 'rect');
    }

    // 新增：在指定的 X 軸切線上，尋找屬於當前區塊的標籤
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
        const block = e.target.closest(TARGET_BLOCK_SELECTOR);
        if (block && document.activeElement !== block) {
            if (block.tabIndex < 0) block.tabIndex = 0;
            block.focus({ preventScroll: true });
        }
    }, { passive: true });

    // 執行模擬點擊
    function doLockedClick(el, x, y) {
        if (!el) return;
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

    // 模擬鍵盤事件（用於縮放）
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

    // 核心處理函式：將標籤切換至指定的 targetText
    async function processCommand(targetText, point = currentMousePos, rangeBlock = null) {
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

            // 【安全修正】不再盲目搜尋區塊內第一個標籤
            // 而是利用 findLabelAtX，只抓取「X 軸範圍符合最初點擊位置」的那個標籤
            if (!targetEl || !targetEl.classList.contains('annoText')) {
                const localAnno = findLabelAtX(activeBlock, lockedX);
                if (localAnno) {
                    targetEl = localAnno;
                    // 精準將點擊位置修正到該特定標籤的中心點
                    const rect = targetEl.getBoundingClientRect();
                    clickX = rect.left + rect.width / 2;
                    clickY = rect.top + rect.height / 2;
                }
            }

            if (!targetEl) break;

            doLockedClick(targetEl, clickX, clickY);

            // 若網頁畫面更新有延遲導致斷鍵，可取消下行註解
            // await sleep(30);
        }
    }

    let rangeMode = null;
    let rangeBusy = false;
    const rangeHint = document.createElement('div');
    rangeHint.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483000;background:#fff7e1;color:#603b16;padding:8px 12px;border:1px solid #d7873e;border-radius:6px;font:13px Arial;pointer-events:none;display:none';
    document.body.appendChild(rangeHint);
    function showRangeHint(text) {
        rangeHint.textContent = text;
        rangeHint.style.display = 'block';
    }
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
    async function applyIndexRange(first, last, tag) {
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
        if (rangeMode?.cancelled || !first.parent || first.parent.$$destroyed ||
            first.parent.af !== af || first.modifiedData !== af.ecgAnno.modifiedData)
            throw new Error('報告已切換，取消區間修改');
        const pending = first.modifiedData;
        const effective = new Map(Object.entries(data.anno).map(([index, type]) => [Number(index), type]));
        for (const item of pending) {
            if (item[4] && item[1] >= start && item[1] <= end) effective.set(item[1], item[2]);
        }
        const updates = [];
        for (const [index, type] of effective) {
            if (!Number.isFinite(index) || index < start || index > end ||
                !['N', 'S', 'A', 'V'].includes(type) || type === tag) continue;
            const existing = pending.find(item => item[4] && item[1] === index);
            const original = existing ? existing[3] : data.anno[index] || type;
            const time = first.startTime + Math.floor((index - first.viewStart) / first.rate);
            updates.push([time, index, tag, original, 1]);
        }
        first.parent.$apply(() => {
            const indices = new Set(updates.map(item => item[1]));
            for (let i = pending.length - 1; i >= 0; i--) {
                if (pending[i][4] && indices.has(pending[i][1])) pending.splice(i, 1);
            }
            pending.push(...updates);
        });
        return updates.length;
    }
    function cancelRange() {
        if (rangeMode) rangeMode.cancelled = true;
        if (!rangeBusy) rangeMode = null;
        if (!rangeBusy) rangeHint.style.display = 'none';
    }
    window.addEventListener('blur', cancelRange);
    async function selectRangePoint(tag) {
        const block = getActiveBlockUnderMouse();
        const svg = block?.querySelector('.annoGroup')?.closest('svg');
        if (!svg) {
            showRangeHint('請將滑鼠移至 ECG 再按 Ctrl + 1／2／3，Esc 取消');
            return;
        }
        try {
            const context = getRangeContext(svg, currentMousePos.x);
            if (!rangeMode?.first) {
                rangeMode = { tag, first: context };
                showRangeHint(`已記錄第一點（${tag}）；移至第二點按 Ctrl + 1／2／3，以第二次數字為準；Esc 取消`);
                return;
            }
            const mode = rangeMode;
            mode.tag = tag;
            rangeBusy = true;
            showRangeHint(`正在將跨視窗區間標籤改為 ${tag}…`);
            const count = await applyIndexRange(mode.first, context, tag);
            rangeMode = null;
            showRangeHint(`範圍標註完成：修改 ${count} 個標籤 → ${tag}，請確認後儲存`);
        } catch (error) {
            showRangeHint(error.message || '區間修改失敗，請重新選取');
            rangeMode = null;
        } finally {
            if (rangeBusy) {
                rangeBusy = false;
                setTimeout(() => { if (!rangeMode && !rangeBusy) rangeHint.style.display = 'none'; }, 3500);
            }
        }
    }

    /**
     * 監聽鍵盤事件
     */
    document.addEventListener('keydown', async function(e) {
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
            // Keep absolute indices while the native ECG viewport moves.
            // Native movement remains available. W/S retain the script's zoom mapping.
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
            const activeBlock = getActiveBlockUnderMouse();
            if (activeBlock) {
                e.preventDefault();
                await processCommand('');
            }
        }
    }, { passive: false });

})();
