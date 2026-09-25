// ==UserScript==
// @name         RootiCare 標籤彩色化
// @namespace    https://editoreu.rooticare.com/
// @version      1.0
// @description  將對應的標籤更換顏色
// @author       Alex
// @match        https://editor.rooticare.com/rooti-care/*
// @match        https://editoreu.rooticare.com/rooti-care/*
// @homepageURL  https://github.com/NineKey1028/userscripts/tree/main/scripts/rooticare
// @supportURL   https://github.com/NineKey1028/userscripts/issues
// @updateURL    https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標籤彩色化.user.js
// @downloadURL  https://raw.githubusercontent.com/NineKey1028/userscripts/main/scripts/rooticare/RootiCare%20標籤彩色化.user.js
// 
// 
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 個人化顏色設定：修改對應常數即可快速更換標籤顏色。
    const COLOR_V = "#DC3545"; // V 標籤目標顏色
    const COLOR_S = "#007BFF"; // S 標籤目標顏色
    const COLOR_N = "#28A745"; // N 標籤目標顏色

    // ======= 功能與程度設定 =======
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

    function removeFooter() {
        // 使用多重類別選擇器定位該 div
        const footer = document.querySelector('.rooti-care-footer.ng-scope.footer');
        if (footer) {
            footer.remove();
        }
    }

    function applyColoredMarkers() {
        // 排除掉 script, style 以及剛剛我們要刪除的 footer，避免重複撈取增進效能
        const elements = document.querySelectorAll('*:not(script):not(style):not(.rooti-care-footer)');

        elements.forEach(el => {
            if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                const text = el.textContent.trim();

                if (colorMap[text]) {
                    const targetColor = colorMap[text];

                    // 1. 顏色處理
                    if (config.enableColor) {
                        el.style.setProperty('color', targetColor, 'important');
                        el.style.setProperty('fill', targetColor, 'important');
                    } else {
                        el.style.removeProperty('color');
                        el.style.removeProperty('fill');
                    }

                    // 2. 粗體程度處理
                    if (config.enableBold) {
                        // 使用 config 中設定的權重值
                        el.style.setProperty('font-weight', config.fontWeight, 'important');
                    } else {
                        el.style.removeProperty('font-weight');
                    }
                }
            }
        });
    }

    // 主執行流程：將刪除 footer 的動作與原本的標色功能綁在一起
    function runAllTasks() {
        removeFooter();
        applyColoredMarkers();
    }

    // 監控與執行邏輯
    const observer = new MutationObserver(() => runAllTasks());
    observer.observe(document.body, { childList: true, subtree: true });

    // 網頁載入時先執行一次
    runAllTasks();

    // 每 2 秒定期檢查一次（應付某些非同步載入的極端狀況）
    setInterval(runAllTasks, 2000);

})();
