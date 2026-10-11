// ==UserScript==
// @name         RootiCare 標籤彩色化
// @namespace    https://editoreu.rooticare.com/
// @version      1.0
// @description  自動將 V / S / N 文字套用自訂顏色與可選粗體，並移除網站頁尾。
// @author       Alex
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標籤彩色化.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標籤彩色化.user.js
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @grant        none
// ==/UserScript==

// 使用教學：啟用腳本後，開啟 RootiCare 編輯器，V / S / N 文字會自動套用顏色。
// 預設顏色：V 紅色、S 藍色、N 綠色；可修改 COLOR_V / COLOR_S / COLOR_N。
// config.enableColor：控制上色；config.enableBold 與 fontWeight：控制粗體及字重。
// 頁面內容變動時會重新套用樣式，並自動移除網站頁尾。

(function() {
    'use strict';

    // 個人化顏色設定：修改對應常數即可快速更換標籤顏色。
    const COLOR_V = "#DC3545"; // V 標籤目標顏色
    const COLOR_S = "#007BFF"; // S 標籤目標顏色
    const COLOR_N = "#28A745"; // N 標籤目標顏色

    // 上色與字重設定
    const config = {
        enableColor: true, // 是否開啟顏色標籤
        enableBold: false, // 是否開啟粗體功能
        fontWeight: '900', // 粗體程度：可填 'bold' 或數值 '100'~'900' (900 最粗)
    };

    // 定義顏色映射表
    const colorMap = {
        'V': COLOR_V,
        'S': COLOR_S,
        'N': COLOR_N,
    };

    // 移除符合完整類別的網站頁尾；稍後重新出現時由下一次更新再次處理。
    function removeFooter() {
        // 以頁尾的完整類別組合定位待移除元素。
        const footer = document.querySelector('.rooti-care-footer.ng-scope.footer');
        if (footer) {
            footer.remove();
        }
    }

    // 只處理僅含單一文字節點且全文為 V / S / N 的元素，避免連帶替長句或父容器上色。
    // 同時設定 HTML color 與 SVG fill；粗體開關獨立於顏色，關閉時移除對應行內樣式。
    function applyColoredMarkers() {
        // 略過程式、樣式與頁尾節點，只處理可顯示的文字元素。
        const elements = document.querySelectorAll('*:not(script):not(style):not(.rooti-care-footer)');

        elements.forEach(el => {
            if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                const text = el.textContent.trim();

                if (colorMap[text]) {
                    const targetColor = colorMap[text];

                    // 依設定套用或移除文字與 SVG 顏色。
                    if (config.enableColor) {
                        el.style.setProperty('color', targetColor, 'important');
                        el.style.setProperty('fill', targetColor, 'important');
                    } else {
                        el.style.removeProperty('color');
                        el.style.removeProperty('fill');
                    }

                    // 依設定套用或移除字重。
                    if (config.enableBold) {
                        // 採用設定的 fontWeight。
                        el.style.setProperty('font-weight', config.fontWeight, 'important');
                    } else {
                        el.style.removeProperty('font-weight');
                    }
                }
            }
        });
    }

    // 每次更新先移除頁尾，再套用標籤樣式。
    // 統一入口，讓初次載入、DOM 更新及定期補掃採用相同的頁尾清理與標色順序。
    function runAllTasks() {
        removeFooter();
        applyColoredMarkers();
    }

    // 監看 DOM 變動並重新套用樣式。
    // DOM 子節點增刪時重新上色；不監看腳本自己寫入的 style，避免樣式更新再觸發自身。
    const observer = new MutationObserver(() => runAllTasks());
    observer.observe(document.body, { childList: true, subtree: true });

    // 初始化時立即處理目前畫面。
    runAllTasks();

    // 每 2 秒補掃一次，處理非同步出現的內容。
    setInterval(runAllTasks, 2000);

})();
