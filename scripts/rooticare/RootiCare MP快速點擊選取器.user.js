// ==UserScript==
// @name         RootiCare MP快速點擊選取器
// @namespace    https://editoreu.rooticare.com/
// @version      1.1
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

                // 先行判定如果等一下真的觸發滑動，應該是「全選」還是「全消」
                const hasSelectedClass = ecgItem.querySelector('.selectedBackground');
                isSelectingMode = !hasSelectedClass;
            }
        });

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
                    const startItem = document.elementFromPoint(startX, startY)?.closest('.ecg-trend');
                    if (startItem) {
                        triggerClick(startItem, e.ctrlKey);
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
                const hasSelectedClass = ecgItem.querySelector('.selectedBackground');

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
            visitedElements.clear();
        }

        // 5. 滑鼠放開 (全域監聽)
        window.addEventListener('mouseup', resetState);
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
