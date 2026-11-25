// ==UserScript==
// @name         RootiCare ECG 變動率自動標註器
// @namespace    https://editoreu.rooticare.com/
// @version      1.2.3
// @description  依相鄰心搏間隔計算變動率，預設達 12% 時標紅並加粗；按住反引號鍵顯示各組平均心率（排除灰色背景區段）。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20ECG%20變動率自動標註器.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20ECG%20變動率自動標註器.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @match        https://report2.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

// 使用教學：開啟含有心搏間隔與 BPM 文字的 ECG 畫面，腳本會自動計算並上色。
// 變動率 =（前一個有效間隔 − 目前間隔）/ 目前間隔；預設達 12% 時標紅並加粗。
// 預設採透明度漸層；可修改 HIT_THRESHOLD、ENABLE_GRADIENT 與 TARGET_COLOR。
// 按住反引號鍵（`）：顯示各組平均心率，灰色背景區段的 BPM 不列入；放開按鍵：隱藏平均值。
// 在輸入框或可編輯區域中不觸發平均值快捷鍵。

(function() {
    'use strict';

    // 顯示與計算設定
    const ENABLE_GRADIENT = true; // 是否開啟漸層模式 (true: 越快越紅, false: 達標即全紅)
    const DEBOUNCE_TIME = 100; // 防抖延遲 (ms)
    const MAX_VAL_FILTER = 10000; // 數值過濾上限 (ms)
    const HIT_THRESHOLD = 0.12; // 觸發門檻 (12%)
    const TARGET_COLOR = "#FF0000"; // 目標顏色 (符合條件時的基準色)
    const BASE_COLOR = "#000000"; // 預設顏色 (未達標時)
    const TRIGGER_KEY = "`"; // 觸發按鍵
    // 以下暫存每次分析的結果。

    // 快取各組平均心率及容器，供快捷鍵建立浮層。
    let groupDataCache = [];

    // 每個 annoGroup 分開分析，第一個有效間隔只建立基準，不與上一組資料比較。
    // 以連續有效間隔計算帶正負號的變動率；達門檻才標紅，並快取該組可讀 BPM 的平均值。
    function processECGData() {
        const groups = document.querySelectorAll('.annoGroup');
        groupDataCache = []; // 清空快取

        groups.forEach(group => {
            // 片段內沒有任何心搏標籤（如 Measurement 頁的卡尺量測數值）時，間隔文字不是 R-R，整組略過。
            const beatScope = group.closest('.ecgRMarker') || group;
            if (!beatScope.querySelector('.annoText')) return;

            const textElements = Array.from(group.querySelectorAll('text.annoDuration'));
            let lastValidValue = null;
            const heartRateLabels = []; // 心率與其文字節點，按鍵時用來排除灰色區段

            // 排除間隔達到設定上限的文字節點。
            const msElements = textElements.filter(el => {
                const mainText = el.childNodes[0] ? el.childNodes[0].textContent.trim() : "0";
                const val = parseInt(mainText.match(/\d+/) || [0]);
                return val < MAX_VAL_FILTER;
            });

            msElements.forEach(el => {
                const mainText = el.childNodes[0] ? el.childNodes[0].textContent.trim() : "";
                const match = mainText.match(/\d+/);
                if (!match) return;

                const currentMS = parseFloat(match[0]);

                // 從間隔文字的 tspan 讀取 BPM。
                const tspanEl = el.querySelector('tspan');
                let currentHR = null;
                if (tspanEl) {
                    const hrMatch = tspanEl.textContent.trim().match(/\d+/);
                    if (hrMatch) {
                        currentHR = parseInt(hrMatch[0], 10);
                        heartRateLabels.push({ hr: currentHR, element: el });
                    }
                }

                if (lastValidValue === null) {
                    lastValidValue = currentMS;
                    updateStyle(el, BASE_COLOR, false);
                    return;
                }

                const speedUpRate = (lastValidValue - currentMS) / currentMS;

                if (speedUpRate >= HIT_THRESHOLD) {
                    let finalColor = TARGET_COLOR;

                    if (ENABLE_GRADIENT) {
                        const maxExpectedRate = 0.40;
                        const intensity = Math.min(1, (speedUpRate - HIT_THRESHOLD) / (maxExpectedRate - HIT_THRESHOLD));
                        finalColor = hexToRGBA(TARGET_COLOR, 0.4 + (intensity * 0.6));
                    }

                    updateStyle(el, finalColor, true);
                } else {
                    updateStyle(el, BASE_COLOR, false);
                }

                lastValidValue = currentMS;
            });

            // 保存容器與心率文字，供按鍵顯示平均值使用。
            groupDataCache.push({
                element: group,
                heartRateLabels
            });
        });
    }

    /**
     * 同步設定間隔文字的顏色、字重與子節點顏色。
     */
    function updateStyle(element, color, isHit) {
        const priority = 'important';
        element.style.setProperty('fill', color, priority);
        element.style.setProperty('font-weight', isHit ? 'bold' : 'normal', priority);

        element.querySelectorAll('tspan').forEach(t => {
            t.style.setProperty('fill', color, priority);
        });
    }

    /**
     * 將十六進位顏色轉為帶透明度的 RGBA。
     */
    function hexToRGBA(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // 平均心率浮層與快捷鍵

    // 取得同一 ECG 區塊中灰色背景的螢幕水平範圍。
    // 網站以 .ecgMask 內每秒一格的 rect.mask 表示背景，opacity 大於 0 即為灰色。
    function getGrayRanges(group) {
        const block = group.closest('svg.ecgRMarker')?.parentElement;
        if (!block) return [];
        return [...block.querySelectorAll('.ecgMask rect.mask')]
            .filter(mask => Number(mask.getAttribute('opacity') ?? getComputedStyle(mask).opacity) > 0)
            .map(mask => mask.getBoundingClientRect())
            .filter(rect => rect.width > 0)
            .map(rect => [rect.left, rect.right]);
    }

    // 按鍵當下計算平均心率，只納入文字中心落在白色背景的 BPM，灰色狀態改變後也能即時反映。
    function getWhiteAverage(groupData) {
        const grayRanges = getGrayRanges(groupData.element);
        const rates = groupData.heartRateLabels.filter(({ element }) => {
            if (!element.isConnected) return false;
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            return !grayRanges.some(([left, right]) => centerX >= left && centerX < right);
        }).map(({ hr }) => hr);
        if (!rates.length) return null;
        return (rates.reduce((acc, val) => acc + val, 0) / rates.length).toFixed(2);
    }

    // 浮層至少要有這麼高的可見範圍才顯示（群組本身較矮時需整條可見），避免只露出一小條的群組把浮層蓋到標題列或相鄰區塊上。
    const MIN_VISIBLE_HEIGHT = 24;

    // 群組在畫面上實際看得到的範圍：與每一層會裁切內容的父元素（捲動區、對話框等）及視窗取交集。
    // 清單改為捲動顯示（如「RootiCare 標註快捷鍵」的捲動檢視）時，捲出清單外的卡片仍有位置，
    // 不裁切的話平均值會蓋在對話框標題列上或畫到畫面外。clipCache 讓同一次顯示中共用的父元素只算一次。
    function getVisibleRect(element, clipCache) {
        const rect = element.getBoundingClientRect();
        let { left, top, right, bottom } = rect;
        for (let node = element.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
            let clip = clipCache.get(node);
            if (clip === undefined) {
                const style = getComputedStyle(node);
                clip = /auto|scroll|hidden|clip/.test(`${style.overflowX} ${style.overflowY}`) ? node.getBoundingClientRect() : null;
                clipCache.set(node, clip);
            }
            if (!clip) continue;
            left = Math.max(left, clip.left);
            top = Math.max(top, clip.top);
            right = Math.min(right, clip.right);
            bottom = Math.min(bottom, clip.bottom);
        }
        left = Math.max(left, 0);
        top = Math.max(top, 0);
        right = Math.min(right, window.innerWidth);
        bottom = Math.min(bottom, window.innerHeight);
        const minHeight = Math.min(MIN_VISIBLE_HEIGHT, rect.height) - 0.5; // 0.5：容許小數像素誤差
        return right - left > 0 && bottom - top > 0 && bottom - top >= minHeight ? { left, top, right, bottom } : null;
    }

    // 為有平均心率的群組建立顯示浮層。
    // 依快取的群組位置建立平均心率浮層；忽略沒有可計算平均值或目前看不到的群組。
    function showAverages() {
        // 建立前先清除上一次的顯示。
        hideAverages();
        const clipCache = new Map();

        groupDataCache.forEach((groupData, idx) => {
            if (!groupData.element.isConnected) return;
            // 只放在群組看得到的部分中央（部分捲出捲動區時仍留在可見範圍內）。
            const visible = getVisibleRect(groupData.element, clipCache);
            if (!visible) return;

            const avgHR = getWhiteAverage(groupData);
            if (!avgHR) return; // 沒有白色區段的心率就不顯示

            const centerX = (visible.left + visible.right) / 2;
            const centerY = (visible.top + visible.bottom) / 2;

            // 建立平均心率的顯示節點。
            const overlay = document.createElement('div');
            overlay.className = 'ecg-avg-overlay';
            overlay.textContent = `Avg: ${avgHR} bpm`;

            // 設定浮層的位置、顏色與文字樣式（以視窗座標固定，捲動時由 refreshAverages 重新排列）。
            Object.assign(overlay.style, {
                position: 'fixed',
                left: `${centerX}px`,
                top: `${centerY}px`,
                transform: 'translate(-50%, -50%)', // 完美居中
                backgroundColor: 'rgba(0, 122, 204, 0.9)',
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                zIndex: '99999',
                pointerEvents: 'none', // 防止擋住滑鼠點擊事件
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                whiteSpace: 'nowrap'
            });

            document.body.appendChild(overlay);
        });
    }

    // 移除所有平均心率浮層。
    // 按鍵放開時移除腳本建立的平均值浮層，保留網站本身的 ECG 節點。
    function hideAverages() {
        const overlays = document.querySelectorAll('.ecg-avg-overlay');
        overlays.forEach(el => el.remove());
    }

    // 按住快捷鍵期間只建立一次浮層。
    let isKeyPressed = false;

    window.addEventListener('keydown', (e) => {
        if (e.key === TRIGGER_KEY && !isKeyPressed) {
            // 輸入欄與可編輯區域不觸發平均值顯示。
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            isKeyPressed = true;
            showAverages();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === TRIGGER_KEY) {
            isKeyPressed = false;
            hideAverages();
        }
    });

    // 按住按鍵時捲動（頁面或清單內的捲動區），浮層跟著卡片重新排列；每個畫面更新最多一次。
    let refreshPending = false;
    function refreshAverages() {
        if (!isKeyPressed || refreshPending) return;
        refreshPending = true;
        requestAnimationFrame(() => {
            refreshPending = false;
            if (isKeyPressed) showAverages();
        });
    }
    window.addEventListener('scroll', refreshAverages, { capture: true, passive: true });
    window.addEventListener('resize', refreshAverages);

    // 按住按鍵時切換視窗會收不到 keyup，離開視窗即隱藏，避免浮層留在畫面上。
    window.addEventListener('blur', () => {
        isKeyPressed = false;
        hideAverages();
    });

    // 後續以 DOM 更新觸發分析，並合併連續通知。

    // 觀察器只監看子節點增刪，將密集更新合併後重算；初次延遲 2 秒等網站載入 ECG。
    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(processECGData, DEBOUNCE_TIME);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(processECGData, 2000);
})();
