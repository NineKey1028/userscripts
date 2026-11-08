// ==UserScript==
// @name         RootiCare 標籤彩色化
// @namespace    https://editoreu.rooticare.com/
// @version      1.1
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

    // 只在值或 !important 不同時寫入，避免重複寫入 style 屬性觸發其他腳本的 DOM 監看。
    function setStyle(el, name, value) {
        if (el.style.getPropertyValue(name) !== value || el.style.getPropertyPriority(name) !== 'important') {
            el.style.setProperty(name, value, 'important');
        }
    }
    function clearStyle(el, name) {
        if (el.style.getPropertyValue(name)) el.style.removeProperty(name);
    }

    // 只處理僅含單一文字節點且全文為 V / S / N 的元素，避免連帶替長句或父容器上色。
    // 同時設定 HTML color 與 SVG fill；粗體開關獨立於顏色，關閉時移除對應行內樣式。
    function styleElement(el) {
        if (!el || el.childNodes.length !== 1 || el.firstChild.nodeType !== Node.TEXT_NODE) return;
        if (el.matches('script, style, .rooti-care-footer')) return;
        const targetColor = colorMap[el.textContent.trim()];
        if (!targetColor) return;

        // 依設定套用或移除文字與 SVG 顏色。
        if (config.enableColor) {
            setStyle(el, 'color', targetColor);
            setStyle(el, 'fill', targetColor);
        } else {
            clearStyle(el, 'color');
            clearStyle(el, 'fill');
        }

        // 依設定套用或移除字重。
        if (config.enableBold) setStyle(el, 'font-weight', config.fontWeight);
        else clearStyle(el, 'font-weight');
    }

    // 只走訪文字節點（比逐一檢查所有元素快很多，波形 SVG 的 path 不含文字），處理其父元素。
    function applyColoredMarkers(root = document.body) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) { styleElement(root.parentElement); return; }
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            // V / S / N 去除空白後只有 1 個字，長文字直接略過。
            if (node.data.length <= 8) styleElement(node.parentElement);
        }
    }

    // 每次更新先移除頁尾，再套用標籤樣式。
    // 統一入口，讓初次載入、DOM 更新及定期補掃採用相同的頁尾清理與標色順序。
    function runAllTasks() {
        removeFooter();
        applyColoredMarkers();
    }

    // 監看 DOM 變動，只重新處理新增或文字改變的節點；同一畫面內的多次變動合併成一次處理。
    // 不監看腳本自己寫入的 style，避免樣式更新再觸發自身。
    const pendingRoots = new Set();
    let pendingFrame = 0;
    function flushPending() {
        pendingFrame = 0;
        removeFooter();
        for (const root of pendingRoots) {
            if (root.isConnected) applyColoredMarkers(root);
        }
        pendingRoots.clear();
    }
    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'characterData') pendingRoots.add(record.target);
            else for (const node of record.addedNodes) pendingRoots.add(node);
        }
        if (pendingRoots.size && !pendingFrame) pendingFrame = requestAnimationFrame(flushPending);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // 初始化時立即處理目前畫面。
    runAllTasks();

    // 每 5 秒補掃一次，處理漏掉的內容；只寫入有變動的樣式，不會觸發其他腳本重算。
    setInterval(runAllTasks, 5000);

})();
