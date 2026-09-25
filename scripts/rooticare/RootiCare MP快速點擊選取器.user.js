// ==UserScript==
// @name         RootiCare MP快速點擊選取器
// @namespace    https://editoreu.rooticare.com/
// @version      1.2
// @description  在 .right-content 內按住滑鼠左鍵滑過，可快速選中或取消選中 ECG 圖片，並停用原本的拖拽效果
// @author       Alex
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20MP快速點擊選取器.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20MP快速點擊選取器.user.js
// 
// 
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isMouseDown = false;
    let isDraggingMode = false; // 是否真正進入「滑動多選」狀態
    let isSelectingMode = true; // true = 滑過時選中, false = 取消選中
    const visitedElements = new Set();

    // 紀錄滑鼠按下的起點座標，用來計算位移
    let startX = 0;
    let startY = 0;
    let startItem = null;
    let pendingClickContainer = null;
    let pendingClickTimer = null;
    const DRAG_THRESHOLD = 3; // 滑動超過 3 像素才判定為拖曳多選，否則視為單擊

    function init() {

        // 1. 強制禁止原生拖拽陰影 (改為全域動態判斷)
        document.addEventListener('dragstart', (e) => {
            if (e.altKey) return;
            // 只有在 .right-content 範圍內才攔截
            if (e.target.closest('.right-content')) {
                e.preventDefault();
                return false;
            }
        }, true);

        // 2. 滑鼠按下
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

                // 紀錄起點
                startX = e.clientX;
                startY = e.clientY;
                startItem = ecgItem;

                // 先行判定如果等一下真的觸發滑動，應該是「全選」還是「全消」
                isSelectingMode = !isItemSelected(ecgItem);
            }
        }, true);

        // 3. 滑鼠移動
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

                    // 既然進入了滑動模式，就要把起點的那張圖先納入計算
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

        // 4. 滑鼠滑過其他元素 (事件代理)
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
        function resetState() {
            isMouseDown = false;
            isDraggingMode = false;
            startItem = null;
            visitedElements.clear();
        }

        function clearPendingClick() {
            clearTimeout(pendingClickTimer);
            pendingClickTimer = null;
            pendingClickContainer = null;
        }

        // 5. mouseup 之後仍會產生原生 click。拖曳已經模擬點擊過，
        // 必須攔住這次 click，否則 Ctrl 在同一格內滑動會把狀態切回去。
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

    function isItemSelected(element) {
        return Boolean(element?.querySelector('.selectedBackground'));
    }

    // 模擬點擊，並將當前的 ctrlKey 狀態帶入
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

    // 因為改用事件代理，不需要等待 DOM 渲染，可以直接初始化
    init();
})();
