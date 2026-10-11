// ==UserScript==
// @name         RootiCare MP快速點擊選取器
// @namespace    https://editoreu.rooticare.com/
// @version      1.2
// @description  在 MP 右側清單按住左鍵滑過 ECG 縮圖，連續選取或取消選取；支援 Ctrl 多選及 Alt 原生拖曳。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20MP快速點擊選取器.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20MP快速點擊選取器.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

// 使用教學：在 MP 右側 ECG 縮圖清單，按住滑鼠左鍵並滑過多張縮圖。
// 從未選取的縮圖開始：沿途選取；從已選取的縮圖開始：沿途取消選取。
// 移動超過 3 像素才進入滑動多選；同一次拖曳中，每張縮圖只處理一次。
// Ctrl 可配合網頁原生多選；按住 Alt 時保留原生拖曳操作。
// 一般單擊仍使用網頁原生行為；拖曳結束後會攔截多餘的點擊，避免反轉選取結果。

(function() {
    'use strict';

    let isMouseDown = false;
    let isDraggingMode = false; // 是否真正進入「滑動多選」狀態
    let isSelectingMode = true; // true = 滑過時選中, false = 取消選中
    const visitedElements = new Set();

    // 記錄滑鼠按下的起點座標，用來計算位移
    let startX = 0;
    let startY = 0;
    let startItem = null;
    let pendingClickContainer = null;
    let pendingClickTimer = null;
    const DRAG_THRESHOLD = 3; // 滑動超過 3 像素才判定為拖曳多選，否則視為單擊

    // 以文件層事件代理支援稍後載入的縮圖；按下時記錄起點，超過位移門檻才進入拖曳選取。
    function init() {

        // 攔截目標清單的原生拖曳；Alt 操作交由網站處理。
        document.addEventListener('dragstart', (e) => {
            if (e.altKey) return;
            // 只有在 .right-content 範圍內才攔截
            if (e.target.closest('.right-content')) {
                e.preventDefault();
                return false;
            }
        }, true);

        // 記錄拖曳起點與預定的選取模式。
        document.addEventListener('mousedown', (e) => {
            clearPendingClick();
            if (e.altKey) return;
            if (e.button !== 0) return; // 只處理左鍵

            // 動態檢查是否在目標容器內點擊了 ECG 項目
            const container = e.target.closest('.right-content');
            if (!container) return;

            const ecgItem = e.target.closest('.ecg-trend');
            if (ecgItem) {
                isMouseDown = true;
                isDraggingMode = false;
                visitedElements.clear();

                // 記錄起點
                startX = e.clientX;
                startY = e.clientY;
                startItem = ecgItem;

                // 以起點原本的選取狀態決定沿途要選取或取消。
                isSelectingMode = !isItemSelected(ecgItem);
            }
        }, true);

        // 移動超過門檻後啟動滑動多選。
        document.addEventListener('mousemove', (e) => {
            if (e.altKey) {
                if (isMouseDown) resetState();
                return;
            }
            if (!isMouseDown) return;

            // 如果還沒進入滑動模式，計算移動距離
            if (!isDraggingMode) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // 超過閾值，正式進入滑動多選模式
                if (distance > DRAG_THRESHOLD) {
                    isDraggingMode = true;

                    // 啟動拖曳後，先讓起點縮圖達到預定狀態。
                    if (startItem) {
                        // 原生 mousedown/click 可能已先改變起點狀態；只在尚未達到拖曳目標時補點擊。
                        const selected = isItemSelected(startItem);
                        if (selected !== isSelectingMode) {
                            triggerClick(startItem, e.ctrlKey);
                        }
                        visitedElements.add(startItem);
                    }
                }
            }
        });

        // 透過事件代理處理滑入的縮圖。
        document.addEventListener('mouseover', (e) => {
            if (e.altKey || !isMouseDown || !isDraggingMode) return;

            // 動態確保滑過的元素是在目標容器內
            if (!e.target.closest('.right-content')) return;

            const ecgItem = e.target.closest('.ecg-trend');

            if (ecgItem && !visitedElements.has(ecgItem)) {
                const hasSelectedClass = isItemSelected(ecgItem);

                // 依據進入滑動時的模式，決定是否對新滑入的圖進行點擊
                if ((isSelectingMode && !hasSelectedClass) || (!isSelectingMode && hasSelectedClass)) {
                    triggerClick(ecgItem, e.ctrlKey);
                }

                visitedElements.add(ecgItem);
            }
        });

        // 重置狀態的函式
        // 清除拖曳狀態與本次已處理的縮圖集合，避免下一次操作沿用舊起點。
        function resetState() {
            isMouseDown = false;
            isDraggingMode = false;
            startItem = null;
            visitedElements.clear();
        }

        // 移除等待攔截的原生點擊與逾時計時器，避免影響下一次正常單擊。
        function clearPendingClick() {
            clearTimeout(pendingClickTimer);
            pendingClickTimer = null;
            pendingClickContainer = null;
        }

        // 拖曳結束後仍可能觸發原生 click；因縮圖已處理，
        // 須攔截這次點擊，避免 Ctrl 拖曳後選取狀態被反轉。
        window.addEventListener('mouseup', (e) => {
            if (e.button !== 0) return;
            if (isDraggingMode) {
                pendingClickContainer = startItem?.closest('.right-content');
                // 沒有產生 click 時自動清除；下一次按下也會立即清除。
                pendingClickTimer = setTimeout(clearPendingClick, 500);
            }
            resetState();
        }, true);

        window.addEventListener('click', (e) => {
            // 腳本合成的 click 必須正常交給網站處理。
            if (!e.isTrusted || e.button !== 0 || !pendingClickContainer) return;
            const shouldSuppress = pendingClickContainer.contains(e.target);
            clearPendingClick();
            if (shouldSuppress) {
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }, true);

        window.addEventListener('blur', () => {
            resetState();
            clearPendingClick();
        });
    }

    // 依網站的 selectedBackground 判斷目前選取結果，不另外維護可能與頁面不同步的清單。
    function isItemSelected(element) {
        return Boolean(element?.querySelector('.selectedBackground'));
    }

    // 模擬點擊，並將當前的 ctrlKey 狀態帶入
    // 發送左鍵 click 事件並帶入當下 Ctrl 狀態，沿用網站選取流程。
    function triggerClick(element, ctrlKey = false) {
        if (!element) return;
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            ctrlKey: ctrlKey
        });
        element.dispatchEvent(clickEvent);
    }

    // 事件代理可處理後續載入的縮圖，因此立即註冊監聽器。
    init();
})();
