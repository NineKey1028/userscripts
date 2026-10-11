// ==UserScript==
// @name         RootiCare ECG 變動率自動標註器
// @namespace    https://editoreu.rooticare.com/
// @version      1.0
// @description  依相鄰心搏間隔計算變動率，預設達 12% 時標紅並加粗；按住反引號鍵顯示各組平均心率。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20ECG%20變動率自動標註器.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20ECG%20變動率自動標註器.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

// 使用教學：開啟含有心搏間隔與 BPM 文字的 ECG 畫面，腳本會自動計算並上色。
// 變動率 =（前一個有效間隔 − 目前間隔）/ 目前間隔；預設達 12% 時標紅並加粗。
// 預設採透明度漸層；可修改 HIT_THRESHOLD、ENABLE_GRADIENT 與 TARGET_COLOR。
// 按住反引號鍵（`）：顯示各組平均心率；放開按鍵：隱藏平均值。
// 在輸入框或可編輯區域中不觸發平均值快捷鍵；控制台表格由 ENABLE_LOG 控制。

(function() {
    'use strict';

    // 顯示與計算設定
    const ENABLE_LOG = true; // 是否輸出控制台表格
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

        groups.forEach((group, groupIdx) => {
            const textElements = Array.from(group.querySelectorAll('text.annoDuration'));
            let lastValidValue = null;
            let logData = [];
            let heartRates = []; // 用來儲存此組所有有效的心率值

            // 排除間隔達到設定上限的文字節點。
            const msElements = textElements.filter(el => {
                const mainText = el.childNodes[0] ? el.childNodes[0].textContent.trim() : "0";
                const val = parseInt(mainText.match(/\d+/) || [0]);
                return val < MAX_VAL_FILTER;
            });

            msElements.forEach((el, index) => {
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
                        heartRates.push(currentHR); // 收集心率
                    }
                }

                if (lastValidValue === null) {
                    lastValidValue = currentMS;
                    updateStyle(el, BASE_COLOR, false);
                    if (ENABLE_LOG) pushLog(logData, index, currentMS, lastValidValue, "0.00%", "START", currentHR);
                    return;
                }

                const speedUpRate = (lastValidValue - currentMS) / currentMS;
                const speedUpPercentage = (speedUpRate * 100).toFixed(2) + '%';

                if (speedUpRate >= HIT_THRESHOLD) {
                    let finalColor = TARGET_COLOR;

                    if (ENABLE_GRADIENT) {
                        const maxExpectedRate = 0.40;
                        const intensity = Math.min(1, (speedUpRate - HIT_THRESHOLD) / (maxExpectedRate - HIT_THRESHOLD));
                        finalColor = hexToRGBA(TARGET_COLOR, 0.4 + (intensity * 0.6));
                    }

                    updateStyle(el, finalColor, true);
                    if (ENABLE_LOG) pushLog(logData, index, currentMS, lastValidValue, speedUpPercentage, `HIT`, currentHR);
                } else {
                    updateStyle(el, BASE_COLOR, false);
                    if (ENABLE_LOG) pushLog(logData, index, currentMS, lastValidValue, speedUpPercentage, "NORMAL", currentHR);
                }

                lastValidValue = currentMS;
            });

            // 以本組讀到的心率值計算算術平均。
            let avgHR = null;
            if (heartRates.length > 0) {
                const sum = heartRates.reduce((acc, val) => acc + val, 0);
                avgHR = (sum / heartRates.length).toFixed(2);
            }

            // 保存容器與平均值，供按鍵顯示使用。
            groupDataCache.push({
                element: group,
                avgHR: avgHR
            });

            if (ENABLE_LOG && logData.length > 0) {
                console.group(`[ECG Analysis] Group ${groupIdx + 1}`);
                console.table(logData);

                if (avgHR) {
                    console.log(`%c➔ 本組平均心率: ${avgHR} bpm (計算總數: ${heartRates.length})`, "color: #007acc; font-weight: bold;");
                } else {
                    console.log("➔ 本組未偵測到有效心率資料");
                }

                console.groupEnd();
            }
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

    // 將單筆分析整理為控制台表格欄位；缺少心率時以「無」表示，不補造數值。
    function pushLog(arr, idx, cur, last, rate, status, hr) {
        arr.push({
            "順序": idx + 1,
            "數值": cur,
            "基準": last,
            "變化率": rate,
            "心率": hr !== null ? hr : "無",
            "狀態": status
        });
    }

    // 平均心率浮層與快捷鍵

    // 為有平均心率的群組建立顯示浮層。
    // 依快取的群組位置建立平均心率浮層；忽略沒有可計算平均值的群組。
    function showAverages() {
        // 建立前先清除上一次的顯示。
        hideAverages();

        groupDataCache.forEach((groupData, idx) => {
            if (!groupData.avgHR) return; // 沒有資料就不顯示

            // 取得群組在可視視窗中的位置。
            const rect = groupData.element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return; // 如果元素目前不可見則跳過

            // 加入捲動位移，換算為頁面中的群組中心。
            const centerX = rect.left + window.scrollX + (rect.width / 2);
            const centerY = rect.top + window.scrollY + (rect.height / 2);

            // 建立平均心率的顯示節點。
            const overlay = document.createElement('div');
            overlay.className = 'ecg-avg-overlay';
            overlay.textContent = `Avg: ${groupData.avgHR} bpm`;

            // 設定浮層的位置、顏色與文字樣式。
            Object.assign(overlay.style, {
                position: 'absolute',
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
