// ==UserScript==
// @name         RootiCare ECG 變動率自動標註器
// @namespace    https://editoreu.rooticare.com/
// @version      1.0
// @description  計算 ( 前心律間隔 - 當前心律間隔 ) / 當前心律間隔，若結果 >= 0.12 則標紅
// @author       Alex
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare ECG 變動率自動標註器-1.0.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare ECG 變動率自動標註器-1.0.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ================= 配置區塊 =================
    const ENABLE_LOG = true; // 是否輸出控制台表格
    const ENABLE_GRADIENT = true; // 是否開啟漸層模式 (true: 越快越紅, false: 達標即全紅)
    const DEBOUNCE_TIME = 100; // 防抖延遲 (ms)
    const MAX_VAL_FILTER = 10000; // 數值過濾上限 (ms)
    const HIT_THRESHOLD = 0.12; // 觸發門檻 (12%)
    const TARGET_COLOR = "#FF0000"; // 目標顏色 (符合條件時的基準色)
    const BASE_COLOR = "#000000"; // 預設顏色 (未達標時)
    const TRIGGER_KEY = "`"; // 觸發按鍵
    // ============================================

    // 全域變數，用來暫存每組的平均心率與對應的 DOM 節點，方便鍵盤事件觸發時快速定位
    let groupDataCache = [];

    function processECGData() {
        const groups = document.querySelectorAll('.annoGroup');
        groupDataCache = []; // 清空快取

        groups.forEach((group, groupIdx) => {
            const textElements = Array.from(group.querySelectorAll('text.annoDuration'));
            let lastValidValue = null;
            let logData = [];
            let heartRates = []; // 用來儲存此組所有有效的心率值

            // 過濾小於設定上限的元素
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

                // 擷取 tspan 內的心率值
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

            // 計算平均心率
            let avgHR = null;
            if (heartRates.length > 0) {
                const sum = heartRates.reduce((acc, val) => acc + val, 0);
                avgHR = (sum / heartRates.length).toFixed(2);
            }

            // 將結果快取起來，供鍵盤事件顯示
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
     * 樣式更新：處理 SVG fill 與字體加粗
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
     * 將 Hex 轉為 RGBA 方便做透明度漸層
     */
    function hexToRGBA(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

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

    // ================= 平均值浮層控制區塊 =================

    // 顯示所有群組的平均值浮層
    function showAverages() {
        // 先移除可能殘留的浮層
        hideAverages();

        groupDataCache.forEach((groupData, idx) => {
            if (!groupData.avgHR) return; // 沒有資料就不顯示

            // 取得群組相對於視窗的位置
            const rect = groupData.element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return; // 如果元素目前不可見則跳過

            // 計算中心點（加上目前視窗滾動的距離）
            const centerX = rect.left + window.scrollX + (rect.width / 2);
            const centerY = rect.top + window.scrollY + (rect.height / 2);

            // 建立浮層 DOM
            const overlay = document.createElement('div');
            overlay.className = 'ecg-avg-overlay';
            overlay.textContent = `Avg: ${groupData.avgHR} bpm`;

            // 設置浮層樣式 (可依喜好自行調整配色)
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

    // 隱藏/刪除所有浮層
    function hideAverages() {
        const overlays = document.querySelectorAll('.ecg-avg-overlay');
        overlays.forEach(el => el.remove());
    }

    // 鍵盤事件監聽 (防重複觸發機制)
    let isKeyPressed = false;

    window.addEventListener('keydown', (e) => {
        if (e.key === TRIGGER_KEY && !isKeyPressed) {
            // 如果是在輸入框之類的元素內按下，則忽略
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

    // ====================================================

    let timeout;
    const observer = new MutationObserver(() => {
        clearTimeout(timeout);
        timeout = setTimeout(processECGData, DEBOUNCE_TIME);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(processECGData, 2000);
})();